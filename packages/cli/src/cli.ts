#!/usr/bin/env node

import { Command } from 'commander'
import { storeCommand, storeDataCommand, retrieveCommand } from './commands/storage.js'
import { inferCommand, listServicesCommand } from './commands/inference.js'
import { statusCommand } from './commands/account.js'
import { initCommand } from './commands/init.js'

const program = new Command()

program
    .name('orbit')
    .description('The developer toolkit for 0G')
    .version('0.1.0')

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
    .command('status')
    .description('Show account status and balance')
    .option('-n, --network <name>', 'network (testnet|mainnet)', 'testnet')
    .action(statusCommand)

program.parse()
