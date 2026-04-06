import { describe, it, expect } from 'vitest'
import { getNetwork, NETWORKS } from './networks.js'

describe('NETWORKS', () => {
    it('testnet has correct chain ID', () => {
        expect(NETWORKS.testnet.chainId).toBe(16602n)
    })

    it('mainnet has correct chain ID', () => {
        expect(NETWORKS.mainnet.chainId).toBe(16661n)
    })

    it('testnet has multiple fallback RPC URLs', () => {
        expect(NETWORKS.testnet.rpcUrls.length).toBeGreaterThanOrEqual(2)
        expect(NETWORKS.testnet.rpcUrls[0]).toBe(NETWORKS.testnet.rpcUrl)
    })

    it('mainnet has multiple fallback RPC URLs', () => {
        expect(NETWORKS.mainnet.rpcUrls.length).toBeGreaterThanOrEqual(2)
        expect(NETWORKS.mainnet.rpcUrls[0]).toBe(NETWORKS.mainnet.rpcUrl)
    })

    it('all contract addresses are non-empty hex strings', () => {
        for (const net of Object.values(NETWORKS)) {
            expect(net.flowContractAddress).toMatch(/^0x[0-9a-fA-F]+$/)
            expect(net.ledgerContractAddress).toMatch(/^0x[0-9a-fA-F]+$/)
            expect(net.inferenceContractAddress).toMatch(/^0x[0-9a-fA-F]+$/)
            expect(net.fineTuningContractAddress).toMatch(/^0x[0-9a-fA-F]+$/)
        }
    })
})

describe('getNetwork', () => {
    it('resolves by name', () => {
        const net = getNetwork('testnet')
        expect(net.name).toBe('testnet')
        expect(net.chainId).toBe(16602n)
    })

    it('resolves by chain ID', () => {
        const net = getNetwork(16661n)
        expect(net.name).toBe('mainnet')
    })

    it('throws on unknown name', () => {
        expect(() => getNetwork('devnet' as any)).toThrow('Unknown network')
    })

    it('throws on unknown chain ID', () => {
        expect(() => getNetwork(99999n)).toThrow('Unknown chain ID')
    })

    it('returns a copy — mutations do not affect originals', () => {
        const net = getNetwork('testnet')
        net.rpcUrl = 'https://mutated.example.com'
        net.rpcUrls.push('https://extra.example.com')

        const fresh = getNetwork('testnet')
        expect(fresh.rpcUrl).not.toBe('https://mutated.example.com')
        expect(fresh.rpcUrls).not.toContain('https://extra.example.com')
    })
})
