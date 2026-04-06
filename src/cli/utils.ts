import { Orbit, OrbitError } from '../index.js'
import type { NetworkName } from '../index.js'
import chalk from 'chalk'

export async function connectOrbit(network: string): Promise<Orbit> {
    return Orbit.connect({
        network: network as NetworkName,
    })
}

export function formatError(err: unknown): string {
    if (err instanceof OrbitError) {
        let msg = err.message
        if (err.suggestion) {
            msg += '\n  ' + chalk.yellow('Hint: ') + err.suggestion
        }
        return msg
    }
    if (err instanceof Error) return err.message
    return String(err)
}
