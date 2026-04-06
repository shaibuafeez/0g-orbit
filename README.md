# 0G Orbit

The developer toolkit for [0G](https://0g.ai). Store, infer, fine-tune — one SDK, one CLI, five minutes.

[![CI](https://github.com/cyber/0g-orbit/actions/workflows/ci.yml/badge.svg)](https://github.com/cyber/0g-orbit/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/0g-orbit)](https://www.npmjs.com/package/0g-orbit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/node/v/0g-orbit)](https://nodejs.org)

## What is this?

0G Orbit wraps the 0G storage SDK, serving broker, and chain interactions into a single unified interface. Instead of juggling `@0gfoundation/0g-ts-sdk`, `@0glabs/0g-serving-broker`, and raw ethers calls, you get one `Orbit` class and one `orbit` CLI.

**Storage** — Upload and download files to 0G's decentralized storage network
**Inference** — Run AI models on 0G's decentralized compute network
**Fine-Tuning** — Upload datasets, create training tasks, download fine-tuned models

## Install

```bash
npm install 0g-orbit
```

## Quick Start

### SDK

```typescript
import { Orbit } from '0g-orbit'

const orbit = await Orbit.connect({
  network: 'testnet',
  privateKey: process.env.PRIVATE_KEY,
})

// Upload a file
const { root, txHash } = await orbit.store('./data.json')
console.log(`Stored: ${root}`)

// Download it back
await orbit.retrieve(root, './downloaded.json')

// Run AI inference
const response = await orbit.infer('meta-llama/Llama-3.2-3B-Instruct', {
  message: 'Explain zero-knowledge proofs in one sentence.',
})
console.log(response.content)

// Fine-tune a model
const dataset = await orbit.uploadDataset('./training-data.jsonl')
const task = await orbit.createFineTuneTask({
  model: 'base-model',
  dataset: dataset.root,
  providerAddress: '0x...',
})
```

### CLI

```bash
# Set your private key
export PRIVATE_KEY=0x...

# Upload a file
orbit store ./my-file.txt

# Download a file
orbit retrieve <rootHash> ./output.txt

# Run inference
orbit infer meta-llama/Llama-3.2-3B-Instruct -m "Hello, 0G!"

# List available AI services
orbit services

# Fine-tune a model
orbit fine-tune ./dataset.jsonl --model base-model --provider 0x...

# Check account status
orbit status
```

## API

### `Orbit.connect(config)`

Creates a connected Orbit instance.

| Option | Type | Description |
|---|---|---|
| `network` | `'testnet' \| 'mainnet'` | Network to connect to |
| `privateKey` | `string?` | Wallet private key (falls back to `PRIVATE_KEY` env var) |
| `rpcUrl` | `string?` | Custom RPC URL |

### Storage

| Method | Description |
|---|---|
| `orbit.store(path, options?)` | Upload a file, returns `{ root, txHash }` |
| `orbit.storeData(text, options?)` | Upload a text string |
| `orbit.retrieve(rootHash, outputPath, options?)` | Download a file by root hash |

### Inference

| Method | Description |
|---|---|
| `orbit.infer(model, options)` | Run AI inference, returns `{ content, tokensUsed }` |
| `orbit.listServices()` | List available AI services on the network |

### Fine-Tuning

| Method | Description |
|---|---|
| `orbit.uploadDataset(path)` | Upload a training dataset to storage |
| `orbit.createFineTuneTask(options)` | Create a fine-tuning task |
| `orbit.getFineTuneTask(provider, taskId)` | Check task status |
| `orbit.downloadModel(provider, taskId, outputDir)` | Download a fine-tuned model |
| `orbit.listModels()` | List available base models |
| `orbit.listProviders()` | List fine-tuning providers |

### Direct Client Access

For advanced usage, access the underlying clients directly:

```typescript
orbit.storage    // StorageClient
orbit.inference  // InferenceClient
orbit.fineTuning // FineTuningClient
```

## Security

This package has transitive dependencies with known vulnerabilities (from upstream 0G SDKs). To mitigate, add this to your project's `package.json`:

```json
{
  "overrides": {
    "axios": "1.14.0"
  }
}
```

See [SECURITY.md](SECURITY.md) for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
