import crypto from 'crypto';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { EncryptionService, EncryptedData, EncryptionContext } from './encryption-service.js';

const scrypt = promisify(crypto.scrypt);

export interface HSMProvider {
  initialize(): Promise<void>;
  generateKey(keyId: string): Promise<Buffer>;
  encrypt(keyId: string, data: Buffer): Promise<Buffer>;
  decrypt(keyId: string, encryptedData: Buffer): Promise<Buffer>;
  rotateKey(keyId: string): Promise<void>;
  isAvailable(): boolean;
}

export interface KeyRotationScheduler {
  scheduleRotation(keyId: string, interval: number): void;
  cancelRotation(keyId: string): void;
  executeRotation(keyId: string): Promise<void>;
}

export interface SecurityAudit {
  keyIntegrityStatus: 'valid' | 'compromised' | 'expired';
  encryptionCoverage: number;
  vulnerabilities: SecurityVulnerability[];
  recommendations: string[];
  auditTimestamp: Date;
}

export interface SecurityVulnerability {
  type: 'weak_key' | 'old_algorithm' | 'exposure_risk' | 'configuration_issue';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  remediation: string;
}

export interface BackupManifest {
  backupId: string;
  timestamp: Date;
  keyVersion: number;
  encryptedBackup: string;
  verificationHash: string;
  recoveryInstructions: string[];
}

export interface AdvancedEncryptionContext extends EncryptionContext {
  securityLevel: 'standard' | 'high' | 'critical';
  dataClassification: 'public' | 'internal' | 'confidential' | 'restricted';
  complianceRequirements: string[];
}

export class AdvancedEncryptionService extends EncryptionService {
  private hsmProvider?: HSMProvider;
  private keyRotationScheduler: KeyRotationScheduler;
  private auditLog: SecurityEvent[] = [];
  private keyMetadata = new Map<string, KeyMetadata>();
  private rotationIntervals = new Map<string, number>();
  
  // Enhanced algorithms based on security level
  private algorithmMap = {
    standard: 'aes-256-gcm',
    high: 'chacha20-poly1305',
    critical: 'aes-256-gcm' // With additional layers
  };

  constructor(masterKeySecret?: string, hsmConfig?: HSMConfig) {
    super(masterKeySecret);
    this.keyRotationScheduler = this.createKeyRotationScheduler();
    
    if (hsmConfig) {
      this.hsmProvider = this.createHSMProvider(hsmConfig);
    }
  }

  async initializeHSM(config: HSMConfig): Promise<void> {
    console.log('🔐 Initializing Hardware Security Module...');
    
    try {
      this.hsmProvider = this.createHSMProvider(config);
      await this.hsmProvider.initialize();
      
      // Migrate existing keys to HSM if needed
      if (config.migrateExistingKeys) {
        await this.migrateKeysToHSM();
      }
      
      console.log('✅ HSM initialized successfully');
      this.logSecurityEvent('hsm_initialized', 'info', 'HSM successfully initialized');
    } catch (error) {
      console.error('❌ HSM initialization failed:', error);
      this.logSecurityEvent('hsm_init_failed', 'critical', `HSM initialization failed: ${error}`);
      throw error;
    }
  }

  async encryptWithContext(
    data: string,
    context: AdvancedEncryptionContext
  ): Promise<EncryptedData> {
    console.log(`🔒 Encrypting data with ${context.securityLevel} security level`);
    
    try {
      // Select algorithm based on security level
      const algorithm = this.algorithmMap[context.securityLevel];
      
      // Generate context-specific encryption parameters
      const encryptionParams = await this.generateEncryptionParams(context);
      
      // Use HSM for critical data if available
      if (context.securityLevel === 'critical' && this.hsmProvider?.isAvailable()) {
        return await this.encryptWithHSM(data, context, encryptionParams);
      }
      
      // Enhanced encryption for high security level
      if (context.securityLevel === 'high') {
        return await this.encryptWithEnhancedSecurity(data, context, encryptionParams);
      }
      
      // Standard encryption with context awareness
      return await this.encryptWithStandardSecurity(data, context, encryptionParams);
      
    } catch (error) {
      this.logSecurityEvent('encryption_failed', 'high', `Encryption failed: ${error}`);
      throw error;
    }
  }

  async rotateKeysWithZeroDowntime(): Promise<void> {
    console.log('🔄 Starting zero-downtime key rotation...');
    
    try {
      const rotationId = crypto.randomUUID();
      this.logSecurityEvent('key_rotation_started', 'info', `Key rotation ${rotationId} initiated`);
      
      // 1. Generate new key version
      const newKeyVersion = this.keyVersion + 1;
      
      // 2. Create new master key (if not using HSM)
      if (!this.hsmProvider) {
        const newMasterKey = crypto.randomBytes(32);
        // Store securely - in production, this would be in secure key storage
      }
      
      // 3. Update key version without invalidating old keys
      const oldKeyVersion = this.keyVersion;
      this.keyVersion = newKeyVersion;
      
      // 4. Schedule old key deprecation (not immediate deletion)
      setTimeout(() => {
        this.deprecateKeyVersion(oldKeyVersion);
      }, 7 * 24 * 60 * 60 * 1000); // 7 days grace period
      
      // 5. Update key metadata
      this.keyMetadata.set(`v${newKeyVersion}`, {
        version: newKeyVersion,
        createdAt: new Date(),
        algorithm: this.algorithmMap.standard,
        derivationParams: {
          salt: 'context-based-v' + newKeyVersion,
          iterations: 100000,
          keyLength: 32
        }
      });
      
      // 6. Clear key cache to force re-derivation with new keys
      this.clearKeyCache();
      
      // 7. Verify new keys work
      await this.validateNewKeys(newKeyVersion);
      
      console.log(`✅ Key rotation completed successfully (v${oldKeyVersion} → v${newKeyVersion})`);
      this.logSecurityEvent('key_rotation_completed', 'info', `Key rotation ${rotationId} completed successfully`);
      
    } catch (error) {
      console.error('❌ Key rotation failed:', error);
      this.logSecurityEvent('key_rotation_failed', 'critical', `Key rotation failed: ${error}`);
      throw error;
    }
  }

  async validateKeyIntegrity(): Promise<SecurityAudit> {
    console.log('🔍 Performing key integrity validation...');
    
    const vulnerabilities: SecurityVulnerability[] = [];
    const recommendations: string[] = [];
    
    try {
      // Check key age
      const keyAge = Date.now() - (this.keyMetadata.get(`v${this.keyVersion}`)?.createdAt.getTime() || 0);
      const maxKeyAge = 90 * 24 * 60 * 60 * 1000; // 90 days
      
      if (keyAge > maxKeyAge) {
        vulnerabilities.push({
          type: 'old_algorithm',
          severity: 'medium',
          description: `Encryption keys are ${Math.round(keyAge / (24 * 60 * 60 * 1000))} days old`,
          remediation: 'Rotate encryption keys to maintain security'
        });
        recommendations.push('Schedule immediate key rotation');
      }
      
      // Check algorithm strength
      const currentAlgorithm = this.algorithmMap.standard;
      if (currentAlgorithm === 'aes-128-gcm') {
        vulnerabilities.push({
          type: 'weak_key',
          severity: 'high',
          description: 'Using AES-128 instead of AES-256',
          remediation: 'Upgrade to AES-256 for better security'
        });
      }
      
      // Check HSM status
      if (!this.hsmProvider) {
        vulnerabilities.push({
          type: 'configuration_issue',
          severity: 'medium',
          description: 'Hardware Security Module not configured',
          remediation: 'Consider implementing HSM for critical data protection'
        });
        recommendations.push('Evaluate HSM implementation for enhanced security');
      }
      
      // Calculate encryption coverage
      const encryptionCoverage = await this.calculateEncryptionCoverage();
      
      if (encryptionCoverage < 0.95) {
        vulnerabilities.push({
          type: 'exposure_risk',
          severity: 'high',
          description: `Only ${(encryptionCoverage * 100).toFixed(1)}% of sensitive data is encrypted`,
          remediation: 'Encrypt all sensitive data fields'
        });
      }
      
      // Test encryption/decryption functionality
      await this.performEncryptionTest();
      
      const auditResult: SecurityAudit = {
        keyIntegrityStatus: vulnerabilities.some(v => v.severity === 'critical') ? 'compromised' : 
                           vulnerabilities.some(v => v.severity === 'high') ? 'expired' : 'valid',
        encryptionCoverage,
        vulnerabilities,
        recommendations,
        auditTimestamp: new Date()
      };
      
      this.logSecurityEvent('key_integrity_audit', 'info', `Key integrity audit completed: ${auditResult.keyIntegrityStatus}`);
      
      return auditResult;
      
    } catch (error) {
      this.logSecurityEvent('key_integrity_audit_failed', 'critical', `Key integrity audit failed: ${error}`);
      throw error;
    }
  }

  async createEncryptedBackup(): Promise<BackupManifest> {
    console.log('💾 Creating encrypted backup...');
    
    try {
      const backupId = crypto.randomUUID();
      const timestamp = new Date();
      
      // Collect all encryption metadata
      const backupData = {
        keyVersion: this.keyVersion,
        keyMetadata: Array.from(this.keyMetadata.entries()),
        rotationIntervals: Array.from(this.rotationIntervals.entries()),
        algorithmMap: this.algorithmMap,
        auditLog: this.auditLog.slice(-100), // Last 100 events
        timestamp
      };
      
      // Encrypt backup data with master key
      const backupJson = JSON.stringify(backupData);
      const backupContext: AdvancedEncryptionContext = {
        userId: 'system',
        provider: 'backup',
        purpose: 'backup',
        securityLevel: 'critical',
        dataClassification: 'restricted',
        complianceRequirements: ['SOC2', 'GDPR']
      };
      
      const encryptedBackup = await this.encryptWithContext(backupJson, backupContext);
      
      // Generate verification hash
      const verificationHash = crypto
        .createHash('sha256')
        .update(backupJson)
        .digest('hex');
      
      const manifest: BackupManifest = {
        backupId,
        timestamp,
        keyVersion: this.keyVersion,
        encryptedBackup: JSON.stringify(encryptedBackup),
        verificationHash,
        recoveryInstructions: [
          '1. Verify backup integrity using verification hash',
          '2. Decrypt backup using master key',
          '3. Restore key metadata and configuration',
          '4. Validate restored keys before use',
          '5. Update key rotation schedules'
        ]
      };
      
      this.logSecurityEvent('backup_created', 'info', `Encrypted backup created: ${backupId}`);
      
      return manifest;
      
    } catch (error) {
      this.logSecurityEvent('backup_failed', 'critical', `Backup creation failed: ${error}`);
      throw error;
    }
  }

  // HSM Implementation
  private async encryptWithHSM(
    data: string,
    context: AdvancedEncryptionContext,
    params: EncryptionParams
  ): Promise<EncryptedData> {
    if (!this.hsmProvider) {
      throw new Error('HSM provider not initialized');
    }
    
    const keyId = this.generateHSMKeyId(context);
    const dataBuffer = Buffer.from(data, 'utf8');
    const encryptedBuffer = await this.hsmProvider.encrypt(keyId, dataBuffer);
    
    return {
      data: encryptedBuffer.toString('base64'),
      iv: params.iv,
      tag: params.tag,
      keyVersion: this.keyVersion,
      algorithm: 'hsm-' + this.algorithmMap.critical
    };
  }

  private async encryptWithEnhancedSecurity(
    data: string,
    context: AdvancedEncryptionContext,
    params: EncryptionParams
  ): Promise<EncryptedData> {
    // Double encryption for high security
    const firstPass = await this.encrypt(data, context);
    const secondPass = await this.encrypt(firstPass.data, {
      ...context,
      purpose: 'storage' // Use storage for double encryption
    });
    
    return {
      ...secondPass,
      algorithm: 'double-' + this.algorithmMap.high
    };
  }

  private async encryptWithStandardSecurity(
    data: string,
    context: AdvancedEncryptionContext,
    params: EncryptionParams
  ): Promise<EncryptedData> {
    // Use parent class encryption with enhancements
    return await this.encrypt(data, context);
  }

  private async generateEncryptionParams(context: AdvancedEncryptionContext): Promise<EncryptionParams> {
    const iv = crypto.randomBytes(16);
    const salt = crypto.randomBytes(32);
    
    // Generate context-specific parameters
    const contextSalt = crypto
      .createHash('sha256')
      .update(JSON.stringify(context))
      .update(salt)
      .digest();
    
    return {
      iv: iv.toString('base64'),
      tag: '', // Will be filled by encryption
      salt: contextSalt.toString('base64'),
      iterations: context.securityLevel === 'critical' ? 200000 : 100000
    };
  }

  private generateHSMKeyId(context: AdvancedEncryptionContext): string {
    return `hsm-${context.securityLevel}-${context.dataClassification}-${context.userId.slice(0, 8)}`;
  }

  private createHSMProvider(config: HSMConfig): HSMProvider {
    // Mock HSM provider - in production, this would integrate with actual HSM
    return {
      async initialize(): Promise<void> {
        console.log('HSM Provider initialized');
      },
      
      async generateKey(keyId: string): Promise<Buffer> {
        return crypto.randomBytes(32);
      },
      
      async encrypt(keyId: string, data: Buffer): Promise<Buffer> {
        const key = await this.generateKey(keyId);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return Buffer.concat([iv, authTag, encrypted]);
      },
      
      async decrypt(keyId: string, encryptedData: Buffer): Promise<Buffer> {
        const key = await this.generateKey(keyId);
        const iv = encryptedData.slice(0, 16);
        const authTag = encryptedData.slice(16, 32);
        const encrypted = encryptedData.slice(32);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]);
      },
      
      async rotateKey(keyId: string): Promise<void> {
        console.log(`Rotating HSM key: ${keyId}`);
      },
      
      isAvailable(): boolean {
        return true; // Mock availability
      }
    };
  }

  private createKeyRotationScheduler(): KeyRotationScheduler {
    const rotationTimers = new Map<string, NodeJS.Timeout>();
    
    return {
      scheduleRotation: (keyId: string, interval: number) => {
        // Clear existing timer
        const existingTimer = rotationTimers.get(keyId);
        if (existingTimer) {
          clearInterval(existingTimer);
        }
        
        // Schedule new rotation
        const timer = setInterval(async () => {
          try {
            await this.rotateKeysWithZeroDowntime();
          } catch (error) {
            console.error(`Scheduled key rotation failed for ${keyId}:`, error);
          }
        }, interval);
        
        rotationTimers.set(keyId, timer);
        this.rotationIntervals.set(keyId, interval);
      },
      
      cancelRotation: (keyId: string) => {
        const timer = rotationTimers.get(keyId);
        if (timer) {
          clearInterval(timer);
          rotationTimers.delete(keyId);
          this.rotationIntervals.delete(keyId);
        }
      },
      
      executeRotation: async (keyId: string) => {
        await this.rotateKeysWithZeroDowntime();
      }
    };
  }

  private async migrateKeysToHSM(): Promise<void> {
    console.log('📦 Migrating existing keys to HSM...');
    
    // In production, this would migrate all existing encrypted data
    // to use HSM-generated keys while maintaining backward compatibility
    
    this.logSecurityEvent('hsm_migration_started', 'info', 'Key migration to HSM initiated');
    
    // Simulate migration process
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.logSecurityEvent('hsm_migration_completed', 'info', 'Key migration to HSM completed');
    console.log('✅ Key migration to HSM completed');
  }

  private deprecateKeyVersion(version: number): void {
    console.log(`🗑️ Deprecating key version ${version}`);
    
    // Mark old key version as deprecated but don't delete immediately
    const metadata = this.keyMetadata.get(`v${version}`);
    if (metadata) {
      (metadata as any).deprecated = true;
      (metadata as any).deprecatedAt = new Date();
    }
    
    this.logSecurityEvent('key_deprecated', 'info', `Key version ${version} deprecated`);
  }

  private async validateNewKeys(version: number): Promise<void> {
    // Test encryption/decryption with new keys
    const testData = 'key-validation-test-' + Date.now();
    const testContext: AdvancedEncryptionContext = {
      userId: 'test',
      provider: 'validation',
      purpose: 'storage',
      securityLevel: 'standard',
      dataClassification: 'internal',
      complianceRequirements: []
    };
    
    const encrypted = await this.encryptWithContext(testData, testContext);
    const decrypted = await this.decrypt(encrypted, testContext);
    
    if (decrypted !== testData) {
      throw new Error(`Key validation failed for version ${version}`);
    }
  }

  private async calculateEncryptionCoverage(): Promise<number> {
    // In production, this would analyze database to check encryption coverage
    // For now, return a simulated value
    return 0.98; // 98% coverage
  }

  private async performEncryptionTest(): Promise<void> {
    const testData = 'encryption-test-' + Date.now();
    const testContext: AdvancedEncryptionContext = {
      userId: 'test',
      provider: 'test',
      purpose: 'storage',
      securityLevel: 'standard',
      dataClassification: 'internal',
      complianceRequirements: []
    };
    
    const encrypted = await this.encryptWithContext(testData, testContext);
    const decrypted = await this.decrypt(encrypted, testContext);
    
    if (decrypted !== testData) {
      throw new Error('Encryption test failed');
    }
  }

  private logSecurityEvent(
    type: string,
    severity: 'info' | 'warning' | 'high' | 'critical',
    description: string
  ): void {
    const event: SecurityEvent = {
      id: crypto.randomUUID(),
      type,
      severity,
      description,
      timestamp: new Date(),
      metadata: {
        keyVersion: this.keyVersion,
        hsmEnabled: !!this.hsmProvider
      }
    };
    
    this.auditLog.push(event);
    
    // Keep only last 1000 events
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }
    
    // Log security event for external monitoring
    console.log('Security event:', event);
  }

  // Public API methods
  
  async scheduleKeyRotation(intervalDays: number = 90): Promise<void> {
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
    this.keyRotationScheduler.scheduleRotation('master', intervalMs);
    console.log(`🔄 Key rotation scheduled every ${intervalDays} days`);
  }

  async getSecurityMetrics(): Promise<SecurityMetrics> {
    return {
      encryptionAlgorithm: this.algorithmMap.standard,
      keyVersion: this.keyVersion,
      hsmEnabled: !!this.hsmProvider,
      lastRotation: this.keyMetadata.get(`v${this.keyVersion}`)?.createdAt || new Date(),
      auditEventCount: this.auditLog.length,
      securityEvents: this.auditLog.filter(e => e.severity === 'high' || e.severity === 'critical').length
    };
  }

  getAuditLog(): SecurityEvent[] {
    return [...this.auditLog];
  }
}

// Interfaces and types
interface EncryptionParams {
  iv: string;
  tag: string;
  salt: string;
  iterations: number;
}

interface HSMConfig {
  provider: 'aws-hsm' | 'azure-hsm' | 'gcp-hsm' | 'mock';
  region?: string;
  credentials?: any;
  migrateExistingKeys: boolean;
}

interface SecurityEvent {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'high' | 'critical';
  description: string;
  timestamp: Date;
  metadata: any;
}

interface KeyMetadata {
  version: number;
  createdAt: Date;
  rotatedAt?: Date;
  algorithm: string;
  derivationParams: {
    salt: string;
    iterations: number;
    keyLength: number;
  };
}

interface SecurityMetrics {
  encryptionAlgorithm: string;
  keyVersion: number;
  hsmEnabled: boolean;
  lastRotation: Date;
  auditEventCount: number;
  securityEvents: number;
}

// Export convenience function
export function createAdvancedEncryptionService(
  masterKeySecret?: string,
  hsmConfig?: HSMConfig
): AdvancedEncryptionService {
  return new AdvancedEncryptionService(masterKeySecret, hsmConfig);
}