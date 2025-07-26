/**
 * Centralized ID generation utilities
 * This module consolidates all ID generation methods to avoid duplication
 */

import { randomBytes } from 'crypto';

/**
 * Generate a unique workflow ID
 */
export function generateWorkflowId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString('hex');
  return `wf_${timestamp}_${random}`;
}

/**
 * Generate a unique instance ID
 */
export function generateInstanceId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString('hex');
  return `inst_${timestamp}_${random}`;
}

/**
 * Generate a unique version ID
 */
export function generateVersionId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString('hex');
  return `v_${timestamp}_${random}`;
}

/**
 * Generate a unique node ID
 */
export function generateNodeId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString('hex');
  return `node_${timestamp}_${random}`;
}

/**
 * Generate a unique audit ID
 */
export function generateAuditId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString('hex');
  return `audit_${timestamp}_${random}`;
}

/**
 * Generate a unique finding ID
 */
export function generateFindingId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString('hex');
  return `finding_${timestamp}_${random}`;
}

/**
 * Generate a unique report ID
 */
export function generateReportId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString('hex');
  return `report_${timestamp}_${random}`;
}

/**
 * Generate a UUID v4 equivalent
 */
export function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}