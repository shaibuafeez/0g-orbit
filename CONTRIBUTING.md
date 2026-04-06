# Contributing to 0G Orbit

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

```bash
git clone https://github.com/cyber/0g-orbit.git
cd 0g-orbit
npm install
npm run build
```

## Running Tests

```bash
npm test           # run all tests
npm run test:watch # watch mode
```

## Project Structure

```
src/
  orbit.ts          # Unified Orbit class
  storage.ts        # StorageClient
  inference.ts      # InferenceClient
  fine-tuning.ts    # FineTuningClient
  types.ts          # All TypeScript interfaces
  errors.ts         # Error classes
  networks.ts       # Network configurations
  retry.ts          # Retry utilities
  cli/
    cli.ts          # CLI entry point
    commands/       # CLI command handlers
    utils.ts        # CLI utilities
```

## Making Changes

1. Fork the repo and create a feature branch from `main`
2. Make your changes
3. Add tests for new functionality
4. Ensure all tests pass: `npm test`
5. Ensure the build succeeds: `npm run build`
6. Ensure types check: `npm run lint`
7. Submit a pull request

## Code Style

- TypeScript strict mode
- ESM modules (`import`/`export`, not `require`)
- Follow existing patterns in the codebase
- Use the `withRetry()` wrapper for network operations
- Throw typed errors (`StorageError`, `InferenceError`, `FineTuningError`) with actionable suggestions

## Commit Messages

Use clear, descriptive commit messages:

```
feat: add fine-tuning dataset validation
fix: handle RPC timeout in storage upload
docs: update CLI usage examples
```

## Reporting Issues

- Use GitHub Issues
- Include your Node.js version, OS, and 0g-orbit version
- Include the full error message and stack trace
- Provide a minimal reproduction if possible

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
