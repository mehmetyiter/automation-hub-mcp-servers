import { Database } from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { 
  CodePattern, 
  ExecutionMetrics, 
  LearningData,
  CodeGenerationRequest,
  GeneratedCode
} from '../types';

export interface PatternCriteria {
  type?: string;
  minSuccessCount?: number;
  limit?: number;
  language?: string;
  category?: string;
}

export interface CodeVersion {
  id: string;
  codeId: string;
  code: string;
  metadata: any;
  timestamp: string;
  performance: any;
  quality: any;
}

export class CodeGenerationDatabase {
  private db: Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(process.cwd(), 'data', 'code-generation.db');
    this.initializeDatabase();
  }

  private initializeDatabase() {
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Create database connection
    const Database = require('better-sqlite3');
    this.db = new Database(this.dbPath);

    // Enable foreign keys
    this.db.exec('PRAGMA foreign_keys = ON');

    // Create tables
    this.createTables();
  }

  private createTables() {
    // Code patterns table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS code_patterns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        pattern_type TEXT NOT NULL,
        category TEXT,
        language TEXT DEFAULT 'javascript',
        pattern TEXT NOT NULL,
        success_count INTEGER DEFAULT 0,
        failure_count INTEGER DEFAULT 0,
        performance_score REAL DEFAULT 0,
        reliability_score REAL DEFAULT 0,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Execution metrics table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS code_execution_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code_id TEXT NOT NULL,
        execution_time INTEGER NOT NULL,
        memory_usage INTEGER NOT NULL,
        success BOOLEAN NOT NULL,
        error_details TEXT,
        input_size INTEGER,
        output_size INTEGER,
        performance_issues TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (code_id) REFERENCES generated_codes(id)
      )
    `);

    // Learning data table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS learning_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_hash TEXT NOT NULL,
        request TEXT NOT NULL,
        generated_code TEXT NOT NULL,
        execution_result TEXT NOT NULL,
        user_feedback TEXT,
        patterns TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Generated codes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS generated_codes (
        id TEXT PRIMARY KEY,
        request_hash TEXT NOT NULL,
        code TEXT NOT NULL,
        language TEXT DEFAULT 'javascript',
        context TEXT,
        metadata TEXT,
        validation_result TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Code versions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS code_versions (
        id TEXT PRIMARY KEY,
        code_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        code TEXT NOT NULL,
        metadata TEXT,
        performance TEXT,
        quality TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (code_id) REFERENCES generated_codes(id)
      )
    `);

    // User feedback table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code_id TEXT NOT NULL,
        rating INTEGER NOT NULL,
        worked BOOLEAN NOT NULL,
        issues TEXT,
        suggestions TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (code_id) REFERENCES generated_codes(id)
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_patterns_type ON code_patterns(pattern_type);
      CREATE INDEX IF NOT EXISTS idx_patterns_category ON code_patterns(category);
      CREATE INDEX IF NOT EXISTS idx_patterns_language ON code_patterns(language);
      CREATE INDEX IF NOT EXISTS idx_metrics_code_id ON code_execution_metrics(code_id);
      CREATE INDEX IF NOT EXISTS idx_generated_codes_hash ON generated_codes(request_hash);
      CREATE INDEX IF NOT EXISTS idx_versions_code_id ON code_versions(code_id);
      CREATE INDEX IF NOT EXISTS idx_feedback_code_id ON user_feedback(code_id);
    `);
  }

  // Pattern management methods
  async saveCodePattern(pattern: CodePattern): Promise<string> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO code_patterns 
      (id, name, description, pattern_type, category, language, pattern, 
       performance_score, reliability_score, metadata, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run(
      pattern.id,
      pattern.name,
      pattern.description,
      pattern.category || 'general',
      pattern.category,
      'javascript', // Default, extend as needed
      pattern.pattern,
      pattern.performance,
      pattern.reliability,
      JSON.stringify(pattern.usage || [])
    );

    return pattern.id;
  }

  async getSuccessfulPatterns(criteria: PatternCriteria): Promise<CodePattern[]> {
    let query = `
      SELECT * FROM code_patterns 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (criteria.type) {
      query += ' AND pattern_type = ?';
      params.push(criteria.type);
    }

    if (criteria.category) {
      query += ' AND category = ?';
      params.push(criteria.category);
    }

    if (criteria.language) {
      query += ' AND language = ?';
      params.push(criteria.language);
    }

    if (criteria.minSuccessCount !== undefined) {
      query += ' AND success_count >= ?';
      params.push(criteria.minSuccessCount);
    }

    query += ' ORDER BY success_count DESC, reliability_score DESC';

    if (criteria.limit) {
      query += ' LIMIT ?';
      params.push(criteria.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      pattern: row.pattern,
      usage: JSON.parse(row.metadata || '[]'),
      performance: row.performance_score,
      reliability: row.reliability_score,
      category: row.category
    }));
  }

  async updatePatternSuccess(patternId: string, success: boolean): Promise<void> {
    const column = success ? 'success_count' : 'failure_count';
    const stmt = this.db.prepare(`
      UPDATE code_patterns 
      SET ${column} = ${column} + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(patternId);
  }

  // Execution metrics methods
  async saveExecutionMetrics(metrics: ExecutionMetrics): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO code_execution_metrics
      (code_id, execution_time, memory_usage, success, error_details, 
       input_size, output_size, performance_issues, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      metrics.codeId,
      metrics.executionTime,
      metrics.memoryUsed,
      metrics.success ? 1 : 0,
      metrics.error || null,
      metrics.inputSize,
      metrics.outputSize,
      JSON.stringify(metrics),
      metrics.timestamp
    );
  }

  async getExecutionMetrics(codeId: string): Promise<ExecutionMetrics[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM code_execution_metrics
      WHERE code_id = ?
      ORDER BY timestamp DESC
    `);

    const rows = stmt.all(codeId);

    return rows.map(row => ({
      codeId: row.code_id,
      executionTime: row.execution_time,
      memoryUsed: row.memory_usage,
      success: row.success === 1,
      error: row.error_details,
      timestamp: row.timestamp,
      inputSize: row.input_size,
      outputSize: row.output_size
    }));
  }

  // Learning data methods
  async saveLearningData(data: LearningData): Promise<void> {
    const requestHash = this.hashRequest(data.request);
    
    const stmt = this.db.prepare(`
      INSERT INTO learning_data
      (request_hash, request, generated_code, execution_result, user_feedback, patterns, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      requestHash,
      JSON.stringify(data.request),
      data.generatedCode,
      JSON.stringify(data.executionResult),
      data.userFeedback ? JSON.stringify(data.userFeedback) : null,
      JSON.stringify(data.patterns),
      data.timestamp
    );
  }

  async getLearningData(limit: number = 100): Promise<LearningData[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM learning_data
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    const rows = stmt.all(limit);

    return rows.map(row => ({
      request: JSON.parse(row.request),
      generatedCode: row.generated_code,
      executionResult: JSON.parse(row.execution_result),
      userFeedback: row.user_feedback ? JSON.parse(row.user_feedback) : undefined,
      patterns: JSON.parse(row.patterns),
      timestamp: row.timestamp
    }));
  }

  // Generated code methods
  async saveGeneratedCode(
    codeId: string,
    request: CodeGenerationRequest,
    result: GeneratedCode
  ): Promise<void> {
    const requestHash = this.hashRequest(request);
    
    const stmt = this.db.prepare(`
      INSERT INTO generated_codes
      (id, request_hash, code, language, context, metadata, validation_result)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      codeId,
      requestHash,
      result.code,
      request.requirements?.language || 'javascript',
      JSON.stringify(result.context),
      JSON.stringify(result.metadata),
      JSON.stringify(result.validation)
    );
  }

  // Code versioning methods
  async saveCodeVersion(version: CodeVersion): Promise<void> {
    // Get current version number
    const currentVersion = this.db.prepare(`
      SELECT MAX(version_number) as max_version 
      FROM code_versions 
      WHERE code_id = ?
    `).get(version.codeId);

    const versionNumber = (currentVersion?.max_version || 0) + 1;

    const stmt = this.db.prepare(`
      INSERT INTO code_versions
      (id, code_id, version_number, code, metadata, performance, quality)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      version.id,
      version.codeId,
      versionNumber,
      version.code,
      JSON.stringify(version.metadata),
      JSON.stringify(version.performance),
      JSON.stringify(version.quality)
    );
  }

  async getCodeVersions(codeId: string): Promise<CodeVersion[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM code_versions
      WHERE code_id = ?
      ORDER BY version_number DESC
    `);

    const rows = stmt.all(codeId);

    return rows.map(row => ({
      id: row.id,
      codeId: row.code_id,
      code: row.code,
      metadata: JSON.parse(row.metadata),
      timestamp: row.timestamp,
      performance: JSON.parse(row.performance),
      quality: JSON.parse(row.quality)
    }));
  }

  // User feedback methods
  async saveUserFeedback(
    codeId: string,
    feedback: {
      rating: number;
      worked: boolean;
      issues?: string[];
      suggestions?: string[];
    }
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO user_feedback
      (code_id, rating, worked, issues, suggestions)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      codeId,
      feedback.rating,
      feedback.worked ? 1 : 0,
      feedback.issues ? JSON.stringify(feedback.issues) : null,
      feedback.suggestions ? JSON.stringify(feedback.suggestions) : null
    );
  }

  async getUserFeedback(codeId: string): Promise<any[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM user_feedback
      WHERE code_id = ?
      ORDER BY timestamp DESC
    `);

    const rows = stmt.all(codeId);

    return rows.map(row => ({
      rating: row.rating,
      worked: row.worked === 1,
      issues: row.issues ? JSON.parse(row.issues) : [],
      suggestions: row.suggestions ? JSON.parse(row.suggestions) : [],
      timestamp: row.timestamp
    }));
  }

  // Utility methods
  private hashRequest(request: CodeGenerationRequest): string {
    const crypto = require('crypto');
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(request))
      .digest('hex');
  }

  // Cleanup and optimization
  async vacuum(): Promise<void> {
    this.db.exec('VACUUM');
  }

  async analyze(): Promise<void> {
    this.db.exec('ANALYZE');
  }

  close(): void {
    this.db.close();
  }
}