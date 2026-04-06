/**
 * 0G Orbit — Model Registry Example
 *
 * Store AI model weights on 0G Storage and maintain
 * a registry of model versions with their root hashes.
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx index.ts
 */

import { Orbit } from '@0g-orbit/core'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'

const REGISTRY_FILE = './registry.json'

interface ModelEntry {
    name: string
    version: string
    rootHash: string
    txHash: string
    uploadedAt: string
    sizeBytes?: number
}

interface Registry {
    models: ModelEntry[]
}

function loadRegistry(): Registry {
    if (existsSync(REGISTRY_FILE)) {
        return JSON.parse(readFileSync(REGISTRY_FILE, 'utf-8'))
    }
    return { models: [] }
}

function saveRegistry(registry: Registry) {
    writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2) + '\n')
}

async function registerModel(
    orbit: Orbit,
    name: string,
    version: string,
    filePath: string
) {
    console.log(`\nUploading ${name} v${version}...`)
    const { root, txHash } = await orbit.store(filePath)

    const registry = loadRegistry()
    registry.models.push({
        name,
        version,
        rootHash: root,
        txHash,
        uploadedAt: new Date().toISOString(),
    })
    saveRegistry(registry)

    console.log(`Registered: ${name} v${version}`)
    console.log(`  Root:  ${root}`)
    console.log(`  Tx:    ${txHash}`)
    return root
}

async function downloadModel(
    orbit: Orbit,
    name: string,
    version: string,
    outputPath: string
) {
    const registry = loadRegistry()
    const entry = registry.models.find(
        (m) => m.name === name && m.version === version
    )

    if (!entry) {
        console.error(`Model ${name} v${version} not found in registry.`)
        return
    }

    console.log(`\nDownloading ${name} v${version}...`)
    await orbit.retrieve(entry.rootHash, outputPath)
    console.log(`Downloaded to ${outputPath}`)
}

function listModels() {
    const registry = loadRegistry()
    if (registry.models.length === 0) {
        console.log('No models registered.')
        return
    }

    console.log('\nRegistered models:')
    for (const m of registry.models) {
        console.log(`  ${m.name} v${m.version}`)
        console.log(`    root: ${m.rootHash}`)
        console.log(`    date: ${m.uploadedAt}`)
    }
}

async function main() {
    const orbit = await Orbit.connect({
        network: 'testnet',
        privateKey: process.env.PRIVATE_KEY!,
    })

    const status = await orbit.status()
    console.log(`Connected: ${status.address} (${status.balance} OG)`)

    const command = process.argv[2] || 'list'

    switch (command) {
        case 'register': {
            const [, , , name, version, filePath] = process.argv
            if (!name || !version || !filePath) {
                console.error('Usage: npx tsx index.ts register <name> <version> <file>')
                process.exit(1)
            }
            await registerModel(orbit, name, version, filePath)
            break
        }
        case 'download': {
            const [, , , name, version, outputPath] = process.argv
            if (!name || !version || !outputPath) {
                console.error('Usage: npx tsx index.ts download <name> <version> <output>')
                process.exit(1)
            }
            await downloadModel(orbit, name, version, outputPath)
            break
        }
        case 'list':
        default:
            listModels()
    }
}

main().catch(console.error)
