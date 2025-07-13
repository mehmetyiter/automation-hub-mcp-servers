import crypto from 'crypto';
import { Redis } from 'ioredis';
import { LoggingService } from '../../../src/observability/logging';
import { MetricsService } from '../../../src/observability/metrics';

const logger = LoggingService.getInstance();
const metrics = MetricsService.getInstance();

export interface RotationJob {
  id: string;
  keyId: string;
  scheduledAt: Date;
  interval: number; // in days
  notificationUrl?: string;
  gracePeriod: number; // in hours
  status: 'scheduled' | 'in_progress' | 'completed' | 'failed';
}

export interface RotationResult {
  success: boolean;
  oldKeyId: string;
  newKeyId: string;
  rotationId: string;
  gracePeriodEnds: Date;
  error?: string;
}

export class KeyRotationService {
  private redis: Redis;
  private rotationJobs: Map<string, RotationJob> = new Map();
  private isRunning = false;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3
    });

    this.startRotationScheduler();
  }

  async scheduleRotation(
    keyId: string,
    intervalDays: number,
    options: {
      notificationUrl?: string;
      gracePeriodHours?: number;
      startDate?: Date;
    } = {}
  ): Promise<string> {
    const rotationId = crypto.randomUUID();
    const startDate = options.startDate || new Date();
    const scheduledAt = new Date(startDate.getTime() + (intervalDays * 24 * 60 * 60 * 1000));

    const job: RotationJob = {
      id: rotationId,
      keyId,
      scheduledAt,
      interval: intervalDays,
      notificationUrl: options.notificationUrl,
      gracePeriod: options.gracePeriodHours || 24,
      status: 'scheduled'
    };

    // Store in memory
    this.rotationJobs.set(rotationId, job);

    // Persist to Redis
    await this.persistRotationJob(job);

    // Schedule in Redis for persistence
    await this.redis.zadd(
      'rotation:schedule',
      scheduledAt.getTime(),
      rotationId
    );

    logger.info('Key rotation scheduled', {
      rotationId,
      keyId,
      scheduledAt,
      intervalDays
    });

    metrics.recordMetric('keyRotation', 'scheduled', 1, { keyId });

    return rotationId;
  }

  async cancelRotation(rotationId: string): Promise<boolean> {
    try {
      const job = this.rotationJobs.get(rotationId);
      if (!job) {
        return false;
      }

      // Remove from schedule
      this.rotationJobs.delete(rotationId);
      await this.redis.zrem('rotation:schedule', rotationId);
      await this.redis.del(`rotation:job:${rotationId}`);

      logger.info('Key rotation cancelled', { rotationId, keyId: job.keyId });
      metrics.recordMetric('keyRotation', 'cancelled', 1, { keyId: job.keyId });

      return true;
    } catch (error) {
      logger.error('Failed to cancel rotation', { rotationId, error });
      return false;
    }
  }

  async executeRotation(keyId: string, options: {
    gracePeriodHours?: number;
    notifyWebhook?: boolean;
  } = {}): Promise<RotationResult> {
    const rotationId = crypto.randomUUID();
    const gracePeriodHours = options.gracePeriodHours || 24;

    try {
      logger.info('Starting key rotation', { keyId, rotationId });
      metrics.recordMetric('keyRotation', 'started', 1, { keyId });

      // 1. Generate new API key
      const newKey = await this.generateNewKey(keyId);
      
      // 2. Create rotation record
      const rotationRecord = {
        id: rotationId,
        oldKeyId: keyId,
        newKeyId: newKey.id,
        startedAt: new Date(),
        gracePeriodEnds: new Date(Date.now() + (gracePeriodHours * 60 * 60 * 1000)),
        status: 'in_progress'
      };

      await this.persistRotationRecord(rotationRecord);

      // 3. Update key status
      await this.markKeyForRotation(keyId, newKey.id, gracePeriodHours);

      // 4. Notify via webhook if configured
      if (options.notifyWebhook) {
        await this.sendRotationNotification(rotationRecord);
      }

      // 5. Schedule grace period cleanup
      await this.scheduleGracePeriodCleanup(rotationId, gracePeriodHours);

      const result: RotationResult = {
        success: true,
        oldKeyId: keyId,
        newKeyId: newKey.id,
        rotationId,
        gracePeriodEnds: rotationRecord.gracePeriodEnds
      };

      logger.info('Key rotation completed', result);
      metrics.recordMetric('keyRotation', 'completed', 1, { 
        keyId, 
        newKeyId: newKey.id 
      });

      return result;

    } catch (error) {
      logger.error('Key rotation failed', { keyId, rotationId, error });
      metrics.recordMetric('keyRotation', 'failed', 1, { keyId });

      return {
        success: false,
        oldKeyId: keyId,
        newKeyId: '',
        rotationId,
        gracePeriodEnds: new Date(),
        error: error.message
      };
    }
  }

  private async generateNewKey(oldKeyId: string): Promise<{ id: string; key: string }> {
    // This would integrate with the APIKeyManager
    // For now, simulate key generation
    const newKeyId = crypto.randomUUID();
    const newKeyValue = this.generateSecureKey();

    // Store the new key (this would be done by APIKeyManager)
    await this.redis.hset(`key:${newKeyId}`, {
      id: newKeyId,
      value: this.hashKey(newKeyValue),
      createdAt: new Date().toISOString(),
      status: 'active',
      rotatedFrom: oldKeyId
    });

    return {
      id: newKeyId,
      key: newKeyValue
    };
  }

  private async markKeyForRotation(
    oldKeyId: string, 
    newKeyId: string, 
    gracePeriodHours: number
  ): Promise<void> {
    const gracePeriodEnd = new Date(Date.now() + (gracePeriodHours * 60 * 60 * 1000));

    // Update old key status
    await this.redis.hmset(`key:${oldKeyId}`, {
      status: 'rotating',
      rotationTo: newKeyId,
      gracePeriodEnd: gracePeriodEnd.toISOString()
    });

    // Set expiration for automatic cleanup
    await this.redis.expire(`key:${oldKeyId}`, gracePeriodHours * 3600);
  }

  private async scheduleGracePeriodCleanup(
    rotationId: string, 
    gracePeriodHours: number
  ): Promise<void> {
    const cleanupTime = Date.now() + (gracePeriodHours * 60 * 60 * 1000);
    
    await this.redis.zadd(
      'rotation:cleanup',
      cleanupTime,
      rotationId
    );
  }

  private async sendRotationNotification(rotationRecord: any): Promise<void> {
    try {
      // This would send webhook notification to registered URL
      const payload = {
        type: 'key_rotation',
        rotationId: rotationRecord.id,
        oldKeyId: rotationRecord.oldKeyId,
        newKeyId: rotationRecord.newKeyId,
        gracePeriodEnds: rotationRecord.gracePeriodEnds,
        timestamp: new Date().toISOString()
      };

      logger.info('Rotation notification sent', { rotationId: rotationRecord.id });
      
      // Store notification for retry if needed
      await this.redis.setex(
        `notification:${rotationRecord.id}`,
        86400, // 24 hours
        JSON.stringify(payload)
      );

    } catch (error) {
      logger.error('Failed to send rotation notification', {
        rotationId: rotationRecord.id,
        error
      });
    }
  }

  private async persistRotationJob(job: RotationJob): Promise<void> {
    await this.redis.setex(
      `rotation:job:${job.id}`,
      job.interval * 24 * 60 * 60, // TTL based on interval
      JSON.stringify(job)
    );
  }

  private async persistRotationRecord(record: any): Promise<void> {
    await this.redis.setex(
      `rotation:record:${record.id}`,
      7 * 24 * 60 * 60, // 7 days TTL
      JSON.stringify(record)
    );
  }

  private startRotationScheduler(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.scheduleNextCheck();
  }

  private scheduleNextCheck(): void {
    setTimeout(async () => {
      try {
        await this.checkScheduledRotations();
        await this.checkGracePeriodCleanups();
      } catch (error) {
        logger.error('Rotation scheduler error', { error });
      } finally {
        this.scheduleNextCheck();
      }
    }, 60000); // Check every minute
  }

  private async checkScheduledRotations(): Promise<void> {
    try {
      const now = Date.now();
      
      // Get all jobs scheduled for now or earlier
      const jobIds = await this.redis.zrangebyscore(
        'rotation:schedule',
        '-inf',
        now
      );

      for (const jobId of jobIds) {
        const jobData = await this.redis.get(`rotation:job:${jobId}`);
        if (!jobData) continue;

        const job: RotationJob = JSON.parse(jobData);
        
        if (job.status === 'scheduled') {
          // Execute rotation
          job.status = 'in_progress';
          await this.persistRotationJob(job);

          const result = await this.executeRotation(job.keyId, {
            gracePeriodHours: job.gracePeriod,
            notifyWebhook: !!job.notificationUrl
          });

          // Update job status
          job.status = result.success ? 'completed' : 'failed';
          await this.persistRotationJob(job);

          // Remove from schedule and reschedule if recurring
          await this.redis.zrem('rotation:schedule', jobId);
          
          if (result.success && job.interval > 0) {
            // Schedule next rotation
            const nextRotation = new Date(now + (job.interval * 24 * 60 * 60 * 1000));
            const newJobId = crypto.randomUUID();
            
            const newJob: RotationJob = {
              ...job,
              id: newJobId,
              keyId: result.newKeyId, // Use the new key for next rotation
              scheduledAt: nextRotation,
              status: 'scheduled'
            };

            await this.scheduleRotation(
              result.newKeyId,
              job.interval,
              {
                notificationUrl: job.notificationUrl,
                gracePeriodHours: job.gracePeriod,
                startDate: nextRotation
              }
            );
          }
        }
      }
    } catch (error) {
      logger.error('Failed to check scheduled rotations', { error });
    }
  }

  private async checkGracePeriodCleanups(): Promise<void> {
    try {
      const now = Date.now();
      
      // Get all cleanups scheduled for now or earlier
      const rotationIds = await this.redis.zrangebyscore(
        'rotation:cleanup',
        '-inf',
        now
      );

      for (const rotationId of rotationIds) {
        const recordData = await this.redis.get(`rotation:record:${rotationId}`);
        if (!recordData) continue;

        const record = JSON.parse(recordData);
        
        // Cleanup old key
        await this.cleanupOldKey(record.oldKeyId);
        
        // Remove from cleanup schedule
        await this.redis.zrem('rotation:cleanup', rotationId);
        
        logger.info('Grace period cleanup completed', {
          rotationId,
          oldKeyId: record.oldKeyId
        });

        metrics.recordMetric('keyRotation', 'cleanupCompleted', 1, {
          oldKeyId: record.oldKeyId
        });
      }
    } catch (error) {
      logger.error('Failed to check grace period cleanups', { error });
    }
  }

  private async cleanupOldKey(keyId: string): Promise<void> {
    try {
      // Mark key as expired
      await this.redis.hset(`key:${keyId}`, 'status', 'expired');
      
      // Remove from active key list
      await this.redis.srem('active:keys', keyId);
      
      // Move to expired keys list
      await this.redis.sadd('expired:keys', keyId);
      
      logger.info('Old key cleaned up', { keyId });
    } catch (error) {
      logger.error('Failed to cleanup old key', { keyId, error });
    }
  }

  private generateSecureKey(): string {
    const prefix = 'sk_live_';
    const randomBytes = crypto.randomBytes(32);
    const key = randomBytes.toString('base64url');
    return `${prefix}${key}`;
  }

  private hashKey(key: string): string {
    return crypto
      .createHash('sha256')
      .update(key + (process.env.API_KEY_SALT || 'default-salt'))
      .digest('hex');
  }

  async getRotationStatus(rotationId: string): Promise<any> {
    try {
      const recordData = await this.redis.get(`rotation:record:${rotationId}`);
      if (!recordData) return null;

      return JSON.parse(recordData);
    } catch (error) {
      logger.error('Failed to get rotation status', { rotationId, error });
      return null;
    }
  }

  async getKeyRotationHistory(keyId: string): Promise<any[]> {
    try {
      // This would query rotation records for a specific key
      const pattern = `rotation:record:*`;
      const keys = await this.redis.keys(pattern);
      
      const rotations = [];
      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const record = JSON.parse(data);
          if (record.oldKeyId === keyId || record.newKeyId === keyId) {
            rotations.push(record);
          }
        }
      }
      
      return rotations.sort((a, b) => 
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
    } catch (error) {
      logger.error('Failed to get rotation history', { keyId, error });
      return [];
    }
  }

  async updateRotationJob(rotationId: string, updates: Partial<RotationJob>): Promise<boolean> {
    try {
      const job = this.rotationJobs.get(rotationId);
      if (!job) return false;

      const updatedJob = { ...job, ...updates };
      this.rotationJobs.set(rotationId, updatedJob);
      await this.persistRotationJob(updatedJob);

      // Update schedule if timing changed
      if (updates.scheduledAt) {
        await this.redis.zadd(
          'rotation:schedule',
          updates.scheduledAt.getTime(),
          rotationId
        );
      }

      logger.info('Rotation job updated', { rotationId, updates });
      return true;
    } catch (error) {
      logger.error('Failed to update rotation job', { rotationId, error });
      return false;
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    await this.redis.disconnect();
  }
}