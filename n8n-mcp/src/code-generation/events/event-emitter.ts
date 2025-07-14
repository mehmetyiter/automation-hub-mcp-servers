/**
 * Event Emitter for the Code Generation System
 */

import { EventEmitter } from 'events';
import { CodeGenerationEvent, EventHandler } from '../types/common-types.js';

export interface IEventEmitter {
  emitEvent(event: CodeGenerationEvent): void;
  on(eventType: string, handler: EventHandler): void;
  off(eventType: string, handler: EventHandler): void;
  once(eventType: string, handler: EventHandler): void;
}

export class CodeGenerationEventEmitter extends EventEmitter implements IEventEmitter {
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private eventHistory: CodeGenerationEvent[] = [];
  private maxHistorySize: number = 1000;

  constructor() {
    super();
    this.setMaxListeners(100); // Increase default limit
  }

  /**
   * Emit a code generation event
   */
  emitEvent(event: CodeGenerationEvent): void {
    // Add to history
    this.addToHistory(event);
    
    // Emit using native EventEmitter
    super.emit(event.type, event);
    super.emit('*', event); // Wildcard event for logging/monitoring
    
    // Call registered handlers
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        this.callHandler(handler, event);
      });
    }
    
    // Call wildcard handlers
    const wildcardHandlers = this.eventHandlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach(handler => {
        this.callHandler(handler, event);
      });
    }
  }

  /**
   * Register an event handler
   */
  on(eventType: string, handler: EventHandler): this {
    // Register with native EventEmitter
    super.on(eventType, handler);
    
    // Also track in our map for additional features
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    this.eventHandlers.get(eventType)!.add(handler);
    return this;
  }

  /**
   * Remove an event handler
   */
  off(eventType: string, handler: EventHandler): this {
    // Remove from native EventEmitter
    super.off(eventType, handler);
    
    // Remove from our map
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType);
      }
    }
    return this;
  }

  /**
   * Register a one-time event handler
   */
  once(eventType: string, handler: EventHandler): this {
    const wrappedHandler: EventHandler = (event) => {
      handler(event);
      this.off(eventType, wrappedHandler);
    };
    this.on(eventType, wrappedHandler);
    return this;
  }

  /**
   * Get event history
   */
  getHistory(eventType?: string, limit: number = 100): CodeGenerationEvent[] {
    const filtered = eventType 
      ? this.eventHistory.filter(e => e.type === eventType)
      : this.eventHistory;
    
    return filtered.slice(-limit);
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
  }

  /**
   * Get registered event types
   */
  getEventTypes(): string[] {
    return Array.from(this.eventHandlers.keys());
  }

  /**
   * Get handler count for an event type
   */
  getHandlerCount(eventType: string): number {
    const handlers = this.eventHandlers.get(eventType);
    return handlers ? handlers.size : 0;
  }

  private addToHistory(event: CodeGenerationEvent): void {
    this.eventHistory.push(event);
    
    // Trim history if it exceeds max size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  private async callHandler(handler: EventHandler, event: CodeGenerationEvent): Promise<void> {
    try {
      await handler(event);
    } catch (error) {
      console.error(`Error in event handler for ${event.type}:`, error);
      // Emit error event
      this.emitEvent({
        type: 'generation_failed',
        timestamp: new Date().toISOString(),
        data: {
          originalEvent: event,
          error: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }
}

// Global event emitter instance
export const globalEventEmitter = new CodeGenerationEventEmitter();

// Event types enum for type safety
export const EventTypes = {
  // Code generation events
  GENERATION_STARTED: 'generation_started',
  GENERATION_COMPLETED: 'generation_completed',
  GENERATION_FAILED: 'generation_failed',
  
  // Validation events
  VALIDATION_STARTED: 'validation_started',
  VALIDATION_COMPLETED: 'validation_completed',
  VALIDATION_FAILED: 'validation_failed',
  
  // Optimization events
  OPTIMIZATION_STARTED: 'optimization_started',
  OPTIMIZATION_COMPLETED: 'optimization_completed',
  OPTIMIZATION_FAILED: 'optimization_failed',
  
  // Version events
  VERSION_CREATED: 'version_created',
  VERSION_ACTIVATED: 'version_activated',
  VERSION_ROLLBACK: 'version_rollback',
  
  // Performance events
  PERFORMANCE_PROFILE_STARTED: 'performance_profile_started',
  PERFORMANCE_PROFILE_COMPLETED: 'performance_profile_completed',
  PERFORMANCE_THRESHOLD_EXCEEDED: 'performance_threshold_exceeded',
  
  // Cache events
  CACHE_HIT: 'cache_hit',
  CACHE_MISS: 'cache_miss',
  CACHE_CLEARED: 'cache_cleared',
  
  // Database events
  DATABASE_CONNECTED: 'database_connected',
  DATABASE_DISCONNECTED: 'database_disconnected',
  DATABASE_ERROR: 'database_error',
  
  // User feedback events
  FEEDBACK_RECEIVED: 'feedback_received',
  FEEDBACK_PROCESSED: 'feedback_processed',
  
  // Security events
  SECURITY_SCAN_STARTED: 'security_scan_started',
  SECURITY_SCAN_COMPLETED: 'security_scan_completed',
  SECURITY_ISSUE_DETECTED: 'security_issue_detected',
  
  // Error events
  ERROR_OCCURRED: 'error_occurred',
  ERROR_RECOVERED: 'error_recovered',
  
  // System events
  SYSTEM_INITIALIZED: 'system_initialized',
  SYSTEM_SHUTDOWN: 'system_shutdown',
  HANDLER_ERROR: 'handler_error'
} as const;

// Helper function to create events
export function createEvent(
  type: CodeGenerationEvent['type'],
  codeId?: string,
  data?: Record<string, unknown>
): CodeGenerationEvent {
  return {
    type,
    timestamp: new Date().toISOString(),
    codeId,
    data: data || {}
  };
}

// Event builder for fluent interface
export class EventBuilder {
  private event: Partial<CodeGenerationEvent> = {};

  type(type: CodeGenerationEvent['type']): EventBuilder {
    this.event.type = type;
    return this;
  }

  codeId(codeId: string): EventBuilder {
    this.event.codeId = codeId;
    return this;
  }

  data(data: Record<string, unknown>): EventBuilder {
    this.event.data = data;
    return this;
  }

  addData(key: string, value: unknown): EventBuilder {
    if (!this.event.data) {
      this.event.data = {};
    }
    this.event.data[key] = value;
    return this;
  }

  build(): CodeGenerationEvent {
    if (!this.event.type) {
      throw new Error('Event type is required');
    }
    
    return {
      type: this.event.type,
      timestamp: new Date().toISOString(),
      codeId: this.event.codeId,
      data: this.event.data || {}
    };
  }

  emit(): void {
    const event = this.build();
    globalEventEmitter.emitEvent(event);
  }
}