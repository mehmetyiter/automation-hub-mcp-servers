export const TOOLS = [
  {
    name: 'auth_login',
    description: 'Authenticate a user with email and password',
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          format: 'email',
          description: 'User email address'
        },
        password: {
          type: 'string',
          description: 'User password'
        }
      },
      required: ['email', 'password']
    }
  },
  {
    name: 'auth_register',
    description: 'Register a new user account',
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          format: 'email',
          description: 'User email address'
        },
        password: {
          type: 'string',
          description: 'User password (min 8 chars, uppercase, lowercase, number, special char)'
        },
        name: {
          type: 'string',
          description: 'User full name'
        },
        role: {
          type: 'string',
          enum: ['admin', 'editor', 'viewer'],
          description: 'User role',
          default: 'viewer'
        }
      },
      required: ['email', 'password', 'name']
    }
  },
  {
    name: 'auth_verify_token',
    description: 'Verify if an authentication token is valid',
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'JWT authentication token'
        }
      },
      required: ['token']
    }
  },
  {
    name: 'auth_get_user',
    description: 'Get user information from authentication token',
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'JWT authentication token'
        }
      },
      required: ['token']
    }
  },
  {
    name: 'auth_logout',
    description: 'Logout and invalidate authentication token',
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'JWT authentication token'
        }
      },
      required: ['token']
    }
  }
];