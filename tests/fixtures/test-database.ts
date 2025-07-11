import { Pool } from 'pg';

let testPool: Pool | null = null;

export async function setupTestDatabase(): Promise<Pool> {
  if (testPool) {
    return testPool;
  }

  // Use environment variables or defaults for test database
  const config = {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5432'),
    database: process.env.TEST_DB_NAME || 'n8n_mcp_test',
    user: process.env.TEST_DB_USER || 'postgres',
    password: process.env.TEST_DB_PASSWORD || 'postgres',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  testPool = new Pool(config);

  try {
    // Test connection
    const client = await testPool.connect();
    await client.query('SELECT 1');
    client.release();

    // Create test tables
    await createTestTables(testPool);
    
    console.log('Test database connected and initialized');
    return testPool;
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }
}

export async function teardownTestDatabase(): Promise<void> {
  if (testPool) {
    try {
      await cleanupTestData(testPool);
      await testPool.end();
      testPool = null;
      console.log('Test database connection closed');
    } catch (error) {
      console.error('Error closing test database:', error);
    }
  }
}

async function createTestTables(pool: Pool): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // User credentials table
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_user_credentials (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES test_users(id) ON DELETE CASCADE,
        provider VARCHAR(50) NOT NULL,
        encrypted_api_key TEXT NOT NULL,
        encryption_version INTEGER DEFAULT 1,
        name VARCHAR(200) NOT NULL,
        validation_status VARCHAR(20) DEFAULT 'pending',
        last_validated_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // API usage events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_api_usage_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES test_users(id) ON DELETE CASCADE,
        credential_id UUID REFERENCES test_user_credentials(id) ON DELETE SET NULL,
        provider VARCHAR(50) NOT NULL,
        model VARCHAR(100) NOT NULL,
        operation VARCHAR(50) NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        estimated_cost DECIMAL(10, 6) NOT NULL,
        execution_time INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'success',
        error_message TEXT,
        request_id VARCHAR(100),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS test_user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES test_users(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT true,
        ip_address INET,
        user_agent TEXT,
        last_activity TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_test_credentials_user_provider 
      ON test_user_credentials(user_id, provider) WHERE is_active = true
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_test_usage_user_date 
      ON test_api_usage_events(user_id, created_at DESC)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_test_sessions_token 
      ON test_user_sessions(session_token) WHERE is_active = true
    `);

    await client.query('COMMIT');
    console.log('Test tables created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating test tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function cleanupTestData(pool: Pool): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Delete test data in reverse dependency order
    await client.query('DELETE FROM test_api_usage_events');
    await client.query('DELETE FROM test_user_sessions');
    await client.query('DELETE FROM test_user_credentials');
    await client.query('DELETE FROM test_users');
    
    await client.query('COMMIT');
    console.log('Test data cleaned up');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cleaning up test data:', error);
  } finally {
    client.release();
  }
}

export async function getTestDatabase(): Promise<Pool> {
  if (!testPool) {
    throw new Error('Test database not initialized');
  }
  return testPool;
}