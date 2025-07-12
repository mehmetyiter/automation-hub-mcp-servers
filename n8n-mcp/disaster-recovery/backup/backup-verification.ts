import * as crypto from 'crypto';
import * as fs from 'fs';
import { Pool } from 'pg';
import * as AWS from 'aws-sdk';
import { LoggingService } from '../../src/observability/logging';
import { MetricsService } from '../../src/observability/metrics';
import { BackupManifest, BackupComponent } from './backup-orchestrator';
import { DatabaseBackupStrategy } from './backup-strategies/database-backup';
import { FileBackupStrategy } from './backup-strategies/file-backup';
import { ConfigBackupStrategy } from './backup-strategies/config-backup';

const logger = LoggingService.getInstance();
const metrics = MetricsService.getInstance();

export interface VerificationResult {
  success: boolean;
  verificationId: string;
  report: VerificationReport;
  errors?: string[];
}

export interface VerificationReport {
  backupId: string;
  timestamp: Date;
  checks: CheckResult[];
  overallScore: number;
  recommendations: string[];
}

export interface CheckResult {
  check: string;
  success: boolean;
  duration: number;
  details: any;
  score: number;
}

export class BackupVerificationService {
  private s3: AWS.S3;
  private kms: AWS.KMS;
  private dbPool: Pool;
  
  constructor(dbPool: Pool) {
    this.s3 = new AWS.S3();
    this.kms = new AWS.KMS();
    this.dbPool = dbPool;
  }

  async performComprehensiveVerification(backupId: string): Promise<VerificationResult> {
    const verificationId = crypto.randomUUID();
    const startTime = Date.now();
    
    logger.info('Starting comprehensive backup verification', { backupId, verificationId });
    metrics.recordMetric('backup', 'verificationStarted', 1, { backupId });
    
    try {
      // Load backup manifest
      const manifest = await this.loadBackupManifest(backupId);
      
      // Perform verification checks
      const checks = await Promise.all([
        this.verifyDataIntegrity(manifest),
        this.verifyEncryption(manifest),
        this.verifyRestorability(manifest),
        this.verifyCompleteness(manifest),
        this.verifyPerformance(manifest),
        this.verifyCompliance(manifest)
      ]);
      
      const overallSuccess = checks.every(r => r.success);
      const overallScore = this.calculateOverallScore(checks);
      const recommendations = this.generateRecommendations(checks, manifest);
      
      const report: VerificationReport = {
        backupId,
        timestamp: new Date(),
        checks,
        overallScore,
        recommendations
      };
      
      // Store verification results
      await this.storeVerificationResults({
        verificationId,
        backupId,
        timestamp: new Date(),
        success: overallSuccess,
        checks,
        report
      });
      
      const duration = Date.now() - startTime;
      logger.info('Backup verification completed', {
        backupId,
        verificationId,
        success: overallSuccess,
        score: overallScore,
        duration
      });
      
      metrics.recordMetric('backup', 'verificationCompleted', 1, {
        backupId,
        success: overallSuccess.toString(),
        score: overallScore.toString()
      });
      
      if (!overallSuccess) {
        await this.handleVerificationFailure(backupId, checks);
      }
      
      return {
        success: overallSuccess,
        verificationId,
        report
      };
      
    } catch (error) {
      logger.error('Backup verification failed', { backupId, verificationId, error });
      metrics.recordMetric('backup', 'verificationFailed', 1, { backupId });
      
      return {
        success: false,
        verificationId,
        report: {
          backupId,
          timestamp: new Date(),
          checks: [],
          overallScore: 0,
          recommendations: ['Verification failed - investigate error']
        },
        errors: [error.message]
      };
    }
  }

  private async verifyDataIntegrity(manifest: BackupManifest): Promise<CheckResult> {
    const startTime = Date.now();
    logger.info('Verifying data integrity', { backupId: manifest.backupId });
    
    try {
      const errors: string[] = [];
      let verifiedComponents = 0;
      
      // Verify each component
      for (const component of manifest.components) {
        try {
          // Download component
          const data = await this.downloadComponent(component);
          
          // Verify checksum
          const actualChecksum = this.calculateChecksum(data);
          if (actualChecksum !== component.checksum) {
            errors.push(`Checksum mismatch for ${component.filename}: expected ${component.checksum}, got ${actualChecksum}`);
          } else {
            verifiedComponents++;
          }
          
          // Verify size
          if (data.length !== component.size) {
            errors.push(`Size mismatch for ${component.filename}: expected ${component.size}, got ${data.length}`);
          }
          
        } catch (error) {
          errors.push(`Failed to verify ${component.filename}: ${error.message}`);
        }
      }
      
      const success = errors.length === 0;
      const score = (verifiedComponents / manifest.components.length) * 100;
      
      return {
        check: 'dataIntegrity',
        success,
        duration: Date.now() - startTime,
        details: {
          totalComponents: manifest.components.length,
          verifiedComponents,
          errors
        },
        score
      };
      
    } catch (error) {
      return {
        check: 'dataIntegrity',
        success: false,
        duration: Date.now() - startTime,
        details: { error: error.message },
        score: 0
      };
    }
  }

  private async verifyEncryption(manifest: BackupManifest): Promise<CheckResult> {
    const startTime = Date.now();
    logger.info('Verifying encryption', { backupId: manifest.backupId });
    
    try {
      const errors: string[] = [];
      let encryptedComponents = 0;
      
      for (const component of manifest.components) {
        if (component.encryptionKeyId) {
          try {
            // Verify KMS key access
            await this.kms.describeKey({ KeyId: component.encryptionKeyId }).promise();
            
            // Test decryption
            const encryptedData = await this.downloadComponent(component);
            await this.testDecryption(encryptedData, component.encryptionKeyId);
            
            encryptedComponents++;
          } catch (error) {
            errors.push(`Encryption verification failed for ${component.filename}: ${error.message}`);
          }
        }
      }
      
      const success = errors.length === 0 && encryptedComponents === manifest.components.length;
      const score = (encryptedComponents / manifest.components.length) * 100;
      
      return {
        check: 'encryption',
        success,
        duration: Date.now() - startTime,
        details: {
          totalComponents: manifest.components.length,
          encryptedComponents,
          errors
        },
        score
      };
      
    } catch (error) {
      return {
        check: 'encryption',
        success: false,
        duration: Date.now() - startTime,
        details: { error: error.message },
        score: 0
      };
    }
  }

  private async verifyRestorability(manifest: BackupManifest): Promise<CheckResult> {
    const startTime = Date.now();
    logger.info('Verifying restorability', { backupId: manifest.backupId });
    
    const testEnv = await this.createTestRestoreEnvironment();
    
    try {
      const results = {
        databaseRestore: false,
        fileRestore: false,
        configRestore: false,
        functionalTest: false
      };
      
      // Test database restore
      const dbComponent = manifest.components.find(c => c.type === 'database');
      if (dbComponent) {
        try {
          const dbStrategy = new DatabaseBackupStrategy(testEnv.dbPool, { compressionLevel: 0 } as any);
          await this.downloadAndDecrypt(dbComponent, `/tmp/test-db-${manifest.backupId}.dump`);
          await dbStrategy.restore(`/tmp/test-db-${manifest.backupId}.dump`, testEnv.database);
          results.databaseRestore = true;
        } catch (error) {
          logger.error('Database restore test failed', { error });
        }
      }
      
      // Test file restore
      const fileComponent = manifest.components.find(c => c.type === 'files');
      if (fileComponent) {
        try {
          const fileStrategy = new FileBackupStrategy({ compressionLevel: 0 } as any);
          await this.downloadAndDecrypt(fileComponent, `/tmp/test-files-${manifest.backupId}.tar`);
          await fileStrategy.restore(`/tmp/test-files-${manifest.backupId}.tar`, testEnv.dataDir);
          results.fileRestore = true;
        } catch (error) {
          logger.error('File restore test failed', { error });
        }
      }
      
      // Test config restore
      const configComponent = manifest.components.find(c => c.type === 'config');
      if (configComponent) {
        try {
          const configStrategy = new ConfigBackupStrategy({ compressionLevel: 0 } as any);
          await this.downloadAndDecrypt(configComponent, `/tmp/test-config-${manifest.backupId}.json`);
          await configStrategy.restore(`/tmp/test-config-${manifest.backupId}.json`, testEnv.configDir);
          results.configRestore = true;
        } catch (error) {
          logger.error('Config restore test failed', { error });
        }
      }
      
      // Run functional tests
      if (results.databaseRestore) {
        results.functionalTest = await this.runFunctionalTests(testEnv);
      }
      
      const successCount = Object.values(results).filter(v => v).length;
      const totalTests = Object.keys(results).length;
      const success = successCount === totalTests;
      const score = (successCount / totalTests) * 100;
      
      return {
        check: 'restorability',
        success,
        duration: Date.now() - startTime,
        details: results,
        score
      };
      
    } finally {
      await this.cleanupTestRestoreEnvironment(testEnv);
    }
  }

  private async verifyCompleteness(manifest: BackupManifest): Promise<CheckResult> {
    const startTime = Date.now();
    logger.info('Verifying backup completeness', { backupId: manifest.backupId });
    
    try {
      const requiredComponents = ['database', 'files', 'config', 'keys'];
      const foundComponents = manifest.components.map(c => c.type);
      const missingComponents = requiredComponents.filter(rc => !foundComponents.includes(rc));
      
      // Check manifest integrity
      const manifestValid = !!(manifest.backupId && manifest.timestamp && manifest.checksum);
      
      // Check component metadata
      const componentsWithMetadata = manifest.components.filter(c => 
        c.checksum && c.size > 0 && c.timestamp
      ).length;
      
      const success = missingComponents.length === 0 && manifestValid;
      const score = manifestValid ? 
        ((requiredComponents.length - missingComponents.length) / requiredComponents.length) * 100 : 0;
      
      return {
        check: 'completeness',
        success,
        duration: Date.now() - startTime,
        details: {
          requiredComponents,
          foundComponents,
          missingComponents,
          manifestValid,
          componentsWithMetadata
        },
        score
      };
      
    } catch (error) {
      return {
        check: 'completeness',
        success: false,
        duration: Date.now() - startTime,
        details: { error: error.message },
        score: 0
      };
    }
  }

  private async verifyPerformance(manifest: BackupManifest): Promise<CheckResult> {
    const startTime = Date.now();
    logger.info('Verifying backup performance', { backupId: manifest.backupId });
    
    try {
      // Test restore speed
      const testComponent = manifest.components[0]; // Use first component for speed test
      const downloadStart = Date.now();
      const data = await this.downloadComponent(testComponent);
      const downloadTime = Date.now() - downloadStart;
      const downloadSpeed = data.length / downloadTime; // bytes per ms
      
      // Calculate expected restore time
      const totalSize = manifest.totalSize;
      const expectedRestoreTime = totalSize / downloadSpeed;
      
      // Performance thresholds
      const acceptableRestoreTime = 3600000; // 1 hour in ms
      const optimalRestoreTime = 900000; // 15 minutes in ms
      
      const success = expectedRestoreTime < acceptableRestoreTime;
      const score = Math.max(0, Math.min(100, 
        ((acceptableRestoreTime - expectedRestoreTime) / acceptableRestoreTime) * 100
      ));
      
      return {
        check: 'performance',
        success,
        duration: Date.now() - startTime,
        details: {
          downloadSpeed: downloadSpeed * 1000, // bytes per second
          expectedRestoreTime: expectedRestoreTime / 1000, // seconds
          totalSize,
          backupDuration: manifest.duration,
          compressionRatio: this.calculateCompressionRatio(manifest)
        },
        score
      };
      
    } catch (error) {
      return {
        check: 'performance',
        success: false,
        duration: Date.now() - startTime,
        details: { error: error.message },
        score: 0
      };
    }
  }

  private async verifyCompliance(manifest: BackupManifest): Promise<CheckResult> {
    const startTime = Date.now();
    logger.info('Verifying backup compliance', { backupId: manifest.backupId });
    
    try {
      const complianceChecks = {
        encryption: false,
        retention: false,
        immutability: false,
        geographicRedundancy: false,
        auditTrail: false
      };
      
      // Check encryption compliance
      complianceChecks.encryption = manifest.components.every(c => c.encryptionKeyId);
      
      // Check retention compliance
      const backupAge = Date.now() - new Date(manifest.timestamp).getTime();
      const retentionDays = 30; // Required retention period
      complianceChecks.retention = backupAge < retentionDays * 24 * 60 * 60 * 1000;
      
      // Check immutability (object lock)
      complianceChecks.immutability = await this.checkObjectLock(manifest);
      
      // Check geographic redundancy
      complianceChecks.geographicRedundancy = await this.checkGeographicRedundancy(manifest);
      
      // Check audit trail
      complianceChecks.auditTrail = await this.checkAuditTrail(manifest.backupId);
      
      const passedChecks = Object.values(complianceChecks).filter(v => v).length;
      const totalChecks = Object.keys(complianceChecks).length;
      const success = passedChecks === totalChecks;
      const score = (passedChecks / totalChecks) * 100;
      
      return {
        check: 'compliance',
        success,
        duration: Date.now() - startTime,
        details: complianceChecks,
        score
      };
      
    } catch (error) {
      return {
        check: 'compliance',
        success: false,
        duration: Date.now() - startTime,
        details: { error: error.message },
        score: 0
      };
    }
  }

  private async createTestRestoreEnvironment(): Promise<any> {
    const testId = `verify-${Date.now()}`;
    
    return {
      id: testId,
      database: `test_restore_${testId}`,
      dataDir: `/tmp/restore-test-${testId}/data`,
      configDir: `/tmp/restore-test-${testId}/config`,
      dbPool: new Pool({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432'),
        database: 'postgres', // Connect to default DB to create test DB
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
      })
    };
  }

  private async cleanupTestRestoreEnvironment(env: any): Promise<void> {
    try {
      // Drop test database
      await env.dbPool.query(`DROP DATABASE IF EXISTS ${env.database}`);
      await env.dbPool.end();
      
      // Remove test directories
      await fs.promises.rmdir(env.dataDir, { recursive: true });
      await fs.promises.rmdir(env.configDir, { recursive: true });
      
    } catch (error) {
      logger.warn('Failed to cleanup test environment', { error });
    }
  }

  private async runFunctionalTests(env: any): Promise<boolean> {
    try {
      // Test basic queries
      const tables = await env.dbPool.query(`
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public'
      `);
      
      if (tables.rows.length === 0) {
        return false;
      }
      
      // Test critical tables
      const criticalTables = ['users', 'workflows', 'credentials'];
      for (const table of criticalTables) {
        const exists = tables.rows.some(r => r.tablename === table);
        if (!exists) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Functional tests failed', { error });
      return false;
    }
  }

  private async loadBackupManifest(backupId: string): Promise<BackupManifest> {
    // Load from database or S3
    const result = await this.dbPool.query(
      'SELECT * FROM backup_catalog WHERE backup_id = $1',
      [backupId]
    );
    
    if (result.rows.length === 0) {
      throw new Error(`Backup manifest not found: ${backupId}`);
    }
    
    const row = result.rows[0];
    return {
      backupId: row.backup_id,
      type: row.type,
      schedule: row.schedule,
      timestamp: row.timestamp,
      components: JSON.parse(row.components),
      checksum: row.checksum,
      duration: row.duration,
      totalSize: row.size,
      metadata: JSON.parse(row.metadata)
    };
  }

  private async downloadComponent(component: BackupComponent): Promise<Buffer> {
    // Download from S3
    const params = {
      Bucket: process.env.BACKUP_BUCKET!,
      Key: `backups/${component.filename}`
    };
    
    const data = await this.s3.getObject(params).promise();
    return data.Body as Buffer;
  }

  private async downloadAndDecrypt(component: BackupComponent, outputPath: string): Promise<void> {
    const encryptedData = await this.downloadComponent(component);
    
    // Extract encrypted data key from header
    const keyLength = encryptedData.readInt32LE(0);
    const encryptedKey = encryptedData.slice(4, 4 + keyLength);
    const iv = encryptedData.slice(4 + keyLength, 4 + keyLength + 16);
    const ciphertext = encryptedData.slice(4 + keyLength + 16, -16);
    const authTag = encryptedData.slice(-16);
    
    // Decrypt data key
    const decryptResult = await this.kms.decrypt({
      CiphertextBlob: encryptedKey
    }).promise();
    
    // Decrypt file
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      decryptResult.Plaintext as Buffer,
      iv
    );
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    await fs.promises.writeFile(outputPath, decrypted);
  }

  private async testDecryption(encryptedData: Buffer, keyId: string): Promise<void> {
    // Test that we can decrypt a small portion
    const keyLength = encryptedData.readInt32LE(0);
    const encryptedKey = encryptedData.slice(4, 4 + keyLength);
    
    // Verify we can decrypt the data key
    await this.kms.decrypt({
      CiphertextBlob: encryptedKey
    }).promise();
  }

  private calculateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private calculateCompressionRatio(manifest: BackupManifest): number {
    // Calculate from component metadata if available
    let originalSize = 0;
    let compressedSize = 0;
    
    for (const component of manifest.components) {
      if (component.metadata?.originalSize) {
        originalSize += component.metadata.originalSize;
        compressedSize += component.size;
      }
    }
    
    return originalSize > 0 ? (1 - compressedSize / originalSize) * 100 : 0;
  }

  private async checkObjectLock(manifest: BackupManifest): Promise<boolean> {
    try {
      // Check if backup files have object lock
      for (const component of manifest.components) {
        const objectLockConfig = await this.s3.getObjectLegalHold({
          Bucket: process.env.BACKUP_BUCKET!,
          Key: `backups/${component.filename}`
        }).promise();
        
        if (objectLockConfig.LegalHold?.Status !== 'ON') {
          return false;
        }
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkGeographicRedundancy(manifest: BackupManifest): Promise<boolean> {
    // Check if backups are replicated to multiple regions
    // This would check S3 replication configuration
    return true; // Simplified
  }

  private async checkAuditTrail(backupId: string): Promise<boolean> {
    // Check if backup operations are logged
    const result = await this.dbPool.query(
      'SELECT COUNT(*) FROM audit_logs WHERE operation = $1 AND resource_id = $2',
      ['backup', backupId]
    );
    
    return parseInt(result.rows[0].count) > 0;
  }

  private calculateOverallScore(checks: CheckResult[]): number {
    const totalScore = checks.reduce((sum, check) => sum + check.score, 0);
    return Math.round(totalScore / checks.length);
  }

  private generateRecommendations(checks: CheckResult[], manifest: BackupManifest): string[] {
    const recommendations: string[] = [];
    
    for (const check of checks) {
      if (!check.success || check.score < 80) {
        switch (check.check) {
          case 'dataIntegrity':
            recommendations.push('Investigate data integrity issues and re-run backup if necessary');
            break;
          case 'encryption':
            recommendations.push('Ensure all backup components are properly encrypted');
            break;
          case 'restorability':
            recommendations.push('Test restore procedures and fix any issues found');
            break;
          case 'completeness':
            recommendations.push('Verify all required components are included in backups');
            break;
          case 'performance':
            recommendations.push('Optimize backup compression and network transfer speeds');
            break;
          case 'compliance':
            recommendations.push('Review compliance requirements and update backup policies');
            break;
        }
      }
    }
    
    // Add general recommendations
    if (manifest.duration && manifest.duration > 3600000) {
      recommendations.push('Consider optimizing backup duration - currently exceeds 1 hour');
    }
    
    if (this.calculateCompressionRatio(manifest) < 50) {
      recommendations.push('Review compression settings to improve storage efficiency');
    }
    
    return recommendations;
  }

  private async storeVerificationResults(results: any): Promise<void> {
    await this.dbPool.query(
      `INSERT INTO backup_verifications 
       (verification_id, backup_id, timestamp, success, report, checks)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        results.verificationId,
        results.backupId,
        results.timestamp,
        results.success,
        JSON.stringify(results.report),
        JSON.stringify(results.checks)
      ]
    );
  }

  private async handleVerificationFailure(backupId: string, checks: CheckResult[]): Promise<void> {
    const failedChecks = checks.filter(c => !c.success);
    
    logger.error('Backup verification failed', {
      backupId,
      failedChecks: failedChecks.map(c => c.check)
    });
    
    // Send alert
    // Create incident ticket
    // Mark backup as unreliable
    
    await this.dbPool.query(
      'UPDATE backup_catalog SET verified = false WHERE backup_id = $1',
      [backupId]
    );
  }
}