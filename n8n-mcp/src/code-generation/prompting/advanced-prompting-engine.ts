import { CodeGenerationRequest, CodePattern } from '../types';
import { CodeGenerationDatabase } from '../database/code-generation-db';
import { AIService } from '../../ai-service';

export interface HistoricalPatterns {
  successfulPatterns: CodePattern[];
  failedPatterns: any[];
  commonRequests: any[];
}

export interface RelevantExample {
  request: string;
  code: string;
  performance: number;
  context: string;
}

export interface ReasoningStep {
  step: number;
  description: string;
  considerations: string[];
}

export interface EnhancedPrompt {
  systemPrompt: string;
  examples: RelevantExample[];
  reasoningChain: ReasoningStep[];
  validationPrompts: string[];
  metaPrompt: string;
  contextualHints: string[];
}

export class AdvancedPromptingEngine {
  private database: CodeGenerationDatabase;
  private aiService: AIService;
  private promptCache: Map<string, EnhancedPrompt>;

  constructor(provider?: string) {
    this.database = new CodeGenerationDatabase();
    this.aiService = new AIService(provider);
    this.promptCache = new Map();
  }

  async generateContextAwarePrompt(
    request: CodeGenerationRequest,
    historicalData?: HistoricalPatterns
  ): Promise<EnhancedPrompt> {
    console.log('🧠 Generating advanced context-aware prompt...');
    
    // Check cache first
    const cacheKey = this.generateCacheKey(request);
    if (this.promptCache.has(cacheKey)) {
      return this.promptCache.get(cacheKey)!;
    }

    // Load historical data if not provided
    if (!historicalData) {
      historicalData = await this.loadHistoricalPatterns(request);
    }

    // Generate prompt components in parallel
    const [examples, reasoningSteps, validationQuestions, contextualHints] = await Promise.all([
      this.selectRelevantExamples(request, historicalData),
      this.generateReasoningSteps(request),
      this.generateValidationQuestions(request),
      this.generateContextualHints(request, historicalData)
    ]);

    const enhancedPrompt: EnhancedPrompt = {
      systemPrompt: this.buildSystemPrompt(request),
      examples,
      reasoningChain: reasoningSteps,
      validationPrompts: validationQuestions,
      metaPrompt: this.generateMetaPrompt(request),
      contextualHints
    };

    // Cache the result
    this.promptCache.set(cacheKey, enhancedPrompt);

    return enhancedPrompt;
  }

  private buildSystemPrompt(request: CodeGenerationRequest): string {
    const language = request.requirements?.language || 'JavaScript';
    const performance = request.requirements?.performanceLevel || 'standard';
    const errorHandling = request.requirements?.errorHandling || 'basic';

    return `
You are an expert software engineer specializing in ${language} with deep expertise in n8n workflow automation.

Your expertise includes:
- Writing production-ready, maintainable ${language} code
- Implementing complex business logic with clarity and efficiency
- Optimizing for ${performance} performance requirements
- Following industry best practices and design patterns
- Creating ${errorHandling} error handling strategies
- Understanding n8n's execution context and data structures

Core Principles:
1. **Clarity over Cleverness**: Write code that is easy to understand and maintain
2. **Defensive Programming**: Anticipate and handle edge cases gracefully
3. **Performance Awareness**: Balance readability with efficiency
4. **Security First**: Never introduce security vulnerabilities
5. **Business Value**: Focus on solving the actual business problem

For this specific request, you should:
1. Deeply analyze the business requirements and context
2. Design the optimal algorithmic approach considering trade-offs
3. Implement with proper validation and error handling
4. Optimize for the specific use case and data patterns
5. Ensure code follows ${language} best practices and idioms
6. Add meaningful comments for complex logic sections
7. Structure code for easy testing and maintenance

Think step by step, explain your reasoning when making decisions, and ensure the code directly addresses the user's specific needs.

Remember: The goal is to generate code that works correctly the first time and continues to work reliably in production.`;
  }

  private async selectRelevantExamples(
    request: CodeGenerationRequest,
    historicalData: HistoricalPatterns
  ): Promise<RelevantExample[]> {
    console.log('📚 Selecting relevant examples...');

    // Get successful patterns similar to current request
    const relevantPatterns = historicalData.successfulPatterns
      .filter(pattern => this.calculateSimilarity(request.description, pattern.name) > 0.7)
      .sort((a, b) => b.performance - a.performance)
      .slice(0, 3);

    // Convert patterns to examples
    const examples: RelevantExample[] = relevantPatterns.map(pattern => ({
      request: pattern.description,
      code: pattern.pattern,
      performance: pattern.performance,
      context: `This pattern has ${pattern.reliability * 100}% reliability`
    }));

    // Add domain-specific examples
    const domainExamples = await this.generateDomainSpecificExamples(request);
    examples.push(...domainExamples);

    return examples.slice(0, 5); // Return top 5 examples
  }

  private async generateReasoningSteps(request: CodeGenerationRequest): Promise<ReasoningStep[]> {
    console.log('🔍 Generating reasoning steps...');

    const analysisPrompt = `
Analyze this code generation request and create a step-by-step reasoning process:

Request: "${request.description}"
Node Type: ${request.nodeType}
Context: ${JSON.stringify(request.workflowContext)}

Generate reasoning steps that a developer would follow:
{
  "steps": [
    {
      "step": 1,
      "description": "What to analyze first",
      "considerations": ["What factors to consider"]
    }
  ]
}

Focus on:
- Understanding the business requirement
- Identifying data structures needed
- Choosing appropriate algorithms
- Planning error handling
- Considering edge cases
- Optimizing for performance`;

    try {
      const response = await this.aiService.getJSONResponse(analysisPrompt);
      return response.steps || this.getDefaultReasoningSteps(request);
    } catch (error) {
      return this.getDefaultReasoningSteps(request);
    }
  }

  private getDefaultReasoningSteps(request: CodeGenerationRequest): ReasoningStep[] {
    return [
      {
        step: 1,
        description: 'Understand the input data structure and requirements',
        considerations: [
          'What data format will be received?',
          'What fields are required vs optional?',
          'What are the data types and constraints?'
        ]
      },
      {
        step: 2,
        description: 'Design the transformation or processing logic',
        considerations: [
          'What operations need to be performed?',
          'What is the desired output format?',
          'Are there any calculations or validations needed?'
        ]
      },
      {
        step: 3,
        description: 'Plan error handling and edge cases',
        considerations: [
          'What if input is empty or malformed?',
          'How to handle missing required fields?',
          'What errors should be logged vs thrown?'
        ]
      },
      {
        step: 4,
        description: 'Optimize for performance and maintainability',
        considerations: [
          'Can any operations be combined or simplified?',
          'Is the code readable and well-structured?',
          'Are there any performance bottlenecks?'
        ]
      }
    ];
  }

  private async generateValidationQuestions(request: CodeGenerationRequest): Promise<string[]> {
    console.log('✅ Generating validation questions...');

    return [
      'Does the code handle all specified requirements from the request?',
      'Are all edge cases properly handled (empty input, null values, type mismatches)?',
      'Is the error handling comprehensive and informative?',
      'Does the code follow n8n best practices for data structure (return [{json: ...}])?',
      'Is the code optimized for the expected data volume and patterns?',
      'Are there any security vulnerabilities or unsafe operations?',
      'Is the code maintainable with clear variable names and structure?',
      'Would this code work correctly in the n8n execution environment?'
    ];
  }

  private generateMetaPrompt(request: CodeGenerationRequest): string {
    return `
IMPORTANT: After generating the code, perform these self-checks:

1. **Correctness Check**: Does the code actually solve the stated problem?
2. **Completeness Check**: Are all requirements addressed?
3. **Safety Check**: Are there any security issues or unsafe operations?
4. **Performance Check**: Is the code efficient for the expected use case?
5. **Maintainability Check**: Is the code clear and well-structured?

If any check fails, revise the code before providing the final answer.

Remember to:
- Include actual business logic, not placeholders
- Handle errors gracefully with informative messages
- Use descriptive variable and function names
- Add comments only where logic is complex
- Ensure compatibility with n8n's execution context`;
  }

  private async generateContextualHints(
    request: CodeGenerationRequest,
    historicalData: HistoricalPatterns
  ): Promise<string[]> {
    const hints: string[] = [];

    // Add hints based on node type
    if (request.nodeType === 'code') {
      hints.push('Remember to access input data via $input.all()');
      hints.push('Return data in n8n format: [{json: {...}}]');
    }

    // Add hints based on request keywords
    const description = request.description.toLowerCase();
    if (description.includes('filter')) {
      hints.push('Use Array.filter() for efficient filtering');
      hints.push('Consider performance impact of filter conditions');
    }
    if (description.includes('transform')) {
      hints.push('Use Array.map() for data transformation');
      hints.push('Preserve original data structure where appropriate');
    }
    if (description.includes('aggregate')) {
      hints.push('Use Array.reduce() for aggregation operations');
      hints.push('Initialize accumulator with appropriate default values');
    }
    if (description.includes('validate')) {
      hints.push('Implement comprehensive validation rules');
      hints.push('Provide clear error messages for validation failures');
    }

    // Add hints from historical failures
    const commonFailures = historicalData.failedPatterns
      .map(f => f.reason)
      .filter((r, i, arr) => arr.indexOf(r) === i)
      .slice(0, 3);

    commonFailures.forEach(failure => {
      hints.push(`Avoid: ${failure}`);
    });

    return hints;
  }

  private async generateDomainSpecificExamples(
    request: CodeGenerationRequest
  ): Promise<RelevantExample[]> {
    const examples: RelevantExample[] = [];
    const description = request.description.toLowerCase();

    // Add examples based on common patterns
    if (description.includes('email') || description.includes('notification')) {
      examples.push({
        request: 'Send email notifications for new orders',
        code: `
const inputItems = $input.all();
const processedItems = [];

for (const item of inputItems) {
  try {
    const order = item.json;
    
    // Validate order data
    if (!order.email || !order.orderId) {
      throw new Error('Missing required fields: email or orderId');
    }
    
    // Prepare notification data
    const notification = {
      to: order.email,
      subject: \`Order #\${order.orderId} Confirmation\`,
      orderId: order.orderId,
      customerName: order.customerName || 'Valued Customer',
      orderTotal: order.total || 0,
      orderDate: new Date().toISOString(),
      status: 'pending_notification'
    };
    
    processedItems.push({ json: notification });
    
  } catch (error) {
    console.error('Error processing order:', error);
    processedItems.push({
      json: {
        ...item.json,
        error: error.message,
        status: 'failed'
      }
    });
  }
}

return processedItems;`,
        performance: 0.95,
        context: 'Email notification pattern with validation'
      });
    }

    if (description.includes('calculate') || description.includes('sum')) {
      examples.push({
        request: 'Calculate total revenue by category',
        code: `
const inputItems = $input.all();

// Initialize aggregation object
const revenueByCategory = {};
let totalRevenue = 0;

// Process each transaction
for (const item of inputItems) {
  const transaction = item.json;
  
  // Validate transaction data
  if (typeof transaction.amount !== 'number' || !transaction.category) {
    console.warn('Invalid transaction data:', transaction);
    continue;
  }
  
  // Aggregate by category
  if (!revenueByCategory[transaction.category]) {
    revenueByCategory[transaction.category] = {
      category: transaction.category,
      revenue: 0,
      transactionCount: 0
    };
  }
  
  revenueByCategory[transaction.category].revenue += transaction.amount;
  revenueByCategory[transaction.category].transactionCount += 1;
  totalRevenue += transaction.amount;
}

// Convert to array format for n8n
const results = Object.values(revenueByCategory).map(categoryData => ({
  json: {
    ...categoryData,
    averageTransaction: categoryData.revenue / categoryData.transactionCount,
    percentageOfTotal: (categoryData.revenue / totalRevenue) * 100
  }
}));

// Add summary record
results.push({
  json: {
    category: 'TOTAL',
    revenue: totalRevenue,
    transactionCount: inputItems.length,
    averageTransaction: totalRevenue / inputItems.length
  }
});

return results;`,
        performance: 0.92,
        context: 'Aggregation pattern with calculations'
      });
    }

    return examples;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple similarity calculation based on common words
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const similarity = commonWords.length / Math.max(words1.length, words2.length);
    
    return similarity;
  }

  private async loadHistoricalPatterns(request: CodeGenerationRequest): Promise<HistoricalPatterns> {
    try {
      const patterns = await this.database.getSuccessfulPatterns({
        limit: 100
      });

      return {
        successfulPatterns: patterns,
        failedPatterns: [], // Would load from database
        commonRequests: [] // Would load from database
      };
    } catch (error) {
      console.error('Failed to load historical patterns:', error);
      return {
        successfulPatterns: [],
        failedPatterns: [],
        commonRequests: []
      };
    }
  }

  private generateCacheKey(request: CodeGenerationRequest): string {
    const crypto = require('crypto');
    return crypto
      .createHash('md5')
      .update(JSON.stringify({
        description: request.description,
        nodeType: request.nodeType,
        language: request.requirements?.language
      }))
      .digest('hex');
  }

  formatPromptForAI(enhancedPrompt: EnhancedPrompt, request: CodeGenerationRequest): string {
    let formattedPrompt = enhancedPrompt.systemPrompt + '\n\n';

    // Add examples if available
    if (enhancedPrompt.examples.length > 0) {
      formattedPrompt += '## Relevant Examples:\n\n';
      enhancedPrompt.examples.forEach((example, index) => {
        formattedPrompt += `### Example ${index + 1}: ${example.request}\n`;
        formattedPrompt += '```javascript\n' + example.code + '\n```\n';
        formattedPrompt += `Performance: ${example.performance}, ${example.context}\n\n`;
      });
    }

    // Add reasoning chain
    formattedPrompt += '## Step-by-Step Reasoning:\n\n';
    enhancedPrompt.reasoningChain.forEach(step => {
      formattedPrompt += `${step.step}. ${step.description}\n`;
      step.considerations.forEach(consideration => {
        formattedPrompt += `   - ${consideration}\n`;
      });
      formattedPrompt += '\n';
    });

    // Add the actual request
    formattedPrompt += `## Current Request:\n\n`;
    formattedPrompt += `Generate ${request.requirements?.language || 'JavaScript'} code for: "${request.description}"\n\n`;

    // Add contextual hints
    if (enhancedPrompt.contextualHints.length > 0) {
      formattedPrompt += '## Important Considerations:\n';
      enhancedPrompt.contextualHints.forEach(hint => {
        formattedPrompt += `- ${hint}\n`;
      });
      formattedPrompt += '\n';
    }

    // Add validation questions
    formattedPrompt += '## Self-Validation Checklist:\n';
    enhancedPrompt.validationPrompts.forEach(question => {
      formattedPrompt += `- ${question}\n`;
    });

    // Add meta prompt
    formattedPrompt += '\n' + enhancedPrompt.metaPrompt;

    return formattedPrompt;
  }
}