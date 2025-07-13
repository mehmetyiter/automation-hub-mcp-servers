# n8n-MCP Documentation Automation

Complete documentation automation system for the n8n-MCP platform, providing comprehensive tools for generating, validating, and maintaining high-quality documentation.

## Features

### 🚀 **API Documentation Generation**
- Generate documentation from OpenAPI specifications
- Support for multiple output formats (Markdown, HTML, PDF)
- Interactive API explorer with "Try it out" functionality
- Multi-language code examples (JavaScript, Python, cURL, etc.)
- Automatic schema validation and example generation

### 📚 **SDK Documentation**
- Multi-language SDK documentation generation
- Support for TypeScript, Python, Go, Java, C#, Ruby, PHP
- TypeDoc integration for TypeScript projects
- Automated API reference extraction
- Code example generation and validation

### 📝 **Reference Documentation**
- Automatic collection and organization of all documentation
- Intelligent categorization by content type
- Full-text search with indexing
- Cross-reference linking and validation
- Table of contents generation

### 🔄 **Changelog Generation**
- Conventional commit parsing
- Automatic release notes generation
- Breaking change detection and highlighting
- Grouping by commit type and scope
- Git tag integration for versioning

### ✅ **Documentation Validation**
- Markdown syntax validation
- Link checking (internal and external)
- Code example syntax validation
- Image alt-text verification
- Consistent formatting enforcement

### 🔧 **Live Development Server**
- Real-time documentation preview
- Hot reloading on file changes
- Built-in search functionality
- Responsive design with mobile support
- Performance monitoring

### 👀 **File Watching & Auto-Regeneration**
- Intelligent file change detection
- Debounced regeneration to prevent excessive builds
- Selective regeneration based on change type
- Integration with development workflows

## Installation

```bash
npm install
```

## Quick Start

### 1. Initialize Configuration

```bash
npx n8n-mcp-docs init
```

This creates a `docs.config.json` file with default settings.

### 2. Generate All Documentation

```bash
npx n8n-mcp-docs generate all
```

### 3. Start Development Server

```bash
npx n8n-mcp-docs serve --watch --open
```

## CLI Commands

### Generate Commands

```bash
# Generate API documentation
npx n8n-mcp-docs generate api -i openapi.yaml -o docs/api

# Generate SDK documentation
npx n8n-mcp-docs generate sdk-docs -l typescript -o docs/sdk

# Generate changelog
npx n8n-mcp-docs generate changelog -o CHANGELOG.md

# Generate reference documentation
npx n8n-mcp-docs generate reference -o docs

# Generate all documentation
npx n8n-mcp-docs generate all -c docs.config.json
```

### Validation Commands

```bash
# Validate documentation
npx n8n-mcp-docs validate -d docs

# Strict validation with auto-fix
npx n8n-mcp-docs validate -d docs --strict --fix
```

### Server Commands

```bash
# Serve documentation
npx n8n-mcp-docs serve -p 3000 -d docs

# Serve with live reload
npx n8n-mcp-docs serve --watch --open

# Watch for changes and regenerate
npx n8n-mcp-docs watch -c docs.config.json
```

## Configuration

The `docs.config.json` file controls all aspects of documentation generation:

```json
{
  "api": {
    "input": "./openapi.yaml",
    "output": "./docs/api",
    "format": "markdown",
    "includeExamples": true
  },
  "sdk": {
    "languages": ["typescript", "python", "go"],
    "output": "./docs/sdk"
  },
  "changelog": {
    "output": "CHANGELOG.md",
    "preset": "angular"
  },
  "validation": {
    "strict": true,
    "checkLinks": true
  }
}
```

## Project Structure

```
docs-automation/
├── src/
│   ├── generators/           # Documentation generators
│   │   ├── api-docs.ts      # API documentation from OpenAPI
│   │   ├── changelog.ts     # Changelog from git commits
│   │   ├── sdk-docs.ts      # SDK documentation
│   │   └── reference-docs.ts # Reference documentation
│   ├── validators/          # Documentation validation
│   │   └── validate-docs.ts # Markdown and link validation
│   ├── utils/              # Utility functions
│   │   ├── syntax-highlighter.ts # Code syntax highlighting
│   │   └── mermaid.ts      # Mermaid diagram rendering
│   ├── server.ts           # Documentation server
│   ├── watcher.ts          # File watching and auto-regen
│   └── index.ts            # CLI entry point
├── .github/
│   └── workflows/
│       └── docs.yml        # GitHub Actions workflow
├── package.json
├── docs.config.json        # Configuration file
└── README.md
```

## API Documentation Generation

The API documentation generator parses OpenAPI specifications and creates comprehensive documentation:

### Features
- **Interactive Explorer**: Try API endpoints directly in the browser
- **Code Examples**: Auto-generated examples in multiple languages
- **Schema Validation**: Automatic request/response validation
- **Multiple Formats**: Output as Markdown, HTML, or PDF

### Example Usage

```bash
# Generate from OpenAPI spec
npx n8n-mcp-docs generate api \
  --input ./api/openapi.yaml \
  --output ./docs/api \
  --format html \
  --include-examples
```

## SDK Documentation

Generates documentation for multiple programming language SDKs:

### Supported Languages
- **TypeScript/JavaScript**: Uses TypeDoc
- **Python**: Uses Sphinx/pydoc
- **Go**: Uses godoc
- **Java**: Uses JavaDoc
- **C#**: Uses DocFX
- **Ruby**: Uses YARD
- **PHP**: Uses phpDocumentor

### Example Usage

```bash
# Generate TypeScript SDK docs
npx n8n-mcp-docs generate sdk-docs \
  --language typescript \
  --input ./sdk/typescript \
  --output ./docs/sdk/typescript
```

## Changelog Generation

Automatically generates changelogs from git commits using conventional commit format:

### Supported Commit Types
- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test changes
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Maintenance tasks

### Example Output

```markdown
# Changelog

## [1.2.0] - 2024-01-15

### ✨ Features
- **api**: Add user authentication endpoints ([a1b2c3d])
- **sdk**: Add TypeScript SDK support ([e4f5g6h])

### 🐛 Bug Fixes
- **auth**: Fix token refresh logic ([i7j8k9l])

### ⚠️ BREAKING CHANGES
- **api**: Remove deprecated v1 endpoints ([m1n2o3p])
```

## Documentation Validation

Comprehensive validation ensures documentation quality:

### Validation Rules
- **Markdown Syntax**: Validates proper markdown formatting
- **Link Checking**: Verifies all internal and external links
- **Code Examples**: Validates syntax of code blocks
- **Image Alt Text**: Ensures accessibility compliance
- **Heading Structure**: Checks proper heading hierarchy
- **Trailing Whitespace**: Removes unnecessary whitespace

### Example Usage

```bash
# Basic validation
npx n8n-mcp-docs validate --dir ./docs

# Strict validation with auto-fix
npx n8n-mcp-docs validate --dir ./docs --strict --fix
```

## Live Development Server

The development server provides real-time documentation preview:

### Features
- **Hot Reloading**: Automatically updates on file changes
- **Search Functionality**: Full-text search across all documentation
- **Responsive Design**: Mobile-friendly interface
- **Navigation**: Auto-generated sidebar navigation
- **Performance Monitoring**: Built-in Lighthouse integration

### Example Usage

```bash
# Start server with live reload
npx n8n-mcp-docs serve --port 3000 --watch --open
```

## File Watching

Intelligent file watching for automatic regeneration:

### Features
- **Change Detection**: Monitors source files for changes
- **Selective Regeneration**: Only rebuilds affected documentation
- **Debounced Updates**: Prevents excessive rebuilds
- **Multi-format Support**: Watches various file types

### Example Usage

```bash
# Watch for changes and auto-regenerate
npx n8n-mcp-docs watch --config docs.config.json
```

## GitHub Actions Integration

Automated documentation deployment with GitHub Actions:

### Workflow Features
- **Validation**: Checks documentation quality on PRs
- **Generation**: Auto-generates docs on main branch
- **Deployment**: Deploys to GitHub Pages
- **Performance**: Lighthouse performance checks
- **Accessibility**: Pa11y accessibility testing
- **Security**: Trivy security scanning

### Setup

1. Copy `.github/workflows/docs.yml` to your repository
2. Configure GitHub Pages in repository settings
3. Add required secrets (SLACK_WEBHOOK, etc.)
4. Push to main branch to trigger deployment

## Advanced Configuration

### Custom Themes

```json
{
  "themes": {
    "custom": {
      "primaryColor": "#ff6b6b",
      "secondaryColor": "#4ecdc4",
      "backgroundColor": "#f7f7f7",
      "textColor": "#2c3e50",
      "codeTheme": "monokai"
    }
  }
}
```

### Multi-language Support

```json
{
  "i18n": {
    "defaultLanguage": "en",
    "languages": ["en", "es", "fr", "de"],
    "generatePerLanguage": true
  }
}
```

### Custom Validators

```json
{
  "validation": {
    "custom": [
      {
        "rule": "no-profanity",
        "message": "Documentation should not contain profanity"
      }
    ]
  }
}
```

## Performance Optimization

### Build Performance
- **Incremental Generation**: Only rebuilds changed content
- **Parallel Processing**: Generates multiple formats simultaneously
- **Caching**: Caches parsed content between builds
- **Memory Management**: Efficient memory usage for large projects

### Runtime Performance
- **Search Indexing**: Pre-built search indices for fast queries
- **Image Optimization**: Automatic image compression and WebP conversion
- **Code Splitting**: Lazy loading for large documentation sites
- **CDN Integration**: Support for content delivery networks

## Troubleshooting

### Common Issues

**OpenAPI parsing errors:**
```bash
# Validate your OpenAPI spec first
npx swagger-parser validate openapi.yaml
```

**TypeScript compilation errors:**
```bash
# Check your TypeScript configuration
npx tsc --noEmit
```

**Link validation failures:**
```bash
# Run validation with verbose output
npx n8n-mcp-docs validate --verbose
```

**Memory issues with large projects:**
```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 ./node_modules/.bin/n8n-mcp-docs generate all
```

### Debug Mode

Enable debug logging for troubleshooting:

```bash
DEBUG=n8n-mcp-docs:* npx n8n-mcp-docs generate all
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Setup

```bash
# Clone the repository
git clone https://github.com/n8n-mcp/docs-automation.git
cd docs-automation

# Install dependencies
npm install

# Run tests
npm test

# Start development
npm run dev
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Support

- 📖 **Documentation**: [https://docs.n8n-mcp.com](https://docs.n8n-mcp.com)
- 🐛 **Issues**: [GitHub Issues](https://github.com/n8n-mcp/docs-automation/issues)
- 💬 **Discord**: [n8n-MCP Community](https://discord.gg/n8n-mcp)
- 📧 **Email**: docs@n8n-mcp.com

---

Made with ❤️ by the n8n-MCP Team