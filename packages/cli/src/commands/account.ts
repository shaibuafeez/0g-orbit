import ora from 'ora'
import chalk from 'chalk'
import { connectOrbit, formatError } from '../utils.js'

interface StatusOpts {
    network: string
}

export async function statusCommand(opts: StatusOpts) {
    const spinner = ora('Checking status...').start()

    try {
        const orbit = await connectOrbit(opts.network)
        const status = await orbit.status()

        spinner.stop()

        console.log()
        console.log(chalk.bold('  0G Orbit'))
        console.log(`  ${chalk.dim('Network:')}  ${status.network}`)
        console.log(`  ${chalk.dim('Address:')}  ${status.address}`)
        console.log(`  ${chalk.dim('Balance:')}  ${chalk.cyan(status.balance)} OG`)
        console.log()
    } catch (err) {
        spinner.fail(chalk.red('Failed to get status'))
        console.error(chalk.dim(`  ${formatError(err)}`))
        process.exit(1)
    }
}
