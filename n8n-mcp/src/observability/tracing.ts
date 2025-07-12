import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { trace, SpanStatusCode, SpanKind, context } from '@opentelemetry/api';

export class TracingService {
  private provider: NodeTracerProvider;
  private static instance: TracingService;
  
  constructor() {
    this.provider = new NodeTracerProvider({
      resource: Resource.default().merge(
        new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: 'n8n-mcp',
          [SemanticResourceAttributes.SERVICE_VERSION]: process.env.VERSION || '1.0.0',
          [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
          [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'automation-hub',
          [SemanticResourceAttributes.SERVICE_INSTANCE_ID]: process.env.INSTANCE_ID || `instance-${Date.now()}`,
        })
      ),
    });

    // Configure Jaeger exporter
    const jaegerExporter = new JaegerExporter({
      endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
      tags: [
        { key: 'service.namespace', value: 'n8n-mcp' },
        { key: 'service.instance.id', value: process.env.INSTANCE_ID || `instance-${Date.now()}` }
      ],
    });

    // Add span processor with batching
    this.provider.addSpanProcessor(
      new BatchSpanProcessor(jaegerExporter, {
        maxQueueSize: 1000,
        maxExportBatchSize: 512,
        scheduledDelayMillis: 5000,
        exportTimeoutMillis: 30000,
      })
    );

    // Register the provider
    this.provider.register();

    // Register instrumentations
    this.registerInstrumentations();
  }

  static getInstance(): TracingService {
    if (!TracingService.instance) {
      TracingService.instance = new TracingService();
    }
    return TracingService.instance;
  }

  private registerInstrumentations(): void {
    // HTTP instrumentation
    registerInstrumentations({
      instrumentations: [
        new HttpInstrumentation({
          requestHook: (span, request) => {
            span.setAttributes({
              'http.request.body.size': request.headers['content-length'] || '0',
              'http.user_agent': request.headers['user-agent'] || 'unknown',
              'custom.user_id': (request as any).user?.id || 'anonymous',
              'custom.workspace_id': (request as any).workspace?.id,
            });
          },
          responseHook: (span, response) => {
            span.setAttributes({
              'http.response.body.size': response.getHeader('content-length') || '0',
              'custom.cache_hit': response.getHeader('x-cache-hit') === 'true',
            });
          },
          ignoreIncomingPaths: ['/health', '/metrics', '/ready'],
          ignoreOutgoingUrls: [(url) => url.includes('metrics')],
        }),
        new ExpressInstrumentation({
          requestHook: (span, info) => {
            span.updateName(`${info.request.method} ${info.route}`);
          },
        }),
        new IORedisInstrumentation({
          requestHook: (span, cmdArgs) => {
            span.setAttributes({
              'redis.command': cmdArgs.command,
              'redis.key': cmdArgs.args?.[0],
            });
          },
        }),
        new PgInstrumentation({
          enhancedDatabaseReporting: true,
          requestHook: (span, queryInfo) => {
            span.setAttributes({
              'db.statement.summary': this.summarizeQuery(queryInfo.query?.text || ''),
            });
          },
        }),
      ],
    });
  }

  private summarizeQuery(query: string): string {
    // Extract table name and operation type
    const match = query.match(/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP)\s+(?:INTO\s+)?(?:FROM\s+)?(\w+)?/i);
    return match ? `${match[1]} ${match[2] || 'unknown'}` : 'unknown';
  }

  // Create custom spans for AI provider calls
  traceAIProviderCall(provider: string, model: string) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const tracer = trace.getTracer('ai-provider-tracer', '1.0.0');
        
        return tracer.startActiveSpan(`ai.${provider}.${propertyKey}`, {
          kind: SpanKind.CLIENT,
          attributes: {
            'ai.provider': provider,
            'ai.model': model,
            'ai.operation': propertyKey,
            'ai.request.prompt_length': args[0]?.prompt?.length || 0,
            'ai.request.max_tokens': args[0]?.max_tokens || 0,
          }
        }, async (span) => {
          const startTime = Date.now();

          try {
            const result = await originalMethod.apply(this, args);
            const duration = Date.now() - startTime;
            
            span.setAttributes({
              'ai.response.tokens.prompt': result?.usage?.prompt_tokens || 0,
              'ai.response.tokens.completion': result?.usage?.completion_tokens || 0,
              'ai.response.tokens.total': result?.usage?.total_tokens || 0,
              'ai.response.cost': result?.cost || 0,
              'ai.response.cached': result?.cached || false,
              'ai.response.duration_ms': duration,
              'ai.response.model_used': result?.model || model,
            });

            // Add event for token usage
            span.addEvent('token_usage', {
              prompt_tokens: result?.usage?.prompt_tokens || 0,
              completion_tokens: result?.usage?.completion_tokens || 0,
              estimated_cost: result?.cost || 0,
            });

            span.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (error: any) {
            span.recordException(error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });

            // Add error details
            span.setAttributes({
              'ai.error.type': error.name,
              'ai.error.code': error.code || 'unknown',
              'ai.error.retryable': error.retryable || false,
            });

            throw error;
          } finally {
            span.end();
          }
        });
      };

      return descriptor;
    };
  }

  // Trace database operations
  traceDatabase(operation: string) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const tracer = trace.getTracer('database-tracer', '1.0.0');
        
        return tracer.startActiveSpan(`db.${operation}`, {
          kind: SpanKind.CLIENT,
          attributes: {
            'db.operation': operation,
            'db.method': propertyKey,
            'db.table': args[0]?.table || 'unknown',
          }
        }, async (span) => {
          try {
            const result = await originalMethod.apply(this, args);
            
            span.setAttributes({
              'db.rows_affected': result?.rowCount || 0,
              'db.found': result?.rows?.length || 0,
            });

            span.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (error: any) {
            span.recordException(error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });
            throw error;
          } finally {
            span.end();
          }
        });
      };

      return descriptor;
    };
  }

  // Create a span for background jobs
  traceBackgroundJob(jobName: string, jobType: string = 'scheduled') {
    const tracer = trace.getTracer('background-job-tracer', '1.0.0');
    
    return tracer.startActiveSpan(`job.${jobName}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'job.name': jobName,
        'job.type': jobType,
        'job.scheduled_at': new Date().toISOString(),
      }
    });
  }

  // Helper to add trace context to logs
  getTraceContext() {
    const span = trace.getActiveSpan();
    if (!span) return {};

    const spanContext = span.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: spanContext.traceFlags,
    };
  }

  // Extract trace context from incoming request
  extractTraceContext(headers: Record<string, string>) {
    return {
      traceId: headers['x-trace-id'],
      spanId: headers['x-span-id'],
      traceFlags: headers['x-trace-flags'],
    };
  }

  // Inject trace context for outgoing requests
  injectTraceContext(headers: Record<string, string>) {
    const context = this.getTraceContext();
    if (context.traceId) {
      headers['x-trace-id'] = context.traceId;
      headers['x-span-id'] = context.spanId!;
      headers['x-trace-flags'] = String(context.traceFlags!);
    }
    return headers;
  }

  // Shutdown tracer
  async shutdown() {
    await this.provider.shutdown();
  }
}