import { Wallet } from 'ethers'
import {
    createZGComputeNetworkBroker,
    type ZGComputeNetworkBroker,
} from '@0glabs/0g-serving-broker'
import type { NetworkConfig } from './networks.js'
import type { InferResult, InferOptions, ServiceInfo } from './types.js'
import { InferenceError, ProviderNotFoundError, TimeoutError } from './errors.js'
import { withRetry } from './retry.js'

const DEFAULT_LEDGER_DEPOSIT = 0.1 // 0.1 OG initial deposit
const AUTO_FUND_INTERVAL = 30_000 // 30 seconds
const DEFAULT_TIMEOUT = 30_000 // 30 seconds

interface ChatCompletionResponse {
    id?: string
    model?: string
    choices?: Array<{ message?: { content?: string } }>
    usage?: {
        prompt_tokens?: number
        completion_tokens?: number
        total_tokens?: number
    }
}

export class InferenceClient {
    private broker: ZGComputeNetworkBroker | null = null
    private wallet: Wallet
    private network: NetworkConfig
    private initialized = false

    constructor(network: NetworkConfig, wallet: Wallet) {
        this.network = network
        this.wallet = wallet
    }

    private async ensureBroker(): Promise<ZGComputeNetworkBroker> {
        if (this.broker && this.initialized) return this.broker

        try {
            // Cast wallet to avoid ESM/CJS ethers type mismatch
            this.broker = await createZGComputeNetworkBroker(
                this.wallet as any,
                this.network.ledgerContractAddress,
                this.network.inferenceContractAddress,
                this.network.fineTuningContractAddress
            )
            this.initialized = true
            return this.broker
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            throw new InferenceError(
                `Failed to initialize compute broker: ${msg}`,
                'Check your network connection and wallet private key. The compute contracts may be temporarily unavailable.'
            )
        }
    }

    async listServices(): Promise<ServiceInfo[]> {
        const broker = await this.ensureBroker()
        return withRetry(
            async () => {
                try {
                    const services = await broker.inference.listService()
                    return services.map((s: any) => ({
                        provider: s.provider ?? s.address ?? '',
                        model: s.model ?? '',
                        url: s.url ?? '',
                        inputPrice: BigInt(s.inputPrice ?? 0),
                        outputPrice: BigInt(s.outputPrice ?? 0),
                        verifiable: Boolean(s.verifiability ?? s.verifiable),
                    }))
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err)
                    throw new InferenceError(
                        `Failed to list services: ${msg}`,
                        'The inference contract may be temporarily unavailable. Check your network connection.'
                    )
                }
            },
            { maxAttempts: 3 }
        )
    }

    async infer(
        model: string,
        options: InferOptions
    ): Promise<InferResult> {
        const broker = await this.ensureBroker()

        // Find a provider for the requested model
        const providerAddress = options.provider ?? await this.findProvider(model)
        const timeout = options.timeout ?? DEFAULT_TIMEOUT

        try {
            // Ensure ledger exists and has funds
            await this.ensureLedgerFunded(broker)

            // Start auto-funding for this provider
            await broker.inference.startAutoFunding(providerAddress, {
                interval: AUTO_FUND_INTERVAL,
            })

            // Get service metadata (endpoint + model name)
            const { endpoint, model: providerModel } =
                await broker.inference.getServiceMetadata(providerAddress)

            // Build the request content for billing calculation
            const content = options.messages.map((m) => m.content).join('\n')

            // Get authenticated headers
            const headers = await broker.inference.getRequestHeaders(
                providerAddress,
                content
            )

            // Make the OpenAI-compatible request with timeout + retry
            const data = await withRetry(
                () => this.fetchCompletion(endpoint, providerModel, options, headers, timeout),
                {
                    maxAttempts: 2,
                    baseDelay: 2000,
                    isRetryable: (err) => {
                        // Don't retry timeouts (user already waited long enough)
                        if (err instanceof TimeoutError) return false
                        // Retry transient provider errors
                        if (err instanceof InferenceError) {
                            const msg = err.message
                            return msg.includes('502') || msg.includes('503') || msg.includes('504')
                        }
                        return false
                    },
                }
            )

            // Extract chatID for TEE verification
            const chatID = data._chatID

            // Process response (caches fees + verifies TEE signature)
            let verified: boolean | null = null
            try {
                verified = await broker.inference.processResponse(
                    providerAddress,
                    chatID,
                    data.usage ? JSON.stringify(data.usage) : undefined
                )
            } catch {
                // Verification failure is non-fatal
                verified = null
            }

            // Stop auto-funding
            broker.inference.stopAutoFunding(providerAddress)

            return {
                content: data.choices?.[0]?.message?.content ?? '',
                model: data.model ?? providerModel,
                usage: data.usage
                    ? {
                          promptTokens: data.usage.prompt_tokens ?? 0,
                          completionTokens: data.usage.completion_tokens ?? 0,
                          totalTokens: data.usage.total_tokens ?? 0,
                      }
                    : undefined,
                verified,
            }
        } catch (err) {
            // Clean up auto-funding on error
            broker.inference.stopAutoFunding(providerAddress)

            if (err instanceof InferenceError || err instanceof TimeoutError || err instanceof ProviderNotFoundError) throw err
            const msg = err instanceof Error ? err.message : String(err)
            throw new InferenceError(`Inference failed: ${msg}`)
        }
    }

    private async fetchCompletion(
        endpoint: string,
        providerModel: string,
        options: InferOptions,
        headers: Record<string, string> | object,
        timeout: number
    ): Promise<ChatCompletionResponse & { _chatID?: string }> {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeout)

        let response: Response
        try {
            response = await fetch(`${endpoint}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
                body: JSON.stringify({
                    model: providerModel,
                    messages: options.messages,
                    temperature: options.temperature,
                    max_tokens: options.maxTokens,
                }),
                signal: controller.signal,
            })
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                throw new TimeoutError(
                    `Inference request timed out after ${timeout / 1000}s.`
                )
            }
            throw err
        } finally {
            clearTimeout(timer)
        }

        if (!response.ok) {
            const body = await response.text().catch(() => '')
            throw new InferenceError(
                `Provider returned ${response.status}: ${body}`,
                response.status === 429
                    ? 'Provider is rate-limited. Wait a moment and retry, or try a different provider.'
                    : response.status >= 500
                      ? 'The provider is experiencing issues. Try a different provider with the provider option.'
                      : 'Check the model name and request parameters.'
            )
        }

        const data = (await response.json()) as ChatCompletionResponse
        const chatID = response.headers.get('ZG-Res-Key') ?? data.id ?? undefined

        return { ...data, _chatID: chatID }
    }

    private async findProvider(model: string): Promise<string> {
        const services = await this.listServices()
        const match = services.find(
            (s) => s.model.toLowerCase() === model.toLowerCase()
        )
        if (!match) {
            const available = [...new Set(services.map((s) => s.model))].join(', ') || 'none'
            throw new ProviderNotFoundError(
                `No provider found for model "${model}". Available models: ${available}`
            )
        }
        return match.provider
    }

    private async ensureLedgerFunded(
        broker: ZGComputeNetworkBroker
    ): Promise<void> {
        try {
            await broker.ledger.getLedger()
        } catch {
            // Ledger doesn't exist yet — create it with initial deposit
            await broker.ledger.addLedger(DEFAULT_LEDGER_DEPOSIT)
        }
    }
}
