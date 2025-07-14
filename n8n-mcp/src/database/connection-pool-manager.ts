import { Pool, PoolConfig } from 'pg';

export class Database {
  private pool: Pool;

  constructor(config?: PoolConfig) {
    this.pool = new Pool(config || {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'n8n_mcp',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async query(text: string, params?: any[]): Promise<any> {
    return this.pool.query(text, params);
  }

  async getClient() {
    return this.pool.connect();
  }

  async end() {
    return this.pool.end();
  }
}

export default Database;