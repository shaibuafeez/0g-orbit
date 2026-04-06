# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email the maintainers directly or use GitHub's private vulnerability reporting
3. Include a description of the vulnerability and steps to reproduce

We will acknowledge receipt within 48 hours and aim to release a fix within 7 days for critical issues.

## Known Considerations

### Transitive Dependencies

This package depends on `@0gfoundation/0g-ts-sdk` and `@0glabs/0g-serving-broker` which pull in transitive dependencies. We recommend consumers add the following overrides to their root `package.json`:

```json
{
  "overrides": {
    "axios": "1.14.0"
  }
}
```

### Private Keys

The SDK requires a private key to sign blockchain transactions. **Never** commit private keys to version control. Use environment variables:

```bash
export PRIVATE_KEY=0x...
```

Or a `.env` file (included in `.gitignore` by default when using `orbit init`).
