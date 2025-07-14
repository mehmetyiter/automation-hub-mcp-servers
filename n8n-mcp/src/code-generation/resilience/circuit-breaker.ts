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
  protected config: CircuitBreakerConfig;
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

  protected transitionToOpen(): void {
    const oldState = this.state;
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.config.timeout;
    this.successes = 0;
    
    console.log(`🔓 ${this.name}: Circuit breaker OPEN (next attempt: ${new Date(this.nextAttempt).toISOString()})`);
    this.emit('stateChange', oldState, this.state);
  }

  private transitionToHalfOpen(): void {
    const oldState = this.state;
    this.state = CircuitState.HALF_OPEN;
    this.successes = 0;
    
    console.log(`🔄 ${this.name}: Circuit breaker HALF_OPEN`);
    this.emit('stateChange', oldState, this.state);
  }

  private recordRequest(): void {
    this.requests++;
    this.requestTimestamps.push(Date.now());
  }

  private recordResponseTime(responseTime: number): void {
    // Update response time statistics
    const current = this.stats.get('totalResponseTime') || 0;
    const count = this.stats.get('responseCount') || 0;
    
    this.stats.set('totalResponseTime', current + responseTime);
    this.stats.set('responseCount', count + 1);
    this.stats.set('lastResponseTime', responseTime);
    
    if (!this.stats.has('minResponseTime') || responseTime < this.stats.get('minResponseTime')!) {
      this.stats.set('minResponseTime', responseTime);
    }
    
    if (!this.stats.has('maxResponseTime') || responseTime > this.stats.get('maxResponseTime')!) {
      this.stats.set('maxResponseTime', responseTime);
    }
  }

  // Public API methods
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      requests: this.requests,
      lastFailureTime: this.lastFailureTime || undefined,
      lastSuccessTime: this.lastSuccessTime || undefined,
      nextAttempt: this.state === CircuitState.OPEN ? this.nextAttempt : undefined
    };
  }

  getDetailedStats(): any {
    const stats = this.getStats();
    const responseCount = this.stats.get('responseCount') || 0;
    const totalResponseTime = this.stats.get('totalResponseTime') || 0;
    
    return {
      ...stats,
      responseTime: {
        average: responseCount > 0 ? totalResponseTime / responseCount : 0,
        min: this.stats.get('minResponseTime') || 0,
        max: this.stats.get('maxResponseTime') || 0,
        last: this.stats.get('lastResponseTime') || 0
      },
      recentRequests: this.getRecentRequests(),
      failureRate: this.requests > 0 ? (this.failures / this.requests) * 100 : 0,
      config: this.config
    };
  }

  reset(): void {
    console.log(`🔄 ${this.name}: Circuit breaker reset`);
    
    const oldState = this.state;
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.requests = 0;
    this.lastFailureTime = 0;
    this.lastSuccessTime = 0;
    this.nextAttempt = 0;
    this.requestTimestamps = [];
    this.stats.clear();
    
    this.emit('reset');
    if (oldState !== this.state) {
      this.emit('stateChange', oldState, this.state);
    }
  }

  forceOpen(): void {
    console.log(`🔒 ${this.name}: Circuit breaker forced OPEN`);
    const oldState = this.state;
    this.transitionToOpen();
  }

  forceClosed(): void {
    console.log(`🔓 ${this.name}: Circuit breaker forced CLOSED`);
    const oldState = this.state;
    this.transitionToClosed();
  }

  getName(): string {
    return this.name;
  }

  getState(): CircuitState {
    return this.state;
  }

  isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  isClosed(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  isHalfOpen(): boolean {
    return this.state === CircuitState.HALF_OPEN;
  }
}

// Circuit Breaker Manager for handling multiple circuit breakers
export class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();
  private globalStats = {
    totalRequests: 0,
    totalFailures: 0,
    totalSuccesses: 0
  };

  constructor() {
    console.log('🏗️ Circuit Breaker Manager initialized');
  }

  create(name: string, options: CircuitBreakerOptions = {}): CircuitBreaker {
    if (this.breakers.has(name)) {
      throw new Error(`Circuit breaker '${name}' already exists`);
    }

    const breaker = new CircuitBreaker({
      ...options,
      name
    });

    // Track global stats
    breaker.on('success', () => {
      this.globalStats.totalRequests++;
      this.globalStats.totalSuccesses++;
    });

    breaker.on('failure', () => {
      this.globalStats.totalRequests++;
      this.globalStats.totalFailures++;
    });

    this.breakers.set(name, breaker);
    console.log(`🔌 Created circuit breaker: ${name}`);
    
    return breaker;
  }

  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  getOrCreate(name: string, options: CircuitBreakerOptions = {}): CircuitBreaker {
    return this.get(name) || this.create(name, options);
  }

  remove(name: string): boolean {
    const breaker = this.breakers.get(name);
    if (breaker) {
      breaker.removeAllListeners();
      this.breakers.delete(name);
      console.log(`🗑️ Removed circuit breaker: ${name}`);
      return true;
    }
    return false;
  }

  reset(name?: string): void {
    if (name) {
      const breaker = this.get(name);
      if (breaker) {
        breaker.reset();
      }
    } else {
      // Reset all breakers
      this.breakers.forEach(breaker => breaker.reset());
      this.globalStats = {
        totalRequests: 0,
        totalFailures: 0,
        totalSuccesses: 0
      };
      console.log('🔄 All circuit breakers reset');
    }
  }

  getAllStats(): any {
    const breakerStats: Record<string, any> = {};
    
    this.breakers.forEach((breaker, name) => {
      breakerStats[name] = breaker.getDetailedStats();
    });

    return {
      global: this.globalStats,
      breakers: breakerStats,
      summary: {
        total: this.breakers.size,
        open: Array.from(this.breakers.values()).filter(b => b.isOpen()).length,
        halfOpen: Array.from(this.breakers.values()).filter(b => b.isHalfOpen()).length,
        closed: Array.from(this.breakers.values()).filter(b => b.isClosed()).length
      }
    };
  }

  getHealthStatus(): {
    healthy: boolean;
    details: Record<string, { state: string; healthy: boolean }>
  } {
    const details: Record<string, { state: string; healthy: boolean }> = {};
    let allHealthy = true;

    this.breakers.forEach((breaker, name) => {
      const healthy = !breaker.isOpen();
      details[name] = {
        state: breaker.getState(),
        healthy
      };
      
      if (!healthy) {
        allHealthy = false;
      }
    });

    return {
      healthy: allHealthy,
      details
    };
  }

  // Utility methods for common patterns
  async executeWithCircuitBreaker<T>(
    breakerName: string,
    operation: () => Promise<T>,
    options: CircuitBreakerOptions = {}
  ): Promise<T> {
    const breaker = this.getOrCreate(breakerName, options);
    return breaker.execute(operation);
  }

  // Decorator function for automatic circuit breaker wrapping
  circuitBreakerDecorator(breakerName: string, options: CircuitBreakerOptions = {}) {
    return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
      const method = descriptor.value;
      
      descriptor.value = async function(...args: any[]) {
        const breaker = this.getOrCreate(breakerName, options);
        return breaker.execute(() => method.apply(this, args));
      }.bind(this);
      
      return descriptor;
    };
  }

  cleanup(): void {
    console.log('🧹 Cleaning up Circuit Breaker Manager...');
    
    this.breakers.forEach((breaker, name) => {
      breaker.removeAllListeners();
    });
    
    this.breakers.clear();
    this.globalStats = {
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0
    };
    
    console.log('✅ Circuit Breaker Manager cleanup completed');
  }
}

// Singleton instance for global use
export const circuitBreakerManager = new CircuitBreakerManager();

// Helper function for quick circuit breaker execution
export async function withCircuitBreaker<T>(
  name: string,
  operation: () => Promise<T>,
  options: CircuitBreakerOptions = {}
): Promise<T> {
  return circuitBreakerManager.executeWithCircuitBreaker(name, operation, options);
}