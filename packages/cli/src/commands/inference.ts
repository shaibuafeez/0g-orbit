import ora from 'ora'
import chalk from 'chalk'
import { connectOrbit, formatError } from '../utils.js'

interface InferOpts {
    network: string
    message?: string
    system?: string
    temperature: string
    maxTokens?: string
    provider?: string
}

export async function inferCommand(model: string, opts: InferOpts) {
    if (!opts.message) {
        console.error(chalk.red('Error: --message is required'))
        console.error(chalk.dim('  orbit infer meta-llama/Llama-3.3-70B -m "Hello!"'))
        process.exit(1)
    }

    const spinner = ora('Connecting to 0G...').start()

    try {
        const orbit = await connectOrbit(opts.network)
        spinner.text = `Sending to ${model}...`

        const messages: Array<{ role: 'system' | 'user'; content: string }> = []
        if (opts.system) {
            messages.push({ role: 'system', content: opts.system })
        }
        messages.push({ role: 'user', content: opts.message })

        const result = await orbit.infer(model, {
            messages,
            temperature: parseFloat(opts.temperature),
            maxTokens: opts.maxTokens ? parseInt(opts.maxTokens, 10) : undefined,
            provider: opts.provider,
        })

        spinner.succeed('Response received')
        console.log()
        console.log(result.content)
        console.log()

        if (result.usage) {
            console.log(
                chalk.dim(
                    `  tokens: ${result.usage.promptTokens} in / ${result.usage.completionTokens} out` +
                        ` | model: ${result.model}` +
                        (result.verified !== null
                            ? ` | verified: ${result.verified ? chalk.green('yes') : chalk.red('no')}`
                            : '')
                )
            )
        }
    } catch (err) {
        spinner.fail(chalk.red('Inference failed'))
        console.error(chalk.dim(`  ${formatError(err)}`))
        process.exit(1)
    }
}

interface ServicesOpts {
    network: string
}

export async function listServicesCommand(opts: ServicesOpts) {
    const spinner = ora('Fetching services...').start()

    try {
        const orbit = await connectOrbit(opts.network)
        const services = await orbit.listServices()

        spinner.stop()

        if (services.length === 0) {
            console.log(chalk.dim('No services found on this network.'))
            return
        }

        console.log(chalk.bold(`\n  ${services.length} services on ${opts.network}\n`))

        for (const svc of services) {
            const verTag = svc.verifiable
                ? chalk.green(' [TEE]')
                : ''
            console.log(
                `  ${chalk.cyan(svc.model)}${verTag}`
            )
            console.log(
                chalk.dim(
                    `    provider: ${svc.provider.slice(0, 10)}...${svc.provider.slice(-6)}` +
                        `  |  in: ${svc.inputPrice} neuron  |  out: ${svc.outputPrice} neuron`
                )
            )
        }
        console.log()
    } catch (err) {
        spinner.fail(chalk.red('Failed to list services'))
        console.error(chalk.dim(`  ${formatError(err)}`))
        process.exit(1)
    }
}
