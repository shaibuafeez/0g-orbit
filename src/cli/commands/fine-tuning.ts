import ora from 'ora'
import chalk from 'chalk'
import { connectOrbit, formatError } from '../utils.js'

interface FineTuneOpts {
    network: string
    model: string
    provider: string
    epochs?: string
    batchSize?: string
    learningRate?: string
    loraRank?: string
    loraAlpha?: string
}

export async function fineTuneCommand(dataset: string, opts: FineTuneOpts) {
    const spinner = ora('Connecting to 0G...').start()

    try {
        const orbit = await connectOrbit(opts.network)

        // Step 1: Upload dataset
        spinner.text = `Uploading dataset ${dataset}...`
        const upload = await orbit.uploadDataset(dataset)
        spinner.text = `Dataset uploaded (root: ${upload.root.slice(0, 12)}...). Creating task...`

        // Step 2: Create task
        const trainingParams: Record<string, unknown> = {}
        if (opts.epochs) trainingParams.nEpochs = parseInt(opts.epochs, 10)
        if (opts.batchSize) trainingParams.batchSize = parseInt(opts.batchSize, 10)
        if (opts.learningRate) trainingParams.learningRate = parseFloat(opts.learningRate)
        if (opts.loraRank) trainingParams.loraRank = parseInt(opts.loraRank, 10)
        if (opts.loraAlpha) trainingParams.loraAlpha = parseInt(opts.loraAlpha, 10)

        const task = await orbit.createFineTuneTask({
            model: opts.model,
            dataset: upload.root,
            providerAddress: opts.provider,
            trainingParams: Object.keys(trainingParams).length > 0 ? trainingParams : undefined,
        })

        spinner.succeed('Fine-tuning task created')
        console.log()
        console.log(chalk.bold('  Task ID:   ') + chalk.cyan(task.id))
        console.log(chalk.bold('  Model:     ') + task.model)
        console.log(chalk.bold('  Dataset:   ') + chalk.dim(upload.root))
        console.log(chalk.bold('  Provider:  ') + chalk.dim(task.provider))
        console.log(chalk.bold('  Status:    ') + task.status)
        console.log()
        console.log(chalk.dim(`  Check progress: orbit tasks ${task.provider} ${task.id}`))
    } catch (err) {
        spinner.fail(chalk.red('Fine-tuning failed'))
        console.error(chalk.dim(`  ${formatError(err)}`))
        process.exit(1)
    }
}

interface TasksOpts {
    network: string
}

export async function tasksCommand(
    providerAddress: string,
    taskId: string | undefined,
    opts: TasksOpts
) {
    const spinner = ora('Fetching tasks...').start()

    try {
        const orbit = await connectOrbit(opts.network)

        if (taskId) {
            // Show single task + log
            const task = await orbit.getFineTuneTask(providerAddress, taskId)
            spinner.stop()

            console.log(chalk.bold(`\n  Task ${task.id}\n`))
            console.log(`  Status:    ${statusColor(task.status)}`)
            console.log(`  Model:     ${task.model}`)
            console.log(`  Dataset:   ${chalk.dim(task.dataset)}`)
            console.log(`  Provider:  ${chalk.dim(task.provider)}`)
            if (task.createdAt) console.log(`  Created:   ${task.createdAt}`)
            if (task.updatedAt) console.log(`  Updated:   ${task.updatedAt}`)

            // Try to get log
            try {
                const log = await orbit.fineTuning.getTaskLog(providerAddress, taskId)
                if (log) {
                    console.log(chalk.bold('\n  Training Log:\n'))
                    console.log(chalk.dim(`  ${log.replace(/\n/g, '\n  ')}`))
                }
            } catch {
                // Log not available yet
            }
            console.log()
        } else {
            // List all tasks for this provider
            const tasks = await orbit.fineTuning.listTasks(providerAddress)
            spinner.stop()

            if (tasks.length === 0) {
                console.log(chalk.dim('\n  No tasks found for this provider.\n'))
                return
            }

            console.log(chalk.bold(`\n  ${tasks.length} tasks\n`))
            for (const task of tasks) {
                console.log(`  ${chalk.cyan(task.id ?? 'unknown')}  ${statusColor(task.status)}  ${chalk.dim(task.model)}`)
            }
            console.log()
        }
    } catch (err) {
        spinner.fail(chalk.red('Failed to fetch tasks'))
        console.error(chalk.dim(`  ${formatError(err)}`))
        process.exit(1)
    }
}

interface ModelsOpts {
    network: string
}

export async function modelsCommand(opts: ModelsOpts) {
    const spinner = ora('Fetching models...').start()

    try {
        const orbit = await connectOrbit(opts.network)
        const models = await orbit.listModels()

        spinner.stop()

        if (models.length === 0) {
            console.log(chalk.dim('\n  No models available on this network.\n'))
            return
        }

        console.log(chalk.bold(`\n  ${models.length} models available for fine-tuning\n`))
        for (const model of models) {
            const desc = model.config.description ?? ''
            const provider = model.config.provider
            console.log(`  ${chalk.cyan(model.name)}`)
            if (desc) console.log(chalk.dim(`    ${desc}`))
            if (provider) console.log(chalk.dim(`    provider: ${provider}`))
        }
        console.log()
    } catch (err) {
        spinner.fail(chalk.red('Failed to list models'))
        console.error(chalk.dim(`  ${formatError(err)}`))
        process.exit(1)
    }
}

function statusColor(status: string): string {
    switch (status) {
        case 'finished':
        case 'acknowledged':
            return chalk.green(status)
        case 'training':
        case 'delivering':
        case 'setting-up':
            return chalk.yellow(status)
        case 'failed':
            return chalk.red(status)
        case 'delivered':
            return chalk.blue(status)
        default:
            return chalk.dim(status)
    }
}
