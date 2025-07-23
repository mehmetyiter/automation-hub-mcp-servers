import { FeedbackData, WorkflowPattern, PerformanceMetric, GenerationRecord } from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { cleanWorkflow } from '../utils/json-cleaner.js';

export class KnowledgeStore {
  private dataDir: string;
  private feedbackFile: string;
  private patternsFile: string;
  private metricsFile: string;
  private generationsFile: string;

  constructor(dataDir: string = './learning-data') {
    this.dataDir = dataDir;
    this.feedbackFile = path.join(dataDir, 'feedback.json');
    this.patternsFile = path.join(dataDir, 'patterns.json');
    this.metricsFile = path.join(dataDir, 'metrics.json');
    this.generationsFile = path.join(dataDir, 'generations.json');
    
    this.initializeStore();
  }

  private async initializeStore(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      
      // Initialize files if they don't exist
      const files = [this.feedbackFile, this.patternsFile, this.metricsFile, this.generationsFile];
      for (const file of files) {
        try {
          await fs.access(file);
        } catch {
          await fs.writeFile(file, '[]');
        }
      }
    } catch (error) {
      console.error('Failed to initialize knowledge store:', error);
    }
  }

  async saveFeedback(feedback: FeedbackData): Promise<void> {
    const feedbacks = await this.loadFeedback();
    feedbacks.push(feedback);
    
    // Keep only last 1000 feedbacks
    const recentFeedbacks = feedbacks.slice(-1000);
    await fs.writeFile(this.feedbackFile, JSON.stringify(recentFeedbacks, null, 2));
  }

  async loadFeedback(): Promise<FeedbackData[]> {
    try {
      const data = await fs.readFile(this.feedbackFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async saveGeneration(record: GenerationRecord): Promise<void> {
    const generations = await this.loadGenerations();
    
    try {
      // Create a clean copy without circular references
      const cleanedWorkflow = cleanWorkflow(record.workflow);
      
      const cleanRecord: GenerationRecord = {
        id: record.id,
        prompt: record.prompt,
        workflow: cleanedWorkflow,
        provider: record.provider,
        model: record.model,
        timestamp: record.timestamp,
        nodeCount: record.nodeCount,
        connectionCount: record.connectionCount
      };
      
      generations.push(cleanRecord);
      
      // Keep only last 500 generations
      const recentGenerations = generations.slice(-500);
      await fs.writeFile(this.generationsFile, JSON.stringify(recentGenerations, null, 2));
    } catch (error) {
      console.error('Error saving generation, possible circular reference:', error);
      // Save without workflow if circular reference detected
      const minimalRecord: GenerationRecord = {
        id: record.id,
        prompt: record.prompt,
        workflow: undefined,
        provider: record.provider,
        model: record.model,
        timestamp: record.timestamp,
        nodeCount: record.nodeCount,
        connectionCount: record.connectionCount
      };
      
      generations.push(minimalRecord);
      const recentGenerations = generations.slice(-500);
      await fs.writeFile(this.generationsFile, JSON.stringify(recentGenerations, null, 2));
    }
  }

  async loadGenerations(): Promise<GenerationRecord[]> {
    try {
      const data = await fs.readFile(this.generationsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async updatePatterns(patterns: WorkflowPattern[]): Promise<void> {
    await fs.writeFile(this.patternsFile, JSON.stringify(patterns, null, 2));
  }

  async loadPatterns(): Promise<WorkflowPattern[]> {
    try {
      const data = await fs.readFile(this.patternsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async updateMetrics(metrics: PerformanceMetric[]): Promise<void> {
    await fs.writeFile(this.metricsFile, JSON.stringify(metrics, null, 2));
  }

  async loadMetrics(): Promise<PerformanceMetric[]> {
    try {
      const data = await fs.readFile(this.metricsFile, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async findSimilarWorkflows(prompt: string, limit: number = 5): Promise<GenerationRecord[]> {
    const generations = await this.loadGenerations();
    
    // Simple similarity based on keyword matching
    const keywords = prompt.toLowerCase().split(/\s+/);
    
    const scored = generations.map(gen => {
      const genKeywords = gen.prompt.toLowerCase().split(/\s+/);
      const commonKeywords = keywords.filter(k => genKeywords.includes(k)).length;
      const similarity = commonKeywords / Math.max(keywords.length, genKeywords.length);
      
      return { generation: gen, similarity };
    });
    
    // Sort by similarity and return top matches
    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .filter(s => s.similarity > 0.3)
      .map(s => s.generation);
  }

  async getCommonErrors(workflowType?: string): Promise<string[]> {
    const feedbacks = await this.loadFeedback();
    
    const errors = feedbacks
      .filter(f => f.outcome === 'failure' && f.errorMessage)
      .filter(f => !workflowType || f.workflowType === workflowType)
      .map(f => f.errorMessage!)
      .filter((error, index, self) => self.indexOf(error) === index); // Unique errors
    
    // Count frequency and return top errors
    const errorCounts = new Map<string, number>();
    feedbacks
      .filter(f => f.outcome === 'failure' && f.errorMessage)
      .forEach(f => {
        const count = errorCounts.get(f.errorMessage!) || 0;
        errorCounts.set(f.errorMessage!, count + 1);
      });
    
    return Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([error]) => error);
  }

  async getBestPractices(workflowType?: string): Promise<string[]> {
    const feedbacks = await this.loadFeedback();
    const patterns = await this.loadPatterns();
    
    const practices: string[] = [];
    
    // Extract from successful workflows
    const successfulWorkflows = feedbacks
      .filter(f => f.outcome === 'success')
      .filter(f => !workflowType || f.workflowType === workflowType);
    
    if (successfulWorkflows.length > 0) {
      // Node count best practices
      const avgNodeCount = successfulWorkflows.reduce((sum, f) => sum + f.nodeCount, 0) / successfulWorkflows.length;
      practices.push(`Optimal node count: ${Math.round(avgNodeCount)} nodes`);
      
      // Success rate insights
      const typeSuccessRates = new Map<string, { success: number; total: number }>();
      feedbacks.forEach(f => {
        const stats = typeSuccessRates.get(f.workflowType) || { success: 0, total: 0 };
        stats.total++;
        if (f.outcome === 'success') stats.success++;
        typeSuccessRates.set(f.workflowType, stats);
      });
      
      typeSuccessRates.forEach((stats, type) => {
        const rate = (stats.success / stats.total) * 100;
        if (rate > 80) {
          practices.push(`${type} workflows have ${rate.toFixed(1)}% success rate`);
        }
      });
    }
    
    // Add pattern-based practices
    patterns
      .filter(p => p.successRate > 0.8)
      .forEach(p => {
        practices.push(`Use ${p.type} pattern (${(p.successRate * 100).toFixed(1)}% success rate)`);
      });
    
    return practices.slice(0, 10); // Return top 10 practices
  }
}