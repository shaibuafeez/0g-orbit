import { Wallet } from 'ethers'
import {
    createZGComputeNetworkBroker,
    type ZGComputeNetworkBroker,
} from '@0glabs/0g-serving-broker'
import type { NetworkConfig } from './networks.js'
import type {
    DatasetUploadResult,
    CreateTaskOptions,
    FineTuneTask,
    FineTuneModel,
    FineTuneProvider,
    FineTuneStatus,
} from './types.js'
import { FineTuningError } from './errors.js'
import { withRetry } from './retry.js'
import { StorageClient } from './storage.js'

const DEFAULT_TRAINING_PARAMS = {
    nEpochs: 3,
    batchSize: 4,
    learningRate: 5e-5,
    loraRank: 8,
    loraAlpha: 16,
}

export class FineTuningClient {
    private broker: ZGComputeNetworkBroker | null = null
    private initialized = false
    private wallet: Wallet
    private network: NetworkConfig
    private storageClient: StorageClient

    constructor(network: NetworkConfig, wallet: Wallet, storageClient: StorageClient) {
        this.network = network
        this.wallet = wallet
        this.storageClient = storageClient
    }

    private async ensureBroker(): Promise<ZGComputeNetworkBroker> {
        if (this.broker && this.initialized) return this.broker

        try {
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
            throw new FineTuningError(
                `Failed to initialize fine-tuning broker: ${msg}`,
                'Check your network connection and wallet private key. The compute contracts may be temporarily unavailable.'
            )
        }
    }

    // --- Dataset ---

    /**
     * Upload a dataset to 0G Storage for fine-tuning.
     * Uses the existing StorageClient for upload, returning the root hash
     * needed to create a fine-tuning task.
     */
    async uploadDataset(filePath: string): Promise<DatasetUploadResult> {
        return withRetry(
            async () => {
                try {
                    const result = await this.storageClient.store(filePath)
                    return {
                        root: result.root,
                        txHash: result.txHash,
                    }
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err)
                    throw new FineTuningError(
                        `Failed to upload dataset: ${msg}`,
                        'Check that the dataset file exists, is valid JSONL, and you have sufficient OG balance.'
                    )
                }
            },
            { maxAttempts: 3 }
        )
    }

    // --- Tasks ---

    /**
     * Create a fine-tuning task. Requires a dataset already uploaded to 0G Storage.
     */
    async createTask(options: CreateTaskOptions): Promise<FineTuneTask> {
        const broker = await this.ensureBroker()

        if (!broker.fineTuning) {
            throw new FineTuningError(
                'Fine-tuning broker not available.',
                'Fine-tuning requires a Wallet signer (not JsonRpcSigner).'
            )
        }

        const params = { ...DEFAULT_TRAINING_PARAMS, ...options.trainingParams }

        return withRetry(
            async () => {
                try {
                    // Acknowledge the provider signer (required before task creation)
                    await broker.fineTuning!.acknowledgeProviderSigner(
                        options.providerAddress
                    )

                    // Write training params as JSON string (broker expects a file path,
                    // but the underlying createTask reads the file content — we'll pass
                    // the JSON string directly via a temp file approach)
                    const { writeFileSync, unlinkSync } = await import('node:fs')
                    const { tmpdir } = await import('node:os')
                    const { join } = await import('node:path')
                    const { randomBytes } = await import('node:crypto')

                    const tempPath = join(tmpdir(), `orbit-params-${randomBytes(8).toString('hex')}.json`)
                    writeFileSync(tempPath, JSON.stringify(params))

                    let taskId: string
                    try {
                        taskId = await broker.fineTuning!.createTask(
                            options.providerAddress,
                            options.model,
                            options.dataset,
                            tempPath
                        )
                    } finally {
                        try { unlinkSync(tempPath) } catch { /* ignore cleanup errors */ }
                    }

                    return {
                        id: taskId,
                        model: options.model,
                        dataset: options.dataset,
                        provider: options.providerAddress,
                        status: 'init' as FineTuneStatus,
                    }
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err)
                    if (msg.includes('User opted not to continue')) {
                        throw new FineTuningError(msg, 'The provider has pending tasks in queue. Try again later or use a different provider.')
                    }
                    throw new FineTuningError(
                        `Failed to create task: ${msg}`,
                        'Verify the model name, dataset hash, and provider address. Run orbit.listModels() to see available options.'
                    )
                }
            },
            { maxAttempts: 2 }
        )
    }

    /**
     * Get the status of a fine-tuning task.
     */
    async getTask(providerAddress: string, taskId: string): Promise<FineTuneTask> {
        const broker = await this.ensureBroker()

        if (!broker.fineTuning) {
            throw new FineTuningError('Fine-tuning broker not available.')
        }

        try {
            const task = await broker.fineTuning.getTask(providerAddress, taskId)
            return this.mapTask(task, providerAddress)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            if (msg.includes('No task found') || msg.includes('not found')) {
                throw new FineTuningError(
                    `Task "${taskId}" not found for provider ${providerAddress}.`,
                    'Check the task ID and provider address. Run orbit.listTasks() to see your tasks.'
                )
            }
            throw new FineTuningError(`Failed to get task: ${msg}`)
        }
    }

    /**
     * Get the training log for a fine-tuning task.
     */
    async getTaskLog(providerAddress: string, taskId: string): Promise<string> {
        const broker = await this.ensureBroker()

        if (!broker.fineTuning) {
            throw new FineTuningError('Fine-tuning broker not available.')
        }

        try {
            return await broker.fineTuning.getLog(providerAddress, taskId)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            throw new FineTuningError(`Failed to get task log: ${msg}`)
        }
    }

    /**
     * List all fine-tuning tasks for a given provider.
     */
    async listTasks(providerAddress: string): Promise<FineTuneTask[]> {
        const broker = await this.ensureBroker()

        if (!broker.fineTuning) {
            throw new FineTuningError('Fine-tuning broker not available.')
        }

        try {
            const tasks = await broker.fineTuning.listTask(providerAddress)
            return tasks.map((t) => this.mapTask(t, providerAddress))
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            throw new FineTuningError(`Failed to list tasks: ${msg}`)
        }
    }

    // --- Models ---

    /**
     * Download a fine-tuned model. Combines acknowledge + download.
     * The task must be in 'delivered' status.
     */
    async downloadModel(
        providerAddress: string,
        taskId: string,
        outputPath: string
    ): Promise<void> {
        const broker = await this.ensureBroker()

        if (!broker.fineTuning) {
            throw new FineTuningError('Fine-tuning broker not available.')
        }

        return withRetry(
            async () => {
                try {
                    await broker.fineTuning!.acknowledgeModel(
                        providerAddress,
                        taskId,
                        outputPath
                    )
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err)
                    if (msg.includes('No deliverable found')) {
                        throw new FineTuningError(
                            `Model not ready for task "${taskId}". The task may still be training.`,
                            'Check task status with orbit.getFineTuneTask(). The task must be in "delivered" status.'
                        )
                    }
                    throw new FineTuningError(
                        `Failed to download model: ${msg}`,
                        'Ensure the task is in "delivered" status and the output path is writable.'
                    )
                }
            },
            { maxAttempts: 2 }
        )
    }

    /**
     * List available base models for fine-tuning.
     */
    async listModels(): Promise<FineTuneModel[]> {
        const broker = await this.ensureBroker()

        if (!broker.fineTuning) {
            throw new FineTuningError('Fine-tuning broker not available.')
        }

        try {
            const [standardModels, customizedModels] = await broker.fineTuning.listModel()

            const models: FineTuneModel[] = []

            for (const [name, config] of standardModels) {
                models.push({ name, config })
            }

            for (const [name, config] of customizedModels) {
                models.push({ name, config })
            }

            return models
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            throw new FineTuningError(`Failed to list models: ${msg}`)
        }
    }

    /**
     * List fine-tuning service providers.
     */
    async listProviders(): Promise<FineTuneProvider[]> {
        const broker = await this.ensureBroker()

        if (!broker.fineTuning) {
            throw new FineTuningError('Fine-tuning broker not available.')
        }

        try {
            const services = await broker.fineTuning.listService()
            return services.map((s: any) => ({
                address: s.provider ?? '',
                url: s.url ?? '',
                models: s.models ?? [],
            }))
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            throw new FineTuningError(`Failed to list providers: ${msg}`)
        }
    }

    // --- Helpers ---

    private mapTask(task: any, providerAddress: string): FineTuneTask {
        return {
            id: task.id ?? '',
            model: task.preTrainedModelHash ?? '',
            dataset: task.datasetHash ?? '',
            provider: providerAddress,
            status: (task.progress?.toLowerCase() ?? 'init') as FineTuneStatus,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
        }
    }
}
