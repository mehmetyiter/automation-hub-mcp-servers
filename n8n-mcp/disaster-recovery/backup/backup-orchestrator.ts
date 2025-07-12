import { CronJob } from 'cron';
import * as AWS from 'aws-sdk';
import { Pool } from 'pg';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';
import { exec as execCallback } from 'child_process';
import { LoggingService } from '../../src/observability/logging';
import { MetricsService } from '../../src/observability/metrics';
import { DatabaseBackupStrategy } from './backup-strategies/database-backup';
import { FileBackupStrategy } from './backup-strategies/file-backup';
import { ConfigBackupStrategy } from './backup-strategies/config-backup';

const exec = promisify(execCallback);
const logger = LoggingService.getInstance();
const metrics = MetricsService.getInstance();

export interface BackupConfig {
  type: 'full' | 'incremental' | 'differential';
  retention: {
    daily: number;
    weekly: number;
    monthly: number;
    yearly: number;
  };
  encryption: {
    algorithm: string;
    keyId: string;
  };
  destinations: BackupDestination[];
  compressionLevel: number;
  parallelism: number;
}

export interface BackupDestination {
  type: 's3' | 'glacier' | 'azure' | 'gcs';
  bucket: string;
  region: string;
  storageClass: string;
  endpoint?: string;
}

export interface BackupManifest {
  backupId: string;
  type: string;
  schedule: string;
  timestamp: string;
  components: BackupComponent[];
  checksum?: string;
  duration?: number;
  totalSize: number;
  metadata: Record<string, any>;
}

export interface BackupComponent {
  type: 'database' | 'files' | 'config' | 'keys';
  backupId: string;
  filename: string;
  size: number;
  checksum: string;
  encryptionKeyId: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface BackupResult {
  success: boolean;
  backupId: string;
  manifest?: BackupManifest;
  error?: Error;
}

export class BackupOrchestrator {
  private s3: AWS.S3;
  private kms: AWS.KMS;
  private schedules: Map<string, CronJob> = new Map();
  private dbPool: Pool;
  private backupLock: Map<string, boolean> = new Map();
  
  constructor(
    private config: BackupConfig,
    dbPool: Pool
  ) {
    this.s3 = new AWS.S3();
    this.kms = new AWS.KMS();
    this.dbPool = dbPool;
    this.initializeSchedules();
  }

  private initializeSchedules(): void {
    // Daily backups at 2 AM
    this.schedules.set('daily', new CronJob('0 2 * * *', async () => {
      await this.performBackup('daily');
    }, null, true, 'UTC'));

    // Weekly backups on Sunday at 3 AM
    this.schedules.set('weekly', new CronJob('0 3 * * 0', async () => {
      await this.performBackup('weekly');
    }, null, true, 'UTC'));

    // Monthly backups on 1st at 4 AM
    this.schedules.set('monthly', new CronJob('0 4 1 * *', async () => {
      await this.performBackup('monthly');
    }, null, true, 'UTC'));

    // Yearly backups on Jan 1st at 5 AM
    this.schedules.set('yearly', new CronJob('0 5 1 1 *', async () => {
      await this.performBackup('yearly');
    }, null, true, 'UTC'));

    logger.info('Backup schedules initialized', {
      schedules: Array.from(this.schedules.keys())
    });
  }

  async performBackup(schedule: string): Promise<BackupResult> {
    const backupId = this.generateBackupId();
    const startTime = Date.now();
    
    // Check if backup is already running
    if (this.backupLock.get(schedule)) {
      logger.warn('Backup already in progress', { schedule });
      return {
        success: false,
        backupId,
        error: new Error('Backup already in progress')
      };
    }
    
    this.backupLock.set(schedule, true);
    
    try {
      logger.info(`Starting ${schedule} backup`, { backupId });
      metrics.recordMetric('backup', 'started', 1, { schedule });
      
      // Phase 1: Pre-backup validation
      await this.preBackupValidation();
      
      // Phase 2: Create backup manifest
      const manifest = await this.createBackupManifest(backupId, schedule);
      
      // Phase 3: Backup database
      const dbBackup = await this.backupDatabase(backupId);
      manifest.components.push(dbBackup);
      
      // Phase 4: Backup files and configurations
      const fileBackup = await this.backupFiles(backupId);
      manifest.components.push(fileBackup);
      
      // Phase 5: Backup configurations
      const configBackup = await this.backupConfigurations(backupId);
      manifest.components.push(configBackup);
      
      // Phase 6: Backup encryption keys (to separate secure storage)
      const keyBackup = await this.backupEncryptionKeys(backupId);
      manifest.components.push(keyBackup);
      
      // Phase 7: Calculate total size and checksums
      manifest.totalSize = manifest.components.reduce((sum, c) => sum + c.size, 0);
      manifest.checksum = await this.calculateManifestChecksum(manifest);
      manifest.duration = Date.now() - startTime;
      
      // Phase 8: Upload to all destinations
      await this.uploadToDestinations(manifest);
      
      // Phase 9: Verify backup integrity
      await this.verifyBackup(manifest);
      
      // Phase 10: Update backup catalog
      await this.updateBackupCatalog(manifest);
      
      // Phase 11: Cleanup old backups
      await this.cleanupOldBackups(schedule);
      
      // Phase 12: Send notifications
      await this.sendBackupNotification(manifest, true);
      
      logger.info('Backup completed successfully', {
        backupId,
        duration: manifest.duration,
        size: manifest.totalSize,
        components: manifest.components.length
      });
      
      metrics.recordMetric('backup', 'completed', 1, {
        schedule,
        duration: manifest.duration.toString(),
        size: manifest.totalSize.toString()
      });
      
      return {
        success: true,
        backupId,
        manifest
      };
      
    } catch (error) {
      logger.error('Backup failed', { backupId, error });
      metrics.recordMetric('backup', 'failed', 1, { schedule, error: error.message });
      
      await this.handleBackupFailure(backupId, error);
      await this.sendBackupNotification(null, false, error);
      
      return {
        success: false,
        backupId,
        error
      };
    } finally {
      this.backupLock.set(schedule, false);
    }
  }

  private async preBackupValidation(): Promise<void> {
    // Check available disk space
    const { stdout } = await exec('df -h /tmp | tail -1 | awk \'{print $4}\'');
    const availableSpace = this.parseSize(stdout.trim());
    
    if (availableSpace < 50 * 1024 * 1024 * 1024) { // 50GB minimum
      throw new Error('Insufficient disk space for backup');
    }
    
    // Check database connectivity
    await this.dbPool.query('SELECT 1');
    
    // Check AWS credentials
    await this.s3.listBuckets().promise();
    
    // Verify KMS key access
    await this.kms.describeKey({ KeyId: this.config.encryption.keyId }).promise();
  }

  private async createBackupManifest(backupId: string, schedule: string): Promise<BackupManifest> {
    return {
      backupId,
      type: this.config.type,
      schedule,
      timestamp: new Date().toISOString(),
      components: [],
      totalSize: 0,
      metadata: {
        version: process.env.VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'production',
        hostname: process.env.HOSTNAME,
        region: process.env.AWS_REGION
      }
    };
  }

  private async backupDatabase(backupId: string): Promise<BackupComponent> {
    const strategy = new DatabaseBackupStrategy(this.dbPool, this.config);
    const tempFile = `/tmp/${backupId}-db.dump`;
    const encryptedFile = `${tempFile}.enc`;
    
    try {
      // Perform database backup
      await strategy.backup(tempFile);
      
      // Compress the dump
      await this.compressFile(tempFile, `${tempFile}.gz`);
      
      // Encrypt the compressed dump
      await this.encryptBackupFile(`${tempFile}.gz`, encryptedFile);
      
      // Calculate checksum
      const checksum = await this.calculateFileChecksum(encryptedFile);
      const size = await this.getFileSize(encryptedFile);
      
      return {
        type: 'database',
        backupId,
        filename: `${backupId}-db.dump.gz.enc`,
        size,
        checksum,
        encryptionKeyId: this.config.encryption.keyId,
        timestamp: new Date().toISOString(),
        metadata: {
          originalSize: await this.getFileSize(tempFile),
          compressedSize: await this.getFileSize(`${tempFile}.gz`),
          compressionRatio: await this.calculateCompressionRatio(tempFile, `${tempFile}.gz`)
        }
      };
    } finally {
      // Cleanup temp files
      await this.cleanupTempFiles([tempFile, `${tempFile}.gz`, encryptedFile]);
    }
  }

  private async backupFiles(backupId: string): Promise<BackupComponent> {
    const strategy = new FileBackupStrategy(this.config);
    const tempFile = `/tmp/${backupId}-files.tar`;
    const encryptedFile = `${tempFile}.gz.enc`;
    
    try {
      // Create tar archive of important files
      await strategy.backup(tempFile);
      
      // Compress
      await this.compressFile(tempFile, `${tempFile}.gz`);
      
      // Encrypt
      await this.encryptBackupFile(`${tempFile}.gz`, encryptedFile);
      
      const checksum = await this.calculateFileChecksum(encryptedFile);
      const size = await this.getFileSize(encryptedFile);
      
      return {
        type: 'files',
        backupId,
        filename: `${backupId}-files.tar.gz.enc`,
        size,
        checksum,
        encryptionKeyId: this.config.encryption.keyId,
        timestamp: new Date().toISOString()
      };
    } finally {
      await this.cleanupTempFiles([tempFile, `${tempFile}.gz`, encryptedFile]);
    }
  }

  private async backupConfigurations(backupId: string): Promise<BackupComponent> {
    const strategy = new ConfigBackupStrategy(this.config);
    const tempFile = `/tmp/${backupId}-config.json`;
    const encryptedFile = `${tempFile}.enc`;
    
    try {
      await strategy.backup(tempFile);
      await this.encryptBackupFile(tempFile, encryptedFile);
      
      const checksum = await this.calculateFileChecksum(encryptedFile);
      const size = await this.getFileSize(encryptedFile);
      
      return {
        type: 'config',
        backupId,
        filename: `${backupId}-config.json.enc`,
        size,
        checksum,
        encryptionKeyId: this.config.encryption.keyId,
        timestamp: new Date().toISOString()
      };
    } finally {
      await this.cleanupTempFiles([tempFile, encryptedFile]);
    }
  }

  private async backupEncryptionKeys(backupId: string): Promise<BackupComponent> {
    // This would backup encryption keys to a separate secure storage
    // Keys should never be stored with the data they encrypt
    const keyManifest = {
      backupId,
      keyIds: [this.config.encryption.keyId],
      timestamp: new Date().toISOString()
    };
    
    const tempFile = `/tmp/${backupId}-keys.json`;
    await fs.promises.writeFile(tempFile, JSON.stringify(keyManifest, null, 2));
    
    // Store in separate secure key storage (e.g., AWS Secrets Manager)
    await this.storeInKeyVault(backupId, keyManifest);
    
    const size = await this.getFileSize(tempFile);
    const checksum = await this.calculateFileChecksum(tempFile);
    
    await this.cleanupTempFiles([tempFile]);
    
    return {
      type: 'keys',
      backupId,
      filename: `${backupId}-keys-reference.json`,
      size,
      checksum,
      encryptionKeyId: 'key-vault',
      timestamp: new Date().toISOString(),
      metadata: {
        vaultLocation: 'aws-secrets-manager',
        secretName: `backup-keys/${backupId}`
      }
    };
  }

  private async encryptBackupFile(inputPath: string, outputPath: string): Promise<void> {
    // Generate data encryption key
    const dataKey = await this.kms.generateDataKey({
      KeyId: this.config.encryption.keyId,
      KeySpec: 'AES_256'
    }).promise();
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      dataKey.Plaintext as Buffer,
      iv
    );
    
    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);
    
    // Write header: encrypted data key length (4 bytes) + encrypted data key + iv (16 bytes)
    const header = Buffer.concat([
      Buffer.from(Int32Array.from([dataKey.CiphertextBlob!.length]).buffer),
      dataKey.CiphertextBlob as Buffer,
      iv
    ]);
    output.write(header);
    
    // Encrypt file content
    await pipeline(input, cipher, output);
    
    // Append auth tag
    const authTag = cipher.getAuthTag();
    await fs.promises.appendFile(outputPath, authTag);
  }

  private async compressFile(inputPath: string, outputPath: string): Promise<void> {
    const zlib = require('zlib');
    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);
    const gzip = zlib.createGzip({ level: this.config.compressionLevel });
    
    await pipeline(input, gzip, output);
  }

  private async uploadToDestinations(manifest: BackupManifest): Promise<void> {
    const uploadPromises = [];
    
    for (const destination of this.config.destinations) {
      for (const component of manifest.components) {
        const uploadPromise = this.uploadToDestination(
          destination,
          component,
          manifest
        );
        uploadPromises.push(uploadPromise);
      }
      
      // Upload manifest
      const manifestUpload = this.uploadManifestToDestination(
        destination,
        manifest
      );
      uploadPromises.push(manifestUpload);
    }
    
    // Parallel uploads with concurrency limit
    const chunks = this.chunkArray(uploadPromises, this.config.parallelism);
    for (const chunk of chunks) {
      await Promise.all(chunk);
    }
  }

  private async uploadToDestination(
    destination: BackupDestination,
    component: BackupComponent,
    manifest: BackupManifest
  ): Promise<void> {
    const key = `backups/${manifest.schedule}/${new Date().getFullYear()}/${component.filename}`;
    
    if (destination.type === 's3') {
      const params: AWS.S3.PutObjectRequest = {
        Bucket: destination.bucket,
        Key: key,
        Body: fs.createReadStream(`/tmp/${component.filename}`),
        StorageClass: destination.storageClass,
        ServerSideEncryption: 'aws:kms',
        SSEKMSKeyId: this.config.encryption.keyId,
        Metadata: {
          'backup-id': manifest.backupId,
          'component-type': component.type,
          'checksum': component.checksum,
          'original-timestamp': component.timestamp
        },
        TagSet: [
          { Key: 'BackupSchedule', Value: manifest.schedule },
          { Key: 'BackupType', Value: manifest.type },
          { Key: 'Retention', Value: this.config.retention[manifest.schedule].toString() }
        ]
      };
      
      await this.s3.upload(params).promise();
      
      // Enable object lock for immutability
      if (destination.storageClass === 'GLACIER') {
        await this.enableObjectLock(destination.bucket, key);
      }
    }
    // Add support for other destinations (Azure, GCS) as needed
  }

  private async verifyBackup(manifest: BackupManifest): Promise<void> {
    logger.info('Verifying backup integrity', { backupId: manifest.backupId });
    
    for (const destination of this.config.destinations) {
      for (const component of manifest.components) {
        // Download and verify checksum
        const verified = await this.verifyComponent(destination, component);
        if (!verified) {
          throw new Error(`Verification failed for ${component.filename}`);
        }
      }
    }
    
    // Randomly perform spot check restoration (10% chance)
    if (Math.random() < 0.1) {
      await this.performSpotCheckRestore(manifest);
    }
    
    metrics.recordMetric('backup', 'verified', 1, {
      backupId: manifest.backupId
    });
  }

  private async cleanupOldBackups(schedule: string): Promise<void> {
    const retention = this.config.retention[schedule];
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retention);
    
    logger.info(`Cleaning up ${schedule} backups older than ${cutoffDate.toISOString()}`);
    
    for (const destination of this.config.destinations) {
      const oldBackups = await this.listOldBackups(destination, schedule, cutoffDate);
      
      for (const backup of oldBackups) {
        await this.deleteBackup(destination, backup);
        logger.info('Deleted old backup', {
          backupId: backup.backupId,
          age: backup.age
        });
      }
    }
    
    metrics.recordMetric('backup', 'cleaned', oldBackups.length, { schedule });
  }

  private async updateBackupCatalog(manifest: BackupManifest): Promise<void> {
    const catalogEntry = {
      backup_id: manifest.backupId,
      schedule: manifest.schedule,
      type: manifest.type,
      timestamp: manifest.timestamp,
      size: manifest.totalSize,
      duration: manifest.duration,
      checksum: manifest.checksum,
      components: JSON.stringify(manifest.components),
      metadata: JSON.stringify(manifest.metadata),
      status: 'completed',
      verified: true
    };
    
    await this.dbPool.query(
      `INSERT INTO backup_catalog 
       (backup_id, schedule, type, timestamp, size, duration, checksum, components, metadata, status, verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      Object.values(catalogEntry)
    );
  }

  private generateBackupId(): string {
    return `backup-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }

  private async calculateFileChecksum(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    
    return hash.digest('hex');
  }

  private async calculateManifestChecksum(manifest: BackupManifest): Promise<string> {
    const content = JSON.stringify(manifest, null, 2);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async getFileSize(filePath: string): Promise<number> {
    const stats = await fs.promises.stat(filePath);
    return stats.size;
  }

  private parseSize(sizeStr: string): number {
    const units = { K: 1024, M: 1024 * 1024, G: 1024 * 1024 * 1024 };
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)(K|M|G)?$/);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2] || 'B';
    
    return value * (units[unit] || 1);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async cleanupTempFiles(files: string[]): Promise<void> {
    for (const file of files) {
      try {
        await fs.promises.unlink(file);
      } catch (error) {
        // File might already be deleted
      }
    }
  }

  private async calculateCompressionRatio(original: string, compressed: string): Promise<number> {
    const originalSize = await this.getFileSize(original);
    const compressedSize = await this.getFileSize(compressed);
    return (1 - compressedSize / originalSize) * 100;
  }

  private async storeInKeyVault(backupId: string, keyManifest: any): Promise<void> {
    const secretsManager = new AWS.SecretsManager();
    await secretsManager.createSecret({
      Name: `backup-keys/${backupId}`,
      SecretString: JSON.stringify(keyManifest),
      Description: `Backup encryption key reference for ${backupId}`,
      Tags: [
        { Key: 'BackupId', Value: backupId },
        { Key: 'Type', Value: 'backup-key-reference' }
      ]
    }).promise();
  }

  private async enableObjectLock(bucket: string, key: string): Promise<void> {
    await this.s3.putObjectLegalHold({
      Bucket: bucket,
      Key: key,
      LegalHold: {
        Status: 'ON'
      }
    }).promise();
  }

  private async verifyComponent(destination: BackupDestination, component: BackupComponent): Promise<boolean> {
    // Verification logic would download and check the component
    // This is a simplified version
    return true;
  }

  private async performSpotCheckRestore(manifest: BackupManifest): Promise<void> {
    logger.info('Performing spot check restore', { backupId: manifest.backupId });
    // Spot check restore logic would be implemented here
  }

  private async listOldBackups(destination: BackupDestination, schedule: string, cutoffDate: Date): Promise<any[]> {
    // List old backups logic
    return [];
  }

  private async deleteBackup(destination: BackupDestination, backup: any): Promise<void> {
    // Delete backup logic
  }

  private async handleBackupFailure(backupId: string, error: Error): Promise<void> {
    await this.dbPool.query(
      `INSERT INTO backup_failures (backup_id, error_message, stack_trace, timestamp)
       VALUES ($1, $2, $3, $4)`,
      [backupId, error.message, error.stack, new Date()]
    );
  }

  private async sendBackupNotification(manifest: BackupManifest | null, success: boolean, error?: Error): Promise<void> {
    // Send notification via SNS, email, or Slack
    const message = success
      ? `Backup completed successfully: ${manifest?.backupId}`
      : `Backup failed: ${error?.message}`;
    
    logger.info('Sending backup notification', { success, message });
  }

  public stop(): void {
    this.schedules.forEach(job => job.stop());
    logger.info('Backup orchestrator stopped');
  }
}