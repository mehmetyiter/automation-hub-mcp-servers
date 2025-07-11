import crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt);

export interface EncryptedData {
  data: string;           // Base64 encrypted data
  iv: string;            // Initialization vector
  tag: string;           // Authentication tag
  keyVersion: number;    // For key rotation
  algorithm: string;     // Encryption algorithm used
}

export interface EncryptionContext {
  userId: string;
  provider: string;
  purpose: 'storage' | 'transit' | 'backup';
}

export interface KeyMetadata {
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

export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly saltLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly keyLength = 32;
  private readonly iterations = 100000; // PBKDF2 iterations
  
  private masterKey: Buffer;
  private keyVersion: number = 1;
  private keyCache = new Map<string, Buffer>();
  
  constructor(masterKeySecret?: string) {
    // In production, this should come from environment variables or HSM
    const secret = masterKeySecret || process.env.MASTER_KEY_SECRET;
    if (!secret) {
      throw new Error('Master key secret is required for encryption service');
    }
    
    // Derive master key from secret
    this.masterKey = crypto.createHash('sha256').update(secret).digest();
  }
  
  async encrypt(data: string, context: EncryptionContext): Promise<EncryptedData> {
    try {
      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);
      
      // Derive context-specific key
      const contextKey = await this.deriveContextKey(context);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, contextKey, iv);
      
      // Encrypt data
      const encrypted = Buffer.concat([
        cipher.update(data, 'utf8'),
        cipher.final()
      ]);
      
      // Get authentication tag
      const tag = cipher.getAuthTag();
      
      return {
        data: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        keyVersion: this.keyVersion,
        algorithm: this.algorithm
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }
  
  async decrypt(encryptedData: EncryptedData, context: EncryptionContext): Promise<string> {
    try {
      // Validate encrypted data
      if (!this.validateEncryptedData(encryptedData)) {
        throw new Error('Invalid encrypted data format');
      }
      
      // Check key version
      if (encryptedData.keyVersion !== this.keyVersion) {
        console.warn(`Key version mismatch: ${encryptedData.keyVersion} vs ${this.keyVersion}`);
        // In production, handle key rotation here
      }
      
      // Derive context-specific key
      const contextKey = await this.deriveContextKey(context);
      
      // Prepare buffers
      const encrypted = Buffer.from(encryptedData.data, 'base64');
      const iv = Buffer.from(encryptedData.iv, 'base64');
      const tag = Buffer.from(encryptedData.tag, 'base64');
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, contextKey, iv);
      decipher.setAuthTag(tag);
      
      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);
      
      return decrypted.toString('utf8');
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }
  
  private async deriveContextKey(context: EncryptionContext): Promise<Buffer> {
    // Create unique key derivation salt from context
    const contextString = `${context.userId}:${context.provider}:${context.purpose}`;
    const cacheKey = `${contextString}:v${this.keyVersion}`;
    
    // Check cache
    if (this.keyCache.has(cacheKey)) {
      return this.keyCache.get(cacheKey)!;
    }
    
    // Generate salt from context
    const salt = crypto
      .createHash('sha256')
      .update(contextString)
      .update(this.masterKey)
      .digest();
    
    // Derive key using scrypt (more secure than PBKDF2)
    const derivedKey = await scrypt(this.masterKey, salt, this.keyLength) as Buffer;
    
    // Cache the derived key
    this.keyCache.set(cacheKey, derivedKey);
    
    // Limit cache size
    if (this.keyCache.size > 1000) {
      const firstKey = this.keyCache.keys().next().value;
      this.keyCache.delete(firstKey);
    }
    
    return derivedKey;
  }
  
  async rotateKeys(): Promise<void> {
    console.log('🔄 Rotating encryption keys...');
    
    // Increment key version
    this.keyVersion++;
    
    // Clear key cache to force re-derivation
    this.keyCache.clear();
    
    // In production, this would:
    // 1. Generate new master key
    // 2. Re-encrypt all existing data with new key
    // 3. Update key metadata in secure storage
    
    console.log(`✅ Keys rotated to version ${this.keyVersion}`);
  }
  
  generateApiKeyHash(apiKey: string): string {
    // Generate a one-way hash for validation without storing the actual key
    return crypto
      .createHash('sha256')
      .update(apiKey)
      .update(this.masterKey)
      .digest('hex');
  }
  
  validateEncryptedData(encryptedData: EncryptedData): boolean {
    if (!encryptedData || typeof encryptedData !== 'object') {
      return false;
    }
    
    const requiredFields = ['data', 'iv', 'tag', 'keyVersion', 'algorithm'];
    for (const field of requiredFields) {
      if (!(field in encryptedData)) {
        return false;
      }
    }
    
    // Validate base64 encoding
    try {
      Buffer.from(encryptedData.data, 'base64');
      Buffer.from(encryptedData.iv, 'base64');
      Buffer.from(encryptedData.tag, 'base64');
    } catch {
      return false;
    }
    
    // Validate algorithm
    if (encryptedData.algorithm !== this.algorithm) {
      return false;
    }
    
    return true;
  }
  
  // Additional utility methods
  
  async encryptObject<T>(obj: T, context: EncryptionContext): Promise<EncryptedData> {
    const jsonString = JSON.stringify(obj);
    return this.encrypt(jsonString, context);
  }
  
  async decryptObject<T>(encryptedData: EncryptedData, context: EncryptionContext): Promise<T> {
    const jsonString = await this.decrypt(encryptedData, context);
    return JSON.parse(jsonString) as T;
  }
  
  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
  
  async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16);
    const hash = await scrypt(password, salt, 64) as Buffer;
    return `${salt.toString('hex')}:${hash.toString('hex')}`;
  }
  
  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    const [saltHex, hashHex] = hashedPassword.split(':');
    const salt = Buffer.from(saltHex, 'hex');
    const hash = Buffer.from(hashHex, 'hex');
    
    const providedHash = await scrypt(password, salt, 64) as Buffer;
    return crypto.timingSafeEqual(hash, providedHash);
  }
  
  // Key management methods
  
  getKeyMetadata(): KeyMetadata {
    return {
      version: this.keyVersion,
      createdAt: new Date(),
      algorithm: this.algorithm,
      derivationParams: {
        salt: 'context-based',
        iterations: this.iterations,
        keyLength: this.keyLength
      }
    };
  }
  
  clearKeyCache(): void {
    this.keyCache.clear();
  }
  
  // Secure random generators
  
  generateSecureId(): string {
    return crypto.randomBytes(16).toString('hex');
  }
  
  generateApiKey(): string {
    // Generate a secure API key in the format: prefix_randomBytes
    const prefix = 'sk';
    const randomPart = crypto.randomBytes(24).toString('base64url');
    return `${prefix}_${randomPart}`;
  }
}

// Export singleton instance
let encryptionServiceInstance: EncryptionService | null = null;

export function getEncryptionService(masterKeySecret?: string): EncryptionService {
  if (!encryptionServiceInstance) {
    encryptionServiceInstance = new EncryptionService(masterKeySecret);
  }
  return encryptionServiceInstance;
}

// Export for testing
export function resetEncryptionService(): void {
  encryptionServiceInstance = null;
}