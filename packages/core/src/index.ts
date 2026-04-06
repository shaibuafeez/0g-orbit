// Main entry point
export { Orbit } from './orbit.js'

// Clients (for direct access)
export { StorageClient } from './storage.js'
export { InferenceClient } from './inference.js'

// Types
export type {
    OrbitConfig,
    StoreResult,
    StoreOptions,
    RetrieveOptions,
    InferResult,
    InferOptions,
    ServiceInfo,
    AccountStatus,
} from './types.js'

// Network config
export type { NetworkName, NetworkConfig } from './networks.js'
export { NETWORKS, getNetwork } from './networks.js'

// Retry utilities
export { withRetry, isTransientError } from './retry.js'
export type { RetryOptions } from './retry.js'

// Errors
export {
    OrbitError,
    ConnectionError,
    StorageError,
    InferenceError,
    InsufficientBalanceError,
    ProviderNotFoundError,
    TimeoutError,
} from './errors.js'
