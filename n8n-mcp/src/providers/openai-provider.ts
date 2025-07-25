import { BaseAIProvider } from './base-provider.js';
import { AIProvider } from '../types/ai-provider.js';
import fetch from 'node-fetch';

export class OpenAIProvider extends BaseAIProvider {
  name: AIProvider = 'openai';

  /**
   * Post-process workflow to fix provider-specific issues
   * OpenAI tends to create duplicate properties at root level
   */
  applyPostProcessing(workflow: any): any {
    if (!workflow || !workflow.nodes) {
      return workflow;
    }

    // Fix OpenAI-specific issue: duplicate properties at root level
    workflow.nodes = workflow.nodes.map((node: any) => {
      // Properties that should only exist in parameters
      const parameterOnlyProps = ['functionCode', 'jsCode', 'pythonCode', 'expression', 'code'];
      
      parameterOnlyProps.forEach(prop => {
        if (node[prop] !== undefined) {
          // Move to parameters if not already there
          if (!node.parameters) {
            node.parameters = {};
          }
          
          // Use root level value if parameters don't have it or if root has more content
          if (!node.parameters[prop] || 
              (typeof node[prop] === 'string' && node[prop].length > (node.parameters[prop] || '').length)) {
            console.log(`[OpenAI] Moving ${prop} from root to parameters for node ${node.name}`);
            node.parameters[prop] = node[prop];
          }
          
          // Remove from root
          delete node[prop];
        }
      });

      // Fix 'execute' property that OpenAI sometimes adds
      if (node.execute && node.type.includes('function')) {
        if (node.execute.function && !node.parameters?.functionCode) {
          if (!node.parameters) {
            node.parameters = {};
          }
          node.parameters.functionCode = node.execute.function;
        }
        delete node.execute;
      }

      return node;
    });

    return workflow;
  }

  async generateWorkflow(prompt: string, name: string, learningContext?: any): Promise<any> {
    const systemPrompt = this.buildSystemPrompt(learningContext);
    const userPrompt = `Create a COMPREHENSIVE n8n workflow named "${name}" that FULLY implements ALL features described below.

REQUIREMENTS:
${prompt}

🎯 INTELLIGENT WORKFLOW DESIGN 🎯

Create a workflow that PRECISELY matches the requirements.

1. NODE USAGE: Use exactly the nodes needed - no more, no less
2. PARALLEL BRANCHES: Create SEPARATE parallel branches for:
   - EACH API integration mentioned
   - EACH processing step mentioned
   - EACH error handling scenario
   - EACH notification type

3. RECOMMENDED NODE TYPES (USE AS APPROPRIATE):
   - IF nodes for conditional logic
   - Switch nodes for multi-way routing
   - SplitInBatches for batch processing
   - Merge nodes to combine branches
   - Set nodes for data transformation
   - Wait nodes for rate limiting
   - Function nodes for custom logic
   - Error Trigger nodes for error handling
   - Aggregate nodes for data summarization

4. ERROR HANDLING REQUIREMENTS:
   - EVERY workflow MUST include error handling nodes:
     * Add Error Trigger node (n8n-nodes-base.errorTrigger) with id and position
     * Add Email Send node for error notifications
     * Connect Error Trigger to Email Send in connections
   - EVERY external API call MUST have error handling
   - Add retry nodes with exponential backoff
   - Create fallback branches for failures
   - Include error logging and notifications

5. FEATURE IMPLEMENTATION:
   - Implement each feature with appropriate nodes
   - Use only necessary nodes for each functionality
   - Ensure complete implementation without excess
   - Focus on quality and correctness

6. CONNECTION REQUIREMENTS:
   - EVERY node MUST have proper connections
   - Use parallel branches that merge back
   - Ensure proper data flow throughout

CREATE AN EFFICIENT WORKFLOW!
Match complexity to requirements - simple tasks need simple solutions.
This is a PRODUCTION system - it needs CORRECT implementation!`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model || 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: this.config.temperature || 0.1,
          // Use max_completion_tokens for newer models like o3
          ...(this.config.model && ['o3', 'o3-mini'].includes(this.config.model) 
            ? { max_completion_tokens: this.config.maxTokens || 16000 }
            : { max_tokens: this.config.maxTokens || 16000 }),
          // Request JSON response format for models that support it
          ...(this.config.model && ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'].includes(this.config.model)
            ? { response_format: { type: "json_object" } }
            : {})
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as any;
      console.log('OpenAI response received');
      console.log('Tokens used:', data.usage);

      const content = data.choices[0].message.content;
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
      console.error('OpenAI generation error:', error);
      return {
        success: false,
        error: error.message,
        provider: this.name
      };
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async getModels(): Promise<string[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch models');
      }

      const data = await response.json() as any;
      return data.data
        .filter((model: any) => model.id.includes('gpt'))
        .map((model: any) => model.id)
        .sort();
    } catch (error) {
      console.error('Error fetching OpenAI models:', error);
      return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
    }
  }

  async chat(messages: any[]): Promise<any> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model || 'gpt-4o',
          messages: messages,
          temperature: this.config.temperature || 0.7,
          // Use max_completion_tokens for newer models like o3
          ...(this.config.model && ['o3', 'o3-mini'].includes(this.config.model) 
            ? { max_completion_tokens: this.config.maxTokens || 2000 }
            : { max_tokens: this.config.maxTokens || 2000 })
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as any;
      return {
        success: true,
        content: data.choices[0].message.content,
        usage: data.usage
      };
    } catch (error: any) {
      console.error('OpenAI chat error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  protected async callAIForFix(prompt: string, currentWorkflow: any): Promise<string> {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model || 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are an expert n8n workflow architect specializing in fixing broken workflows. Return only valid JSON without any explanations.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: this.config.temperature || 0.5, // Lower temperature for fixes
          ...(this.config.model && ['o3', 'o3-mini'].includes(this.config.model) 
            ? { max_completion_tokens: this.config.maxTokens || 8000 }
            : { max_tokens: this.config.maxTokens || 8000 })
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as any;
      return data.choices[0].message.content;
    } catch (error: any) {
      throw error;
    }
  }
}