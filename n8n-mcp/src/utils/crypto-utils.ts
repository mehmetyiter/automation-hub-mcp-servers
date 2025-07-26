/**
 * Cryptographic utilities
 * This module consolidates all cryptographic and security-related methods
 */

import { randomBytes, createHash } from 'crypto';

/**
 * Generate a cryptographically secure random key
 * @param length Length of the key in bytes (default: 32)
 * @returns Base64 encoded secure key
 */
export function generateSecureKey(length: number = 32): string {
  return randomBytes(length).toString('base64');
}

/**
 * Generate a hex-encoded secure key
 * @param length Length of the key in bytes (default: 32)
 * @returns Hex encoded secure key
 */
export function generateSecureHexKey(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Hash a key using SHA-256
 * @param key The key to hash
 * @returns Hex encoded hash
 */
export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Hash a key using SHA-512
 * @param key The key to hash
 * @returns Hex encoded hash
 */
export function hashKeySha512(key: string): string {
  return createHash('sha512').update(key).digest('hex');
}

/**
 * Generate a secure token suitable for API keys
 * @param prefix Optional prefix for the token
 * @returns Secure token string
 */
export function generateApiToken(prefix?: string): string {
  const token = randomBytes(24).toString('base64url');
  return prefix ? `${prefix}_${token}` : token;
}

/**
 * Generate a secure nonce
 * @param length Length in bytes (default: 16)
 * @returns Hex encoded nonce
 */
export function generateNonce(length: number = 16): string {
  return randomBytes(length).toString('hex');
}

/**
 * Time-safe string comparison to prevent timing attacks
 * @param a First string
 * @param b Second string
 * @returns true if strings are equal
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}