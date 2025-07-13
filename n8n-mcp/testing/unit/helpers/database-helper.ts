import { Pool, PoolClient } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

export class DatabaseHelper {
  private pool: Pool;
  private currentTransaction: PoolClient | null = null;
  private migrations: string[] = [];

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async setupTestSchema(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      // Drop all tables if they exist
      await this.dropAllTables(client);
      
      // Run migrations to create schema
      await this.runMigrations(client);
      
      // Create test-specific tables
      await this.createTestTables(client);
      
      console.log('✅ Test database schema setup complete');
    } catch (error) {
      console.error('❌ Failed to setup test schema:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async dropAllTables(client: PoolClient): Promise<void> {
    // Get all table names
    const result = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    
    // Drop tables in correct order (handle foreign keys)
    const tableNames = result.rows.map(row => row.tablename);
    
    if (tableNames.length > 0) {
      // Disable foreign key checks temporarily
      await client.query('SET session_replication_role = replica');
      
      for (const tableName of tableNames) {
        await client.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
      }
      
      // Re-enable foreign key checks
      await client.query('SET session_replication_role = DEFAULT');
    }
  }

  private async runMigrations(client: PoolClient): Promise<void> {
    // Define test database schema
    const schema = `
      -- Users table
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        plan VARCHAR(50) DEFAULT 'free',
        settings JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        email_verified BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );

      -- API Keys table
      CREATE TABLE api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        hash VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scopes JSONB DEFAULT '[]',
        rate_limit JSONB DEFAULT '{}',
        expires_at TIMESTAMP,
        metadata JSONB DEFAULT '{}',
        last_used_at TIMESTAMP,
        usage_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Workflows table
      CREATE TABLE workflows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        nodes JSONB NOT NULL DEFAULT '[]',
        connections JSONB DEFAULT '[]',
        settings JSONB DEFAULT '{}',
        active BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'draft',
        tags TEXT[] DEFAULT '{}',
        version INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      );

      -- Executions table
      CREATE TABLE executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        status VARCHAR(50) NOT NULL DEFAULT 'new',
        mode VARCHAR(50) NOT NULL DEFAULT 'manual',
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        finished_at TIMESTAMP,
        data JSONB DEFAULT '{}',
        result JSONB DEFAULT '{}',
        error_message TEXT,
        execution_time INTEGER, -- in milliseconds
        metadata JSONB DEFAULT '{}'
      );

      -- Credentials table
      CREATE TABLE credentials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        data JSONB NOT NULL DEFAULT '{}',
        encrypted_data TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Backup catalog table
      CREATE TABLE backup_catalog (
        backup_id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        schedule VARCHAR(100),
        timestamp TIMESTAMP NOT NULL,
        components JSONB NOT NULL,
        checksum VARCHAR(255) NOT NULL,
        size BIGINT NOT NULL,
        duration INTEGER,
        metadata JSONB DEFAULT '{}',
        verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Backup verifications table
      CREATE TABLE backup_verifications (
        verification_id VARCHAR(255) PRIMARY KEY,
        backup_id VARCHAR(255) NOT NULL REFERENCES backup_catalog(backup_id),
        timestamp TIMESTAMP NOT NULL,
        success BOOLEAN NOT NULL,
        report JSONB NOT NULL,
        checks JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Audit logs table
      CREATE TABLE audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        operation VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100) NOT NULL,
        resource_id VARCHAR(255),
        old_values JSONB,
        new_values JSONB,
        ip_address INET,
        user_agent TEXT,
        metadata JSONB DEFAULT '{}',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Test data table for testing purposes
      CREATE TABLE test_data (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        data JSONB DEFAULT '{}',
        test_context VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for better performance
      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_status ON users(status);
      CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
      CREATE INDEX idx_api_keys_hash ON api_keys(hash);
      CREATE INDEX idx_workflows_user_id ON workflows(user_id);
      CREATE INDEX idx_workflows_active ON workflows(active);
      CREATE INDEX idx_executions_workflow_id ON executions(workflow_id);
      CREATE INDEX idx_executions_status ON executions(status);
      CREATE INDEX idx_executions_started_at ON executions(started_at);
      CREATE INDEX idx_credentials_user_id ON credentials(user_id);
      CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX idx_audit_logs_operation ON audit_logs(operation);
      CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
      CREATE INDEX idx_test_data_context ON test_data(test_context);
    `;

    await client.query(schema);
  }

  private async createTestTables(client: PoolClient): Promise<void> {
    // Additional test-specific tables
    const testTables = `
      -- Test isolation table
      CREATE TABLE test_contexts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        context_id VARCHAR(255) UNIQUE NOT NULL,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP,
        metadata JSONB DEFAULT '{}'
      );

      -- Test metrics table
      CREATE TABLE test_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_name VARCHAR(255) NOT NULL,
        metric_name VARCHAR(255) NOT NULL,
        metric_value DECIMAL,
        unit VARCHAR(50),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB DEFAULT '{}'
      );
    `;

    await client.query(testTables);
  }

  async beginTransaction(): Promise<void> {
    if (this.currentTransaction) {
      throw new Error('Transaction already in progress');
    }

    this.currentTransaction = await this.pool.connect();
    await this.currentTransaction.query('BEGIN');
  }

  async commitTransaction(): Promise<void> {
    if (!this.currentTransaction) {
      throw new Error('No transaction in progress');
    }

    try {
      await this.currentTransaction.query('COMMIT');
    } finally {
      this.currentTransaction.release();
      this.currentTransaction = null;
    }
  }

  async rollbackTransaction(): Promise<void> {
    if (!this.currentTransaction) {
      return; // No transaction to rollback
    }

    try {
      await this.currentTransaction.query('ROLLBACK');
    } finally {
      this.currentTransaction.release();
      this.currentTransaction = null;
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    const client = this.currentTransaction || this.pool;
    return await client.query(text, params);
  }

  async insertTestData(table: string, data: any): Promise<any> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 1}`);

    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `;

    const result = await this.query(query, values);
    return result.rows[0];
  }

  async updateTestData(table: string, id: string, data: any): Promise<any> {
    const entries = Object.entries(data);
    const setClause = entries.map(([key], index) => `${key} = $${index + 2}`).join(', ');
    const values = [id, ...entries.map(([, value]) => value)];

    const query = `
      UPDATE ${table}
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await this.query(query, values);
    return result.rows[0];
  }

  async deleteTestData(table: string, id: string): Promise<void> {
    await this.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
  }

  async truncateTable(table: string): Promise<void> {
    await this.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
  }

  async truncateAllTables(): Promise<void> {
    const tables = [
      'audit_logs',
      'backup_verifications',
      'backup_catalog',
      'credentials',
      'executions',
      'workflows',
      'api_keys',
      'users',
      'test_data',
      'test_contexts',
      'test_metrics'
    ];

    // Disable foreign key checks
    await this.query('SET session_replication_role = replica');

    for (const table of tables) {
      await this.truncateTable(table);
    }

    // Re-enable foreign key checks
    await this.query('SET session_replication_role = DEFAULT');
  }

  async seedTestData(): Promise<void> {
    // Create test users
    const testUsers = [
      {
        email: 'test.user@example.com',
        name: 'Test User',
        password_hash: 'hashed_password',
        role: 'user',
        plan: 'free',
        email_verified: true
      },
      {
        email: 'admin@example.com',
        name: 'Admin User',
        password_hash: 'hashed_password',
        role: 'admin',
        plan: 'enterprise',
        email_verified: true
      }
    ];

    for (const user of testUsers) {
      await this.insertTestData('users', user);
    }
  }

  async getTableRowCount(table: string): Promise<number> {
    const result = await this.query(`SELECT COUNT(*) as count FROM ${table}`);
    return parseInt(result.rows[0].count);
  }

  async executeRawSQL(sql: string): Promise<any> {
    return await this.query(sql);
  }

  async createSavepoint(name: string): Promise<void> {
    await this.query(`SAVEPOINT ${name}`);
  }

  async rollbackToSavepoint(name: string): Promise<void> {
    await this.query(`ROLLBACK TO SAVEPOINT ${name}`);
  }

  async releaseSavepoint(name: string): Promise<void> {
    await this.query(`RELEASE SAVEPOINT ${name}`);
  }

  // Performance testing helpers
  async measureQueryPerformance(query: string, params?: any[]): Promise<{
    result: any;
    duration: number;
  }> {
    const start = performance.now();
    const result = await this.query(query, params);
    const end = performance.now();

    return {
      result,
      duration: end - start
    };
  }

  async explainQuery(query: string, params?: any[]): Promise<any> {
    const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
    const result = await this.query(explainQuery, params);
    return result.rows[0]['QUERY PLAN'];
  }

  // Test data validation helpers
  async validateForeignKeys(): Promise<any[]> {
    const query = `
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE constraint_type = 'FOREIGN KEY'
    `;

    const result = await this.query(query);
    return result.rows;
  }

  async checkDataIntegrity(): Promise<{
    orphanedRecords: any[];
    nullConstraintViolations: any[];
    duplicateConstraintViolations: any[];
  }> {
    // This would implement comprehensive data integrity checks
    // For now, return empty arrays
    return {
      orphanedRecords: [],
      nullConstraintViolations: [],
      duplicateConstraintViolations: []
    };
  }
}