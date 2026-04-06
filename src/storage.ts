import { Indexer, ZgFile } from '@0gfoundation/0g-ts-sdk'
import type { Signer } from 'ethers'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import type { NetworkConfig } from './networks.js'
import type { StoreResult, StoreOptions, RetrieveOptions } from './types.js'
import { StorageError } from './errors.js'
import { withRetry, isTransientError } from './retry.js'

const DEFAULT_REPLICAS = 1
const DEFAULT_MAX_GAS_PRICE = 25_000_000_000 // 25 gwei — generous ceiling for auto-escalation

export class StorageClient {
    private indexer: Indexer
    private rpcUrl: string
    private signer: Signer

    constructor(network: NetworkConfig, signer: Signer) {
        this.indexer = new Indexer(network.indexerUrl)
        this.rpcUrl = network.rpcUrl
        this.signer = signer
    }

    /**
     * Upload a file to 0G Storage by file path.
     * Retries transient failures automatically. Gas escalates on each retry.
     */
    async store(filePath: string, options: StoreOptions = {}): Promise<StoreResult> {
        return withRetry(
            () => this._store(filePath, options),
            {
                maxAttempts: 3,
                isRetryable: (err) => {
                    if (!(err instanceof StorageError)) return isTransientError(err)
                    const msg = err.message.toLowerCase()
                    return msg.includes('gas') ||
                        msg.includes('timeout') ||
                        msg.includes('etimedout') ||
                        msg.includes('econnrefused') ||
                        msg.includes('underpriced')
                },
            }
        )
    }

    /**
     * Upload raw data (string, Buffer, or Uint8Array) to 0G Storage.
     * Writes to a temp file, uploads, then cleans up.
     */
    async storeData(
        data: string | Buffer | Uint8Array,
        options: StoreOptions = {}
    ): Promise<StoreResult> {
        const tempPath = join(tmpdir(), `orbit-${randomBytes(8).toString('hex')}`)
        try {
            writeFileSync(tempPath, data)
            return await this.store(tempPath, options)
        } finally {
            try { unlinkSync(tempPath) } catch { /* ignore cleanup errors */ }
        }
    }

    private async _store(filePath: string, options: StoreOptions): Promise<StoreResult> {
        const file = await ZgFile.fromFilePath(filePath)
        try {
            const [tree, treeErr] = await file.merkleTree()
            if (treeErr || !tree) {
                throw new StorageError(
                    `Failed to compute merkle tree: ${treeErr?.message ?? 'unknown error'}`,
                    'Ensure the file exists, is readable, and is not empty.'
                )
            }

            // Skip upload if this exact file is already on storage nodes.
            // Re-uploading finalized data creates a conflicting tx that breaks retrieval.
            const rootHash = tree.rootHash()
            if (rootHash) {
                try {
                    const locations = await this.indexer.getFileLocations(rootHash)
                    if (locations && locations.length > 0) {
                        return { root: rootHash, txHash: '' }
                    }
                } catch {
                    // Location check failed — proceed with upload
                }
            }

            // Always enable gas auto-escalation via the SDK's built-in retry.
            // MaxGasPrice sets the ceiling — the SDK starts from the network estimate
            // and bumps 10% on each retry until it hits this cap.
            const maxGas = options.maxGasPrice
                ? Number(options.maxGasPrice)
                : DEFAULT_MAX_GAS_PRICE

            // Cast signer to avoid ESM/CJS ethers type mismatch
            const [result, uploadErr] = await this.indexer.upload(
                file,
                this.rpcUrl,
                this.signer as any,
                {
                    tags: options.tags ?? '0x',
                    expectedReplica: options.replicas ?? DEFAULT_REPLICAS,
                },
                { Retries: 5, Interval: 3, MaxGasPrice: maxGas }
            )

            if (uploadErr) {
                const msg = uploadErr.message
                let suggestion = 'Check your OG balance and try again.'
                if (msg.includes('insufficient funds') || msg.includes('INSUFFICIENT_FUNDS')) {
                    suggestion = 'Your wallet needs more OG for gas. Get testnet OG from: https://faucet.0g.ai'
                } else if (msg.includes('underpriced') || msg.includes('gas required exceeds')) {
                    suggestion = `Gas auto-escalation hit the ceiling (${maxGas} wei). Try a higher maxGasPrice, e.g. { maxGasPrice: ${maxGas * 2}n }`
                } else if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
                    suggestion = 'The RPC endpoint timed out. Try a different RPC URL with the rpcUrl option.'
                }
                throw new StorageError(`Upload failed: ${msg}`, suggestion)
            }

            if ('txHash' in result) {
                return {
                    root: result.rootHash,
                    txHash: result.txHash,
                }
            }

            // Fragmented upload — return the first root hash as primary handle
            return {
                root: result.rootHashes[0],
                txHash: result.txHashes[0],
            }
        } finally {
            await file.close()
        }
    }

    /**
     * Download a file from 0G Storage by root hash.
     */
    async retrieve(
        rootHash: string,
        outputPath: string,
        options: RetrieveOptions = {}
    ): Promise<void> {
        return withRetry(
            () => this._retrieve(rootHash, outputPath, options),
            { maxAttempts: 3 }
        )
    }

    private async _retrieve(
        rootHash: string,
        outputPath: string,
        options: RetrieveOptions
    ): Promise<void> {
        let err: Error | null
        try {
            err = await this.indexer.download(
                rootHash,
                outputPath,
                options.proof ?? false
            )
        } catch (e: any) {
            // Catch crashes from SDK internals (e.g. null getFileLocations)
            const msg = e?.message ?? String(e)
            throw new StorageError(
                `Download failed: ${msg}`,
                'The file may not be fully replicated yet. Wait a moment and retry, or verify the root hash.'
            )
        }
        if (err) {
            const msg = err.message
            let suggestion = 'Verify the root hash is correct and the file was uploaded successfully.'
            if (msg.includes('not found') || msg.includes('404')) {
                suggestion = 'This root hash was not found on the network. Double-check the hash or ensure the upload completed.'
            }
            throw new StorageError(`Download failed: ${msg}`, suggestion)
        }
    }
}
