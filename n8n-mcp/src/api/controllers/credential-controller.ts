import { Request, Response } from 'express';
import { Pool } from 'pg';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export class CredentialController {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  // Get all credentials for user
  getAllCredentials = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.params.userId || req.user!.id;
      const { page = 1, limit = 20, provider, status } = req.query;

      let whereClause = 'WHERE user_id = $1 AND deleted_at IS NULL';
      const queryParams: any[] = [userId];
      let paramCount = 1;

      if (provider) {
        paramCount++;
        whereClause += ` AND provider = $${paramCount}`;
        queryParams.push(provider);
      }

      if (status) {
        paramCount++;
        whereClause += ` AND status = $${paramCount}`;
        queryParams.push(status);
      }

      // Get total count
      const countResult = await this.db.query(
        `SELECT COUNT(*) as total FROM user_credentials ${whereClause}`,
        queryParams
      );
      const total = parseInt(countResult.rows[0].total);

      // Get paginated results
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      const credentials = await this.db.query(
        `SELECT id, provider, name, status, is_default, last_validated, created_at, updated_at, metadata
         FROM user_credentials ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
        [...queryParams, limit, offset]
      );

      res.json({
        success: true,
        data: credentials.rows,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          totalPages: Math.ceil(total / parseInt(limit as string))
        }
      });
    } catch (error) {
      console.error('Get credentials error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_CREDENTIALS_ERROR',
          message: 'Failed to fetch credentials'
        }
      });
    }
  };

  // Get single credential
  getCredential = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { credentialId } = req.params;
      const userId = req.user!.id;

      const credential = await this.db.query(
        `SELECT id, provider, name, status, is_default, last_validated, created_at, updated_at, metadata
         FROM user_credentials 
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
        [credentialId, userId]
      );

      if (credential.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CREDENTIAL_NOT_FOUND',
            message: 'Credential not found'
          }
        });
        return;
      }

      res.json({
        success: true,
        data: credential.rows[0]
      });
    } catch (error) {
      console.error('Get credential error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_CREDENTIAL_ERROR',
          message: 'Failed to fetch credential'
        }
      });
    }
  };

  // Create new credential
  createCredential = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { provider, name, credentials, isDefault = false, metadata = {} } = req.body;

      // Validate credential data
      const validation = await this.validateCredential({ provider, credentials });
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIAL',
            message: 'Credential validation failed',
            details: validation.errors
          }
        });
        return;
      }

      // Encrypt credentials
      const encryptedCredentials = await this.encryptCredentials(credentials);

      // If setting as default, unset other defaults
      if (isDefault) {
        await this.db.query(
          'UPDATE user_credentials SET is_default = false WHERE user_id = $1 AND provider = $2',
          [userId, provider]
        );
      }

      // Create credential
      const result = await this.db.query(
        `INSERT INTO user_credentials (user_id, provider, name, encrypted_credentials, is_default, status, metadata)
         VALUES ($1, $2, $3, $4, $5, 'active', $6)
         RETURNING id, provider, name, status, is_default, created_at, metadata`,
        [userId, provider, name, encryptedCredentials, isDefault, metadata]
      );

      const credential = result.rows[0];

      // Send webhook notification (placeholder - implement webhooks)
      await this.triggerWebhookEvent(userId, 'credential.created', {
        credentialId: credential.id,
        provider: credential.provider,
        createdAt: credential.created_at
      });

      res.status(201).json({
        success: true,
        data: credential
      });
    } catch (error) {
      console.error('Create credential error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_CREDENTIAL_ERROR',
          message: 'Failed to create credential'
        }
      });
    }
  };

  // Update credential
  updateCredential = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { credentialId } = req.params;
      const userId = req.user!.id;
      const updateData = req.body;

      // Check if credential exists and belongs to user
      const existing = await this.db.query(
        'SELECT id FROM user_credentials WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [credentialId, userId]
      );

      if (existing.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CREDENTIAL_NOT_FOUND',
            message: 'Credential not found'
          }
        });
        return;
      }

      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      // Build dynamic update query
      if (updateData.name) {
        paramCount++;
        updates.push(`name = $${paramCount}`);
        values.push(updateData.name);
      }

      if (updateData.credentials) {
        const encryptedCredentials = await this.encryptCredentials(updateData.credentials);
        paramCount++;
        updates.push(`encrypted_credentials = $${paramCount}`);
        values.push(encryptedCredentials);
      }

      if (updateData.isDefault !== undefined) {
        if (updateData.isDefault) {
          // Unset other defaults first
          await this.db.query(
            'UPDATE user_credentials SET is_default = false WHERE user_id = $1 AND id != $2',
            [userId, credentialId]
          );
        }
        paramCount++;
        updates.push(`is_default = $${paramCount}`);
        values.push(updateData.isDefault);
      }

      if (updateData.metadata) {
        paramCount++;
        updates.push(`metadata = $${paramCount}`);
        values.push(updateData.metadata);
      }

      if (updates.length === 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NO_UPDATES',
            message: 'No valid fields to update'
          }
        });
        return;
      }

      // Add updated_at
      paramCount++;
      updates.push(`updated_at = $${paramCount}`);
      values.push(new Date());

      // Add WHERE clause parameters
      paramCount++;
      values.push(credentialId);
      paramCount++;
      values.push(userId);

      const result = await this.db.query(
        `UPDATE user_credentials 
         SET ${updates.join(', ')}
         WHERE id = $${paramCount - 1} AND user_id = $${paramCount}
         RETURNING id, provider, name, status, is_default, updated_at, metadata`,
        values
      );

      const credential = result.rows[0];

      // Send webhook notification
      await this.triggerWebhookEvent(userId, 'credential.updated', {
        credentialId: credential.id,
        provider: credential.provider,
        updatedAt: credential.updated_at
      });

      res.json({
        success: true,
        data: credential
      });
    } catch (error) {
      console.error('Update credential error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_CREDENTIAL_ERROR',
          message: 'Failed to update credential'
        }
      });
    }
  };

  // Delete credential
  deleteCredential = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { credentialId } = req.params;
      const userId = req.user!.id;

      const result = await this.db.query(
        `UPDATE user_credentials 
         SET deleted_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
         RETURNING id`,
        [credentialId, userId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CREDENTIAL_NOT_FOUND',
            message: 'Credential not found'
          }
        });
        return;
      }

      // Send webhook notification
      await this.triggerWebhookEvent(userId, 'credential.deleted', {
        credentialId,
        deletedAt: new Date()
      });

      res.json({
        success: true,
        message: 'Credential deleted successfully'
      });
    } catch (error) {
      console.error('Delete credential error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'DELETE_CREDENTIAL_ERROR',
          message: 'Failed to delete credential'
        }
      });
    }
  };

  // Test credential
  testCredential = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { credentialId } = req.params;
      const userId = req.user!.id;

      // Get credential
      const credential = await this.db.query(
        `SELECT provider, encrypted_credentials
         FROM user_credentials 
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
        [credentialId, userId]
      );

      if (credential.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CREDENTIAL_NOT_FOUND',
            message: 'Credential not found'
          }
        });
        return;
      }

      const { provider, encrypted_credentials } = credential.rows[0];
      const credentials = await this.decryptCredentials(encrypted_credentials);

      // Test the credential based on provider
      const testResult = await this.performCredentialTest(provider, credentials);

      // Update last_validated timestamp
      await this.db.query(
        'UPDATE user_credentials SET last_validated = NOW() WHERE id = $1',
        [credentialId]
      );

      res.json({
        success: true,
        data: testResult
      });
    } catch (error) {
      console.error('Test credential error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'TEST_CREDENTIAL_ERROR',
          message: 'Failed to test credential'
        }
      });
    }
  };

  // Get credential usage stats
  getCredentialUsage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { credentialId } = req.params;
      const userId = req.user!.id;
      const { timeframe = '7d' } = req.query;

      // Verify credential ownership
      const credential = await this.db.query(
        'SELECT id FROM user_credentials WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [credentialId, userId]
      );

      if (credential.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: {
            code: 'CREDENTIAL_NOT_FOUND',
            message: 'Credential not found'
          }
        });
        return;
      }

      // Get usage stats from usage_logs table
      const timeframeDays = this.parseTimeframe(timeframe as string);
      const usage = await this.db.query(
        `SELECT 
           COUNT(*) as total_requests,
           SUM(tokens_used) as total_tokens,
           SUM(cost) as total_cost,
           AVG(response_time_ms) as avg_response_time
         FROM usage_logs 
         WHERE credential_id = $1 
           AND created_at >= NOW() - INTERVAL '${timeframeDays} days'`,
        [credentialId]
      );

      res.json({
        success: true,
        data: usage.rows[0]
      });
    } catch (error) {
      console.error('Get credential usage error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_USAGE_ERROR',
          message: 'Failed to fetch credential usage'
        }
      });
    }
  };

  // Helper methods
  private async validateCredential(credentialData: any): Promise<{ isValid: boolean; errors?: string[] }> {
    const { provider, credentials } = credentialData;
    const errors: string[] = [];

    // Basic validation
    if (!provider || !credentials) {
      errors.push('Provider and credentials are required');
      return { isValid: false, errors };
    }

    // Provider-specific validation
    switch (provider) {
      case 'openai':
        if (!credentials.apiKey) {
          errors.push('OpenAI API key is required');
        }
        break;
      case 'anthropic':
        if (!credentials.apiKey) {
          errors.push('Anthropic API key is required');
        }
        break;
      case 'google':
        if (!credentials.apiKey && !credentials.serviceAccountKey) {
          errors.push('Google API key or service account key is required');
        }
        break;
      default:
        errors.push('Unsupported provider');
    }

    return { isValid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }

  private async encryptCredentials(credentials: any): Promise<string> {
    // Placeholder for encryption - implement proper encryption
    return JSON.stringify(credentials);
  }

  private async decryptCredentials(encryptedCredentials: string): Promise<any> {
    // Placeholder for decryption - implement proper decryption
    return JSON.parse(encryptedCredentials);
  }

  private async performCredentialTest(provider: string, credentials: any): Promise<any> {
    // Placeholder for credential testing - implement actual API calls
    const startTime = Date.now();
    
    try {
      // Simulate API call based on provider
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
      
      const responseTime = Date.now() - startTime;
      
      return {
        isValid: true,
        responseTime,
        model: 'test-model',
        tokensUsed: 10,
        cost: 0.0001,
        testedAt: new Date()
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Test failed',
        testedAt: new Date()
      };
    }
  }

  private async triggerWebhookEvent(userId: string, event: string, data: any): Promise<void> {
    // Placeholder for webhook triggering - implement webhook service
    console.log(`Webhook event: ${event}`, { userId, data });
  }

  private parseTimeframe(timeframe: string): number {
    const timeframes: Record<string, number> = {
      '1h': 0.04,
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90
    };
    return timeframes[timeframe] || 7;
  }
}