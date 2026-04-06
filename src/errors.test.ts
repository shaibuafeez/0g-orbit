import { describe, it, expect } from 'vitest'
import {
    OrbitError,
    ConnectionError,
    StorageError,
    InferenceError,
    InsufficientBalanceError,
    ProviderNotFoundError,
    TimeoutError,
} from './errors.js'

describe('OrbitError', () => {
    it('has code and suggestion', () => {
        const err = new OrbitError('test', 'TEST_CODE', 'try this')
        expect(err.message).toBe('test')
        expect(err.code).toBe('TEST_CODE')
        expect(err.suggestion).toBe('try this')
        expect(err.name).toBe('OrbitError')
        expect(err).toBeInstanceOf(Error)
    })

    it('suggestion is optional', () => {
        const err = new OrbitError('test', 'CODE')
        expect(err.suggestion).toBeUndefined()
    })
})

describe('ConnectionError', () => {
    it('has default suggestion', () => {
        const err = new ConnectionError('failed')
        expect(err.code).toBe('CONNECTION_ERROR')
        expect(err.suggestion).toContain('RPC')
    })

    it('accepts custom suggestion', () => {
        const err = new ConnectionError('failed', 'custom hint')
        expect(err.suggestion).toBe('custom hint')
    })
})

describe('StorageError', () => {
    it('has default suggestion', () => {
        const err = new StorageError('upload broke')
        expect(err.code).toBe('STORAGE_ERROR')
        expect(err.suggestion).toContain('file exists')
    })
})

describe('InferenceError', () => {
    it('has default suggestion', () => {
        const err = new InferenceError('inference broke')
        expect(err.code).toBe('INFERENCE_ERROR')
        expect(err.suggestion).toContain('listServices')
    })
})

describe('InsufficientBalanceError', () => {
    it('includes required and available amounts', () => {
        const err = new InsufficientBalanceError(1.5, 0.1)
        expect(err.required).toBe(1.5)
        expect(err.available).toBe(0.1)
        expect(err.message).toContain('1.5')
        expect(err.message).toContain('0.1')
        expect(err.suggestion).toContain('faucet')
    })
})

describe('ProviderNotFoundError', () => {
    it('has suggestion about listServices', () => {
        const err = new ProviderNotFoundError('No provider for model "gpt-5"')
        expect(err.message).toContain('gpt-5')
        expect(err.suggestion).toContain('listServices')
    })
})

describe('TimeoutError', () => {
    it('has timeout-specific suggestion', () => {
        const err = new TimeoutError('timed out after 30s')
        expect(err.code).toBe('TIMEOUT')
        expect(err.suggestion).toContain('timeout')
    })
})

describe('error hierarchy', () => {
    it('all errors are instanceof OrbitError and Error', () => {
        const errors = [
            new ConnectionError('a'),
            new StorageError('b'),
            new InferenceError('c'),
            new InsufficientBalanceError(1, 0),
            new ProviderNotFoundError('d'),
            new TimeoutError('e'),
        ]
        for (const err of errors) {
            expect(err).toBeInstanceOf(OrbitError)
            expect(err).toBeInstanceOf(Error)
        }
    })
})
