import ora from 'ora'
import chalk from 'chalk'
import { connectOrbit, formatError } from '../utils.js'

interface StoreOpts {
    network: string
    tags?: string
    replicas: string
}

export async function storeCommand(file: string, opts: StoreOpts) {
    const spinner = ora('Connecting to 0G...').start()

    try {
        const orbit = await connectOrbit(opts.network)
        spinner.text = `Uploading ${file}...`

        const result = await orbit.store(file, {
            tags: opts.tags,
            replicas: parseInt(opts.replicas, 10),
        })

        spinner.succeed('Upload complete')
        console.log()
        console.log(chalk.bold('  Root hash: ') + chalk.cyan(result.root))
        console.log(chalk.bold('  Tx hash:   ') + chalk.dim(result.txHash))
        console.log()
        console.log(chalk.dim(`  Retrieve with: orbit retrieve ${result.root} ./output`))
    } catch (err) {
        spinner.fail(chalk.red('Upload failed'))
        console.error(chalk.dim(`  ${formatError(err)}`))
        process.exit(1)
    }
}

interface StoreDataOpts {
    network: string
    tags?: string
    replicas: string
}

export async function storeDataCommand(text: string, opts: StoreDataOpts) {
    const spinner = ora('Connecting to 0G...').start()

    try {
        const orbit = await connectOrbit(opts.network)
        spinner.text = 'Uploading data...'

        const result = await orbit.storeData(text, {
            tags: opts.tags,
            replicas: parseInt(opts.replicas, 10),
        })

        spinner.succeed('Upload complete')
        console.log()
        console.log(chalk.bold('  Root hash: ') + chalk.cyan(result.root))
        console.log(chalk.bold('  Tx hash:   ') + chalk.dim(result.txHash))
        console.log()
        console.log(chalk.dim(`  Retrieve with: orbit retrieve ${result.root} ./output`))
    } catch (err) {
        spinner.fail(chalk.red('Upload failed'))
        console.error(chalk.dim(`  ${formatError(err)}`))
        process.exit(1)
    }
}

interface RetrieveOpts {
    network: string
    proof?: boolean
}

export async function retrieveCommand(
    rootHash: string,
    output: string,
    opts: RetrieveOpts
) {
    const spinner = ora('Connecting to 0G...').start()

    try {
        const orbit = await connectOrbit(opts.network)
        spinner.text = `Downloading to ${output}...`

        await orbit.retrieve(rootHash, output, { proof: opts.proof })

        spinner.succeed(`Downloaded to ${output}`)
    } catch (err) {
        spinner.fail(chalk.red('Download failed'))
        console.error(chalk.dim(`  ${formatError(err)}`))
        process.exit(1)
    }
}
