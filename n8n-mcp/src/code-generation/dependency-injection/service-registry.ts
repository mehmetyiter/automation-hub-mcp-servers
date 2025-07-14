/**
 * Service Registry - Registers all services with the DI container
 */

import { IServiceContainer, ServiceTokens, globalContainer } from './container.js';
import { AIService } from '../../ai-service.js';
import { CodeGenerationDatabase } from '../database/code-generation-db.js';
import { DynamicCodeGenerator } from '../dynamic-code-generator.js';
import { CodeContextAnalyzer } from '../code-context-analyzer.js';
import { CodeValidationEngine } from '../code-validation-engine.js';
import { CodeOptimizationEngine } from '../code-optimization-engine.js';
import { CodeExecutionMonitor } from '../code-execution-monitor.js';
import { PythonCodeAdapter } from '../language-adapters/python-adapter.js';
import { SQLCodeAdapter } from '../language-adapters/sql-adapter.js';
import { TypeScriptCodeAdapter } from '../language-adapters/typescript-adapter.js';
import { RCodeAdapter } from '../language-adapters/r-adapter.js';
import { AdvancedPerformanceMetrics } from '../performance/advanced-metrics.js';
import { PerformanceProfiler } from '../performance/performance-profiler.js';
import { RealTimeQualityAssessor } from '../quality/real-time-quality-assessor.js';
import { AdvancedSecurityScanner } from '../security/advanced-security-scanner.js';
import { AdvancedPromptingEngine } from '../prompting/advanced-prompting-engine.js';
import { CodeVersionManager } from '../versioning/code-version-manager.js';
import { VisualCodeBuilder } from '../visual-builder/visual-code-builder.js';
import { CodeGenerationLearningEngine } from '../code-generation-learning-engine.js';

export interface ServiceRegistryOptions {
  aiProvider?: string;
  databasePath?: string;
}

export class ServiceRegistry {
  private container: IServiceContainer;
  private options: ServiceRegistryOptions;

  constructor(container: IServiceContainer = globalContainer, options: ServiceRegistryOptions = {}) {
    this.container = container;
    this.options = options;
  }

  /**
   * Register all services with the container
   */
  registerAll(): void {
    // Register configuration values
    this.registerConfiguration();
    
    // Register core services
    this.registerCoreServices();
    
    // Register language adapters
    this.registerLanguageAdapters();
    
    // Register performance services
    this.registerPerformanceServices();
    
    // Register quality services
    this.registerQualityServices();
    
    // Register other services
    this.registerOtherServices();
  }

  private registerConfiguration(): void {
    // AI Provider configuration
    this.container.register(ServiceTokens.AI_PROVIDER, () => 
      this.options.aiProvider || process.env.AI_PROVIDER || 'openai'
    , true);
    
    // Database path configuration
    this.container.register(ServiceTokens.DATABASE_PATH, () => 
      this.options.databasePath || process.env.CODE_GEN_DB_PATH
    , true);
  }

  private registerCoreServices(): void {
    // AI Service - Singleton
    this.container.register(ServiceTokens.AI_SERVICE, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new AIService(provider);
    }, false);
    
    // Database - Singleton
    this.container.register(ServiceTokens.DATABASE, () => {
      const dbPath = this.container.resolve<string | undefined>(ServiceTokens.DATABASE_PATH);
      return new CodeGenerationDatabase(dbPath);
    }, false);
    
    // Dynamic Code Generator - Transient
    this.container.register(ServiceTokens.DYNAMIC_CODE_GENERATOR, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new DynamicCodeGenerator(provider);
    }, false);
    
    // Code Context Analyzer - Transient
    this.container.register(ServiceTokens.CODE_CONTEXT_ANALYZER, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new CodeContextAnalyzer(provider);
    }, false);
    
    // Code Validation Engine - Transient
    this.container.register(ServiceTokens.CODE_VALIDATION_ENGINE, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new CodeValidationEngine(provider);
    }, false);
    
    // Code Optimization Engine - Transient
    this.container.register(ServiceTokens.CODE_OPTIMIZATION_ENGINE, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new CodeOptimizationEngine(provider);
    }, false);
    
    // Code Execution Monitor - Singleton
    this.container.register(ServiceTokens.CODE_EXECUTION_MONITOR, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new CodeExecutionMonitor(provider);
    }, false);
  }

  private registerLanguageAdapters(): void {
    // Python Adapter - Transient
    this.container.register(ServiceTokens.PYTHON_ADAPTER, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new PythonCodeAdapter(provider);
    }, false);
    
    // SQL Adapter - Transient
    this.container.register(ServiceTokens.SQL_ADAPTER, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new SQLCodeAdapter(provider);
    }, false);
    
    // TypeScript Adapter - Transient
    this.container.register(ServiceTokens.TYPESCRIPT_ADAPTER, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new TypeScriptCodeAdapter(provider);
    }, false);
    
    // R Adapter - Transient
    this.container.register(ServiceTokens.R_ADAPTER, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new RCodeAdapter(provider);
    }, false);
  }

  private registerPerformanceServices(): void {
    // Performance Metrics - Singleton
    this.container.register(ServiceTokens.PERFORMANCE_METRICS, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new AdvancedPerformanceMetrics(provider);
    }, false);
    
    // Performance Profiler - Singleton
    this.container.register(ServiceTokens.PERFORMANCE_PROFILER, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new PerformanceProfiler(provider);
    }, false);
  }

  private registerQualityServices(): void {
    // Quality Assessor - Singleton
    this.container.register(ServiceTokens.QUALITY_ASSESSOR, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new RealTimeQualityAssessor(provider);
    }, false);
    
    // Security Scanner - Singleton
    this.container.register(ServiceTokens.SECURITY_SCANNER, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new AdvancedSecurityScanner(provider);
    }, false);
  }

  private registerOtherServices(): void {
    // Prompting Engine - Singleton
    this.container.register(ServiceTokens.PROMPTING_ENGINE, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new AdvancedPromptingEngine(provider);
    }, false);
    
    // Version Manager - Singleton
    this.container.register(ServiceTokens.VERSION_MANAGER, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new CodeVersionManager(provider);
    }, false);
    
    // Visual Code Builder - Transient
    this.container.register(ServiceTokens.VISUAL_BUILDER, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new VisualCodeBuilder(provider);
    }, false);
    
    // Learning Engine - Singleton
    this.container.register(ServiceTokens.LEARNING_ENGINE, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new CodeGenerationLearningEngine(provider);
    }, false);
  }

  /**
   * Create a factory function for creating services with DI
   */
  static createServiceFactory<T>(
    token: string,
    dependencies: string[] = []
  ): (container: IServiceContainer) => T {
    return (container: IServiceContainer) => {
      const resolvedDeps = dependencies.map(dep => container.resolve(dep));
      return container.resolve<T>(token);
    };
  }
}

// Initialize the global registry
let globalRegistry: ServiceRegistry | null = null;

export function initializeServices(options?: ServiceRegistryOptions): void {
  if (!globalRegistry) {
    globalRegistry = new ServiceRegistry(globalContainer, options);
    globalRegistry.registerAll();
  }
}

export function getService<T>(token: string): T {
  if (!globalRegistry) {
    initializeServices();
  }
  return globalContainer.resolve<T>(token);
}

export async function getServiceAsync<T>(token: string): Promise<T> {
  if (!globalRegistry) {
    initializeServices();
  }
  return globalContainer.resolveAsync<T>(token);
}