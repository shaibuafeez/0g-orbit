import type { NetworkName } from './networks.js'

export interface OrbitConfig {
    /** Private key for signing transactions. Falls back to PRIVATE_KEY env var if omitted. */
    privateKey?: string
    /** Network to connect to */
    network: NetworkName
    /** Custom RPC URL (overrides network default) */
    rpcUrl?: string
    /** Custom indexer URL (overrides network default) */
    indexerUrl?: string
}

export interface StoreResult {
    /** Merkle root hash — use this to retrieve the file */
    root: string
    /** On-chain transaction hash */
    txHash: string
}

export interface StoreOptions {
    /** Custom tags for the upload (hex string) */
    tags?: string
    /** Expected number of replicas */
    replicas?: number
    /** Maximum gas price in wei */
    maxGasPrice?: bigint
}

export interface RetrieveOptions {
    /** Whether to verify merkle proofs during download */
    proof?: boolean
}

export interface InferResult {
    /** The model's response text */
    content: string
    /** The model used */
    model: string
    /** Token usage */
    usage?: {
        promptTokens: number
        completionTokens: number
        totalTokens: number
    }
    /** Whether the response passed TEE verification (null if not verifiable) */
    verified: boolean | null
}

export interface InferOptions {
    /** Messages for chat completion */
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
    /** Temperature for sampling (0-2) */
    temperature?: number
    /** Maximum tokens to generate */
    maxTokens?: number
    /** Specific provider address (auto-selected if omitted) */
    provider?: string
    /** Request timeout in milliseconds (default: 30000) */
    timeout?: number
}

export interface ServiceInfo {
    /** Provider wallet address */
    provider: string
    /** Model name */
    model: string
    /** Service endpoint URL */
    url: string
    /** Input token price (neuron) */
    inputPrice: bigint
    /** Output token price (neuron) */
    outputPrice: bigint
    /** Whether TEE verification is available */
    verifiable: boolean
}

export interface AccountStatus {
    /** Main ledger balance in OG */
    balance: string
    /** Network name */
    network: NetworkName
    /** Wallet address */
    address: string
}
