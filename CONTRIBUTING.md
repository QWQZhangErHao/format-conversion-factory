# Contributing to 格式转换工厂

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Code of Conduct

Please read and follow our [Code of Conduct](./CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/QWQZhangErHao/format-conversion-factory/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots (if applicable)
   - Environment info (OS, app version)

### Suggesting Features

1. Check existing issues for similar suggestions
2. Describe the feature and its use case
3. Explain why it would benefit the project

### Pull Requests

1. Fork the repository
2. Create a feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. Make your changes following our coding standards
4. Write or update tests as needed
5. Ensure all tests pass: `pnpm test`
6. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat: add new format converter for XYZ
   fix: correct progress calculation in batch mode
   refactor: extract shared validation logic
   docs: update API documentation
   test: add edge cases for CSV parser
   ```
7. Push and create a Pull Request

## Development Setup

```bash
pnpm install
cd apps/desktop && pnpm tauri dev
```

## Coding Standards

- **TypeScript/React**: Follow the existing patterns in the codebase
- **Rust**: Run `cargo clippy` before committing
- **Commits**: Use Conventional Commits format
- **Tests**: Maintain ≥80% coverage for new code

## Project Structure

```
packages/core/src/     # Core conversion engine (TypeScript)
packages/ui-shared/    # Shared UI components
apps/desktop/src/      # React frontend
apps/desktop/src-tauri/ # Rust backend
```
