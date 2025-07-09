import { api } from '../services/api';
import { DeepAnalysis, FeedbackData, RecognizedPatterns, WorkflowArchitecture } from './types';

export interface Pattern {
  id: string;
  patternType: string;
  patternName: string;
  description: string;
  successCount: number;
  failureCount: number;
  effectivenessScore: number;
  lastUsedAt: string;
  domain?: string;
  metadata?: any;
}

export interface PerformanceMetric {
  workflowType: string;
  avgExecutionTime: number;
  successRate: number;
  totalCount: number;
  lastUpdated: string;
}

export class DatabaseService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Initialize with localStorage fallback for demo purposes
    this.initializeLocalStorage();
  }

  private initializeLocalStorage() {
    if (!localStorage.getItem('ai_patterns')) {
      localStorage.setItem('ai_patterns', JSON.stringify([]));
    }
    if (!localStorage.getItem('ai_feedback')) {
      localStorage.setItem('ai_feedback', JSON.stringify([]));
    }
    if (!localStorage.getItem('ai_analyses')) {
      localStorage.setItem('ai_analyses', JSON.stringify([]));
    }
    if (!localStorage.getItem('ai_metrics')) {
      localStorage.setItem('ai_metrics', JSON.stringify({}));
    }
  }

  async saveDeepAnalysis(analysis: DeepAnalysis): Promise<string> {
    try {
      // Try to save to backend first
      const response = await api.post('/ai-analysis/deep-analyses', analysis);
      return response.data.id;
    } catch (error) {
      // Fallback to localStorage
      const analyses = JSON.parse(localStorage.getItem('ai_analyses') || '[]');
      const id = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      analyses.push({ id, ...analysis, createdAt: new Date().toISOString() });
      localStorage.setItem('ai_analyses', JSON.stringify(analyses));
      return id;
    }
  }

  async saveFeedback(feedback: FeedbackData): Promise<void> {
    try {
      // Try to save to backend first
      await api.post('/ai-analysis/feedback', feedback);
    } catch (error) {
      // Fallback to localStorage
      const feedbacks = JSON.parse(localStorage.getItem('ai_feedback') || '[]');
      feedbacks.push({ ...feedback, id: `feedback_${Date.now()}` });
      localStorage.setItem('ai_feedback', JSON.stringify(feedbacks));
    }

    // Update metrics
    await this.updateMetricsFromFeedback(feedback);
  }

  async getSuccessfulPatterns(domain: string): Promise<Pattern[]> {
    const cacheKey = `patterns_${domain}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // Try to get from backend first
      const response = await api.get(`/ai-analysis/patterns?domain=${domain}&status=successful`);
      const patterns = response.data;
      this.setCache(cacheKey, patterns);
      return patterns;
    } catch (error) {
      // Fallback to localStorage
      const patterns = JSON.parse(localStorage.getItem('ai_patterns') || '[]');
      const filtered = patterns.filter((p: Pattern) => 
        (!domain || p.domain === domain) && p.effectivenessScore > 0.7
      );
      return filtered;
    }
  }

  async savePattern(pattern: Pattern): Promise<void> {
    try {
      await api.post('/ai-analysis/patterns', pattern);
    } catch (error) {
      // Fallback to localStorage
      const patterns = JSON.parse(localStorage.getItem('ai_patterns') || '[]');
      patterns.push(pattern);
      localStorage.setItem('ai_patterns', JSON.stringify(patterns));
    }
  }

  async updatePerformanceMetrics(workflowId: string, metrics: any): Promise<void> {
    try {
      await api.post('/ai-analysis/performance-metrics', { workflowId, metrics });
    } catch (error) {
      // Fallback to localStorage
      const storedMetrics = JSON.parse(localStorage.getItem('ai_metrics') || '{}');
      storedMetrics[workflowId] = {
        ...metrics,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem('ai_metrics', JSON.stringify(storedMetrics));
    }
  }

  async getPerformanceMetrics(): Promise<Record<string, PerformanceMetric>> {
    try {
      const response = await api.get('/ai-analysis/performance-metrics');
      return response.data;
    } catch (error) {
      // Fallback to localStorage
      return JSON.parse(localStorage.getItem('ai_metrics') || '{}');
    }
  }

  async getRecentFeedback(limit: number = 100): Promise<FeedbackData[]> {
    try {
      const response = await api.get(`/ai-analysis/feedback?limit=${limit}`);
      return response.data;
    } catch (error) {
      // Fallback to localStorage
      const feedbacks = JSON.parse(localStorage.getItem('ai_feedback') || '[]');
      return feedbacks
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    }
  }

  async getAnalysisByRequest(request: string): Promise<DeepAnalysis | null> {
    const cacheKey = `analysis_${request.substring(0, 50)}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const response = await api.get(`/ai-analysis/deep-analyses/search?request=${encodeURIComponent(request)}`);
      if (response.data) {
        this.setCache(cacheKey, response.data);
        return response.data;
      }
    } catch (error) {
      // Fallback to localStorage
      const analyses = JSON.parse(localStorage.getItem('ai_analyses') || '[]');
      const found = analyses.find((a: any) => 
        a.request?.toLowerCase() === request.toLowerCase()
      );
      return found || null;
    }

    return null;
  }

  private async updateMetricsFromFeedback(feedback: FeedbackData): Promise<void> {
    const metrics = await this.getPerformanceMetrics();
    const key = `${feedback.workflowType}_metrics`;
    
    const current = metrics[key] || {
      workflowType: feedback.workflowType,
      avgExecutionTime: 0,
      successRate: 0,
      totalCount: 0,
      lastUpdated: new Date().toISOString()
    };

    // Update metrics
    const newTotal = current.totalCount + 1;
    const successCount = Math.round(current.successRate * current.totalCount) + 
                        (feedback.outcome === 'success' ? 1 : 0);
    
    current.avgExecutionTime = (current.avgExecutionTime * current.totalCount + feedback.executionTime) / newTotal;
    current.successRate = successCount / newTotal;
    current.totalCount = newTotal;
    current.lastUpdated = new Date().toISOString();

    metrics[key] = current;
    
    // Save updated metrics
    try {
      await api.put('/ai-analysis/performance-metrics', metrics);
    } catch (error) {
      localStorage.setItem('ai_metrics', JSON.stringify(metrics));
    }
  }

  // Cache management
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
    
    // Clean old cache entries
    if (this.cache.size > 100) {
      const oldestKey = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
      this.cache.delete(oldestKey);
    }
  }

  // Demo data seeding
  async seedDemoPatterns(): Promise<void> {
    const demoPatterns: Pattern[] = [
      {
        id: 'pattern_1',
        patternType: 'workflow',
        patternName: 'Email Notification Flow',
        description: 'Standard pattern for email notifications with error handling',
        successCount: 45,
        failureCount: 5,
        effectivenessScore: 0.9,
        lastUsedAt: new Date().toISOString(),
        domain: 'Marketing'
      },
      {
        id: 'pattern_2',
        patternType: 'integration',
        patternName: 'Database Sync Pattern',
        description: 'Reliable pattern for database synchronization',
        successCount: 38,
        failureCount: 2,
        effectivenessScore: 0.95,
        lastUsedAt: new Date().toISOString(),
        domain: 'IT Operations'
      },
      {
        id: 'pattern_3',
        patternType: 'error',
        patternName: 'Retry with Exponential Backoff',
        description: 'Error handling pattern with exponential backoff',
        successCount: 52,
        failureCount: 3,
        effectivenessScore: 0.94,
        lastUsedAt: new Date().toISOString(),
        domain: 'General'
      }
    ];

    for (const pattern of demoPatterns) {
      await this.savePattern(pattern);
    }
  }
}