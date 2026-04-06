import { describe, it, expect, vi } from 'vitest'
import { withRetry, isTransientError } from './retry.js'

describe('withRetry', () => {
    it('returns on first success', async () => {
        const fn = vi.fn().mockResolvedValue('ok')
        const result = await withRetry(fn)
        expect(result).toBe('ok')
        expect(fn).toHaveBeenCalledTimes(1)
    })

    it('retries on transient error and succeeds', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('ECONNREFUSED'))
            .mockResolvedValue('ok')

        const result = await withRetry(fn, { baseDelay: 10 })
        expect(result).toBe('ok')
        expect(fn).toHaveBeenCalledTimes(2)
    })

    it('throws after maxAttempts exhausted', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('ETIMEDOUT'))

        await expect(
            withRetry(fn, { maxAttempts: 3, baseDelay: 10 })
        ).rejects.toThrow('ETIMEDOUT')
        expect(fn).toHaveBeenCalledTimes(3)
    })

    it('does not retry non-transient errors', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('Invalid private key'))

        await expect(
            withRetry(fn, { maxAttempts: 3, baseDelay: 10 })
        ).rejects.toThrow('Invalid private key')
        expect(fn).toHaveBeenCalledTimes(1)
    })

    it('calls onRetry callback', async () => {
        const onRetry = vi.fn()
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('ECONNRESET'))
            .mockResolvedValue('ok')

        await withRetry(fn, { baseDelay: 10, onRetry })
        expect(onRetry).toHaveBeenCalledTimes(1)
        expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error))
    })

    it('respects custom isRetryable predicate', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('custom-retryable'))
            .mockResolvedValue('ok')

        const result = await withRetry(fn, {
            baseDelay: 10,
            isRetryable: (err) => err instanceof Error && err.message === 'custom-retryable',
        })
        expect(result).toBe('ok')
        expect(fn).toHaveBeenCalledTimes(2)
    })
})

describe('isTransientError', () => {
    it.each([
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'fetch failed',
        'network error',
        'timeout exceeded',
        'server error',
        'bad gateway',
        'service unavailable',
        'rate limit exceeded',
        'missing response',
        'connection error',
        'could not detect network',
    ])('returns true for "%s"', (msg) => {
        expect(isTransientError(new Error(msg))).toBe(true)
    })

    it.each([
        'Invalid private key',
        'insufficient funds for gas',
        'File not found',
        'unknown error',
    ])('returns false for "%s"', (msg) => {
        expect(isTransientError(new Error(msg))).toBe(false)
    })

    it('returns false for non-Error values', () => {
        expect(isTransientError('string error')).toBe(false)
        expect(isTransientError(null)).toBe(false)
        expect(isTransientError(42)).toBe(false)
    })
})
