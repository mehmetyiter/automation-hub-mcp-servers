import { Pool } from 'pg';
import { AdvancedEncryptionService } from '../security/advanced-encryption-service.js';
// import { AuditLogService } from '../audit/audit-log-service.js'; // TODO: Implement audit service

export interface UserCredential {
  id: string;
  userId: string;
  provider: string;
  name: string;
  encryptedData: any;
  metadata: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class UserCredentialManager {
  constructor(
    private db: Pool,
    private encryptionService: AdvancedEncryptionService
    // private auditService: AuditLogService // TODO: Implement audit service
  ) {}

  async createCredential(userId: string, provider: string, credentials: any): Promise<UserCredential> {
    const encrypted = await this.encryptionService.encrypt(JSON.stringify(credentials), {
      userId,
      provider,
      purpose: 'storage'
    });
    
    const result = await this.db.query(
      `INSERT INTO user_credentials (user_id, provider, name, encrypted_data, metadata, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [userId, provider, `${provider} Credential`, encrypted, {}]
    );

    return result.rows[0];
  }

  async getCredential(credentialId: string, userId: string): Promise<UserCredential | null> {
    const result = await this.db.query(
      'SELECT * FROM user_credentials WHERE id = $1 AND user_id = $2',
      [credentialId, userId]
    );

    return result.rows[0] || null;
  }

  async updateCredential(credentialId: string, userId: string, updates: Partial<UserCredential>): Promise<UserCredential> {
    const result = await this.db.query(
      `UPDATE user_credentials 
       SET name = COALESCE($3, name),
           metadata = COALESCE($4, metadata),
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [credentialId, userId, updates.name, updates.metadata]
    );

    return result.rows[0];
  }

  async deleteCredential(credentialId: string, userId: string): Promise<void> {
    await this.db.query(
      'UPDATE user_credentials SET is_active = false WHERE id = $1 AND user_id = $2',
      [credentialId, userId]
    );
  }

  async listCredentials(userId: string): Promise<UserCredential[]> {
    const result = await this.db.query(
      'SELECT * FROM user_credentials WHERE user_id = $1 AND is_active = true',
      [userId]
    );

    return result.rows;
  }
}

export default UserCredentialManager;