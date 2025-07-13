# n8n-MCP CLI

Command-line interface for n8n-MCP workflow automation platform.

## Installation

```bash
npm install -g @n8n-mcp/cli
```

Or use directly with npx:

```bash
npx @n8n-mcp/cli
```

## Quick Start

1. **Authenticate**
   ```bash
   n8n-mcp auth login
   ```

2. **List workflows**
   ```bash
   n8n-mcp workflow list
   ```

3. **Create a workflow**
   ```bash
   n8n-mcp workflow create workflow.json
   ```

4. **Execute a workflow**
   ```bash
   n8n-mcp workflow execute <workflow-id>
   ```

## Commands

### Authentication

```bash
# Login with API key
n8n-mcp auth login

# Check authentication status
n8n-mcp auth status

# List authentication profiles
n8n-mcp auth profiles

# Logout
n8n-mcp auth logout
```

### Workflows

```bash
# List workflows
n8n-mcp workflow list
n8n-mcp wf ls

# Get workflow details
n8n-mcp workflow get <id>

# Create workflow from file
n8n-mcp workflow create workflow.json

# Update workflow
n8n-mcp workflow update <id> workflow.json

# Delete workflow
n8n-mcp workflow delete <id>

# Activate/deactivate workflow
n8n-mcp workflow activate <id>
n8n-mcp workflow deactivate <id>

# Execute workflow
n8n-mcp workflow execute <id> --data '{"key": "value"}'
n8n-mcp workflow run <id> --file data.json --wait
```

### Executions

```bash
# List executions for a workflow
n8n-mcp execution list <workflow-id>
n8n-mcp exec ls <workflow-id>

# Get execution details
n8n-mcp execution get <id>

# Stop running execution
n8n-mcp execution stop <id>

# Retry failed execution
n8n-mcp execution retry <id>

# Watch execution in real-time
n8n-mcp execution watch <id>
```

### Generate

```bash
# Generate workflow from prompt
n8n-mcp generate workflow

# Generate SDK for a language
n8n-mcp generate sdk typescript
n8n-mcp generate sdk python --output ./python-sdk

# Generate custom node template
n8n-mcp generate node trigger --name MyTrigger

# Generate integration boilerplate
n8n-mcp generate integration slack
```

### Deploy

```bash
# Deploy single workflow
n8n-mcp deploy workflow workflow.json --activate

# Deploy all workflows in directory
n8n-mcp deploy directory ./workflows --pattern "*.json"

# Sync workflows with remote
n8n-mcp deploy sync --pull  # Pull from remote
n8n-mcp deploy sync --push  # Push to remote
```

### Logs

```bash
# View execution logs
n8n-mcp logs execution <id>
n8n-mcp logs execution <id> -f  # Follow logs

# View workflow logs
n8n-mcp logs workflow <id>
n8n-mcp logs workflow <id> -f --since 1h

# View system logs
n8n-mcp logs system
n8n-mcp logs system -f --level error --service api
```

### Configuration

```bash
# List configuration
n8n-mcp config list

# Get configuration value
n8n-mcp config get <key>

# Set configuration value
n8n-mcp config set <key> <value>

# Set default editor
n8n-mcp config editor

# Configure defaults
n8n-mcp config defaults
```

### Project Initialization

```bash
# Initialize new project
n8n-mcp init

# With options
n8n-mcp init --name my-project --template advanced
```

## Options

### Global Options

- `-p, --profile <profile>` - Use specific authentication profile (default: "default")
- `--json` - Output in JSON format
- `--help` - Show help
- `--version` - Show version

### Common Options

- `-l, --limit <number>` - Limit number of results
- `-o, --output <file>` - Save output to file
- `-f, --follow` - Follow/stream output
- `--wait` - Wait for operation to complete

## Profiles

The CLI supports multiple authentication profiles:

```bash
# Login to different profiles
n8n-mcp auth login -p production
n8n-mcp auth login -p staging

# Use specific profile
n8n-mcp workflow list -p production
```

## Project Structure

When you run `n8n-mcp init`, it creates:

```
my-project/
├── workflows/           # Workflow JSON files
├── src/                # Source code (for advanced templates)
├── tests/              # Test files
├── package.json        # Project configuration
├── n8n-mcp.json       # n8n-MCP configuration
└── README.md          # Project documentation
```

## Environment Variables

- `N8N_MCP_API_KEY` - API key for authentication
- `N8N_MCP_API_URL` - API base URL (default: https://api.n8n-mcp.com)
- `N8N_MCP_PROFILE` - Default profile to use
- `EDITOR` - Default editor for editing files

## Examples

### Deploy workflow and wait for first execution

```bash
# Create and deploy workflow
n8n-mcp workflow create my-workflow.json --activate

# Execute and wait for completion
n8n-mcp workflow execute <id> --wait --data '{"test": true}'
```

### Generate TypeScript SDK

```bash
n8n-mcp generate sdk typescript \
  --output ./sdk \
  --package-name @mycompany/n8n-mcp-sdk
```

### Batch deploy workflows

```bash
# Deploy all workflows in a directory
n8n-mcp deploy directory ./workflows --activate

# Deploy only specific pattern
n8n-mcp deploy directory ./workflows --pattern "prod-*.json"
```

### Stream logs with filters

```bash
# Stream error logs only
n8n-mcp logs system -f --level error

# Stream logs for specific workflow
n8n-mcp logs workflow <id> -f --since 30m
```

## Troubleshooting

### Authentication Issues

```bash
# Check current auth status
n8n-mcp auth status

# Re-authenticate
n8n-mcp auth logout
n8n-mcp auth login
```

### SSL Certificate Issues

```bash
# For self-signed certificates
export NODE_TLS_REJECT_UNAUTHORIZED=0
```

### Debug Mode

```bash
# Enable debug output
export DEBUG=1
n8n-mcp workflow list
```

## Contributing

1. Clone the repository
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Link for local development: `npm link`

## License

MIT