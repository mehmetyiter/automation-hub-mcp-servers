# n8n MCP Server

A Model Context Protocol (MCP) server for n8n workflow automation.

## Features

- Create, read, update, and delete n8n workflows
- Execute workflows with custom data
- View execution history
- Manage credentials
- Test n8n connection

## Installation

```bash
npm install
npm run build
```

## Configuration

1. Copy `.env.example` to `.env`
2. Set your n8n instance URL and API key:

```env
N8N_BASE_URL=https://your-n8n-instance.com
N8N_API_KEY=your-n8n-api-key
```

## Usage

### Standalone

```bash
npm start
```

### With Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "n8n": {
      "command": "node",
      "args": ["/path/to/n8n-mcp/dist/index.js"],
      "env": {
        "N8N_BASE_URL": "https://your-n8n-instance.com",
        "N8N_API_KEY": "your-n8n-api-key"
      }
    }
  }
}
```

## Available Tools

- `n8n_create_workflow` - Create a new workflow
- `n8n_list_workflows` - List all workflows
- `n8n_get_workflow` - Get workflow details
- `n8n_execute_workflow` - Execute a workflow
- `n8n_update_workflow` - Update workflow
- `n8n_delete_workflow` - Delete workflow
- `n8n_get_executions` - Get execution history
- `n8n_get_credentials` - List available credentials
- `n8n_test_connection` - Test n8n connection

## Development

```bash
npm run dev
```

## Testing

```bash
npm test
```