/**
 * Dependency Injection Container for the Code Generation System
 */

import { Injectable } from '../types/common-types';

export interface ServiceFactory<T = unknown> {
  (): T | Promise<T>;
}

export interface ServiceDescriptor<T = unknown> {
  token: string;
  factory: ServiceFactory<T>;
  singleton: boolean;
  instance?: T;
}

export interface IServiceContainer {
  register<T>(token: string, factory: ServiceFactory<T>, singleton?: boolean): void;
  resolve<T>(token: string): T;
  resolveAsync<T>(token: string): Promise<T>;
  has(token: string): boolean;
  createScope(): IServiceContainer;
}

export class ServiceContainer implements IServiceContainer {
  private services: Map<string, ServiceDescriptor> = new Map();
  private parent?: ServiceContainer;

  constructor(parent?: ServiceContainer) {
    this.parent = parent;
  }

  /**
   * Register a service with the container
   */
  register<T>(token: string, factory: ServiceFactory<T>, singleton: boolean = true): void {
    if (this.services.has(token)) {
      throw new Error(`Service with token "${token}" is already registered`);
    }

    this.services.set(token, {
      token,
      factory,
      singleton,
    });
  }

  /**
   * Register a singleton service
   */
  singleton<T>(token: string, factory: ServiceFactory<T>): void {
    this.register(token, factory, true);
  }

  /**
   * Register a transient service
   */
  transient<T>(token: string, factory: ServiceFactory<T>): void {
    this.register(token, factory, false);
  }

  /**
   * Resolve a service synchronously
   */
  resolve<T>(token: string): T {
    const descriptor = this.getDescriptor(token);
    
    if (!descriptor) {
      throw new Error(`Service with token "${token}" not found`);
    }

    if (descriptor.singleton && descriptor.instance) {
      return descriptor.instance as T;
    }

    const instance = descriptor.factory();
    
    if (instance instanceof Promise) {
      throw new Error(`Service "${token}" returns a Promise. Use resolveAsync() instead`);
    }

    if (descriptor.singleton) {
      descriptor.instance = instance;
    }

    return instance as T;
  }

  /**
   * Resolve a service asynchronously
   */
  async resolveAsync<T>(token: string): Promise<T> {
    const descriptor = this.getDescriptor(token);
    
    if (!descriptor) {
      throw new Error(`Service with token "${token}" not found`);
    }

    if (descriptor.singleton && descriptor.instance) {
      return descriptor.instance as T;
    }

    const instance = await descriptor.factory();

    if (descriptor.singleton) {
      descriptor.instance = instance;
    }

    return instance as T;
  }

  /**
   * Check if a service is registered
   */
  has(token: string): boolean {
    return this.services.has(token) || (this.parent?.has(token) ?? false);
  }

  /**
   * Create a scoped container
   */
  createScope(): IServiceContainer {
    return new ServiceContainer(this);
  }

  /**
   * Get descriptor from current or parent container
   */
  private getDescriptor(token: string): ServiceDescriptor | undefined {
    return this.services.get(token) || this.parent?.getDescriptor(token);
  }

  /**
   * Clear all services (useful for testing)
   */
  clear(): void {
    this.services.clear();
  }

  /**
   * Get all registered service tokens
   */
  getTokens(): string[] {
    const tokens = Array.from(this.services.keys());
    if (this.parent) {
      const parentTokens = this.parent.getTokens();
      return [...new Set([...tokens, ...parentTokens])];
    }
    return tokens;
  }
}

// Global container instance
export const globalContainer = new ServiceContainer();

// Service tokens
export const ServiceTokens = {
  // Core services
  AI_SERVICE: 'AIService',
  DATABASE: 'CodeGenerationDatabase',
  
  // Code generation services
  DYNAMIC_CODE_GENERATOR: 'DynamicCodeGenerator',
  CODE_CONTEXT_ANALYZER: 'CodeContextAnalyzer',
  CODE_VALIDATION_ENGINE: 'CodeValidationEngine',
  CODE_OPTIMIZATION_ENGINE: 'CodeOptimizationEngine',
  CODE_EXECUTION_MONITOR: 'CodeExecutionMonitor',
  
  // Language adapters
  PYTHON_ADAPTER: 'PythonCodeAdapter',
  SQL_ADAPTER: 'SQLCodeAdapter',
  TYPESCRIPT_ADAPTER: 'TypeScriptCodeAdapter',
  R_ADAPTER: 'RCodeAdapter',
  
  // Performance services
  PERFORMANCE_METRICS: 'AdvancedPerformanceMetrics',
  PERFORMANCE_PROFILER: 'PerformanceProfiler',
  
  // Quality services
  QUALITY_ASSESSOR: 'RealTimeQualityAssessor',
  SECURITY_SCANNER: 'AdvancedSecurityScanner',
  
  // Other services
  PROMPTING_ENGINE: 'AdvancedPromptingEngine',
  VERSION_MANAGER: 'CodeVersionManager',
  VISUAL_BUILDER: 'VisualCodeBuilder',
  LEARNING_ENGINE: 'CodeGenerationLearningEngine',
  
  // Configuration
  AI_PROVIDER: 'AIProvider',
  DATABASE_PATH: 'DatabasePath',
} as const;

// Decorator for injectable classes
export function Injectable(token: string, singleton: boolean = true) {
  return function <T extends { new(...args: any[]): {} }>(constructor: T) {
    // Store metadata on the constructor
    Reflect.defineMetadata('injectable:token', token, constructor);
    Reflect.defineMetadata('injectable:singleton', singleton, constructor);
    return constructor;
  };
}

// Helper to register all decorated classes
export function registerInjectables(container: IServiceContainer, classes: any[]): void {
  for (const cls of classes) {
    const token = Reflect.getMetadata('injectable:token', cls);
    const singleton = Reflect.getMetadata('injectable:singleton', cls);
    
    if (token) {
      container.register(token, () => new cls(), singleton);
    }
  }
}

// Dependency injection helper
export function inject<T>(token: string): T {
  return globalContainer.resolve<T>(token);
}

// Async dependency injection helper
export async function injectAsync<T>(token: string): Promise<T> {
  return globalContainer.resolveAsync<T>(token);
}