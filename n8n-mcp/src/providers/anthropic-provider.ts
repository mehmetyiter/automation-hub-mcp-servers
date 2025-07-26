import { BaseAIProvider } from './base-provider.js';
import { AIProvider } from '../types/ai-provider.js';
import { errorTracker } from '../monitoring/error-tracker.js';
import fetch from 'node-fetch';

export class AnthropicProvider extends BaseAIProvider {
  name: AIProvider = 'anthropic';

  /**
   * Post-process workflow to fix provider-specific issues
   * Anthropic tends to create disconnected nodes
   */
  applyPostProcessing(workflow: any): any {
    if (!workflow || !workflow.nodes) {
      return workflow;
    }

    // Anthropic-specific: Ensure all non-trigger nodes have connections
    const nodeMap = new Map(workflow.nodes.map((n: any) => [n.id, n]));
    const nodeNameMap = new Map(workflow.nodes.map((n: any) => [n.name, n]));
    
    // Initialize connections if not exists
    if (!workflow.connections) {
      workflow.connections = {};
    }

    // Find nodes without incoming connections
    const connectedNodes = new Set<string>();
    Object.entries(workflow.connections).forEach(([fromNode, connections]: [string, any]) => {
      if (connections.main) {
        connections.main.forEach((outputArray: any[]) => {
          outputArray.forEach((conn: any) => {
            connectedNodes.add(conn.node);
          });
        });
      }
    });

    // Auto-connect disconnected nodes based on position
    workflow.nodes.forEach((node: any) => {
      const isTrigger = node.type.includes('trigger') || node.type.includes('webhook') || node.type.includes('Trigger');
      
      // Skip if already connected or is a trigger
      if (connectedNodes.has(node.name) || isTrigger) {
        return;
      }

      // Find the nearest node to the left
      const potentialSources = workflow.nodes.filter((n: any) => {
        return n.id !== node.id &&
               n.position[0] < node.position[0] && // To the left
               Math.abs(n.position[1] - node.position[1]) < 150; // Similar Y position
      });

      if (potentialSources.length > 0) {
        // Sort by distance
        potentialSources.sort((a: any, b: any) => {
          const distA = node.position[0] - a.position[0];
          const distB = node.position[0] - b.position[0];
          return distA - distB;
        });

        const sourceNode = potentialSources[0];
        const sourceName = sourceNode.name;

        // Create connection
        if (!workflow.connections[sourceName]) {
          workflow.connections[sourceName] = { main: [[]] };
        }

        // Check if connection already exists
        const exists = workflow.connections[sourceName].main[0].some((conn: any) => conn.node === node.name);
        
        if (!exists) {
          console.log(`[Anthropic] Auto-connecting ${sourceName} -> ${node.name}`);
          workflow.connections[sourceName].main[0].push({
            node: node.name,
            type: 'main',
            index: 0
          });
        }
      }
    });

    return workflow;
  }

  async generateWorkflow(prompt: string, name: string, learningContext?: any): Promise<any> {
    const systemPrompt = this.buildSystemPrompt(learningContext);
    const userPrompt = `Create an n8n workflow named "${name}" for: ${prompt}`;

    try {
      console.log('Sending request to Anthropic API...');
      console.log('Model:', this.config.model || 'claude-opus-4-20250514');
      console.log('Max tokens:', this.config.maxTokens || 32000);
      
      // Retry with exponential backoff for rate limiting
      const maxRetries = 3;
      let lastError: any;
      
      for (let i = 0; i < maxRetries; i++) {
        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': this.config.apiKey,
              'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
              model: this.config.model || 'claude-sonnet-4-20250514',
              messages: [
                { role: 'user', content: userPrompt }
              ],
              system: systemPrompt,
              temperature: this.config.temperature || 0.7,
              max_tokens: this.config.maxTokens || 32000
            })
          });

          if (!response.ok) {
            const error = await response.text();
            lastError = new Error(`Anthropic API error: ${response.status} - ${error}`);
            
            // If rate limited, retry with exponential backoff
            if (response.status === 529 && i < maxRetries - 1) {
              const backoffMs = Math.pow(2, i) * 1000; // 1s, 2s, 4s
              console.log(`Rate limited, retrying in ${backoffMs}ms...`);
              await new Promise(resolve => setTimeout(resolve, backoffMs));
              continue;
            }
            
            throw lastError;
          }
          
          // Success - break out of retry loop
          const data = await response.json() as any;
          console.log('Anthropic response received');
          console.log('Tokens used:', data.usage);
          
          const content = data.content[0].text;
          console.log('Raw AI response length:', content.length);
          console.log('Raw AI response preview:', content.substring(0, 200) + '...');
          
          // Save raw response to file for debugging
          try {
            const fs = await import('fs');
            fs.writeFileSync('/tmp/latest-ai-response.txt', content);
            console.log('Raw AI response saved to /tmp/latest-ai-response.txt');
          } catch (e: any) {
            console.log('Could not save debug file:', e.message);
          }
          
          const workflow = this.parseAIResponse(content);

          // Special handling for plan generation
          if (name === 'plan' && workflow.totalNodes && workflow.sections) {
            // This is a valid plan structure, not a workflow
            return {
              success: true,
              workflow,
              usage: data.usage,
              provider: this.name
            };
          }

          if (!this.validateWorkflowStructure(workflow)) {
            throw new Error('Generated workflow has invalid structure');
          }

          return {
            success: true,
            workflow,
            usage: data.usage,
            provider: this.name
          };
          
        } catch (error: any) {
          lastError = error;
          if (error.message?.includes('529') && i < maxRetries - 1) {
            continue;
          }
          throw error;
        }
      }
      
      throw lastError;
    } catch (error: any) {
      console.error('Anthropic generation error:', error);
      
      // Track AI provider error
      await errorTracker.trackError({
        type: 'ai_provider',
        severity: error.name === 'AbortError' ? 'error' : 'critical',
        message: error.message,
        details: {
          provider: this.name,
          model: this.config.model,
          errorName: error.name,
          statusCode: error.statusCode,
          timeout: error.name === 'AbortError'
        },
        context: {
          prompt,
          workflowName: name,
          provider: this.name,
          phase: 'ai_generation'
        },
        stack: error.stack
      });
      
      // Check if it's a timeout error
      if (error.name === 'AbortError') {
        console.error('Request timed out after 2 minutes');
        return {
          success: false,
          error: 'Request timed out. There might be a temporary issue with the API.',
          provider: this.name
        };
      }
      
      return {
        success: false,
        error: error.message,
        provider: this.name
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 10
        })
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async getModels(): Promise<string[]> {
    // Anthropic doesn't have a models endpoint, so we return known models
    return [
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ];
  }

  protected async callAIForFix(prompt: string, currentWorkflow: any): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 2 minute timeout
    
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.config.model || 'claude-3-5-sonnet-20241022',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: this.config.maxTokens || 8000,
          temperature: this.config.temperature || 0.5, // Lower temperature for fixes
          system: 'You are an expert n8n workflow architect specializing in fixing broken workflows. Return only valid JSON without any explanations.'
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as any;
      return data.content[0].text;
    } catch (error: any) {
      clearTimeout(timeout);
      
      // Track AI provider error for workflow fixing
      await errorTracker.trackError({
        type: 'ai_provider',
        severity: error.name === 'AbortError' ? 'error' : 'critical',
        message: `Failed to fix workflow: ${error.message}`,
        details: {
          provider: this.name,
          model: this.config.model,
          errorName: error.name,
          statusCode: error.statusCode,
          timeout: error.name === 'AbortError',
          operation: 'fix_workflow'
        },
        context: {
          provider: this.name,
          phase: 'workflow_repair',
          nodeCount: currentWorkflow?.nodes?.length,
          connectionCount: Object.keys(currentWorkflow?.connections || {}).length
        },
        stack: error.stack
      });
      
      throw error;
    }
  }

  async chat(messages: Array<{role: string, content: string}>): Promise<any> {
    try {
      // Get max tokens limit for the model
      const modelLimits: Record<string, number> = {
        'claude-3-5-sonnet-20241022': 8192,
        'claude-3-5-haiku-20241022': 8192,
        'claude-3-opus-20240229': 4096,
        'claude-3-sonnet-20240229': 4096,
        'claude-3-haiku-20240307': 4096,
        'claude-opus-4-20250514': 32768,
        'claude-sonnet-4-20250514': 32768
      };
      
      const model = this.config.model || 'claude-3-5-sonnet-20241022';
      const maxModelTokens = modelLimits[model] || 4096;
      const maxTokens = this.config.maxTokens ? 
        Math.min(this.config.maxTokens, maxModelTokens) : 
        maxModelTokens;
      
      // Extract system message if present
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');
      
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model,
          messages: conversationMessages,
          system: systemMessage?.content,
          temperature: this.config.temperature || 0.7,
          max_tokens: maxTokens
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as any;
      
      return {
        success: true,
        content: data.content[0].text,
        usage: data.usage
      };
    } catch (error: any) {
      console.error('Anthropic chat error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}