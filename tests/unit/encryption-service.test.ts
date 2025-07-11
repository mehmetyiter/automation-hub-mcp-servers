import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { AdvancedEncryptionService } from '../../src/security/advanced-encryption-service';
import crypto from 'crypto';

describe('AdvancedEncryptionService', () => {
  let encryptionService: AdvancedEncryptionService;
  let testMasterKey: string;

  beforeEach(() => {
    testMasterKey = crypto.randomBytes(32).toString('base64');
    encryptionService = new AdvancedEncryptionService(testMasterKey);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Encryption/Decryption', () => {
    it('should encrypt and decrypt string data successfully', async () => {
      const plaintext = 'sk-test1234567890abcdef';
      const context = {
        userId: 'user-123',
        provider: 'openai',
        purpose: 'storage',
        securityLevel: 'standard' as const,
        dataClassification: 'confidential' as const
      };

      const encrypted = await encryptionService.encryptWithContext(plaintext, context);
      
      expect(encrypted).toBeDefined();
      expect(encrypted.data).not.toBe(plaintext);
      expect(encrypted.keyVersion).toBeGreaterThan(0);
      expect(encrypted.algorithm).toBe('aes-256-gcm');

      const decrypted = await encryptionService.decrypt(encrypted, context);
      expect(decrypted).toBe(plaintext);
    });

    it('should generate unique ciphertext for same plaintext', async () => {
      const plaintext = 'test-data';
      const context = {
        userId: 'user-123',
        provider: 'anthropic',
        purpose: 'storage',
        securityLevel: 'standard' as const,
        dataClassification: 'internal' as const
      };

      const encrypted1 = await encryptionService.encryptWithContext(plaintext, context);
      const encrypted2 = await encryptionService.encryptWithContext(plaintext, context);

      expect(encrypted1.data).not.toBe(encrypted2.data);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should handle empty and null data appropriately', async () => {
      const context = {
        userId: 'user-123',
        provider: 'test',
        purpose: 'storage',
        securityLevel: 'standard' as const
      };

      const emptyEncrypted = await encryptionService.encryptWithContext('', context);
      const emptyDecrypted = await encryptionService.decrypt(emptyEncrypted, context);
      expect(emptyDecrypted).toBe('');

      await expect(
        encryptionService.encryptWithContext(null as any, context)
      ).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should encrypt/decrypt within acceptable time limits', async () => {
      const largeData = crypto.randomBytes(1024).toString('base64'); // 1KB
      const context = {
        userId: 'user-123',
        provider: 'test',
        purpose: 'storage',
        securityLevel: 'standard' as const
      };

      const startEncrypt = Date.now();
      const encrypted = await encryptionService.encryptWithContext(largeData, context);
      const encryptTime = Date.now() - startEncrypt;

      const startDecrypt = Date.now();
      const decrypted = await encryptionService.decrypt(encrypted, context);
      const decryptTime = Date.now() - startDecrypt;

      expect(encryptTime).toBeLessThan(100);
      expect(decryptTime).toBeLessThan(100);
      expect(decrypted).toBe(largeData);
    });

    it('should handle concurrent encryption operations', async () => {
      const operations = 10;
      const context = {
        userId: 'user-123',
        provider: 'test',
        purpose: 'storage',
        securityLevel: 'standard' as const
      };

      const promises = Array.from({ length: operations }, (_, i) =>
        encryptionService.encryptWithContext(`data-${i}`, context)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(operations);
      expect(new Set(results.map(r => r.data)).size).toBe(operations);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid master key gracefully', async () => {
      const badService = new AdvancedEncryptionService('invalid-key');
      const context = {
        userId: 'user-123',
        provider: 'test',
        purpose: 'storage',
        securityLevel: 'standard' as const
      };

      await expect(
        badService.encryptWithContext('test', context)
      ).rejects.toThrow();
    });

    it('should validate encryption context', async () => {
      const invalidContexts = [
        { userId: '', provider: 'test', purpose: 'storage' },
        { userId: 'user', provider: '', purpose: 'storage' },
        { userId: 'user', provider: 'test' },
        null,
        {}
      ];

      for (const context of invalidContexts) {
        await expect(
          encryptionService.encryptWithContext('test', context as any)
        ).rejects.toThrow();
      }
    });
  });
});