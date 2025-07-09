import { db } from './database.js';

export interface AIProviderSetting {
  id: number;
  user_id: number;
  provider: string;
  api_key_encrypted: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function createAIProviderTable() {
  await (db as any).db.exec(`
    CREATE TABLE IF NOT EXISTS ai_provider_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      provider TEXT NOT NULL CHECK(provider IN ('openai', 'anthropic', 'gemini', 'llama', 'deepseek', 'perplexity')),
      api_key_encrypted TEXT NOT NULL,
      model TEXT,
      temperature REAL DEFAULT 0.7,
      max_tokens INTEGER DEFAULT 8000,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, provider)
    )
  `);

  await (db as any).db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_providers_user ON ai_provider_settings(user_id)`);
  await (db as any).db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_providers_active ON ai_provider_settings(is_active)`);
}

export async function saveAIProviderSettings(data: {
  user_id: number;
  provider: string;
  api_key_encrypted: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}): Promise<number> {
  const result = await (db as any).db.run(
    `INSERT INTO ai_provider_settings (user_id, provider, api_key_encrypted, model, temperature, max_tokens) 
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, provider) 
     DO UPDATE SET 
       api_key_encrypted = ?,
       model = ?,
       temperature = ?,
       max_tokens = ?,
       updated_at = CURRENT_TIMESTAMP`,
    [
      data.user_id,
      data.provider,
      data.api_key_encrypted,
      data.model,
      data.temperature,
      data.max_tokens,
      // Update values
      data.api_key_encrypted,
      data.model,
      data.temperature,
      data.max_tokens
    ]
  );
  return result.lastID;
}

export async function getAIProviderSettings(userId: number): Promise<AIProviderSetting[]> {
  return await (db as any).db.all(
    'SELECT * FROM ai_provider_settings WHERE user_id = ? ORDER BY provider',
    [userId]
  );
}

export async function getActiveAIProvider(userId: number): Promise<AIProviderSetting | null> {
  return await (db as any).db.get(
    'SELECT * FROM ai_provider_settings WHERE user_id = ? AND is_active = 1 LIMIT 1',
    [userId]
  );
}

export async function setActiveAIProvider(userId: number, provider: string): Promise<void> {
  // First, deactivate all providers for this user
  await (db as any).db.run(
    'UPDATE ai_provider_settings SET is_active = 0 WHERE user_id = ?',
    [userId]
  );
  
  // Then activate the selected provider
  await (db as any).db.run(
    'UPDATE ai_provider_settings SET is_active = 1 WHERE user_id = ? AND provider = ?',
    [userId, provider]
  );
}

export async function deleteAIProviderSettings(userId: number, provider: string): Promise<void> {
  await (db as any).db.run(
    'DELETE FROM ai_provider_settings WHERE user_id = ? AND provider = ?',
    [userId, provider]
  );
}