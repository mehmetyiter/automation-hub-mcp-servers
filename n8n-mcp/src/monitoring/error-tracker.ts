// monitoring/error-tracker.ts

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export interface WorkflowError {
  id: string;
  timestamp: Date;
  type: 'generation' | 'validation' | 'serialization' | 'ai_provider' | 'node_configuration';
  severity: 'critical' | 'error' | 'warning';
  message: string;
  details: any;
  context: {
    prompt?: string;
    workflowName?: string;
    provider?: string;
    nodeCount?: number;
    connectionCount?: number;
    phase?: string; // planning, generation, validation, repair, etc.
  };
  stack?: string;
  resolution?: {
    attempted: boolean;
    successful: boolean;
    method?: string;
    result?: any;
  };
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  errorsByProvider: Record<string, number>;
  errorsByPhase: Record<string, number>;
  resolutionRate: number;
  commonPatterns: Array<{
    pattern: string;
    count: number;
    lastSeen: Date;
  }>;
}

export class ErrorTracker extends EventEmitter {
  private errors: WorkflowError[] = [];
  private readonly maxErrors = 1000;
  private readonly errorLogPath: string;
  
  constructor(logPath: string = './logs/workflow-errors') {
    super();
    this.errorLogPath = logPath;
    this.initializeLogDirectory();
  }
  
  private async initializeLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.errorLogPath, { recursive: true });
    } catch (error) {
      console.error('Failed to create error log directory:', error);
    }
  }
  
  async trackError(error: Omit<WorkflowError, 'id' | 'timestamp'>): Promise<string> {
    const errorRecord: WorkflowError = {
      ...error,
      id: this.generateErrorId(),
      timestamp: new Date()
    };
    
    // Add to memory
    this.errors.push(errorRecord);
    if (this.errors.length > this.maxErrors) {
      this.errors.shift(); // Remove oldest
    }
    
    // Persist to disk
    await this.persistError(errorRecord);
    
    // Emit event for real-time monitoring
    this.emit('error', errorRecord);
    
    // Analyze for patterns
    this.analyzeErrorPatterns(errorRecord);
    
    return errorRecord.id;
  }
  
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private async persistError(error: WorkflowError): Promise<void> {
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `errors_${dateStr}.jsonl`;
      const filepath = path.join(this.errorLogPath, filename);
      
      const errorLine = JSON.stringify(error) + '\n';
      await fs.appendFile(filepath, errorLine);
    } catch (err) {
      console.error('Failed to persist error:', err);
    }
  }
  
  private analyzeErrorPatterns(error: WorkflowError): void {
    // Look for common patterns
    const patterns = [
      { regex: /disconnected node/i, pattern: 'disconnected_nodes' },
      { regex: /circular reference/i, pattern: 'circular_reference' },
      { regex: /invalid node type/i, pattern: 'invalid_node_type' },
      { regex: /missing parameter/i, pattern: 'missing_parameters' },
      { regex: /timeout|abort/i, pattern: 'timeout_errors' },
      { regex: /no api key/i, pattern: 'missing_api_key' },
      { regex: /json.*parse/i, pattern: 'json_parsing' },
      { regex: /empty branch/i, pattern: 'empty_branches' },
      { regex: /merge.*node/i, pattern: 'merge_node_issues' }
    ];
    
    for (const { regex, pattern } of patterns) {
      if (regex.test(error.message) || regex.test(JSON.stringify(error.details))) {
        this.emit('pattern', { pattern, error });
      }
    }
  }
  
  async getMetrics(timeRange?: { start: Date; end: Date }): Promise<ErrorMetrics> {
    let relevantErrors = this.errors;
    
    if (timeRange) {
      relevantErrors = this.errors.filter(e => 
        e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
      );
    }
    
    const metrics: ErrorMetrics = {
      totalErrors: relevantErrors.length,
      errorsByType: {},
      errorsBySeverity: {},
      errorsByProvider: {},
      errorsByPhase: {},
      resolutionRate: 0,
      commonPatterns: []
    };
    
    // Calculate metrics
    let resolvedCount = 0;
    const patternCounts: Record<string, { count: number; lastSeen: Date }> = {};
    
    for (const error of relevantErrors) {
      // By type
      metrics.errorsByType[error.type] = (metrics.errorsByType[error.type] || 0) + 1;
      
      // By severity
      metrics.errorsBySeverity[error.severity] = (metrics.errorsBySeverity[error.severity] || 0) + 1;
      
      // By provider
      if (error.context.provider) {
        metrics.errorsByProvider[error.context.provider] = 
          (metrics.errorsByProvider[error.context.provider] || 0) + 1;
      }
      
      // By phase
      if (error.context.phase) {
        metrics.errorsByPhase[error.context.phase] = 
          (metrics.errorsByPhase[error.context.phase] || 0) + 1;
      }
      
      // Resolution rate
      if (error.resolution?.attempted && error.resolution.successful) {
        resolvedCount++;
      }
      
      // Pattern analysis
      const patterns = this.extractPatterns(error);
      for (const pattern of patterns) {
        if (!patternCounts[pattern]) {
          patternCounts[pattern] = { count: 0, lastSeen: error.timestamp };
        }
        patternCounts[pattern].count++;
        patternCounts[pattern].lastSeen = error.timestamp;
      }
    }
    
    // Calculate resolution rate
    const attemptedResolutions = relevantErrors.filter(e => e.resolution?.attempted).length;
    metrics.resolutionRate = attemptedResolutions > 0 
      ? resolvedCount / attemptedResolutions 
      : 0;
    
    // Sort patterns by frequency
    metrics.commonPatterns = Object.entries(patternCounts)
      .map(([pattern, data]) => ({
        pattern,
        count: data.count,
        lastSeen: data.lastSeen
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10 patterns
    
    return metrics;
  }
  
  private extractPatterns(error: WorkflowError): string[] {
    const patterns: string[] = [];
    const message = error.message.toLowerCase();
    
    if (message.includes('disconnected')) patterns.push('disconnected_nodes');
    if (message.includes('circular')) patterns.push('circular_reference');
    if (message.includes('timeout')) patterns.push('timeout');
    if (message.includes('validation')) patterns.push('validation_failure');
    if (message.includes('json')) patterns.push('json_parsing');
    
    return patterns;
  }
  
  async getRecentErrors(limit: number = 50): Promise<WorkflowError[]> {
    return this.errors.slice(-limit).reverse();
  }
  
  async getErrorById(id: string): Promise<WorkflowError | undefined> {
    return this.errors.find(e => e.id === id);
  }
  
  async searchErrors(criteria: {
    type?: string;
    severity?: string;
    provider?: string;
    phase?: string;
    pattern?: string;
    timeRange?: { start: Date; end: Date };
  }): Promise<WorkflowError[]> {
    let results = this.errors;
    
    if (criteria.type) {
      results = results.filter(e => e.type === criteria.type);
    }
    
    if (criteria.severity) {
      results = results.filter(e => e.severity === criteria.severity);
    }
    
    if (criteria.provider) {
      results = results.filter(e => e.context.provider === criteria.provider);
    }
    
    if (criteria.phase) {
      results = results.filter(e => e.context.phase === criteria.phase);
    }
    
    if (criteria.pattern) {
      const regex = new RegExp(criteria.pattern, 'i');
      results = results.filter(e => 
        regex.test(e.message) || regex.test(JSON.stringify(e.details))
      );
    }
    
    if (criteria.timeRange) {
      results = results.filter(e => 
        e.timestamp >= criteria.timeRange!.start && 
        e.timestamp <= criteria.timeRange!.end
      );
    }
    
    return results;
  }
  
  async exportErrors(format: 'json' | 'csv' = 'json'): Promise<string> {
    if (format === 'json') {
      return JSON.stringify(this.errors, null, 2);
    }
    
    // CSV export
    const headers = [
      'ID', 'Timestamp', 'Type', 'Severity', 'Message', 
      'Provider', 'Phase', 'Node Count', 'Resolution'
    ];
    
    const rows = this.errors.map(e => [
      e.id,
      e.timestamp.toISOString(),
      e.type,
      e.severity,
      e.message.replace(/"/g, '""'), // Escape quotes
      e.context.provider || '',
      e.context.phase || '',
      e.context.nodeCount || '',
      e.resolution?.successful ? 'Resolved' : e.resolution?.attempted ? 'Failed' : 'Not attempted'
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    return csv;
  }
  
  // Get insights for improving the system
  async getInsights(): Promise<{
    topIssues: Array<{ issue: string; count: number; suggestion: string }>;
    providerReliability: Record<string, number>;
    criticalPatterns: string[];
    recommendations: string[];
  }> {
    const metrics = await this.getMetrics();
    
    // Analyze top issues
    const topIssues = metrics.commonPatterns.slice(0, 5).map(pattern => ({
      issue: pattern.pattern,
      count: pattern.count,
      suggestion: this.getSuggestionForPattern(pattern.pattern)
    }));
    
    // Calculate provider reliability
    const providerReliability: Record<string, number> = {};
    for (const [provider, errorCount] of Object.entries(metrics.errorsByProvider)) {
      const totalRequests = this.errors.filter(e => e.context.provider === provider).length;
      providerReliability[provider] = 1 - (errorCount / Math.max(totalRequests, 1));
    }
    
    // Identify critical patterns
    const criticalPatterns = metrics.commonPatterns
      .filter(p => p.count > 5 || this.isCriticalPattern(p.pattern))
      .map(p => p.pattern);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(metrics, topIssues);
    
    return {
      topIssues,
      providerReliability,
      criticalPatterns,
      recommendations
    };
  }
  
  private getSuggestionForPattern(pattern: string): string {
    const suggestions: Record<string, string> = {
      'disconnected_nodes': 'Improve node connection logic in workflow builders',
      'circular_reference': 'Enhance circular reference detection in JSON cleaner',
      'invalid_node_type': 'Update node catalog with latest n8n node types',
      'missing_parameters': 'Add parameter validation before workflow generation',
      'timeout_errors': 'Increase timeout limits or optimize AI prompts',
      'missing_api_key': 'Improve credential management UI',
      'json_parsing': 'Add better JSON extraction from AI responses',
      'empty_branches': 'Enhance branch completion logic in validators',
      'merge_node_issues': 'Improve merge node insertion algorithm'
    };
    
    return suggestions[pattern] || 'Investigate and add specific handling for this pattern';
  }
  
  private isCriticalPattern(pattern: string): boolean {
    const criticalPatterns = [
      'circular_reference',
      'timeout_errors',
      'missing_api_key'
    ];
    return criticalPatterns.includes(pattern);
  }
  
  private generateRecommendations(
    metrics: ErrorMetrics, 
    topIssues: Array<{ issue: string; count: number; suggestion: string }>
  ): string[] {
    const recommendations: string[] = [];
    
    // Based on resolution rate
    if (metrics.resolutionRate < 0.5) {
      recommendations.push('Improve automatic error resolution mechanisms');
    }
    
    // Based on error types
    if (metrics.errorsByType['validation'] > metrics.totalErrors * 0.3) {
      recommendations.push('Strengthen validation logic before workflow generation');
    }
    
    if (metrics.errorsByType['ai_provider'] > metrics.totalErrors * 0.2) {
      recommendations.push('Consider implementing fallback AI providers');
    }
    
    // Based on severity
    if (metrics.errorsBySeverity['critical'] > 0) {
      recommendations.push('Address critical errors immediately - they block workflow generation');
    }
    
    // Based on patterns
    if (topIssues.some(i => i.issue === 'timeout_errors')) {
      recommendations.push('Implement progressive timeout strategy for large workflows');
    }
    
    return recommendations;
  }
}

// Singleton instance
export const errorTracker = new ErrorTracker();