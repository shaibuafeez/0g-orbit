export class OrbitError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly suggestion?: string
    ) {
        super(message)
        this.name = 'OrbitError'
    }
}

export class ConnectionError extends OrbitError {
    constructor(message: string, suggestion?: string) {
        super(
            message,
            'CONNECTION_ERROR',
            suggestion ?? 'Check your RPC URL and network connection. Try a different RPC endpoint with the rpcUrl option.'
        )
        this.name = 'ConnectionError'
    }
}

export class StorageError extends OrbitError {
    constructor(message: string, suggestion?: string) {
        super(
            message,
            'STORAGE_ERROR',
            suggestion ?? 'Check that your file exists and you have sufficient OG balance for gas fees.'
        )
        this.name = 'StorageError'
    }
}

export class InferenceError extends OrbitError {
    constructor(message: string, suggestion?: string) {
        super(
            message,
            'INFERENCE_ERROR',
            suggestion ?? 'Run orbit.listServices() to check available models and provider status.'
        )
        this.name = 'InferenceError'
    }
}

export class InsufficientBalanceError extends OrbitError {
    constructor(
        public readonly required: number,
        public readonly available: number
    ) {
        super(
            `Insufficient balance: need ${required} OG but have ${available} OG`,
            'INSUFFICIENT_BALANCE',
            'Get testnet OG from the faucet: https://faucet.0g.ai'
        )
        this.name = 'InsufficientBalanceError'
    }
}

export class ProviderNotFoundError extends OrbitError {
    constructor(message: string) {
        super(
            message,
            'PROVIDER_NOT_FOUND',
            'Run orbit.listServices() to see available models and their providers.'
        )
        this.name = 'ProviderNotFoundError'
    }
}

export class TimeoutError extends OrbitError {
    constructor(message: string) {
        super(
            message,
            'TIMEOUT',
            'The request timed out. Try increasing the timeout option or check if the provider is responsive.'
        )
        this.name = 'TimeoutError'
    }
}

export class FineTuningError extends OrbitError {
    constructor(message: string, suggestion?: string) {
        super(
            message,
            'FINE_TUNING_ERROR',
            suggestion ?? 'Check model and provider availability with orbit.listModels() or orbit.listProviders().'
        )
        this.name = 'FineTuningError'
    }
}
