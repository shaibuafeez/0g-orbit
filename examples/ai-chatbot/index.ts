/**
 * 0G Orbit — AI Chatbot Example
 *
 * A simple interactive chatbot using 0G Compute Network.
 * Demonstrates multi-turn conversations with TEE verification.
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx tsx index.ts
 */

import { Orbit } from '@0g-orbit/core'
import { createInterface } from 'node:readline'

const MODEL = 'meta-llama/Llama-3.3-70B'

async function main() {
    const orbit = await Orbit.connect({
        network: 'testnet',
        privateKey: process.env.PRIVATE_KEY!,
    })

    const status = await orbit.status()
    console.log(`Connected: ${status.address} (${status.balance} OG)`)
    console.log(`Model: ${MODEL}`)
    console.log('Type "quit" to exit.\n')

    const history: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        {
            role: 'system',
            content: 'You are a helpful AI assistant running on 0G decentralized compute. Be concise.',
        },
    ]

    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
    })

    const ask = (prompt: string): Promise<string> =>
        new Promise((resolve) => rl.question(prompt, resolve))

    while (true) {
        const input = await ask('You: ')
        if (input.toLowerCase() === 'quit') break
        if (!input.trim()) continue

        history.push({ role: 'user', content: input })

        try {
            const result = await orbit.infer(MODEL, {
                messages: history,
                temperature: 0.7,
                maxTokens: 1024,
            })

            history.push({ role: 'assistant', content: result.content })

            console.log(`\nAssistant: ${result.content}`)

            const meta: string[] = []
            if (result.usage) meta.push(`${result.usage.totalTokens} tokens`)
            if (result.verified === true) meta.push('TEE verified')
            if (meta.length) console.log(`  (${meta.join(' | ')})`)
            console.log()
        } catch (err) {
            console.error(`Error: ${err instanceof Error ? err.message : err}\n`)
        }
    }

    rl.close()
    console.log('Goodbye!')
}

main().catch(console.error)
