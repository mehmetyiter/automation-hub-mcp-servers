import { trace, SpanKind, SpanStatusCode, context } from '@opentelemetry/api';
import { MetricsService } from '../observability/metrics.js';
import { LoggingService } from '../observability/logging.js';
import { TracingService } from '../observability/tracing.js';

interface AIProviderOptions {
  provider: string;
  model: string;
  apiKey: string;
  endpoint?: string;
  maxRetries?: number;
  timeout?: number;
}

interface AIProviderResponse {
  result: any;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  cached?: boolean;
  duration: number;
  cost?: number;
}

export class AIProviderInstrumentation {
  private metrics: MetricsService;
  private logger: LoggingService;
  private tracing: TracingService;
  private provider: string;
  private model: string;

  // Cost calculation factors (per 1K tokens)
  private static readonly COST_FACTORS: Record<string, Record<string, { input: number; output: number }>> = {
    openai: {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
      'text-embedding-ada-002': { input: 0.0001, output: 0 },
    },
    anthropic: {
      'claude-3-opus': { input: 0.015, output: 0.075 },
      'claude-3-sonnet': { input: 0.003, output: 0.015 },
      'claude-3-haiku': { input: 0.00025, output: 0.00125 },
      'claude-2.1': { input: 0.008, output: 0.024 },
    },
    google: {
      'gemini-pro': { input: 0.00025, output: 0.0005 },
      'gemini-pro-vision': { input: 0.00025, output: 0.0005 },
      'palm-2': { input: 0.0002, output: 0.0004 },
    },
  };

  constructor(options: AIProviderOptions) {
    this.metrics = MetricsService.getInstance();
    this.logger = LoggingService.getInstance();
    this.tracing = TracingService.getInstance();
    this.provider = options.provider.toLowerCase();
    this.model = options.model;
  }

  // Main instrumentation wrapper for AI calls
  async instrumentCall<T>(
    operation: string,
    prompt: string,
    callFn: () => Promise<T>,
    options?: {
      stream?: boolean;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      tools?: any[];
    }
  ): Promise<AIProviderResponse> {
    const startTime = Date.now();
    const tracer = trace.getTracer('ai-provider-instrumentation', '1.0.0');
    
    // Calculate prompt token estimate
    const promptTokens = this.estimateTokens(prompt);
    const systemTokens = options?.systemPrompt ? this.estimateTokens(options.systemPrompt) : 0;
    
    const span = tracer.startSpan(`ai.${operation}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'ai.provider': this.provider,
        'ai.model': this.model,
        'ai.operation': operation,
        'ai.request.model': this.model,
        'ai.request.temperature': options?.temperature,
        'ai.request.max_tokens': options?.maxTokens,
        'ai.request.stream': options?.stream || false,
        'ai.request.has_tools': !!options?.tools?.length,
        'ai.request.tool_count': options?.tools?.length || 0,
        'ai.request.prompt_tokens_estimate': promptTokens + systemTokens,
      }
    });

    // Record request metric
    this.metrics.recordAIProviderRequest(this.provider, this.model, operation);

    try {
      // Execute the AI call with context
      const result = await context.with(
        trace.setSpan(context.active(), span),
        async () => {
          // Add retry logic with exponential backoff
          let lastError: any;
          const maxRetries = 3;
          
          for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
              if (attempt > 0) {
                const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                await new Promise(resolve => setTimeout(resolve, delay));
                span.addEvent('retry_attempt', { attempt: attempt + 1 });
              }
              
              return await callFn();
            } catch (error: any) {
              lastError = error;
              
              // Check if error is retryable
              if (!this.isRetryableError(error) || attempt === maxRetries - 1) {
                throw error;
              }
              
              this.metrics.recordMetric('aiProvider', 'retryCount', 1, {
                provider: this.provider,
                model: this.model,
                error_type: error.code || 'unknown'
              });
            }
          }
          
          throw lastError;
        }
      );

      const duration = Date.now() - startTime;

      // Parse response to extract usage data
      const usage = this.extractUsage(result);
      const cached = this.checkIfCached(result);
      
      // Calculate cost
      const cost = this.calculateCost(usage);

      // Update span with response data
      span.setAttributes({
        'ai.response.model': this.extractModelFromResponse(result) || this.model,
        'ai.response.finish_reason': this.extractFinishReason(result),
        'ai.usage.prompt_tokens': usage?.prompt_tokens || 0,
        'ai.usage.completion_tokens': usage?.completion_tokens || 0,
        'ai.usage.total_tokens': usage?.total_tokens || 0,
        'ai.usage.cached': cached,
        'ai.cost.usd': cost,
        'ai.duration_ms': duration,
      });

      span.setStatus({ code: SpanStatusCode.OK });

      // Record metrics
      if (usage) {
        this.metrics.recordAIProviderTokens(
          this.provider,
          this.model,
          usage.prompt_tokens || 0,
          usage.completion_tokens || 0
        );
      }

      if (cost > 0) {
        this.metrics.recordAIProviderCost(this.provider, this.model, cost);
      }

      this.metrics.recordMetric('aiProvider', 'requestDuration', duration, {
        provider: this.provider,
        model: this.model,
        operation,
        cached: cached.toString()
      });

      // Log the call
      this.logger.logAIProviderCall(
        this.provider,
        this.model,
        operation,
        { usage, cost, cached, duration },
        undefined
      );

      return {
        result,
        usage,
        cached,
        duration,
        cost
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Record error details
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });

      span.setAttributes({
        'ai.error.type': error.type || error.name || 'unknown',
        'ai.error.code': error.code || error.status || 'unknown',
        'ai.error.message': error.message,
        'ai.duration_ms': duration,
      });

      // Record error metrics
      this.metrics.recordAIProviderError(this.provider, this.model, error.code || 'unknown');

      // Log the error
      this.logger.logAIProviderCall(
        this.provider,
        this.model,
        operation,
        { duration },
        error
      );

      // Add context to error for better debugging
      error.aiContext = {
        provider: this.provider,
        model: this.model,
        operation,
        duration,
        traceId: span.spanContext().traceId,
        spanId: span.spanContext().spanId,
      };

      throw error;
    } finally {
      span.end();
    }
  }

  // Stream instrumentation wrapper
  async *instrumentStream<T>(
    operation: string,
    prompt: string,
    streamFn: () => AsyncGenerator<T>,
    options?: {
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }
  ): AsyncGenerator<T> {
    const startTime = Date.now();
    const tracer = trace.getTracer('ai-provider-instrumentation', '1.0.0');
    
    const span = tracer.startSpan(`ai.stream.${operation}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'ai.provider': this.provider,
        'ai.model': this.model,
        'ai.operation': operation,
        'ai.request.stream': true,
      }
    });

    let tokenCount = 0;
    let chunkCount = 0;
    let error: any = null;

    try {
      const stream = streamFn();
      
      for await (const chunk of stream) {
        chunkCount++;
        
        // Estimate tokens in chunk
        const chunkTokens = this.estimateTokensFromChunk(chunk);
        tokenCount += chunkTokens;
        
        // Add periodic events
        if (chunkCount % 10 === 0) {
          span.addEvent('stream_progress', {
            chunks_received: chunkCount,
            tokens_estimated: tokenCount,
          });
        }
        
        yield chunk;
      }

      const duration = Date.now() - startTime;
      
      span.setAttributes({
        'ai.stream.chunks': chunkCount,
        'ai.stream.tokens_estimated': tokenCount,
        'ai.stream.duration_ms': duration,
        'ai.stream.avg_chunk_interval_ms': duration / chunkCount,
      });

      span.setStatus({ code: SpanStatusCode.OK });

      // Estimate cost based on token count
      const estimatedCost = this.calculateCost({
        prompt_tokens: this.estimateTokens(prompt),
        completion_tokens: tokenCount,
        total_tokens: this.estimateTokens(prompt) + tokenCount,
      });

      // Record metrics
      this.metrics.recordMetric('aiProvider', 'streamChunks', chunkCount, {
        provider: this.provider,
        model: this.model,
        operation,
      });

      if (estimatedCost > 0) {
        this.metrics.recordAIProviderCost(this.provider, this.model, estimatedCost);
      }

    } catch (err: any) {
      error = err;
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message
      });

      this.metrics.recordAIProviderError(this.provider, this.model, error.code || 'stream_error');
      
      throw error;
    } finally {
      span.end();
    }
  }

  // Function calling instrumentation
  @TracingService.traceMethod('ai.function_call')
  async instrumentFunctionCall(
    functionName: string,
    args: any,
    executeFn: () => Promise<any>
  ): Promise<any> {
    const startTime = Date.now();
    
    this.metrics.recordMetric('aiProvider', 'functionCallTotal', 1, {
      provider: this.provider,
      model: this.model,
      function: functionName,
    });

    try {
      const result = await executeFn();
      const duration = Date.now() - startTime;

      this.metrics.recordMetric('aiProvider', 'functionCallDuration', duration, {
        provider: this.provider,
        model: this.model,
        function: functionName,
        status: 'success',
      });

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      this.metrics.recordMetric('aiProvider', 'functionCallDuration', duration, {
        provider: this.provider,
        model: this.model,
        function: functionName,
        status: 'error',
      });

      this.metrics.recordMetric('aiProvider', 'functionCallErrors', 1, {
        provider: this.provider,
        model: this.model,
        function: functionName,
        error_type: error.code || 'unknown',
      });

      throw error;
    }
  }

  // Helper methods
  private estimateTokens(text: string): number {
    // Simple estimation: ~4 characters per token on average
    return Math.ceil(text.length / 4);
  }

  private estimateTokensFromChunk(chunk: any): number {
    if (typeof chunk === 'string') {
      return this.estimateTokens(chunk);
    } else if (chunk?.choices?.[0]?.delta?.content) {
      return this.estimateTokens(chunk.choices[0].delta.content);
    } else if (chunk?.content) {
      return this.estimateTokens(chunk.content);
    }
    return 0;
  }

  private extractUsage(response: any): any {
    // OpenAI format
    if (response?.usage) {
      return response.usage;
    }
    // Anthropic format
    if (response?.usage?.input_tokens) {
      return {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      };
    }
    // Google format
    if (response?.metadata?.tokenMetadata) {
      const metadata = response.metadata.tokenMetadata;
      return {
        prompt_tokens: metadata.inputTokenCount?.totalTokens || 0,
        completion_tokens: metadata.outputTokenCount?.totalTokens || 0,
        total_tokens: (metadata.inputTokenCount?.totalTokens || 0) + (metadata.outputTokenCount?.totalTokens || 0),
      };
    }
    return null;
  }

  private checkIfCached(response: any): boolean {
    // OpenAI caching
    if (response?.usage?.cached_tokens) {
      return true;
    }
    // Anthropic caching
    if (response?.usage?.cache_creation_input_tokens || response?.usage?.cache_read_input_tokens) {
      return true;
    }
    // Check custom headers or metadata
    if (response?.headers?.['x-cache-hit'] === 'true') {
      return true;
    }
    return false;
  }

  private calculateCost(usage: any): number {
    if (!usage || !usage.prompt_tokens) {
      return 0;
    }

    const costs = AIProviderInstrumentation.COST_FACTORS[this.provider]?.[this.model];
    if (!costs) {
      return 0;
    }

    const inputCost = (usage.prompt_tokens / 1000) * costs.input;
    const outputCost = (usage.completion_tokens / 1000) * costs.output;
    
    return Number((inputCost + outputCost).toFixed(6));
  }

  private extractModelFromResponse(response: any): string | null {
    return response?.model || response?.metadata?.model || null;
  }

  private extractFinishReason(response: any): string | null {
    // OpenAI format
    if (response?.choices?.[0]?.finish_reason) {
      return response.choices[0].finish_reason;
    }
    // Anthropic format
    if (response?.stop_reason) {
      return response.stop_reason;
    }
    // Google format
    if (response?.candidates?.[0]?.finishReason) {
      return response.candidates[0].finishReason;
    }
    return null;
  }

  private isRetryableError(error: any): boolean {
    // Rate limit errors
    if (error.status === 429 || error.code === 'rate_limit_exceeded') {
      return true;
    }
    // Temporary server errors
    if (error.status >= 500 && error.status < 600) {
      return true;
    }
    // Network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }
    // OpenAI specific
    if (error.code === 'insufficient_quota' || error.code === 'server_error') {
      return true;
    }
    return false;
  }

  // Rate limiting tracker
  private rateLimitTracker = new Map<string, { remaining: number; reset: Date }>();

  updateRateLimits(headers: Record<string, string>): void {
    const key = `${this.provider}:${this.model}`;
    
    // OpenAI headers
    if (headers['x-ratelimit-remaining']) {
      this.rateLimitTracker.set(key, {
        remaining: parseInt(headers['x-ratelimit-remaining']),
        reset: new Date(parseInt(headers['x-ratelimit-reset']) * 1000),
      });
    }
    
    // Anthropic headers
    if (headers['anthropic-ratelimit-requests-remaining']) {
      this.rateLimitTracker.set(key, {
        remaining: parseInt(headers['anthropic-ratelimit-requests-remaining']),
        reset: new Date(headers['anthropic-ratelimit-requests-reset']),
      });
    }

    // Update metrics
    const limits = this.rateLimitTracker.get(key);
    if (limits) {
      this.metrics.recordMetric('aiProvider', 'rateLimitRemaining', limits.remaining, {
        provider: this.provider,
        model: this.model,
      });
    }
  }

  // Get current rate limit status
  getRateLimitStatus(): { remaining: number; reset: Date } | null {
    const key = `${this.provider}:${this.model}`;
    return this.rateLimitTracker.get(key) || null;
  }
}