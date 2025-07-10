/**
 * Example usage of the Dependency Injection system
 */

import { globalContainer, ServiceTokens } from './container';
import { initializeServices, getService } from './service-registry';
import { DynamicCodeGeneratorDI } from '../dynamic-code-generator-di';
import { CodeGenerationRequest } from '../types';

// Example 1: Basic usage with global container
export async function example1() {
  // Initialize all services
  initializeServices({
    aiProvider: 'openai',
    databasePath: './data/code-gen.db'
  });

  // Get services from the container
  const codeGenerator = getService<DynamicCodeGeneratorDI>(ServiceTokens.DYNAMIC_CODE_GENERATOR);
  
  // Use the service
  const request: CodeGenerationRequest = {
    description: 'Transform data by adding timestamps',
    nodeType: 'code',
    workflowContext: {
      workflowPurpose: 'Data transformation'
    }
  };

  const result = await codeGenerator.generateCode(request);
  console.log('Generated code:', result.code);
}

// Example 2: Using scoped containers for isolation
export async function example2() {
  // Create a scoped container
  const scopedContainer = globalContainer.createScope();
  
  // Register services in the scoped container
  scopedContainer.register(ServiceTokens.AI_PROVIDER, () => 'anthropic');
  
  // Create code generator with scoped dependencies
  const codeGenerator = DynamicCodeGeneratorDI.createScoped(scopedContainer);
  
  // Use the service
  const request: CodeGenerationRequest = {
    description: 'Filter items by status',
    nodeType: 'code',
    workflowContext: {
      workflowPurpose: 'Data filtering'
    }
  };

  const result = await codeGenerator.generateCode(request);
  console.log('Generated code:', result.code);
}

// Example 3: Testing with mock services
export async function example3() {
  // Create a test container
  const testContainer = globalContainer.createScope();
  
  // Register mock services
  const mockAIService = {
    callAI: async (prompt: string) => {
      return `// Mock generated code for: ${prompt}`;
    },
    getJSONResponse: async (prompt: string) => {
      return { success: true };
    }
  };
  
  testContainer.register(ServiceTokens.AI_SERVICE, () => mockAIService);
  
  // Create code generator with mocked dependencies
  const codeGenerator = DynamicCodeGeneratorDI.create(testContainer);
  
  // Run tests
  const request: CodeGenerationRequest = {
    description: 'Test code generation',
    nodeType: 'code',
    workflowContext: {}
  };

  const result = await codeGenerator.generateCode(request);
  console.log('Test result:', result);
}

// Example 4: Factory pattern with DI
export class CodeGeneratorFactory {
  constructor(private container = globalContainer) {}

  createGenerator(options?: { aiProvider?: string }): DynamicCodeGeneratorDI {
    if (options?.aiProvider) {
      // Create a scoped container with custom provider
      const scoped = this.container.createScope();
      scoped.register(ServiceTokens.AI_PROVIDER, () => options.aiProvider);
      return DynamicCodeGeneratorDI.create(scoped);
    }
    
    // Use default container
    return DynamicCodeGeneratorDI.create(this.container);
  }
}

// Example 5: Lazy loading services
export async function example5() {
  // Register services with lazy loading
  globalContainer.singleton(ServiceTokens.DYNAMIC_CODE_GENERATOR, async () => {
    // Dynamically import the module
    const module = await import('../dynamic-code-generator-di');
    return module.DynamicCodeGeneratorDI.create(globalContainer);
  });

  // Resolve asynchronously
  const codeGenerator = await globalContainer.resolveAsync<DynamicCodeGeneratorDI>(
    ServiceTokens.DYNAMIC_CODE_GENERATOR
  );

  // Use the service
  const request: CodeGenerationRequest = {
    description: 'Aggregate data by category',
    nodeType: 'code',
    workflowContext: {}
  };

  const result = await codeGenerator.generateCode(request);
  console.log('Generated code:', result.code);
}

// Example 6: Service middleware/decorators
export function withLogging<T>(service: T, serviceName: string): T {
  return new Proxy(service as any, {
    get(target, prop) {
      const original = target[prop];
      if (typeof original === 'function') {
        return async (...args: any[]) => {
          console.log(`[${serviceName}] Calling ${String(prop)} with:`, args);
          const start = Date.now();
          try {
            const result = await original.apply(target, args);
            console.log(`[${serviceName}] ${String(prop)} completed in ${Date.now() - start}ms`);
            return result;
          } catch (error) {
            console.error(`[${serviceName}] ${String(prop)} failed:`, error);
            throw error;
          }
        };
      }
      return original;
    }
  }) as T;
}

// Example usage with middleware
export async function example6() {
  // Register service with logging middleware
  globalContainer.singleton(ServiceTokens.DYNAMIC_CODE_GENERATOR, () => {
    const generator = DynamicCodeGeneratorDI.create(globalContainer);
    return withLogging(generator, 'DynamicCodeGenerator');
  });

  const codeGenerator = getService<DynamicCodeGeneratorDI>(ServiceTokens.DYNAMIC_CODE_GENERATOR);
  
  const request: CodeGenerationRequest = {
    description: 'Sort items by date',
    nodeType: 'code',
    workflowContext: {}
  };

  const result = await codeGenerator.generateCode(request);
  console.log('Generated code:', result.code);
}