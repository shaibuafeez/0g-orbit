#!/usr/bin/env node

import { Command } from 'commander'
import { storeCommand, storeDataCommand, retrieveCommand } from './commands/storage.js'
import { inferCommand, listServicesCommand } from './commands/inference.js'
import { fineTuneCommand, tasksCommand, modelsCommand } from './commands/fine-tuning.js'
import { statusCommand } from './commands/account.js'
import { initCommand } from './commands/init.js'

const program = new Command()

program
    .name('orbit')
    .description('The developer toolkit for 0G')
    .version('0.2.3')

program
    .command('init')
    .description('Initialize a new 0G project')
    .option('-t, --template <name>', 'template to use', 'default')
    .option('-d, --dir <path>', 'directory to create', '.')
    .action(initCommand)

program
    .command('store <file>')
    .description('Upload a file to 0G Storage')
    .option('-n, --network <name>', 'network (testnet|mainnet)', 'testnet')
    .option('--tags <hex>', 'custom tags (hex string)')
    .option('--replicas <n>', 'number of replicas', '1')
    .action(storeCommand)

program
    .command('store-data <text>')
    .description('Upload a text string to 0G Storage')
    .option('-n, --network <name>', 'network (testnet|mainnet)', 'testnet')
    .option('--tags <hex>', 'custom tags (hex string)')
    .option('--replicas <n>', 'number of replicas', '1')
    .action(storeDataCommand)

program
    .command('retrieve <rootHash> <output>')
    .description('Download a file from 0G Storage')
    .option('-n, --network <name>', 'network (testnet|mainnet)', 'testnet')
    .option('--proof', 'verify merkle proofs during download')
    .action(retrieveCommand)

program
    .command('infer <model>')
    .description('Run AI inference on the 0G Compute Network')
    .option('-n, --network <name>', 'network (testnet|mainnet)', 'testnet')
    .option('-m, --message <text>', 'message to send')
    .option('-s, --system <text>', 'system prompt')
    .option('-t, --temperature <n>', 'sampling temperature', '0.7')
    .option('--max-tokens <n>', 'maximum tokens to generate')
    .option('--provider <address>', 'specific provider address')
    .action(inferCommand)

program
    .command('services')
    .description('List available AI services on the network')
    .option('-n, --network <name>', 'network (testnet|mainnet)', 'testnet')
    .action(listServicesCommand)

program
    .command('fine-tune <dataset>')
    .description('Upload dataset and create a fine-tuning task')
    .option('-n, --network <name>', 'network (testnet|mainnet)', 'testnet')
    .requiredOption('--model <name>', 'base model to fine-tune')
    .requiredOption('--provider <address>', 'provider wallet address')
    .option('--epochs <n>', 'number of training epochs')
    .option('--batch-size <n>', 'training batch size')
    .option('--learning-rate <n>', 'learning rate')
    .option('--lora-rank <n>', 'LoRA rank')
    .option('--lora-alpha <n>', 'LoRA alpha')
    .action(fineTuneCommand)

program
    .command('tasks <provider> [taskId]')
    .description('List fine-tuning tasks or show a specific task')
    .option('-n, --network <name>', 'network (testnet|mainnet)', 'testnet')
    .action(tasksCommand)

program
    .command('models')
    .description('List available base models for fine-tuning')
    .option('-n, --network <name>', 'network (testnet|mainnet)', 'testnet')
    .action(modelsCommand)

program
    .command('status')
    .description('Show account status and balance')
    .option('-n, --network <name>', 'network (testnet|mainnet)', 'testnet')
    .action(statusCommand)

program.parse()
