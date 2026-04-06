# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.3] - 2026-04-05

### Fixed
- **Storage dedup**: Skip re-uploading files that already exist on storage nodes (prevents retrieve regression)
- **Retrieve crash guard**: Catch SDK-internal null crashes and throw descriptive `StorageError` instead of raw `TypeError`

## [0.2.2] - 2026-04-04

### Fixed
- Version string synced across root, core, and CLI packages

## [0.2.1] - 2026-04-04

### Changed
- Added axios override recommendations to mitigate transitive vulnerabilities

## [0.2.0] - 2026-04-04

### Added
- **Fine-Tuning Support**: Full `FineTuningClient` with dataset upload, task management, and model download
- CLI commands: `orbit fine-tune`, `orbit tasks`, `orbit models`
- `FineTuningError` class with actionable suggestions
- 19 new tests for fine-tuning functionality (85 total tests passing)

### Changed
- `Orbit` class now exposes `fineTuning` accessor and shortcut methods

## [0.1.0] - 2026-04-03

### Added
- Initial release
- `StorageClient` — file and data upload/download to 0G Storage
- `InferenceClient` — AI inference on 0G Compute Network
- `Orbit` unified class combining storage, inference, and chain operations
- CLI with `orbit store`, `orbit retrieve`, `orbit infer`, `orbit services`, `orbit status`, `orbit init`
- Automatic retry with exponential backoff for transient errors
- Testnet and mainnet network configurations
- 66 tests passing
