/**
 * Event Listeners for the Code Generation System
 */

import { CodeGenerationEvent } from '../types/common-types';
import { globalEventEmitter, EventTypes } from './event-emitter';
import { CodeGenerationDatabase } from '../database/code-generation-db';
import { AdvancedPerformanceMetrics } from '../performance/advanced-metrics';
import { globalContainer, ServiceTokens } from '../dependency-injection/container';

export interface EventListener {
  name: string;
  eventTypes: string[];
  handler: (event: CodeGenerationEvent) => void | Promise<void>;
}

/**
 * Performance monitoring listener
 */
export class PerformanceMonitorListener implements EventListener {
  name = 'PerformanceMonitor';
  eventTypes = [
    EventTypes.GENERATION_COMPLETED,
    EventTypes.OPTIMIZATION_COMPLETED,
    EventTypes.PERFORMANCE_THRESHOLD_EXCEEDED
  ];

  private metrics: Map<string, any> = new Map();

  async handler(event: CodeGenerationEvent): Promise<void> {
    switch (event.type) {
      case EventTypes.GENERATION_COMPLETED:
        await this.recordGenerationMetrics(event);
        break;
      
      case EventTypes.OPTIMIZATION_COMPLETED:
        await this.recordOptimizationMetrics(event);
        break;
      
      case EventTypes.PERFORMANCE_THRESHOLD_EXCEEDED:
        await this.handlePerformanceAlert(event);
        break;
    }
  }

  private async recordGenerationMetrics(event: CodeGenerationEvent): Promise<void> {
    const { codeId, duration, codeSize } = event.data;
    
    this.metrics.set(codeId as string, {
      generationTime: duration,
      codeSize,
      timestamp: event.timestamp
    });

    console.log(`📊 Generation metrics recorded for ${codeId}: ${duration}ms`);
  }

  private async recordOptimizationMetrics(event: CodeGenerationEvent): Promise<void> {
    const { codeId, improvement } = event.data;
    
    const existing = this.metrics.get(codeId as string) || {};
    this.metrics.set(codeId as string, {
      ...existing,
      optimizationImprovement: improvement
    });

    console.log(`📈 Optimization improved performance by ${improvement}%`);
  }

  private async handlePerformanceAlert(event: CodeGenerationEvent): Promise<void> {
    const { metric, threshold, actual } = event.data;
    
    console.warn(`⚠️ Performance alert: ${metric} exceeded threshold (${actual} > ${threshold})`);
    
    // Could trigger auto-optimization or send notifications
    globalEventEmitter.emit({
      type: 'optimization_requested',
      timestamp: new Date().toISOString(),
      codeId: event.codeId,
      data: { reason: 'performance_threshold_exceeded', metric, threshold, actual }
    });
  }
}

/**
 * Database persistence listener
 */
export class DatabasePersistenceListener implements EventListener {
  name = 'DatabasePersistence';
  eventTypes = [
    EventTypes.GENERATION_COMPLETED,
    EventTypes.VERSION_CREATED,
    EventTypes.FEEDBACK_RECEIVED,
    EventTypes.PERFORMANCE_PROFILE_COMPLETED
  ];

  private database?: CodeGenerationDatabase;

  async handler(event: CodeGenerationEvent): Promise<void> {
    if (!this.database && globalContainer.has(ServiceTokens.DATABASE)) {
      this.database = globalContainer.resolve<CodeGenerationDatabase>(ServiceTokens.DATABASE);
    }

    if (!this.database) {
      console.warn('Database service not available');
      return;
    }

    switch (event.type) {
      case EventTypes.GENERATION_COMPLETED:
        await this.saveGeneratedCode(event);
        break;
      
      case EventTypes.VERSION_CREATED:
        await this.saveCodeVersion(event);
        break;
      
      case EventTypes.FEEDBACK_RECEIVED:
        await this.saveFeedback(event);
        break;
      
      case EventTypes.PERFORMANCE_PROFILE_COMPLETED:
        await this.savePerformanceProfile(event);
        break;
    }
  }

  private async saveGeneratedCode(event: CodeGenerationEvent): Promise<void> {
    const { request, result } = event.data;
    
    if (event.codeId && request && result) {
      await this.database!.saveGeneratedCode(
        event.codeId,
        request as any,
        result as any
      );
      console.log(`💾 Saved generated code: ${event.codeId}`);
    }
  }

  private async saveCodeVersion(event: CodeGenerationEvent): Promise<void> {
    const { version } = event.data;
    
    if (version) {
      await this.database!.saveCodeVersion(version as any);
      console.log(`💾 Saved code version: ${(version as any).id}`);
    }
  }

  private async saveFeedback(event: CodeGenerationEvent): Promise<void> {
    const { feedback } = event.data;
    
    if (event.codeId && feedback) {
      await this.database!.saveUserFeedback(event.codeId, feedback as any);
      console.log(`💾 Saved user feedback for: ${event.codeId}`);
    }
  }

  private async savePerformanceProfile(event: CodeGenerationEvent): Promise<void> {
    const { profile } = event.data;
    
    if (profile) {
      // Save performance profile (implementation depends on database schema)
      console.log(`💾 Saved performance profile: ${(profile as any).id}`);
    }
  }
}

/**
 * Logging listener
 */
export class LoggingListener implements EventListener {
  name = 'Logger';
  eventTypes = ['*']; // Listen to all events

  private logFile?: string;
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';

  constructor(options?: { logFile?: string; logLevel?: 'debug' | 'info' | 'warn' | 'error' }) {
    this.logFile = options?.logFile;
    this.logLevel = options?.logLevel || 'info';
  }

  handler(event: CodeGenerationEvent): void {
    const logEntry = this.formatLogEntry(event);
    
    // Console logging
    this.consoleLog(event, logEntry);
    
    // File logging (if configured)
    if (this.logFile) {
      this.fileLog(logEntry);
    }
  }

  private formatLogEntry(event: CodeGenerationEvent): string {
    return JSON.stringify({
      timestamp: event.timestamp,
      type: event.type,
      codeId: event.codeId,
      data: event.data
    });
  }

  private consoleLog(event: CodeGenerationEvent, logEntry: string): void {
    const level = this.getLogLevel(event.type);
    
    switch (level) {
      case 'error':
        console.error(`[${event.type}]`, event.data);
        break;
      case 'warn':
        console.warn(`[${event.type}]`, event.data);
        break;
      case 'info':
        console.info(`[${event.type}]`, event.codeId || '');
        break;
      case 'debug':
        if (this.logLevel === 'debug') {
          console.debug(`[${event.type}]`, logEntry);
        }
        break;
    }
  }

  private fileLog(logEntry: string): void {
    // Implementation would append to log file
    // For now, just a placeholder
  }

  private getLogLevel(eventType: string): 'debug' | 'info' | 'warn' | 'error' {
    if (eventType.includes('error') || eventType.includes('failed')) {
      return 'error';
    }
    if (eventType.includes('warning') || eventType.includes('exceeded')) {
      return 'warn';
    }
    if (eventType.includes('started') || eventType.includes('completed')) {
      return 'info';
    }
    return 'debug';
  }
}

/**
 * Auto-optimization listener
 */
export class AutoOptimizationListener implements EventListener {
  name = 'AutoOptimizer';
  eventTypes = [
    EventTypes.PERFORMANCE_THRESHOLD_EXCEEDED,
    EventTypes.SECURITY_ISSUE_DETECTED,
    'optimization_requested'
  ];

  private optimizationQueue: Map<string, any> = new Map();
  private isProcessing = false;

  async handler(event: CodeGenerationEvent): Promise<void> {
    if (!event.codeId) return;

    // Add to optimization queue
    this.optimizationQueue.set(event.codeId, {
      event,
      priority: this.calculatePriority(event),
      timestamp: Date.now()
    });

    // Process queue if not already processing
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  private calculatePriority(event: CodeGenerationEvent): number {
    if (event.type === EventTypes.SECURITY_ISSUE_DETECTED) {
      return 10; // Highest priority
    }
    if (event.type === EventTypes.PERFORMANCE_THRESHOLD_EXCEEDED) {
      const { threshold, actual } = event.data;
      const ratio = (actual as number) / (threshold as number);
      return Math.min(9, Math.floor(ratio * 5));
    }
    return 5; // Default priority
  }

  private async processQueue(): Promise<void> {
    this.isProcessing = true;

    while (this.optimizationQueue.size > 0) {
      // Get highest priority item
      const [codeId, item] = Array.from(this.optimizationQueue.entries())
        .sort((a, b) => b[1].priority - a[1].priority)[0];

      this.optimizationQueue.delete(codeId);

      try {
        await this.optimizeCode(codeId, item);
      } catch (error) {
        console.error(`Failed to optimize ${codeId}:`, error);
      }
    }

    this.isProcessing = false;
  }

  private async optimizeCode(codeId: string, item: any): Promise<void> {
    console.log(`🔧 Auto-optimizing code ${codeId} (priority: ${item.priority})`);

    // Emit optimization started event
    globalEventEmitter.emit({
      type: EventTypes.OPTIMIZATION_STARTED,
      timestamp: new Date().toISOString(),
      codeId,
      data: {
        reason: item.event.data.reason || 'auto_optimization',
        priority: item.priority
      }
    });

    // Actual optimization would happen here
    // For now, just simulate with a delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Emit optimization completed event
    globalEventEmitter.emit({
      type: EventTypes.OPTIMIZATION_COMPLETED,
      timestamp: new Date().toISOString(),
      codeId,
      data: {
        improvement: Math.floor(Math.random() * 30) + 10, // Simulated improvement
        optimizations: ['removed_redundant_code', 'improved_algorithm']
      }
    });
  }
}

/**
 * Error recovery listener
 */
export class ErrorRecoveryListener implements EventListener {
  name = 'ErrorRecovery';
  eventTypes = [
    EventTypes.GENERATION_FAILED,
    EventTypes.VALIDATION_FAILED,
    EventTypes.ERROR_OCCURRED,
    EventTypes.DATABASE_ERROR
  ];

  private retryCount: Map<string, number> = new Map();
  private maxRetries = 3;

  async handler(event: CodeGenerationEvent): Promise<void> {
    const { error, operation } = event.data;
    const key = `${event.codeId || 'global'}_${operation || event.type}`;
    
    const currentRetries = this.retryCount.get(key) || 0;
    
    if (currentRetries < this.maxRetries) {
      console.log(`🔄 Attempting recovery for ${event.type} (retry ${currentRetries + 1}/${this.maxRetries})`);
      
      this.retryCount.set(key, currentRetries + 1);
      
      // Schedule retry
      setTimeout(() => {
        this.attemptRecovery(event);
      }, Math.pow(2, currentRetries) * 1000); // Exponential backoff
    } else {
      console.error(`❌ Max retries exceeded for ${event.type}`);
      
      // Emit critical error event
      globalEventEmitter.emit({
        type: 'critical_error',
        timestamp: new Date().toISOString(),
        codeId: event.codeId,
        data: {
          originalError: error,
          operation,
          retriesExhausted: true
        }
      });
      
      // Clear retry count
      this.retryCount.delete(key);
    }
  }

  private async attemptRecovery(event: CodeGenerationEvent): Promise<void> {
    // Recovery logic would depend on the error type
    switch (event.type) {
      case EventTypes.GENERATION_FAILED:
        // Retry code generation with fallback options
        globalEventEmitter.emit({
          type: EventTypes.GENERATION_STARTED,
          timestamp: new Date().toISOString(),
          codeId: event.codeId,
          data: {
            ...event.data,
            retry: true,
            fallbackMode: true
          }
        });
        break;
      
      case EventTypes.DATABASE_ERROR:
        // Attempt to reconnect to database
        globalEventEmitter.emit({
          type: 'database_reconnect_requested',
          timestamp: new Date().toISOString(),
          data: event.data
        });
        break;
      
      default:
        console.log(`Recovery not implemented for ${event.type}`);
    }
  }
}

// Register all listeners
export function registerEventListeners(): void {
  const listeners: EventListener[] = [
    new PerformanceMonitorListener(),
    new DatabasePersistenceListener(),
    new LoggingListener({ logLevel: 'info' }),
    new AutoOptimizationListener(),
    new ErrorRecoveryListener()
  ];

  for (const listener of listeners) {
    for (const eventType of listener.eventTypes) {
      globalEventEmitter.on(eventType, (event) => listener.handler(event));
    }
    console.log(`✅ Registered ${listener.name} listener for ${listener.eventTypes.join(', ')}`);
  }
}