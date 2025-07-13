import { apiClient } from './api-client';

export interface SandboxExecutionOptions {
  code: string;
  language: string;
  environment: {
    language: string;
    runtime: string;
    setupCode?: string;
    cleanupCode?: string;
  };
  dependencies?: Record<string, string>;
  setupCode?: string;
  hiddenTests?: string;
  timeout?: number;
}

export interface SandboxExecutionResult {
  output?: any;
  error?: string;
  type: 'success' | 'error' | 'timeout';
  executionTime?: number;
  testResults?: {
    passed: number;
    failed: number;
    tests: Array<{
      name: string;
      passed: boolean;
      message?: string;
    }>;
  };
}

class SandboxExecutor {
  private worker: Worker | null = null;
  private iframe: HTMLIFrameElement | null = null;

  async execute(options: SandboxExecutionOptions): Promise<SandboxExecutionResult> {
    const startTime = Date.now();
    
    try {
      switch (options.language) {
        case 'typescript':
        case 'javascript':
          return await this.executeJavaScript(options, startTime);
          
        case 'python':
          return await this.executePython(options, startTime);
          
        case 'go':
          return await this.executeGo(options, startTime);
          
        default:
          return {
            error: `Unsupported language: ${options.language}`,
            type: 'error'
          };
      }
    } catch (error: any) {
      return {
        error: error.message || 'Execution failed',
        type: 'error',
        executionTime: Date.now() - startTime
      };
    }
  }

  private async executeJavaScript(
    options: SandboxExecutionOptions,
    startTime: number
  ): Promise<SandboxExecutionResult> {
    // Create sandboxed iframe for execution
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.sandbox.add('allow-scripts');
    document.body.appendChild(iframe);
    
    try {
      // Inject utilities and SDK mock
      const sandboxCode = `
        // Console capture
        const logs = [];
        const originalConsole = console;
        const console = {
          log: (...args) => {
            logs.push({ type: 'log', args });
            originalConsole.log(...args);
          },
          error: (...args) => {
            logs.push({ type: 'error', args });
            originalConsole.error(...args);
          },
          warn: (...args) => {
            logs.push({ type: 'warn', args });
            originalConsole.warn(...args);
          }
        };
        
        // Mock n8n-MCP SDK
        const N8nMcpClient = class {
          constructor(config) {
            this.config = config;
            this.workflows = {
              list: async (params) => ({ 
                data: [
                  { id: 'wf_123', name: 'Test Workflow', status: 'active' }
                ],
                pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
              }),
              get: async (id) => ({ 
                id, 
                name: 'Test Workflow',
                status: 'active',
                nodes: []
              }),
              create: async (data) => ({ 
                id: 'wf_' + Date.now(),
                status: 201,
                data: { ...data, id: 'wf_' + Date.now() }
              }),
              update: async (id, data) => ({ id, ...data }),
              delete: async (id) => {},
              execute: async (id, data) => ({
                execution_id: 'exec_' + Date.now(),
                status: 'running',
                data: { id: 'exec_' + Date.now() }
              })
            };
            this.executions = {
              get: async (id) => ({ id, status: 'success' }),
              list: async (workflowId, params) => ({ data: [] })
            };
          }
          
          request(config) {
            return Promise.resolve({ data: {}, status: 200 });
          }
        };
        
        // API Error classes
        class ApiError extends Error {
          constructor(message, status, code) {
            super(message);
            this.status = status;
            this.code = code;
          }
        }
        
        class ValidationError extends ApiError {
          constructor(message, details) {
            super(message, 422, 'VALIDATION_ERROR');
            this.details = details;
          }
        }
        
        // Async execution wrapper
        (async () => {
          let result;
          let error;
          
          try {
            ${options.setupCode || ''}
            
            ${options.code}
            
            ${options.hiddenTests || ''}
          } catch (e) {
            error = e;
          }
          
          return {
            logs,
            result,
            error: error ? { message: error.message, stack: error.stack } : null
          };
        })();
      `;
      
      // Execute in iframe
      const iframeWindow = iframe.contentWindow;
      if (!iframeWindow) throw new Error('Failed to create sandbox');
      
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Execution timeout')), options.timeout || 5000);
      });
      
      // Execute code with timeout
      const executionPromise = iframeWindow.eval(sandboxCode);
      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      if (result.error) {
        return {
          error: result.error.message,
          type: 'error',
          executionTime: Date.now() - startTime
        };
      }
      
      // Process logs into output
      const output = result.logs
        .filter(log => log.type === 'log')
        .map(log => log.args.join(' '))
        .join('\n');
      
      return {
        output: output || result.result,
        type: 'success',
        executionTime: Date.now() - startTime
      };
      
    } catch (error: any) {
      if (error.message === 'Execution timeout') {
        return {
          error: 'Code execution timed out',
          type: 'timeout',
          executionTime: Date.now() - startTime
        };
      }
      
      return {
        error: error.message,
        type: 'error',
        executionTime: Date.now() - startTime
      };
    } finally {
      document.body.removeChild(iframe);
    }
  }

  private async executePython(
    options: SandboxExecutionOptions,
    startTime: number
  ): Promise<SandboxExecutionResult> {
    // For Python, we'll use a web service or Pyodide
    // This is a mock implementation
    try {
      // In a real implementation, you would:
      // 1. Send code to a Python execution service
      // 2. Or use Pyodide for browser-based Python execution
      
      const mockResult = {
        output: 'Python execution not implemented in this demo',
        type: 'success' as const,
        executionTime: Date.now() - startTime
      };
      
      return mockResult;
    } catch (error: any) {
      return {
        error: error.message,
        type: 'error',
        executionTime: Date.now() - startTime
      };
    }
  }

  private async executeGo(
    options: SandboxExecutionOptions,
    startTime: number
  ): Promise<SandboxExecutionResult> {
    // For Go, we'll use a web service
    // This is a mock implementation
    try {
      const mockResult = {
        output: 'Go execution not implemented in this demo',
        type: 'success' as const,
        executionTime: Date.now() - startTime
      };
      
      return mockResult;
    } catch (error: any) {
      return {
        error: error.message,
        type: 'error',
        executionTime: Date.now() - startTime
      };
    }
  }
}

// Export singleton instance
export const sandboxExecutor = new SandboxExecutor();

// Export convenience function
export const executeInSandbox = (options: SandboxExecutionOptions) => {
  return sandboxExecutor.execute(options);
};