import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Mock the 0G SDK
vi.mock('@0gfoundation/0g-ts-sdk', () => {
    const mockClose = vi.fn()
    const mockMerkleTree = vi.fn().mockResolvedValue([{ rootHash: () => '0xabc' }, null])

    return {
        ZgFile: {
            fromFilePath: vi.fn().mockResolvedValue({
                merkleTree: mockMerkleTree,
                close: mockClose,
                size: () => 100,
            }),
        },
        Indexer: vi.fn().mockImplementation(() => ({
            upload: vi.fn().mockResolvedValue([
                { txHash: '0xtx123', rootHash: '0xroot456' },
                null,
            ]),
            download: vi.fn().mockResolvedValue(null),
            getFileLocations: vi.fn().mockResolvedValue([]),
        })),
    }
})

import { StorageClient } from './storage.js'
import { StorageError } from './errors.js'
import { NETWORKS } from './networks.js'
import { Indexer, ZgFile } from '@0gfoundation/0g-ts-sdk'

const mockSigner = { address: '0x123' } as any
const testNetwork = { ...NETWORKS.testnet }

describe('StorageClient', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('store', () => {
        it('uploads a file and returns root + tx hash', async () => {
            const client = new StorageClient(testNetwork, mockSigner)
            const result = await client.store('/tmp/test.txt')
            expect(result.root).toBe('0xroot456')
            expect(result.txHash).toBe('0xtx123')
        })

        it('passes tags and replicas to upload', async () => {
            const client = new StorageClient(testNetwork, mockSigner)
            await client.store('/tmp/test.txt', { tags: '0xbeef', replicas: 3 })

            const indexerInstance = (Indexer as any).mock.results[0].value
            expect(indexerInstance.upload).toHaveBeenCalledWith(
                expect.anything(),
                testNetwork.rpcUrl,
                expect.anything(),
                expect.objectContaining({ tags: '0xbeef', expectedReplica: 3 }),
                expect.objectContaining({ Retries: 5, Interval: 3 })
            )
        })

        it('always passes gas retry options', async () => {
            const client = new StorageClient(testNetwork, mockSigner)
            await client.store('/tmp/test.txt')

            const indexerInstance = (Indexer as any).mock.results[0].value
            const retryOpts = indexerInstance.upload.mock.calls[0][4]
            expect(retryOpts).toBeDefined()
            expect(retryOpts.Retries).toBe(5)
            expect(retryOpts.MaxGasPrice).toBeGreaterThan(0)
        })

        it('throws StorageError with suggestion on merkle failure', async () => {
            const mockFile = {
                merkleTree: vi.fn().mockResolvedValue([null, new Error('corrupt file')]),
                close: vi.fn(),
            }
            ;(ZgFile.fromFilePath as any).mockResolvedValueOnce(mockFile)

            const client = new StorageClient(testNetwork, mockSigner)
            try {
                await client.store('/tmp/bad.txt')
                expect.unreachable('should have thrown')
            } catch (err) {
                expect(err).toBeInstanceOf(StorageError)
                expect((err as StorageError).suggestion).toContain('file exists')
            }
        })

        it('throws StorageError with gas suggestion on underpriced', async () => {
            const indexerMock = {
                upload: vi.fn().mockResolvedValue([
                    { txHash: '', rootHash: '' },
                    new Error('transaction underpriced'),
                ]),
                download: vi.fn(),
            }
            ;(Indexer as any).mockImplementationOnce(() => indexerMock)

            const client = new StorageClient(testNetwork, mockSigner)
            try {
                await client.store('/tmp/test.txt')
                expect.unreachable('should have thrown')
            } catch (err) {
                expect(err).toBeInstanceOf(StorageError)
                expect((err as StorageError).suggestion).toContain('maxGasPrice')
            }
        })

        it('always closes the file even on error', async () => {
            const mockClose = vi.fn()
            const mockFile = {
                merkleTree: vi.fn().mockRejectedValue(new Error('boom')),
                close: mockClose,
            }
            ;(ZgFile.fromFilePath as any).mockResolvedValueOnce(mockFile)

            const client = new StorageClient(testNetwork, mockSigner)
            await client.store('/tmp/test.txt').catch(() => {})
            expect(mockClose).toHaveBeenCalled()
        })
    })

    describe('storeData', () => {
        it('stores a string by writing to temp file', async () => {
            const client = new StorageClient(testNetwork, mockSigner)
            const result = await client.storeData('hello world')
            expect(result.root).toBe('0xroot456')
            expect(result.txHash).toBe('0xtx123')

            // Verify ZgFile.fromFilePath was called with a temp path
            const calledPath = (ZgFile.fromFilePath as any).mock.calls[0][0]
            expect(calledPath).toContain('orbit-')
        })

        it('stores a Buffer', async () => {
            const client = new StorageClient(testNetwork, mockSigner)
            const result = await client.storeData(Buffer.from('binary data'))
            expect(result.root).toBe('0xroot456')
        })

        it('stores a Uint8Array', async () => {
            const client = new StorageClient(testNetwork, mockSigner)
            const result = await client.storeData(new Uint8Array([1, 2, 3]))
            expect(result.root).toBe('0xroot456')
        })

        it('cleans up temp file after upload', async () => {
            const client = new StorageClient(testNetwork, mockSigner)
            await client.storeData('cleanup test')

            const calledPath = (ZgFile.fromFilePath as any).mock.calls[0][0]
            // Temp file should have been deleted
            expect(existsSync(calledPath)).toBe(false)
        })

        it('cleans up temp file even on error', async () => {
            const mockFile = {
                merkleTree: vi.fn().mockResolvedValue([null, new Error('fail')]),
                close: vi.fn(),
            }
            ;(ZgFile.fromFilePath as any).mockResolvedValueOnce(mockFile)

            const client = new StorageClient(testNetwork, mockSigner)
            await client.storeData('error cleanup test').catch(() => {})

            const calledPath = (ZgFile.fromFilePath as any).mock.calls[0][0]
            expect(existsSync(calledPath)).toBe(false)
        })
    })

    describe('store — dedup', () => {
        it('skips upload when file already exists on storage nodes', async () => {
            const indexerMock = {
                upload: vi.fn(),
                download: vi.fn(),
                getFileLocations: vi.fn().mockResolvedValue([{ url: 'http://node1' }]),
            }
            ;(Indexer as any).mockImplementationOnce(() => indexerMock)

            const client = new StorageClient(testNetwork, mockSigner)
            const result = await client.store('/tmp/test.txt')
            expect(result.root).toBe('0xabc') // root from merkle tree
            expect(result.txHash).toBe('')     // no tx submitted
            expect(indexerMock.upload).not.toHaveBeenCalled()
        })

        it('proceeds with upload when getFileLocations returns empty', async () => {
            const client = new StorageClient(testNetwork, mockSigner)
            const result = await client.store('/tmp/test.txt')
            expect(result.root).toBe('0xroot456')
            expect(result.txHash).toBe('0xtx123')
        })

        it('proceeds with upload when getFileLocations throws', async () => {
            const indexerMock = {
                upload: vi.fn().mockResolvedValue([
                    { txHash: '0xtx789', rootHash: '0xroot789' },
                    null,
                ]),
                download: vi.fn(),
                getFileLocations: vi.fn().mockRejectedValue(new Error('network error')),
            }
            ;(Indexer as any).mockImplementationOnce(() => indexerMock)

            const client = new StorageClient(testNetwork, mockSigner)
            const result = await client.store('/tmp/test.txt')
            expect(result.txHash).toBe('0xtx789')
            expect(indexerMock.upload).toHaveBeenCalled()
        })
    })

    describe('retrieve', () => {
        it('downloads successfully', async () => {
            const client = new StorageClient(testNetwork, mockSigner)
            await expect(
                client.retrieve('0xroot', '/tmp/output.txt')
            ).resolves.toBeUndefined()
        })

        it('throws StorageError on download failure', async () => {
            const indexerMock = {
                upload: vi.fn(),
                download: vi.fn().mockResolvedValue(new Error('file not found: 404')),
                getFileLocations: vi.fn().mockResolvedValue([]),
            }
            ;(Indexer as any).mockImplementationOnce(() => indexerMock)

            const client = new StorageClient(testNetwork, mockSigner)
            try {
                await client.retrieve('0xbad', '/tmp/out.txt')
                expect.unreachable('should have thrown')
            } catch (err) {
                expect(err).toBeInstanceOf(StorageError)
                expect((err as StorageError).suggestion).toContain('root hash')
            }
        })

        it('catches SDK null crash and throws descriptive StorageError', async () => {
            const indexerMock = {
                upload: vi.fn(),
                download: vi.fn().mockRejectedValue(
                    new TypeError("Cannot read properties of null (reading 'length')")
                ),
                getFileLocations: vi.fn().mockResolvedValue([]),
            }
            ;(Indexer as any).mockImplementationOnce(() => indexerMock)

            const client = new StorageClient(testNetwork, mockSigner)
            try {
                await client.retrieve('0xorphan', '/tmp/out.txt')
                expect.unreachable('should have thrown')
            } catch (err) {
                expect(err).toBeInstanceOf(StorageError)
                expect((err as StorageError).message).toContain('null')
                expect((err as StorageError).suggestion).toContain('replicated')
            }
        })
    })
})
