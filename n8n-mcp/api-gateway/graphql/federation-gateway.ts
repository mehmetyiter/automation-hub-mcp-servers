import { ApolloGateway, IntrospectAndCompose, RemoteGraphQLDataSource } from '@apollo/gateway';
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { Redis } from 'ioredis';
import { GraphQLError, GraphQLRequestContext } from 'graphql';
import { SchemaRegistry, SchemaComposition } from './schema-registry';
import { AdvancedRateLimiter, RateLimitRequest } from '../src/gateway/rate-limiter';
import { LoggingService } from '../../src/observability/logging';
import { MetricsService } from '../../src/observability/metrics';

const logger = LoggingService.getInstance();
const metrics = MetricsService.getInstance();

export interface GraphQLGatewayConfig {
  port: number;
  introspectionEnabled?: boolean;
  playgroundEnabled?: boolean;
  rateLimiter?: AdvancedRateLimiter;
  schemaRegistry: SchemaRegistry;
  redis: Redis;
}

export interface GraphQLContext {
  userId?: string;
  apiKeyId?: string;
  scopes?: string[];
  requestId: string;
  traceId: string;
  startTime: number;
  rateLimitInfo?: any;
}

export interface QueryComplexity {
  score: number;
  depth: number;
  breadth: number;
  fields: number;
}

export class AuthenticatedDataSource extends RemoteGraphQLDataSource {
  willSendRequest({ request, context }: { request: any; context: GraphQLContext }) {
    // Forward authentication headers
    if (context.userId) {
      request.http.headers.set('x-user-id', context.userId);
    }
    
    if (context.apiKeyId) {
      request.http.headers.set('x-api-key-id', context.apiKeyId);
    }
    
    if (context.scopes) {
      request.http.headers.set('x-scopes', context.scopes.join(','));
    }
    
    // Add tracing headers
    request.http.headers.set('x-request-id', context.requestId);
    request.http.headers.set('x-trace-id', context.traceId);
    
    // Add timing header
    request.http.headers.set('x-start-time', context.startTime.toString());
  }

  async didReceiveResponse({ response, request, context }: any) {
    const duration = Date.now() - context.startTime;
    
    // Log service response
    logger.debug('Service response received', {
      service: this.url,
      requestId: context.requestId,
      duration,
      status: response.http?.status || 'unknown'
    });
    
    // Record metrics
    metrics.recordMetric('graphql', 'serviceResponse', 1, {
      service: this.url,
      status: response.http?.status?.toString() || 'unknown',
      duration: duration.toString()
    });
    
    return response;
  }

  async didEncounterError(error: Error, request: any, context: GraphQLContext) {
    logger.error('Service request failed', {
      service: this.url,
      requestId: context.requestId,
      error: error.message
    });
    
    metrics.recordMetric('graphql', 'serviceError', 1, {
      service: this.url,
      error: error.constructor.name
    });
  }
}

export class GraphQLFederationGateway {
  private gateway: ApolloGateway | null = null;
  private server: ApolloServer | null = null;
  private config: GraphQLGatewayConfig;
  private redis: Redis;
  private isRunning = false;

  constructor(config: GraphQLGatewayConfig) {
    this.config = config;
    this.redis = config.redis;
    
    this.subscribeToSchemaUpdates();
  }

  async start(): Promise<void> {
    try {
      await this.initializeGateway();
      
      if (!this.server) {
        throw new Error('Server initialization failed');
      }

      const { url } = await startStandaloneServer(this.server, {
        listen: { port: this.config.port },
        context: async ({ req }) => this.createContext(req)
      });

      this.isRunning = true;
      logger.info('GraphQL Federation Gateway started', { url });
      
      metrics.recordMetric('graphql', 'gatewayStarted', 1, {
        port: this.config.port.toString()
      });

    } catch (error) {
      logger.error('Failed to start GraphQL Gateway', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.server) {
      await this.server.stop();
    }
    
    if (this.gateway) {
      await this.gateway.stop();
    }
    
    this.isRunning = false;
    logger.info('GraphQL Federation Gateway stopped');
  }

  private async initializeGateway(): Promise<void> {
    const composition = await this.config.schemaRegistry.getCurrentComposition();
    
    if (!composition || !composition.isValid) {
      throw new Error('No valid schema composition available');
    }

    const services = composition.services.map(service => ({
      name: service.name,
      url: service.url
    }));

    this.gateway = new ApolloGateway({
      supergraphSdl: composition.supergraphSdl,
      
      buildService({ name, url }) {
        return new AuthenticatedDataSource({ 
          url,
          willSendRequest: ({ request, context }) => {
            const authenticatedDataSource = new AuthenticatedDataSource({ url });
            authenticatedDataSource.willSendRequest({ request, context });
          }
        });
      },
      
      experimental_pollInterval: 10000,
      experimental_didUpdateSupergraph: async ({ supergraphSdl }) => {
        logger.info('Supergraph updated', { 
          timestamp: new Date().toISOString() 
        });
        
        metrics.recordMetric('graphql', 'supergraphUpdated', 1);
      }
    });

    this.server = new ApolloServer({
      gateway: this.gateway,
      introspection: this.config.introspectionEnabled ?? false,
      
      plugins: [
        this.createPerformancePlugin(),
        this.createComplexityPlugin(),
        this.createRateLimitPlugin(),
        this.createLoggingPlugin(),
        this.createMetricsPlugin()
      ],
      
      formatError: (error) => {
        logger.error('GraphQL error', {
          message: error.message,
          locations: error.locations,
          path: error.path,
          extensions: error.extensions
        });
        
        // Don't expose internal errors in production
        if (process.env.NODE_ENV === 'production' && 
            error.message.includes('Internal server error')) {
          return new GraphQLError('An internal error occurred');
        }
        
        return error;
      }
    });
  }

  private async createContext(req: any): Promise<GraphQLContext> {
    const requestId = req.headers['x-request-id'] || 
                     `gql_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const traceId = req.headers['x-trace-id'] || requestId;
    
    // Extract authentication from headers
    const userId = req.headers['x-user-id'];
    const apiKeyId = req.headers['x-api-key-id'];
    const scopes = req.headers['x-scopes']?.split(',') || [];
    
    return {
      userId,
      apiKeyId,
      scopes,
      requestId,
      traceId,
      startTime: Date.now()
    };
  }

  private createPerformancePlugin() {
    return {
      requestDidStart() {
        const startTime = Date.now();
        
        return {
          async willSendResponse(requestContext: GraphQLRequestContext<GraphQLContext>) {
            const duration = Date.now() - startTime;
            const context = requestContext.contextValue;
            
            // Set performance headers
            if (requestContext.response.http) {
              requestContext.response.http.headers.set('x-response-time', `${duration}ms`);
              requestContext.response.http.headers.set('x-request-id', context.requestId);
              requestContext.response.http.headers.set('x-trace-id', context.traceId);
            }
            
            // Log slow queries
            if (duration > 1000) { // 1 second
              logger.warn('Slow GraphQL query detected', {
                requestId: context.requestId,
                duration,
                query: requestContext.request.query?.substring(0, 200),
                variables: requestContext.request.variables
              });
              
              metrics.recordMetric('graphql', 'slowQuery', 1, {
                duration: duration.toString(),
                userId: context.userId || 'anonymous'
              });
            }
          }
        };
      }
    };
  }

  private createComplexityPlugin() {
    const MAX_COMPLEXITY = 1000;
    const MAX_DEPTH = 15;
    
    return {
      requestDidStart() {
        return {
          async didResolveOperation(requestContext: GraphQLRequestContext<GraphQLContext>) {
            const complexity = this.calculateQueryComplexity(requestContext.document!);
            
            if (complexity.score > MAX_COMPLEXITY) {
              throw new GraphQLError(
                `Query complexity ${complexity.score} exceeds maximum allowed complexity ${MAX_COMPLEXITY}`,
                {
                  extensions: {
                    code: 'QUERY_TOO_COMPLEX',
                    complexity: complexity.score,
                    maxComplexity: MAX_COMPLEXITY
                  }
                }
              );
            }
            
            if (complexity.depth > MAX_DEPTH) {
              throw new GraphQLError(
                `Query depth ${complexity.depth} exceeds maximum allowed depth ${MAX_DEPTH}`,
                {
                  extensions: {
                    code: 'QUERY_TOO_DEEP',
                    depth: complexity.depth,
                    maxDepth: MAX_DEPTH
                  }
                }
              );
            }
            
            // Store complexity in context
            requestContext.contextValue.queryComplexity = complexity;
          }
        };
      }
    };
  }

  private createRateLimitPlugin() {
    if (!this.config.rateLimiter) {
      return {};
    }
    
    const rateLimiter = this.config.rateLimiter;
    
    return {
      requestDidStart() {
        return {
          async didResolveOperation(requestContext: GraphQLRequestContext<GraphQLContext>) {
            const context = requestContext.contextValue;
            
            // Create rate limit request
            const rateLimitRequest: RateLimitRequest = {
              userId: context.userId,
              apiKey: context.apiKeyId,
              ip: requestContext.request.http?.headers.get('x-forwarded-for') || 'unknown',
              path: '/graphql',
              method: 'POST',
              headers: Object.fromEntries(requestContext.request.http?.headers.entries() || []),
              metadata: {
                queryComplexity: (context as any).queryComplexity?.score || 0,
                operationType: requestContext.operation?.operation || 'query'
              }
            };
            
            const rateLimitResult = await rateLimiter.checkRateLimit(rateLimitRequest);
            
            if (!rateLimitResult.allowed) {
              // Add rate limit headers
              if (requestContext.response.http) {
                Object.entries(rateLimitResult.headers).forEach(([key, value]) => {
                  requestContext.response.http!.headers.set(key, value);
                });
              }
              
              throw new GraphQLError('Rate limit exceeded', {
                extensions: {
                  code: 'RATE_LIMITED',
                  retryAfter: rateLimitResult.retryAfter,
                  policy: rateLimitResult.policy
                }
              });
            }
            
            // Store rate limit info in context
            context.rateLimitInfo = rateLimitResult;
          },
          
          async willSendResponse(requestContext: GraphQLRequestContext<GraphQLContext>) {
            const rateLimitInfo = requestContext.contextValue.rateLimitInfo;
            
            // Add rate limit headers to response
            if (rateLimitInfo && requestContext.response.http) {
              Object.entries(rateLimitInfo.headers).forEach(([key, value]) => {
                requestContext.response.http!.headers.set(key, value);
              });
            }
          }
        };
      }
    };
  }

  private createLoggingPlugin() {
    return {
      requestDidStart() {
        return {
          async didResolveOperation(requestContext: GraphQLRequestContext<GraphQLContext>) {
            const context = requestContext.contextValue;
            
            logger.info('GraphQL operation started', {
              requestId: context.requestId,
              operationType: requestContext.operation?.operation,
              operationName: requestContext.operationName,
              userId: context.userId,
              complexity: (context as any).queryComplexity?.score
            });
          },
          
          async didEncounterErrors(requestContext: GraphQLRequestContext<GraphQLContext>) {
            const context = requestContext.contextValue;
            
            requestContext.errors?.forEach(error => {
              logger.error('GraphQL execution error', {
                requestId: context.requestId,
                error: error.message,
                path: error.path,
                locations: error.locations,
                userId: context.userId
              });
            });
          }
        };
      }
    };
  }

  private createMetricsPlugin() {
    return {
      requestDidStart() {
        const startTime = Date.now();
        
        return {
          async didResolveOperation(requestContext: GraphQLRequestContext<GraphQLContext>) {
            metrics.recordMetric('graphql', 'operationStarted', 1, {
              operationType: requestContext.operation?.operation || 'unknown',
              operationName: requestContext.operationName || 'anonymous'
            });
          },
          
          async willSendResponse(requestContext: GraphQLRequestContext<GraphQLContext>) {
            const duration = Date.now() - startTime;
            const context = requestContext.contextValue;
            const hasErrors = (requestContext.errors?.length || 0) > 0;
            
            metrics.recordMetric('graphql', 'operationCompleted', 1, {
              operationType: requestContext.operation?.operation || 'unknown',
              success: (!hasErrors).toString(),
              duration: duration.toString(),
              userId: context.userId || 'anonymous'
            });
            
            // Record complexity metrics
            const complexity = (context as any).queryComplexity;
            if (complexity) {
              metrics.recordMetric('graphql', 'queryComplexity', complexity.score, {
                operationType: requestContext.operation?.operation || 'unknown'
              });
              
              metrics.recordMetric('graphql', 'queryDepth', complexity.depth, {
                operationType: requestContext.operation?.operation || 'unknown'
              });
            }
          }
        };
      }
    };
  }

  private calculateQueryComplexity(document: any): QueryComplexity {
    // Simplified complexity calculation
    // In production, use a proper complexity analysis library
    
    let score = 0;
    let depth = 0;
    let breadth = 0;
    let fields = 0;
    
    const visit = (node: any, currentDepth: number = 0) => {
      if (!node) return;
      
      if (node.kind === 'Field') {
        fields++;
        score += 1;
        depth = Math.max(depth, currentDepth);
        
        if (node.selectionSet) {
          const childFields = node.selectionSet.selections?.length || 0;
          breadth = Math.max(breadth, childFields);
          score += childFields * 0.5; // Child fields add less complexity
          
          node.selectionSet.selections?.forEach((child: any) => {
            visit(child, currentDepth + 1);
          });
        }
      } else if (node.selectionSet) {
        node.selectionSet.selections?.forEach((child: any) => {
          visit(child, currentDepth);
        });
      }
      
      // Handle arguments (add complexity for each argument)
      if (node.arguments) {
        score += node.arguments.length * 0.2;
      }
      
      // Handle directives (some directives are more expensive)
      if (node.directives) {
        node.directives.forEach((directive: any) => {
          if (directive.name.value === 'include' || directive.name.value === 'skip') {
            score += 0.1; // Conditional fields add slight complexity
          }
        });
      }
    };
    
    document.definitions?.forEach((definition: any) => {
      if (definition.kind === 'OperationDefinition') {
        definition.selectionSet?.selections?.forEach((selection: any) => {
          visit(selection, 1);
        });
      }
    });
    
    return { score: Math.round(score), depth, breadth, fields };
  }

  private subscribeToSchemaUpdates(): void {
    const subscriber = this.redis.duplicate();
    
    subscriber.subscribe('schema_updates', (err) => {
      if (err) {
        logger.error('Failed to subscribe to schema updates', { err });
        return;
      }
      
      logger.info('Subscribed to schema updates');
    });
    
    subscriber.on('message', async (channel, message) => {
      if (channel === 'schema_updates') {
        try {
          const update = JSON.parse(message);
          
          if (update.type === 'composition_updated') {
            logger.info('Received schema update notification', {
              compositionId: update.compositionId
            });
            
            // Reload gateway with new composition
            await this.reloadGateway();
          }
        } catch (error) {
          logger.error('Failed to process schema update', { error, message });
        }
      }
    });
  }

  private async reloadGateway(): Promise<void> {
    try {
      logger.info('Reloading GraphQL Gateway with updated schema');
      
      if (this.gateway) {
        await this.gateway.stop();
      }
      
      await this.initializeGateway();
      
      logger.info('GraphQL Gateway reloaded successfully');
      metrics.recordMetric('graphql', 'gatewayReloaded', 1);
      
    } catch (error) {
      logger.error('Failed to reload GraphQL Gateway', { error });
      metrics.recordMetric('graphql', 'reloadFailed', 1);
    }
  }

  isHealthy(): boolean {
    return this.isRunning && this.server !== null && this.gateway !== null;
  }

  async getSchema(): Promise<string | null> {
    const composition = await this.config.schemaRegistry.getCurrentComposition();
    return composition?.supergraphSdl || null;
  }

  async getServiceHealth(): Promise<Record<string, boolean>> {
    const schemas = await this.config.schemaRegistry.getAllSchemas();
    const health: Record<string, boolean> = {};
    
    schemas.forEach(schema => {
      health[schema.name] = schema.health === 'healthy';
    });
    
    return health;
  }
}