# Automation Hub MCP Servers

A collection of Model Context Protocol (MCP) servers for integrating with popular automation platforms. This project enables AI-powered workflow generation and management across multiple automation platforms.

## Architecture

This project implements a microservices architecture where each automation platform and service has its own dedicated MCP server:

- **n8n-mcp**: n8n workflow automation
- **database-mcp**: Database operations and data persistence
- **auth-mcp**: Authentication and authorization
- **make-mcp**: Make.com (Integromat) integration
- **zapier-mcp**: Zapier integration
- **vapi-mcp**: VAPI voice automation

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository>
cd automation-hub-mcp-servers
cp .env.example .env
# Edit .env with your credentials
```

### 2. Start Core Services

```bash
# Start database and n8n
docker-compose up -d postgres n8n

# Wait for services to be ready
docker-compose ps

# Start MCP servers
docker-compose up -d n8n-mcp database-mcp auth-mcp
```

### 3. Start Optional Services

```bash
# Start Make.com integration
docker-compose --profile make up -d

# Start Zapier integration
docker-compose --profile zapier up -d

# Start VAPI integration
docker-compose --profile vapi up -d
```

## MCP Server Configuration

### For Claude Desktop

Add to your Claude Desktop configuration file:

```json
{
  "mcpServers": {
    "n8n": {
      "command": "docker",
      "args": ["exec", "-i", "n8n-mcp-server", "node", "dist/index.js"],
      "env": {}
    },
    "database": {
      "command": "docker",
      "args": ["exec", "-i", "database-mcp-server", "node", "dist/index.js"],
      "env": {}
    },
    "auth": {
      "command": "docker",
      "args": ["exec", "-i", "auth-mcp-server", "node", "dist/index.js"],
      "env": {}
    }
  }
}
```

### For Local Development

```json
{
  "mcpServers": {
    "n8n": {
      "command": "node",
      "args": ["./n8n-mcp/dist/index.js"],
      "env": {
        "N8N_BASE_URL": "http://localhost:5678",
        "N8N_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Web Interface

The project includes a modern web interface for managing automations across all MCP servers.

### Starting the Web Interface

```bash
# Start the web interface
./start-web-interface.sh
```

Access the interface at http://localhost:3000

### Features
- Dashboard with MCP server status monitoring
- Workflow management (create, edit, execute, delete)
- Real-time execution monitoring
- Platform integrations overview

## Development

### HTTP API Access (Linux/VSCode)

For Linux users without Claude Desktop, each MCP server exposes an HTTP API:

```bash
# Start n8n MCP HTTP server
cd n8n-mcp
npm run start:http

# The server will be available at http://localhost:3100
```

### Building Individual Servers

```bash
# Build n8n MCP server
cd n8n-mcp
npm install
npm run build

# Build database MCP server
cd ../database-mcp
npm install
npm run build
```

### Running in Development Mode

```bash
# Run n8n MCP server in dev mode
cd n8n-mcp
npm run dev

# In another terminal, run database MCP server
cd database-mcp
npm run dev
```

## Services Overview

### n8n MCP Server

Provides tools for:
- Creating and managing workflows
- Executing workflows
- Managing credentials
- Viewing execution history

### Database MCP Server

Provides tools for:
- User management
- Workspace management
- Credential storage
- Query execution

### Auth MCP Server

Provides tools for:
- User authentication
- JWT token management
- Session handling
- Password management

## Environment Variables

See `.env.example` for all available configuration options.

## Troubleshooting

### n8n Connection Issues

1. Ensure n8n is running: `docker-compose ps`
2. Check n8n logs: `docker-compose logs n8n`
3. Verify API key is correct in `.env`
4. Test connection: `curl -H "X-N8N-API-KEY: your-key" http://localhost:5678/api/v1/workflows`

### Database Connection Issues

1. Check PostgreSQL is running: `docker-compose ps postgres`
2. Verify credentials in `.env`
3. Test connection: `docker-compose exec postgres psql -U automation_hub -d automation_hub`

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT