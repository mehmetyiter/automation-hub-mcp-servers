# Auth MCP Server

A Model Context Protocol (MCP) server for authentication and authorization.

## Features

- User authentication (login/logout)
- JWT token management
- Session management
- Password reset
- Email verification
- Multi-factor authentication support

## Configuration

```env
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=10
```

## Available Tools

- `auth_login` - Authenticate user
- `auth_logout` - Logout user
- `auth_verify_token` - Verify JWT token
- `auth_refresh_token` - Refresh access token
- `auth_reset_password` - Reset user password
- `auth_verify_email` - Verify email address