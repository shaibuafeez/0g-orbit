/**
 * 0G Orbit — Quick Start
 *
 * Demonstrates the three core operations:
 * 1. Check account status
 * 2. Store a file to 0G Storage
 * 3. Run AI inference on 0G Compute
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx index.ts
 */

import { Orbit } from '@0g-orbit/core'
import { writeFileSync, unlinkSync } from 'node:fs'

async function main() {
    // Connect
    const orbit = await Orbit.connect({
        network: 'testnet',
        privateKey: process.env.PRIVATE_KEY!,
    })

    // 1. Account status
    const status = await orbit.status()
    console.log(`Connected: ${status.address}`)
    console.log(`Balance:   ${status.balance} OG on ${status.network}`)

    // 2. Store a file
    const testFile = '/tmp/orbit-test.txt'
    writeFileSync(testFile, 'Hello from 0G Orbit!')

    console.log('\nUploading file...')
    const { root, txHash } = await orbit.store(testFile)
    console.log(`Stored! Root: ${root}`)
    console.log(`Tx:     ${txHash}`)

    unlinkSync(testFile)

    // 3. Retrieve it back
    const outputFile = '/tmp/orbit-test-downloaded.txt'
    console.log('\nDownloading...')
    await orbit.retrieve(root, outputFile)
    console.log(`Downloaded to ${outputFile}`)

    // 4. AI inference
    console.log('\nRunning inference...')
    const result = await orbit.infer('meta-llama/Llama-3.3-70B', {
        messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'Explain what 0G is in one sentence.' },
        ],
        temperature: 0.7,
    })

    console.log(`\nResponse: ${result.content}`)
    console.log(`Model:    ${result.model}`)
    if (result.usage) {
        console.log(`Tokens:   ${result.usage.totalTokens}`)
    }
    if (result.verified !== null) {
        console.log(`Verified: ${result.verified}`)
    }
}

main().catch(console.error)
