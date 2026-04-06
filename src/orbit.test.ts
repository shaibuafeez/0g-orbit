import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConnectionError } from './errors.js'

// Mock ethers before importing Orbit
vi.mock('ethers', () => {
    const mockProvider = {
        getNetwork: vi.fn().mockResolvedValue({ chainId: 16602n }),
        getBalance: vi.fn().mockResolvedValue(1000000000000000000n), // 1 OG
    }
    const MockJsonRpcProvider = vi.fn(() => mockProvider)
    const MockWallet = vi.fn((key: string, provider: any) => ({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        provider,
    }))
    return {
        JsonRpcProvider: MockJsonRpcProvider,
        Wallet: MockWallet,
    }
})

// Mock the storage and inference clients
vi.mock('./storage.js', () => ({
    StorageClient: vi.fn(),
}))
vi.mock('./inference.js', () => ({
    InferenceClient: vi.fn(),
}))

import { Orbit } from './orbit.js'
import { JsonRpcProvider } from 'ethers'

describe('Orbit.connect', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        delete process.env.PRIVATE_KEY
    })

    it('connects with explicit private key', async () => {
        const orbit = await Orbit.connect({
            network: 'testnet',
            privateKey: '0xabc123',
        })
        expect(orbit.address).toBe('0x1234567890abcdef1234567890abcdef12345678')
        expect(orbit.network.name).toBe('testnet')
    })

    it('reads PRIVATE_KEY from env var', async () => {
        process.env.PRIVATE_KEY = '0xenv_key_123'
        const orbit = await Orbit.connect({ network: 'testnet' })
        expect(orbit.address).toBeDefined()
    })

    it('throws with suggestion when no private key available', async () => {
        await expect(
            Orbit.connect({ network: 'testnet' })
        ).rejects.toThrow('No private key provided')

        try {
            await Orbit.connect({ network: 'testnet' })
        } catch (err) {
            expect(err).toBeInstanceOf(ConnectionError)
            expect((err as ConnectionError).suggestion).toContain('PRIVATE_KEY')
        }
    })

    it('throws on chain ID mismatch', async () => {
        const { JsonRpcProvider } = await import('ethers')
        const mockProvider = new JsonRpcProvider() as any
        mockProvider.getNetwork.mockResolvedValueOnce({ chainId: 99999n })

        await expect(
            Orbit.connect({ network: 'testnet', privateKey: '0xabc' })
        ).rejects.toThrow('Chain ID mismatch')
    })

    it('warns on zero balance but still connects', async () => {
        const { JsonRpcProvider } = await import('ethers')
        const mockProvider = new JsonRpcProvider() as any
        mockProvider.getNetwork.mockResolvedValueOnce({ chainId: 16602n })
        mockProvider.getBalance.mockResolvedValueOnce(0n)

        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

        const orbit = await Orbit.connect({
            network: 'testnet',
            privateKey: '0xabc',
        })

        expect(orbit).toBeDefined()
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('0 OG balance')
        )
        warnSpy.mockRestore()
    })

    it('tries fallback RPC URLs on connection failure', async () => {
        const { JsonRpcProvider } = await import('ethers')

        // First two URLs fail, third succeeds
        let callCount = 0
        ;(JsonRpcProvider as any).mockImplementation(() => {
            callCount++
            const provider = {
                getNetwork: callCount < 3
                    ? vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
                    : vi.fn().mockResolvedValue({ chainId: 16602n }),
                getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
            }
            return provider
        })

        const orbit = await Orbit.connect({
            network: 'testnet',
            privateKey: '0xabc',
        })
        expect(orbit).toBeDefined()
        expect(callCount).toBe(3)
    })

    it('throws when all RPC URLs fail', async () => {
        const { JsonRpcProvider } = await import('ethers')
        ;(JsonRpcProvider as any).mockImplementation(() => ({
            getNetwork: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        }))

        await expect(
            Orbit.connect({ network: 'testnet', privateKey: '0xabc' })
        ).rejects.toThrow('Failed to connect to any RPC endpoint')
    })
})

describe('Orbit.status', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Restore default mock after tests that override JsonRpcProvider
        const mockProvider = {
            getNetwork: vi.fn().mockResolvedValue({ chainId: 16602n }),
            getBalance: vi.fn().mockResolvedValue(1000000000000000000n),
        }
        ;(JsonRpcProvider as any).mockImplementation(() => mockProvider)
    })

    it('returns formatted balance and address', async () => {
        const orbit = await Orbit.connect({
            network: 'testnet',
            privateKey: '0xabc',
        })
        const status = await orbit.status()
        expect(status.network).toBe('testnet')
        expect(status.address).toBe('0x1234567890abcdef1234567890abcdef12345678')
        expect(status.balance).toMatch(/^\d+\.\d{6}$/)
    })
})
