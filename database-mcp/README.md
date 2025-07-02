# Database MCP Server

A Model Context Protocol (MCP) server for database operations.

## Features

- Execute SQL queries
- Manage database schema
- Handle transactions
- User management
- Workspace management
- Credential storage

## Configuration

```env
DATABASE_URL=postgresql://user:password@localhost:5432/automation_hub
```

## Available Tools

- `db_query` - Execute SQL query
- `db_transaction` - Execute multiple queries in transaction
- `db_create_user` - Create new user
- `db_create_workspace` - Create new workspace
- `db_get_user` - Get user details
- `db_list_workspaces` - List user workspaces