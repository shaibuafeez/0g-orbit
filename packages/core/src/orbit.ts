import { Wallet, JsonRpcProvider } from 'ethers'
import type { NetworkName, NetworkConfig } from './networks.js'
import { getNetwork, NETWORKS } from './networks.js'
import { StorageClient } from './storage.js'
import { InferenceClient } from './inference.js'
import type {
    OrbitConfig,
    StoreResult,
    StoreOptions,
    RetrieveOptions,
    InferResult,
    InferOptions,
    ServiceInfo,
    AccountStatus,
} from './types.js'
import { ConnectionError } from './errors.js'

export class Orbit {
    readonly network: NetworkConfig
    readonly storage: StorageClient
    readonly inference: InferenceClient
    private wallet: Wallet
    private provider: JsonRpcProvider

    private constructor(
        network: NetworkConfig,
        wallet: Wallet,
        provider: JsonRpcProvider
    ) {
        this.network = network
        this.wallet = wallet
        this.provider = provider
        this.storage = new StorageClient(network, wallet)
        this.inference = new InferenceClient(network, wallet)
    }

    /**
     * Connect to the 0G network. This is the primary entry point.
     *
     * Tries the primary RPC URL first, then falls back to alternates.
     * If privateKey is not provided, reads from PRIVATE_KEY env var.
     */
    static async connect(config: OrbitConfig): Promise<Orbit> {
        // Resolve private key: explicit > env var
        const privateKey = config.privateKey ?? process.env.PRIVATE_KEY
        if (!privateKey) {
            throw new ConnectionError(
                'No private key provided.',
                'Pass privateKey in config or set the PRIVATE_KEY environment variable. Example: PRIVATE_KEY=0x... npx tsx index.ts'
            )
        }

        const networkConfig = getNetwork(config.network)

        // Allow overrides
        if (config.rpcUrl) networkConfig.rpcUrl = config.rpcUrl
        if (config.indexerUrl) networkConfig.indexerUrl = config.indexerUrl

        // Build candidate RPC URLs: explicit override first, then the fallback list
        const rpcUrls = config.rpcUrl
            ? [config.rpcUrl]
            : networkConfig.rpcUrls

        // Try each RPC URL until one connects
        let lastError: Error | null = null
        for (const url of rpcUrls) {
            try {
                const provider = new JsonRpcProvider(url)
                const wallet = new Wallet(privateKey, provider)

                const chainId = (await provider.getNetwork()).chainId
                if (chainId !== networkConfig.chainId) {
                    throw new ConnectionError(
                        `Chain ID mismatch: expected ${networkConfig.chainId}, got ${chainId}`,
                        `Your RPC endpoint is on a different network. Use the correct RPC URL for ${networkConfig.name}.`
                    )
                }

                // Lock in the working URL
                networkConfig.rpcUrl = url

                // Check balance and warn if zero (non-blocking)
                try {
                    const balance = await provider.getBalance(wallet.address)
                    if (balance === 0n) {
                        console.warn(
                            `[0G Orbit] Warning: wallet ${wallet.address} has 0 OG balance on ${networkConfig.name}. ` +
                            `Get testnet tokens at https://faucet.0g.ai`
                        )
                    }
                } catch {
                    // Balance check failure is non-fatal
                }

                return new Orbit(networkConfig, wallet, provider)
            } catch (err) {
                // Chain ID mismatch is not a transient failure — don't try other URLs
                if (err instanceof ConnectionError && err.message.includes('Chain ID mismatch')) {
                    throw err
                }
                lastError = err instanceof Error ? err : new Error(String(err))
            }
        }

        const tried = rpcUrls.join(', ')
        throw new ConnectionError(
            `Failed to connect to any RPC endpoint. Tried: ${tried}. Last error: ${lastError?.message ?? 'unknown'}`,
            'All RPC endpoints are unreachable. Check your internet connection, or provide a custom RPC URL with the rpcUrl option.'
        )
    }

    // --- Storage shortcuts ---

    async store(filePath: string, options?: StoreOptions): Promise<StoreResult> {
        return this.storage.store(filePath, options)
    }

    async storeData(
        data: string | Buffer | Uint8Array,
        options?: StoreOptions
    ): Promise<StoreResult> {
        return this.storage.storeData(data, options)
    }

    async retrieve(
        rootHash: string,
        outputPath: string,
        options?: RetrieveOptions
    ): Promise<void> {
        return this.storage.retrieve(rootHash, outputPath, options)
    }

    // --- Inference shortcuts ---

    async infer(model: string, options: InferOptions): Promise<InferResult> {
        return this.inference.infer(model, options)
    }

    async listServices(): Promise<ServiceInfo[]> {
        return this.inference.listServices()
    }

    // --- Account ---

    async status(): Promise<AccountStatus> {
        const balance = await this.provider.getBalance(this.wallet.address)
        const balanceOG = Number(balance) / 1e18

        return {
            balance: balanceOG.toFixed(6),
            network: this.network.name,
            address: this.wallet.address,
        }
    }

    get address(): string {
        return this.wallet.address
    }
}
