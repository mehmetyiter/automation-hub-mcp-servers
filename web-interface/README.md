# Automation Hub Web Interface

This is the web interface for the Automation Hub MCP Servers. It provides a modern React-based UI to interact with various MCP servers.

## Features

- 🎯 Dashboard with MCP server status monitoring
- 📋 Workflow management (list, create, execute, delete)
- 🔍 Workflow details and execution history
- 🚀 Direct integration with MCP servers through HTTP APIs

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The web interface will be available at http://localhost:3000

## MCP Server Integration

The web interface connects to the following MCP servers:

- **n8n MCP** (port 3100) - Workflow automation
- **Database MCP** (port 3101) - Data persistence
- **Auth MCP** (port 3102) - Authentication
- **Make MCP** (port 3103) - Make.com integration
- **Zapier MCP** (port 3104) - Zapier integration
- **Vapi MCP** (port 3105) - Voice AI integration

## Development

The application uses:
- React 18 with TypeScript
- Vite for fast development
- TailwindCSS for styling
- React Query for server state management
- React Router for navigation
- Axios for HTTP requests

## API Proxy Configuration

The Vite development server proxies API requests to the respective MCP servers:

- `/api/n8n/*` → `http://localhost:3100`
- `/api/database/*` → `http://localhost:3101`
- `/api/auth/*` → `http://localhost:3102`
- `/api/make/*` → `http://localhost:3103`
- `/api/zapier/*` → `http://localhost:3104`
- `/api/vapi/*` → `http://localhost:3105`

## Building for Production

```bash
npm run build
```

The production build will be in the `dist` directory.