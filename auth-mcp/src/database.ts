import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createAIProviderTable } from './database-ai-providers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface User {
  id: number;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer';
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: number;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface Credential {
  id: number;
  user_id: number;
  platform: string;
  name: string;
  data: string; // Encrypted JSON
  created_at: string;
  updated_at: string;
}

class Database {
  private db: any;

  async initialize() {
    this.db = await open({
      filename: path.join(__dirname, '..', 'auth.db'),
      driver: sqlite3.Database
    });

    await this.createTables();
    await this.seedDemoUsers();
  }

  private async createTables() {
    // Users table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'editor', 'viewer')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sessions table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Credentials table
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        platform TEXT NOT NULL,
        name TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, platform, name)
      )
    `);

    // Create indexes
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`);
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`);
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_credentials_user ON credentials(user_id)`);
    await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_credentials_platform ON credentials(platform)`);
    
    // Create AI provider table
    await createAIProviderTable();
  }

  private async seedDemoUsers() {
    const demoUsers = [
      { email: 'admin@automation-hub.com', password: 'admin123', name: 'Admin User', role: 'admin' },
      { email: 'editor@demo.com', password: 'demo123', name: 'Editor User', role: 'editor' },
      { email: 'viewer@demo.com', password: 'demo123', name: 'Viewer User', role: 'viewer' }
    ];

    for (const user of demoUsers) {
      const existing = await this.getUserByEmail(user.email);
      if (!existing) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        await this.createUser({
          ...user,
          password: hashedPassword
        });
      }
    }
  }

  async createUser(data: { email: string; password: string; name: string; role: string }) {
    const result = await this.db.run(
      `INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)`,
      [data.email, data.password, data.name, data.role]
    );
    return result.lastID;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return await this.db.get('SELECT * FROM users WHERE email = ?', [email]);
  }

  async getUserById(id: number): Promise<User | null> {
    return await this.db.get('SELECT * FROM users WHERE id = ?', [id]);
  }

  async createSession(userId: number, token: string, expiresIn: number = 86400) {
    const id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    
    await this.db.run(
      `INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`,
      [id, userId, token, expiresAt]
    );
    
    return { id, user_id: userId, token, expires_at: expiresAt };
  }

  async getSessionByToken(token: string): Promise<Session | null> {
    return await this.db.get(
      'SELECT * FROM sessions WHERE token = ? AND expires_at > datetime("now")',
      [token]
    );
  }

  async deleteSession(token: string) {
    await this.db.run('DELETE FROM sessions WHERE token = ?', [token]);
  }

  async deleteExpiredSessions() {
    await this.db.run('DELETE FROM sessions WHERE expires_at <= datetime("now")');
  }

  // Credential methods
  async createCredential(data: { user_id: number; platform: string; name: string; data: string }) {
    const result = await this.db.run(
      `INSERT INTO credentials (user_id, platform, name, data) 
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, platform, name) 
       DO UPDATE SET data = ?, updated_at = CURRENT_TIMESTAMP`,
      [data.user_id, data.platform, data.name, data.data, data.data]
    );
    return result.lastID;
  }

  async getCredentials(userId: number): Promise<Credential[]> {
    return await this.db.all(
      'SELECT * FROM credentials WHERE user_id = ? ORDER BY platform, name',
      [userId]
    );
  }

  async getCredential(userId: number, platform: string, name: string): Promise<Credential | null> {
    return await this.db.get(
      'SELECT * FROM credentials WHERE user_id = ? AND platform = ? AND name = ?',
      [userId, platform, name]
    );
  }

  async updateCredential(userId: number, credentialId: number, data: string) {
    await this.db.run(
      `UPDATE credentials SET data = ?, updated_at = CURRENT_TIMESTAMP 
       WHERE id = ? AND user_id = ?`,
      [data, credentialId, userId]
    );
  }

  async deleteCredential(userId: number, credentialId: number) {
    await this.db.run(
      'DELETE FROM credentials WHERE id = ? AND user_id = ?',
      [credentialId, userId]
    );
  }

  async getCredentialById(id: number): Promise<Credential | null> {
    return await this.db.get('SELECT * FROM credentials WHERE id = ?', [id]);
  }
  
  // Expose db instance for other modules
  get dbInstance() {
    return this.db;
  }
}

export const db = new Database();