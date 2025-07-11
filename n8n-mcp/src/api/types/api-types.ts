export interface APIKey {
  id: string;
  userId: string;
  keyName: string;
  keyPrefix: string;
  scopes: string[];
  rateLimit: number;
  dailyLimit: number;
  isActive: boolean;
  expiresAt?: Date;
  lastUsedAt?: Date;
  usageCount: number;
  createdAt: Date;
  metadata: Record<string, any>;
}

export interface APIUsageLog {
  id: string;
  apiKeyId?: string;
  userId?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  requestSizeBytes: number;
  responseSizeBytes: number;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  errorMessage?: string;
  createdAt: Date;
}

export interface WebhookConfig {
  id: string;
  userId: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  retryCount: number;
  timeoutMs: number;
  lastTriggeredAt?: Date;
  successCount: number;
  failureCount: number;
  metadata: Record<string, any>;
}

export interface RateLimitConfig {
  windowSizeMs: number;
  maxRequests: number;
  burstAllowance?: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: any) => string;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  meta?: Record<string, any>;
}

export interface WebSocketMessage {
  type: string;
  event: string;
  data: any;
  timestamp: Date;
  requestId?: string;
}

export interface RealtimeEvent {
  type: string;
  userId: string;
  data: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}