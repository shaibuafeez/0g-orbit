export interface RetryOptions {
    /** Maximum number of attempts (default: 3) */
    maxAttempts?: number
    /** Base delay between retries in ms (default: 1000). Doubles each retry. */
    baseDelay?: number
    /** Maximum delay cap in ms (default: 10000) */
    maxDelay?: number
    /** Predicate to decide if an error is retryable (default: transient errors only) */
    isRetryable?: (err: unknown) => boolean
    /** Called before each retry with attempt number and error */
    onRetry?: (attempt: number, err: unknown) => void
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10_000,
    isRetryable: isTransientError,
}

/**
 * Retry an async operation with exponential backoff.
 * Only retries on transient errors (network, timeout, 5xx) by default.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    let lastError: unknown

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
        try {
            return await fn()
        } catch (err) {
            lastError = err

            if (attempt === opts.maxAttempts || !opts.isRetryable(err)) {
                throw err
            }

            if (options.onRetry) {
                options.onRetry(attempt, err)
            }

            // Exponential backoff with jitter
            const delay = Math.min(
                opts.baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500,
                opts.maxDelay
            )
            await sleep(delay)
        }
    }

    throw lastError
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Determines if an error is transient and worth retrying.
 * Covers: network failures, timeouts, RPC errors, 5xx responses.
 */
export function isTransientError(err: unknown): boolean {
    if (!(err instanceof Error)) return false
    const msg = err.message.toLowerCase()

    // Network-level failures
    if (msg.includes('econnrefused')) return true
    if (msg.includes('econnreset')) return true
    if (msg.includes('etimedout')) return true
    if (msg.includes('enotfound')) return true
    if (msg.includes('epipe')) return true
    if (msg.includes('fetch failed')) return true
    if (msg.includes('network error')) return true

    // Timeout
    if (msg.includes('timeout')) return true
    if (err.name === 'AbortError') return true

    // RPC-level transient errors
    if (msg.includes('server error')) return true
    if (msg.includes('bad gateway')) return true
    if (msg.includes('service unavailable')) return true
    if (msg.includes('rate limit')) return true
    if (msg.includes('429')) return true
    if (msg.includes('502')) return true
    if (msg.includes('503')) return true
    if (msg.includes('504')) return true

    // ethers provider errors
    if (msg.includes('missing response')) return true
    if (msg.includes('connection error')) return true
    if (msg.includes('could not detect network')) return true

    return false
}
