import { faker } from '@faker-js/faker';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { DeepPartial } from 'utility-types';
import { LoggingService } from '../observability/logging.js';

const logger = LoggingService.getInstance();

export interface FactoryDefinition<T> {
  build: (context: FactoryContext) => Promise<T> | T;
  traits?: Record<string, (context: FactoryContext) => Promise<Partial<T>> | Partial<T>>;
  persist?: (instance: T) => Promise<T>;
  associations?: Record<string, AssociationDefinition>;
}

export interface FactoryContext {
  sequence: number;
  faker: typeof import('@faker-js/faker').faker;
  factory: TestFactory;
  associations?: Record<string, any>;
}

export interface FactoryOptions {
  traits?: string[];
  persist?: boolean;
  associations?: Record<string, any>;
}

export interface AssociationDefinition {
  factory: string;
  options?: FactoryOptions;
  required?: boolean;
}

export interface User {
  id?: string;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  plan: string;
  settings: any;
  metadata: any;
  email_verified: boolean;
  status: string;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date;
}

export interface Workflow {
  id?: string;
  name: string;
  description?: string;
  user_id: string;
  nodes: any[];
  connections: any[];
  settings: any;
  active: boolean;
  status: string;
  tags: string[];
  version: number;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date;
}

export interface ApiKey {
  id?: string;
  hash: string;
  name: string;
  user_id: string;
  scopes: string[];
  rate_limit: any;
  expires_at?: Date;
  metadata: any;
  last_used_at?: Date;
  usage_count: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface Execution {
  id?: string;
  workflow_id: string;
  status: string;
  mode: string;
  started_at?: Date;
  finished_at?: Date;
  data: any;
  result: any;
  error_message?: string;
  execution_time?: number;
  metadata: any;
}

export class TestFactory {
  private factories: Map<string, FactoryDefinition<any>> = new Map();
  private sequences: Map<string, number> = new Map();
  private db: Pool;
  private redis: Redis;
  private createdInstances: Map<string, any[]> = new Map();

  constructor(db: Pool, redis: Redis) {
    this.db = db;
    this.redis = redis;
  }

  async initialize(): Promise<void> {
    this.defineUserFactory();
    this.defineWorkflowFactory();
    this.defineApiKeyFactory();
    this.defineExecutionFactory();
    this.defineNodeFactory();
    this.defineCredentialFactory();
    
    logger.info('Test factory initialized with all factories');
  }

  define<T>(name: string, definition: FactoryDefinition<T>): void {
    this.factories.set(name, definition);
    this.sequences.set(name, 0);
  }

  async create<T>(
    name: string,
    overrides?: DeepPartial<T>,
    options?: FactoryOptions
  ): Promise<T> {
    const factory = this.factories.get(name);
    if (!factory) {
      throw new Error(`Factory '${name}' not defined`);
    }

    const sequence = this.getNextSequence(name);
    const context: FactoryContext = {
      sequence,
      faker,
      factory: this,
      associations: options?.associations || {}
    };

    // Build associations first
    const associations: Record<string, any> = {};
    if (factory.associations) {
      for (const [key, assocDef] of Object.entries(factory.associations)) {
        if (options?.associations?.[key]) {
          associations[key] = options.associations[key];
        } else if (assocDef.required !== false) {
          associations[key] = await this.create(assocDef.factory, {}, assocDef.options);
        }
      }
    }
    context.associations = { ...context.associations, ...associations };

    // Build base object
    const base = await factory.build(context);

    // Apply overrides
    const instance = this.deepMerge(base, overrides || {});

    // Apply traits
    if (options?.traits) {
      for (const trait of options.traits) {
        const traitDef = factory.traits?.[trait];
        if (traitDef) {
          const traitData = await traitDef(context);
          Object.assign(instance, traitData);
        }
      }
    }

    // Persist if requested
    if (options?.persist && factory.persist) {
      const persistedInstance = await factory.persist(instance);
      this.trackCreatedInstance(name, persistedInstance);
      return persistedInstance;
    }

    this.trackCreatedInstance(name, instance);
    return instance;
  }

  async createMany<T>(
    name: string,
    count: number,
    overrides?: DeepPartial<T>,
    options?: FactoryOptions
  ): Promise<T[]> {
    const promises = Array(count).fill(null).map((_, index) =>
      this.create(name, overrides, options)
    );

    return Promise.all(promises);
  }

  private defineUserFactory(): void {
    this.define<User>('user', {
      build: ({ sequence, faker }) => ({
        email: `user${sequence}@example.com`,
        name: faker.person.fullName(),
        password_hash: faker.internet.password({ length: 60 }),
        role: 'user',
        plan: 'free',
        settings: {
          theme: faker.helpers.arrayElement(['light', 'dark']),
          notifications: faker.datatype.boolean(),
          language: faker.helpers.arrayElement(['en', 'tr', 'de', 'fr'])
        },
        metadata: {
          lastLogin: faker.date.recent(),
          signupSource: faker.helpers.arrayElement(['web', 'mobile', 'api'])
        },
        email_verified: faker.datatype.boolean({ probability: 0.8 }),
        status: 'active'
      }),

      traits: {
        admin: () => ({ role: 'admin', plan: 'enterprise' }),
        premium: () => ({ plan: 'pro' }),
        enterprise: () => ({ plan: 'enterprise' }),
        unverified: () => ({ email_verified: false }),
        deleted: ({ faker }) => ({
          status: 'deleted',
          deleted_at: faker.date.recent()
        }),
        inactive: () => ({ status: 'inactive' }),
        new: () => ({
          settings: { theme: 'light', notifications: true },
          metadata: { signupSource: 'web' }
        })
      },

      persist: async (user) => {
        const query = `
          INSERT INTO users (email, name, password_hash, role, plan, settings, metadata, email_verified, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `;
        const result = await this.db.query(query, [
          user.email,
          user.name,
          user.password_hash,
          user.role,
          user.plan,
          JSON.stringify(user.settings),
          JSON.stringify(user.metadata),
          user.email_verified,
          user.status
        ]);
        return result.rows[0];
      }
    });
  }

  private defineWorkflowFactory(): void {
    this.define<Workflow>('workflow', {
      build: async ({ sequence, faker, factory }) => {
        return {
          name: `Test Workflow ${sequence}`,
          description: faker.lorem.paragraph(),
          user_id: '', // Will be set by association
          nodes: await factory.createMany('node', faker.number.int({ min: 2, max: 5 })),
          connections: [],
          settings: {
            timezone: faker.location.timeZone(),
            errorWorkflow: null,
            saveManualExecutions: faker.datatype.boolean()
          },
          active: faker.datatype.boolean(),
          status: faker.helpers.arrayElement(['draft', 'active', 'paused', 'error']),
          tags: faker.helpers.arrayElements(['automation', 'data', 'api', 'webhook'], { min: 0, max: 3 }),
          version: 1
        };
      },

      associations: {
        user: {
          factory: 'user',
          required: true
        }
      },

      traits: {
        complex: async ({ factory }) => ({
          nodes: await factory.createMany('node', 20),
          connections: generateComplexConnections(20)
        }),
        simple: async ({ factory }) => ({
          nodes: await factory.createMany('node', 2),
          connections: generateSimpleConnections(2)
        }),
        failing: ({ faker }) => ({
          status: 'error',
          metadata: {
            lastError: faker.lorem.sentence(),
            lastRunAt: faker.date.recent()
          }
        }),
        active: () => ({ active: true, status: 'active' }),
        draft: () => ({ active: false, status: 'draft' })
      },

      persist: async (workflow) => {
        const query = `
          INSERT INTO workflows (name, description, user_id, nodes, connections, settings, active, status, tags, version)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *
        `;
        const result = await this.db.query(query, [
          workflow.name,
          workflow.description,
          workflow.user_id,
          JSON.stringify(workflow.nodes),
          JSON.stringify(workflow.connections),
          JSON.stringify(workflow.settings),
          workflow.active,
          workflow.status,
          workflow.tags,
          workflow.version
        ]);
        return result.rows[0];
      }
    });
  }

  private defineApiKeyFactory(): void {
    this.define<ApiKey>('apiKey', {
      build: ({ sequence, faker }) => ({
        hash: faker.string.alphanumeric(64),
        name: `Test API Key ${sequence}`,
        user_id: '', // Will be set by association
        scopes: faker.helpers.arrayElements(['read', 'write', 'admin'], { min: 1, max: 3 }),
        rate_limit: {
          requests: faker.number.int({ min: 100, max: 10000 }),
          window: 3600,
          algorithm: faker.helpers.arrayElement(['token-bucket', 'sliding-window'])
        },
        expires_at: faker.date.future(),
        metadata: {
          ipWhitelist: [],
          allowedOrigins: ['*'],
          plan: 'free'
        },
        usage_count: faker.number.int({ min: 0, max: 1000 })
      }),

      associations: {
        user: {
          factory: 'user',
          required: true
        }
      },

      traits: {
        admin: () => ({
          scopes: ['read', 'write', 'admin'],
          rate_limit: { requests: 10000, window: 3600 }
        }),
        readonly: () => ({
          scopes: ['read']
        }),
        expired: ({ faker }) => ({
          expires_at: faker.date.past()
        }),
        unlimited: () => ({
          rate_limit: { requests: -1, window: 3600 }
        })
      },

      persist: async (apiKey) => {
        const query = `
          INSERT INTO api_keys (hash, name, user_id, scopes, rate_limit, expires_at, metadata, usage_count)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `;
        const result = await this.db.query(query, [
          apiKey.hash,
          apiKey.name,
          apiKey.user_id,
          JSON.stringify(apiKey.scopes),
          JSON.stringify(apiKey.rate_limit),
          apiKey.expires_at,
          JSON.stringify(apiKey.metadata),
          apiKey.usage_count
        ]);
        return result.rows[0];
      }
    });
  }

  private defineExecutionFactory(): void {
    this.define<Execution>('execution', {
      build: ({ sequence, faker }) => ({
        workflow_id: '', // Will be set by association
        status: faker.helpers.arrayElement(['new', 'running', 'success', 'error', 'canceled']),
        mode: faker.helpers.arrayElement(['manual', 'trigger', 'webhook']),
        data: {
          input: faker.helpers.arrayElements([
            { id: 1, name: faker.commerce.productName() },
            { id: 2, name: faker.commerce.productName() }
          ])
        },
        result: {
          output: faker.helpers.maybe(() => ({
            processed: faker.number.int({ min: 1, max: 100 }),
            success: faker.datatype.boolean()
          }))
        },
        execution_time: faker.number.int({ min: 100, max: 30000 }),
        metadata: {
          nodeExecutions: faker.number.int({ min: 1, max: 10 }),
          memoryUsage: faker.number.int({ min: 50, max: 500 }),
          cpuTime: faker.number.int({ min: 10, max: 1000 })
        }
      }),

      associations: {
        workflow: {
          factory: 'workflow',
          required: true
        }
      },

      traits: {
        successful: () => ({
          status: 'success',
          finished_at: new Date(),
          result: { success: true, processed: 100 }
        }),
        failed: ({ faker }) => ({
          status: 'error',
          finished_at: new Date(),
          error_message: faker.lorem.sentence(),
          result: { success: false, error: 'Execution failed' }
        }),
        running: () => ({
          status: 'running',
          finished_at: null
        }),
        quick: () => ({
          execution_time: faker.number.int({ min: 50, max: 500 })
        }),
        slow: () => ({
          execution_time: faker.number.int({ min: 10000, max: 60000 })
        })
      },

      persist: async (execution) => {
        const query = `
          INSERT INTO executions (workflow_id, status, mode, data, result, error_message, execution_time, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `;
        const result = await this.db.query(query, [
          execution.workflow_id,
          execution.status,
          execution.mode,
          JSON.stringify(execution.data),
          JSON.stringify(execution.result),
          execution.error_message,
          execution.execution_time,
          JSON.stringify(execution.metadata)
        ]);
        return result.rows[0];
      }
    });
  }

  private defineNodeFactory(): void {
    this.define('node', {
      build: ({ sequence, faker }) => ({
        id: `node-${sequence}`,
        type: faker.helpers.arrayElement([
          'http-request',
          'webhook',
          'transform',
          'condition',
          'loop',
          'timer',
          'email',
          'database'
        ]),
        name: `${faker.hacker.verb()} ${faker.hacker.noun()}`,
        position: {
          x: faker.number.int({ min: 0, max: 1000 }),
          y: faker.number.int({ min: 0, max: 800 })
        },
        parameters: generateNodeParameters(faker)
      }),

      traits: {
        webhook: ({ sequence, faker }) => ({
          id: `node-${sequence}`,
          type: 'webhook' as const,
          name: `${faker.hacker.verb()} ${faker.hacker.noun()}`,
          position: {
            x: faker.number.int({ min: 0, max: 1000 }),
            y: faker.number.int({ min: 0, max: 800 })
          },
          parameters: {
            path: '/webhook/test',
            method: 'POST',
            responseMode: 'onReceived'
          }
        }),
        httpRequest: ({ sequence, faker }) => ({
          id: `node-${sequence}`,
          type: 'http-request' as const,
          name: `${faker.hacker.verb()} ${faker.hacker.noun()}`,
          position: {
            x: faker.number.int({ min: 0, max: 1000 }),
            y: faker.number.int({ min: 0, max: 800 })
          },
          parameters: {
            url: faker.internet.url(),
            method: faker.helpers.arrayElement(['GET', 'POST', 'PUT']),
            headers: {},
            path: '', // Add missing properties to match webhook structure
            responseMode: 'onReceived'
          } as any
        }),
        transform: ({ sequence, faker }) => ({
          id: `node-${sequence}`,
          type: 'transform' as const,
          name: `${faker.hacker.verb()} ${faker.hacker.noun()}`,
          position: {
            x: faker.number.int({ min: 0, max: 1000 }),
            y: faker.number.int({ min: 0, max: 800 })
          },
          parameters: {
            code: 'return items;',
            workflowMode: 'manual',
            path: '', // Add missing properties to match webhook structure
            method: 'POST',
            responseMode: 'onReceived'
          } as any
        })
      }
    });
  }

  private defineCredentialFactory(): void {
    this.define('credential', {
      build: ({ sequence, faker }) => ({
        name: `Test Credential ${sequence}`,
        type: faker.helpers.arrayElement(['http', 'database', 'email', 'webhook']),
        user_id: '', // Will be set by association
        data: {
          username: faker.internet.userName(),
          password: faker.internet.password()
        }
      }),

      associations: {
        user: {
          factory: 'user',
          required: true
        }
      },

      traits: {
        http: ({ faker }) => ({
          type: 'http' as const,
          data: {
            url: faker.internet.url(),
            apiKey: faker.string.alphanumeric(32),
            username: '', // Add missing properties
            password: ''
          } as any
        }),
        database: ({ faker }) => ({
          type: 'database' as const,
          data: {
            host: faker.internet.ip(),
            port: 5432,
            database: faker.lorem.word(),
            username: faker.internet.userName(),
            password: faker.internet.password()
          }
        })
      },

      persist: async (credential) => {
        const query = `
          INSERT INTO credentials (name, type, user_id, data)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `;
        const result = await this.db.query(query, [
          credential.name,
          credential.type,
          credential.user_id,
          JSON.stringify(credential.data)
        ]);
        return result.rows[0];
      }
    });
  }

  private getNextSequence(name: string): number {
    const current = this.sequences.get(name) || 0;
    const next = current + 1;
    this.sequences.set(name, next);
    return next;
  }

  private deepMerge(target: any, source: any): any {
    if (source === null || source === undefined) {
      return target;
    }

    const output = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (isObject(source[key]) && isObject(target[key])) {
          output[key] = this.deepMerge(target[key], source[key]);
        } else {
          output[key] = source[key];
        }
      }
    }
    
    return output;
  }

  private trackCreatedInstance(factoryName: string, instance: any): void {
    if (!this.createdInstances.has(factoryName)) {
      this.createdInstances.set(factoryName, []);
    }
    this.createdInstances.get(factoryName)!.push(instance);
  }

  async cleanup(): Promise<void> {
    // Clean up created instances in reverse order
    const factoryNames = Array.from(this.createdInstances.keys()).reverse();
    
    for (const factoryName of factoryNames) {
      const instances = this.createdInstances.get(factoryName) || [];
      
      for (const instance of instances) {
        if (instance.id) {
          try {
            await this.deleteInstance(factoryName, instance.id);
          } catch (error) {
            logger.warn(`Failed to cleanup ${factoryName} instance`, {
              id: instance.id,
              error: error.message
            });
          }
        }
      }
    }
    
    this.createdInstances.clear();
    this.sequences.clear();
  }

  private async deleteInstance(factoryName: string, id: string): Promise<void> {
    const tableMap: Record<string, string> = {
      user: 'users',
      workflow: 'workflows',
      apiKey: 'api_keys',
      execution: 'executions',
      credential: 'credentials'
    };

    const tableName = tableMap[factoryName];
    if (tableName) {
      await this.db.query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    }
  }
}

// Helper functions
function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

function generateNodeParameters(faker: any): any {
  return {
    value: faker.helpers.maybe(() => faker.lorem.word()),
    expression: faker.helpers.maybe(() => '={{$json.data}}'),
    options: faker.helpers.maybe(() => ({
      timeout: faker.number.int({ min: 1000, max: 30000 }),
      retry: faker.number.int({ min: 0, max: 3 })
    }))
  };
}

function generateComplexConnections(nodeCount: number): any[] {
  const connections = [];
  for (let i = 0; i < nodeCount - 1; i++) {
    connections.push({
      source: `node-${i + 1}`,
      target: `node-${i + 2}`,
      sourceOutput: 'main',
      targetInput: 'main'
    });
  }
  return connections;
}

function generateSimpleConnections(nodeCount: number): any[] {
  if (nodeCount < 2) return [];
  
  return [{
    source: 'node-1',
    target: 'node-2',
    sourceOutput: 'main',
    targetInput: 'main'
  }];
}