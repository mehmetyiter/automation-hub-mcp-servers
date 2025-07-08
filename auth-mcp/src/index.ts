import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { authService } from './auth-service.js';
import { db } from './database.js';
import { TOOLS } from './tools.js';

// Initialize database
await db.initialize();

// Create MCP server
const server = new Server(
  {
    name: 'auth-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'auth_login': {
        const result = await authService.login(args.email, args.password);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                token: result.token,
                user: result.user
              }, null, 2),
            },
          ],
        };
      }

      case 'auth_register': {
        const result = await authService.register({
          email: args.email,
          password: args.password,
          name: args.name,
          role: args.role || 'viewer'
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                token: result.token,
                user: result.user
              }, null, 2),
            },
          ],
        };
      }

      case 'auth_verify_token': {
        try {
          await authService.verifyToken(args.token);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  valid: true,
                  message: 'Token is valid'
                }, null, 2),
              },
            ],
          };
        } catch {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  valid: false,
                  message: 'Token is invalid or expired'
                }, null, 2),
              },
            ],
          };
        }
      }

      case 'auth_get_user': {
        const user = await authService.getUserFromToken(args.token);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                user
              }, null, 2),
            },
          ],
        };
      }

      case 'auth_logout': {
        await authService.logout(args.token);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Logged out successfully'
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message || 'Operation failed'
          }, null, 2),
        },
      ],
    };
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('Auth MCP Server running on stdio');

// Also start the HTTP API server
// Start the HTTP API server (Express)
import('./http-server.js')
  .then(() => console.error('Auth HTTP Server initialized'))
  .catch(err => console.error('Failed to start Auth HTTP Server:', err));