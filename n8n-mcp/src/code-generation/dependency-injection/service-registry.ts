/**
 * Service Registry - Registers all services with the DI container
 */

import { IServiceContainer, ServiceTokens, globalContainer } from './container';
import { AIService } from '../../ai-service';
import { CodeGenerationDatabase } from '../database/code-generation-db';
import { DynamicCodeGenerator } from '../dynamic-code-generator';
import { CodeContextAnalyzer } from '../code-context-analyzer';
import { CodeValidationEngine } from '../code-validation-engine';
import { CodeOptimizationEngine } from '../code-optimization-engine';
import { CodeExecutionMonitor } from '../code-execution-monitor';
import { PythonCodeAdapter } from '../language-adapters/python-adapter';
import { SQLCodeAdapter } from '../language-adapters/sql-adapter';
import { TypeScriptCodeAdapter } from '../language-adapters/typescript-adapter';
import { RCodeAdapter } from '../language-adapters/r-adapter';
import { AdvancedPerformanceMetrics } from '../performance/advanced-metrics';
import { PerformanceProfiler } from '../performance/performance-profiler';
import { RealTimeQualityAssessor } from '../quality/real-time-quality-assessor';
import { AdvancedSecurityScanner } from '../security/advanced-security-scanner';
import { AdvancedPromptingEngine } from '../prompting/advanced-prompting-engine';
import { CodeVersionManager } from '../versioning/code-version-manager';
import { VisualCodeBuilder } from '../visual-builder/visual-code-builder';
import { CodeGenerationLearningEngine } from '../code-generation-learning-engine';

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
    this.container.singleton(ServiceTokens.AI_PROVIDER, () => 
      this.options.aiProvider || process.env.AI_PROVIDER || 'openai'
    );
    
    // Database path configuration
    this.container.singleton(ServiceTokens.DATABASE_PATH, () => 
      this.options.databasePath || process.env.CODE_GEN_DB_PATH
    );
  }

  private registerCoreServices(): void {
    // AI Service - Singleton
    this.container.singleton(ServiceTokens.AI_SERVICE, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new AIService(provider);
    });
    
    // Database - Singleton
    this.container.singleton(ServiceTokens.DATABASE, () => {
      const dbPath = this.container.resolve<string | undefined>(ServiceTokens.DATABASE_PATH);
      return new CodeGenerationDatabase(dbPath);
    });
    
    // Dynamic Code Generator - Transient
    this.container.transient(ServiceTokens.DYNAMIC_CODE_GENERATOR, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new DynamicCodeGenerator(provider);
    });
    
    // Code Context Analyzer - Transient
    this.container.transient(ServiceTokens.CODE_CONTEXT_ANALYZER, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new CodeContextAnalyzer(provider);
    });
    
    // Code Validation Engine - Transient
    this.container.transient(ServiceTokens.CODE_VALIDATION_ENGINE, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new CodeValidationEngine(provider);
    });
    
    // Code Optimization Engine - Transient
    this.container.transient(ServiceTokens.CODE_OPTIMIZATION_ENGINE, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new CodeOptimizationEngine(provider);
    });
    
    // Code Execution Monitor - Singleton
    this.container.singleton(ServiceTokens.CODE_EXECUTION_MONITOR, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new CodeExecutionMonitor(provider);
    });
  }

  private registerLanguageAdapters(): void {
    // Python Adapter - Transient
    this.container.transient(ServiceTokens.PYTHON_ADAPTER, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new PythonCodeAdapter(provider);
    });
    
    // SQL Adapter - Transient
    this.container.transient(ServiceTokens.SQL_ADAPTER, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new SQLCodeAdapter(provider);
    });
    
    // TypeScript Adapter - Transient
    this.container.transient(ServiceTokens.TYPESCRIPT_ADAPTER, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new TypeScriptCodeAdapter(provider);
    });
    
    // R Adapter - Transient
    this.container.transient(ServiceTokens.R_ADAPTER, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new RCodeAdapter(provider);
    });
  }

  private registerPerformanceServices(): void {
    // Performance Metrics - Singleton
    this.container.singleton(ServiceTokens.PERFORMANCE_METRICS, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new AdvancedPerformanceMetrics(provider);
    });
    
    // Performance Profiler - Singleton
    this.container.singleton(ServiceTokens.PERFORMANCE_PROFILER, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new PerformanceProfiler(provider);
    });
  }

  private registerQualityServices(): void {
    // Quality Assessor - Singleton
    this.container.singleton(ServiceTokens.QUALITY_ASSESSOR, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new RealTimeQualityAssessor(provider);
    });
    
    // Security Scanner - Singleton
    this.container.singleton(ServiceTokens.SECURITY_SCANNER, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new AdvancedSecurityScanner(provider);
    });
  }

  private registerOtherServices(): void {
    // Prompting Engine - Singleton
    this.container.singleton(ServiceTokens.PROMPTING_ENGINE, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new AdvancedPromptingEngine(provider);
    });
    
    // Version Manager - Singleton
    this.container.singleton(ServiceTokens.VERSION_MANAGER, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new CodeVersionManager(provider);
    });
    
    // Visual Code Builder - Transient
    this.container.transient(ServiceTokens.VISUAL_BUILDER, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new VisualCodeBuilder(provider);
    });
    
    // Learning Engine - Singleton
    this.container.singleton(ServiceTokens.LEARNING_ENGINE, () => {
      const provider = this.container.resolve<string>(ServiceTokens.AI_PROVIDER);
      return new CodeGenerationLearningEngine(provider);
    });
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