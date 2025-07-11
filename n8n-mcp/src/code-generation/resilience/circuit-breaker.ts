import { EventEmitter } from 'events';

export interface CircuitBreakerConfig {
  timeout: number;           // Time to wait before transitioning from OPEN to HALF_OPEN (ms)
  failureThreshold: number;  // Number of failures before opening circuit
  successThreshold: number;  // Number of successes in HALF_OPEN before closing circuit
  monitoringWindow: number;  // Time window for monitoring failures (ms)
  volumeThreshold: number;   // Minimum requests in window before circuit can open
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  requests: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  nextAttempt?: number;
}

export interface CircuitBreakerOptions {
  name?: string;
  config?: Partial<CircuitBreakerConfig>;
  onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;
  onFailure?: (error: Error) => void;
  onSuccess?: () => void;
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private requests = 0;
  private lastFailureTime = 0;
  private lastSuccessTime = 0;
  private nextAttempt = 0;
  private config: CircuitBreakerConfig;
  private name: string;
  private requestTimestamps: number[] = [];
  private stats: Map<string, number> = new Map();

  constructor(options: CircuitBreakerOptions = {}) {
    super();
    
    this.name = options.name || 'CircuitBreaker';
    this.config = {
      timeout: 60000,           // 1 minute
      failureThreshold: 5,      // 5 failures
      successThreshold: 3,      // 3 successes
      monitoringWindow: 60000,  // 1 minute
      volumeThreshold: 10,      // 10 requests
      ...options.config
    };

    if (options.onStateChange) {
      this.on('stateChange', options.onStateChange);
    }
    if (options.onFailure) {
      this.on('failure', options.onFailure);
    }
    if (options.onSuccess) {
      this.on('success', options.onSuccess);
    }

    console.log(`🔌 Circuit breaker '${this.name}' initialized with config:`, this.config);
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    this.recordRequest();

    // Check if circuit should be opened based on current state
    if (this.shouldBlock()) {
      const error = new Error(`Circuit breaker '${this.name}' is ${this.state}. Request blocked.`);
      this.emit('blocked', error);
      throw error;
    }

    try {
      const result = await operation();
      this.onSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      this.onFailure(error as Error, Date.now() - startTime);
      throw error;
    }
  }

  private shouldBlock(): boolean {
    const now = Date.now();

    switch (this.state) {
      case CircuitState.CLOSED:
        return false;

      case CircuitState.OPEN:
        if (now >= this.nextAttempt) {
          this.transitionToHalfOpen();
          return false;
        }
        return true;

      case CircuitState.HALF_OPEN:
        return false;

      default:
        return false;
    }
  }

  private onSuccess(responseTime: number): void {
    this.successes++;
    this.lastSuccessTime = Date.now();
    this.recordResponseTime(responseTime);
    
    console.log(`✅ ${this.name}: Operation succeeded (${responseTime}ms)`);
    this.emit('success', { responseTime });

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    }
  }

  private onFailure(error: Error, responseTime: number): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.recordResponseTime(responseTime);
    
    console.warn(`❌ ${this.name}: Operation failed (${responseTime}ms):`, error.message);
    this.emit('failure', { error, responseTime });

    if (this.state === CircuitState.CLOSED) {
      if (this.shouldOpen()) {
        this.transitionToOpen();
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen();
    }
  }

  private shouldOpen(): boolean {
    // Check if we have enough volume of requests
    const recentRequests = this.getRecentRequests();
    if (recentRequests < this.config.volumeThreshold) {
      return false;
    }

    // Check failure rate
    const recentFailures = this.getRecentFailures();
    return recentFailures >= this.config.failureThreshold;
  }

  private getRecentRequests(): number {
    const now = Date.now();
    const cutoff = now - this.config.monitoringWindow;
    
    this.requestTimestamps = this.requestTimestamps.filter(timestamp => timestamp > cutoff);
    return this.requestTimestamps.length;
  }

  private getRecentFailures(): number {
    // In a more sophisticated implementation, we would track failure timestamps
    // For now, we'll use a simple approach based on current failures
    const now = Date.now();
    const timeSinceLastFailure = now - this.lastFailureTime;
    
    if (timeSinceLastFailure > this.config.monitoringWindow) {
      return 0;
    }
    
    return this.failures;
  }

  private transitionToClosed(): void {
    const oldState = this.state;
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    
    console.log(`🔒 ${this.name}: Circuit breaker CLOSED`);
    this.emit('stateChange', oldState, this.state);
  }

  private transitionToOpen(): void {
    const oldState = this.state;
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.config.timeout;
    this.successes = 0;
    
    console.log(`🔓 ${this.name}: Circuit breaker OPEN (next attempt: ${new Date(this.nextAttempt).toISOString()})`);\n    this.emit('stateChange', oldState, this.state);\n  }\n\n  private transitionToHalfOpen(): void {\n    const oldState = this.state;\n    this.state = CircuitState.HALF_OPEN;\n    this.successes = 0;\n    \n    console.log(`🔄 ${this.name}: Circuit breaker HALF_OPEN`);\n    this.emit('stateChange', oldState, this.state);\n  }\n\n  private recordRequest(): void {\n    this.requests++;\n    this.requestTimestamps.push(Date.now());\n  }\n\n  private recordResponseTime(responseTime: number): void {\n    // Update response time statistics\n    const current = this.stats.get('totalResponseTime') || 0;\n    const count = this.stats.get('responseCount') || 0;\n    \n    this.stats.set('totalResponseTime', current + responseTime);\n    this.stats.set('responseCount', count + 1);\n    this.stats.set('lastResponseTime', responseTime);\n    \n    if (!this.stats.has('minResponseTime') || responseTime < this.stats.get('minResponseTime')!) {\n      this.stats.set('minResponseTime', responseTime);\n    }\n    \n    if (!this.stats.has('maxResponseTime') || responseTime > this.stats.get('maxResponseTime')!) {\n      this.stats.set('maxResponseTime', responseTime);\n    }\n  }\n\n  // Public API methods\n  getStats(): CircuitBreakerStats {\n    return {\n      state: this.state,\n      failures: this.failures,\n      successes: this.successes,\n      requests: this.requests,\n      lastFailureTime: this.lastFailureTime || undefined,\n      lastSuccessTime: this.lastSuccessTime || undefined,\n      nextAttempt: this.state === CircuitState.OPEN ? this.nextAttempt : undefined\n    };\n  }\n\n  getDetailedStats(): any {\n    const stats = this.getStats();\n    const responseCount = this.stats.get('responseCount') || 0;\n    const totalResponseTime = this.stats.get('totalResponseTime') || 0;\n    \n    return {\n      ...stats,\n      responseTime: {\n        average: responseCount > 0 ? totalResponseTime / responseCount : 0,\n        min: this.stats.get('minResponseTime') || 0,\n        max: this.stats.get('maxResponseTime') || 0,\n        last: this.stats.get('lastResponseTime') || 0\n      },\n      recentRequests: this.getRecentRequests(),\n      failureRate: this.requests > 0 ? (this.failures / this.requests) * 100 : 0,\n      config: this.config\n    };\n  }\n\n  reset(): void {\n    console.log(`🔄 ${this.name}: Circuit breaker reset`);\n    \n    const oldState = this.state;\n    this.state = CircuitState.CLOSED;\n    this.failures = 0;\n    this.successes = 0;\n    this.requests = 0;\n    this.lastFailureTime = 0;\n    this.lastSuccessTime = 0;\n    this.nextAttempt = 0;\n    this.requestTimestamps = [];\n    this.stats.clear();\n    \n    this.emit('reset');\n    if (oldState !== this.state) {\n      this.emit('stateChange', oldState, this.state);\n    }\n  }\n\n  forceOpen(): void {\n    console.log(`🔒 ${this.name}: Circuit breaker forced OPEN`);\n    const oldState = this.state;\n    this.transitionToOpen();\n  }\n\n  forceClosed(): void {\n    console.log(`🔓 ${this.name}: Circuit breaker forced CLOSED`);\n    const oldState = this.state;\n    this.transitionToClosed();\n  }\n\n  getName(): string {\n    return this.name;\n  }\n\n  getState(): CircuitState {\n    return this.state;\n  }\n\n  isOpen(): boolean {\n    return this.state === CircuitState.OPEN;\n  }\n\n  isClosed(): boolean {\n    return this.state === CircuitState.CLOSED;\n  }\n\n  isHalfOpen(): boolean {\n    return this.state === CircuitState.HALF_OPEN;\n  }\n}\n\n// Circuit Breaker Manager for handling multiple circuit breakers\nexport class CircuitBreakerManager {\n  private breakers: Map<string, CircuitBreaker> = new Map();\n  private globalStats = {\n    totalRequests: 0,\n    totalFailures: 0,\n    totalSuccesses: 0\n  };\n\n  constructor() {\n    console.log('🏗️ Circuit Breaker Manager initialized');\n  }\n\n  create(name: string, options: CircuitBreakerOptions = {}): CircuitBreaker {\n    if (this.breakers.has(name)) {\n      throw new Error(`Circuit breaker '${name}' already exists`);\n    }\n\n    const breaker = new CircuitBreaker({\n      ...options,\n      name\n    });\n\n    // Track global stats\n    breaker.on('success', () => {\n      this.globalStats.totalRequests++;\n      this.globalStats.totalSuccesses++;\n    });\n\n    breaker.on('failure', () => {\n      this.globalStats.totalRequests++;\n      this.globalStats.totalFailures++;\n    });\n\n    this.breakers.set(name, breaker);\n    console.log(`🔌 Created circuit breaker: ${name}`);\n    \n    return breaker;\n  }\n\n  get(name: string): CircuitBreaker | undefined {\n    return this.breakers.get(name);\n  }\n\n  getOrCreate(name: string, options: CircuitBreakerOptions = {}): CircuitBreaker {\n    return this.get(name) || this.create(name, options);\n  }\n\n  remove(name: string): boolean {\n    const breaker = this.breakers.get(name);\n    if (breaker) {\n      breaker.removeAllListeners();\n      this.breakers.delete(name);\n      console.log(`🗑️ Removed circuit breaker: ${name}`);\n      return true;\n    }\n    return false;\n  }\n\n  reset(name?: string): void {\n    if (name) {\n      const breaker = this.get(name);\n      if (breaker) {\n        breaker.reset();\n      }\n    } else {\n      // Reset all breakers\n      this.breakers.forEach(breaker => breaker.reset());\n      this.globalStats = {\n        totalRequests: 0,\n        totalFailures: 0,\n        totalSuccesses: 0\n      };\n      console.log('🔄 All circuit breakers reset');\n    }\n  }\n\n  getAllStats(): any {\n    const breakerStats: Record<string, any> = {};\n    \n    this.breakers.forEach((breaker, name) => {\n      breakerStats[name] = breaker.getDetailedStats();\n    });\n\n    return {\n      global: this.globalStats,\n      breakers: breakerStats,\n      summary: {\n        total: this.breakers.size,\n        open: Array.from(this.breakers.values()).filter(b => b.isOpen()).length,\n        halfOpen: Array.from(this.breakers.values()).filter(b => b.isHalfOpen()).length,\n        closed: Array.from(this.breakers.values()).filter(b => b.isClosed()).length\n      }\n    };\n  }\n\n  getHealthStatus(): {\n    healthy: boolean;\n    details: Record<string, { state: string; healthy: boolean }>\n  } {\n    const details: Record<string, { state: string; healthy: boolean }> = {};\n    let allHealthy = true;\n\n    this.breakers.forEach((breaker, name) => {\n      const healthy = !breaker.isOpen();\n      details[name] = {\n        state: breaker.getState(),\n        healthy\n      };\n      \n      if (!healthy) {\n        allHealthy = false;\n      }\n    });\n\n    return {\n      healthy: allHealthy,\n      details\n    };\n  }\n\n  // Utility methods for common patterns\n  async executeWithCircuitBreaker<T>(\n    breakerName: string,\n    operation: () => Promise<T>,\n    options: CircuitBreakerOptions = {}\n  ): Promise<T> {\n    const breaker = this.getOrCreate(breakerName, options);\n    return breaker.execute(operation);\n  }\n\n  // Decorator function for automatic circuit breaker wrapping\n  circuitBreakerDecorator(breakerName: string, options: CircuitBreakerOptions = {}) {\n    return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {\n      const method = descriptor.value;\n      \n      descriptor.value = async function(...args: any[]) {\n        const breaker = this.getOrCreate(breakerName, options);\n        return breaker.execute(() => method.apply(this, args));\n      }.bind(this);\n      \n      return descriptor;\n    };\n  }\n\n  cleanup(): void {\n    console.log('🧹 Cleaning up Circuit Breaker Manager...');\n    \n    this.breakers.forEach((breaker, name) => {\n      breaker.removeAllListeners();\n    });\n    \n    this.breakers.clear();\n    this.globalStats = {\n      totalRequests: 0,\n      totalFailures: 0,\n      totalSuccesses: 0\n    };\n    \n    console.log('✅ Circuit Breaker Manager cleanup completed');\n  }\n}\n\n// Singleton instance for global use\nexport const circuitBreakerManager = new CircuitBreakerManager();\n\n// Helper function for quick circuit breaker execution\nexport async function withCircuitBreaker<T>(\n  name: string,\n  operation: () => Promise<T>,\n  options: CircuitBreakerOptions = {}\n): Promise<T> {\n  return circuitBreakerManager.executeWithCircuitBreaker(name, operation, options);\n}