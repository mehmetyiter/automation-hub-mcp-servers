import { WebSocket } from 'ws';
import { Redis } from 'ioredis';
import { LoggingService } from '../../src/observability/logging';
import { MetricsService } from '../../src/observability/metrics';

const logger = LoggingService.getInstance();
const metrics = MetricsService.getInstance();

export interface Connection {
  id: string;
  ws: WebSocket;
  userId?: string;
  apiKeyId?: string;
  scopes: string[];
  connectedAt: Date;
  lastActivity: Date;
  lastPong?: Date;
  metadata: ConnectionMetadata;
  subscriptions: Set<string>;
  rateLimitData: RateLimitData;
}

export interface ConnectionMetadata {
  ip: string;
  userAgent?: string;
  origin?: string;
  protocol?: string;
  room?: string;
  tags: string[];
  plan: string;
}

export interface RateLimitData {
  messageCount: number;
  lastMinuteMessages: number;
  subscriptionCount: number;
  bandwidthUsed: number; // in bytes
  resetTime: Date;
}

export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  authenticatedConnections: number;
  connectionsByPlan: Record<string, number>;
  connectionsByRoom: Record<string, number>;
  averageConnectionTime: number;
  messagesPerSecond: number;
  bandwidthUsage: number;
}

export class ConnectionManager {
  private connections: Map<string, Connection> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();
  private roomConnections: Map<string, Set<string>> = new Map();
  private redis: Redis;
  private cleanupInterval: NodeJS.Timeout;
  private metricsInterval: NodeJS.Timeout;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3
    });

    this.startCleanupTask();
    this.startMetricsCollection();
  }

  async registerConnection(ws: WebSocket, req: any): Promise<Connection> {
    const connectionId = this.generateConnectionId();
    
    const connection: Connection = {
      id: connectionId,
      ws,
      userId: req.userId,
      apiKeyId: req.apiKeyId,
      scopes: req.scopes || [],
      connectedAt: new Date(),
      lastActivity: new Date(),
      metadata: {
        ip: this.getClientIP(req),
        userAgent: req.headers['user-agent'],
        origin: req.headers.origin,
        protocol: req.headers['sec-websocket-protocol'],
        room: req.query?.room as string,
        tags: [],
        plan: req.plan || 'free'
      },
      subscriptions: new Set(),
      rateLimitData: {
        messageCount: 0,
        lastMinuteMessages: 0,
        subscriptionCount: 0,
        bandwidthUsed: 0,
        resetTime: new Date(Date.now() + 60000) // 1 minute from now
      }
    };

    // Store connection
    this.connections.set(connectionId, connection);

    // Index by user
    if (connection.userId) {
      if (!this.userConnections.has(connection.userId)) {
        this.userConnections.set(connection.userId, new Set());
      }
      this.userConnections.get(connection.userId)!.add(connectionId);
    }

    // Index by room
    if (connection.metadata.room) {
      if (!this.roomConnections.has(connection.metadata.room)) {
        this.roomConnections.set(connection.metadata.room, new Set());
      }
      this.roomConnections.get(connection.metadata.room)!.add(connectionId);
    }

    // Store in Redis for cluster coordination
    await this.persistConnection(connection);

    logger.info('WebSocket connection registered', {
      connectionId,
      userId: connection.userId,
      ip: connection.metadata.ip,
      room: connection.metadata.room
    });

    metrics.recordMetric('websocket', 'connectionRegistered', 1, {
      userId: connection.userId || 'anonymous',
      plan: connection.metadata.plan,
      room: connection.metadata.room || 'none'
    });

    return connection;
  }

  async unregisterConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    // Remove from indexes
    if (connection.userId) {
      const userConns = this.userConnections.get(connection.userId);
      if (userConns) {
        userConns.delete(connectionId);
        if (userConns.size === 0) {
          this.userConnections.delete(connection.userId);
        }
      }
    }

    if (connection.metadata.room) {
      const roomConns = this.roomConnections.get(connection.metadata.room);
      if (roomConns) {
        roomConns.delete(connectionId);
        if (roomConns.size === 0) {
          this.roomConnections.delete(connection.metadata.room);
        }
      }
    }

    // Remove from main storage
    this.connections.delete(connectionId);

    // Remove from Redis
    await this.removePersistedConnection(connectionId);

    const duration = Date.now() - connection.connectedAt.getTime();
    
    logger.info('WebSocket connection unregistered', {
      connectionId,
      userId: connection.userId,
      duration
    });

    metrics.recordMetric('websocket', 'connectionUnregistered', 1, {
      userId: connection.userId || 'anonymous',
      duration: duration.toString(),
      plan: connection.metadata.plan
    });
  }

  getConnection(connectionId: string): Connection | null {
    return this.connections.get(connectionId) || null;
  }

  getUserConnections(userId: string): Connection[] {
    const connectionIds = this.userConnections.get(userId) || new Set();
    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter(conn => conn !== undefined) as Connection[];
  }

  getRoomConnections(room: string): Connection[] {
    const connectionIds = this.roomConnections.get(room) || new Set();
    return Array.from(connectionIds)
      .map(id => this.connections.get(id))
      .filter(conn => conn !== undefined) as Connection[];
  }

  async updateLastActivity(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = new Date();
      
      // Update rate limiting data
      connection.rateLimitData.messageCount++;
      connection.rateLimitData.lastMinuteMessages++;
      
      // Reset minute counter if needed
      if (Date.now() > connection.rateLimitData.resetTime.getTime()) {
        connection.rateLimitData.lastMinuteMessages = 1;
        connection.rateLimitData.resetTime = new Date(Date.now() + 60000);
      }
    }
  }

  async addSubscription(connectionId: string, subscriptionId: string): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    // Check subscription limits
    const maxSubscriptions = this.getMaxSubscriptions(connection.metadata.plan);
    if (connection.subscriptions.size >= maxSubscriptions) {
      logger.warn('Subscription limit exceeded', {
        connectionId,
        userId: connection.userId,
        currentSubscriptions: connection.subscriptions.size,
        maxSubscriptions
      });
      return false;
    }

    connection.subscriptions.add(subscriptionId);
    connection.rateLimitData.subscriptionCount = connection.subscriptions.size;

    logger.debug('Subscription added', {
      connectionId,
      subscriptionId,
      totalSubscriptions: connection.subscriptions.size
    });

    return true;
  }

  async removeSubscription(connectionId: string, subscriptionId: string): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    const removed = connection.subscriptions.delete(subscriptionId);
    connection.rateLimitData.subscriptionCount = connection.subscriptions.size;

    if (removed) {
      logger.debug('Subscription removed', {
        connectionId,
        subscriptionId,
        totalSubscriptions: connection.subscriptions.size
      });
    }

    return removed;
  }

  async checkRateLimit(connectionId: string, messageSize: number = 0): Promise<{
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  }> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return { allowed: false, reason: 'Connection not found' };
    }

    const limits = this.getRateLimits(connection.metadata.plan);
    
    // Check message rate
    if (connection.rateLimitData.lastMinuteMessages >= limits.messagesPerMinute) {
      return {
        allowed: false,
        reason: 'Message rate limit exceeded',
        retryAfter: Math.ceil((connection.rateLimitData.resetTime.getTime() - Date.now()) / 1000)
      };
    }

    // Check bandwidth
    connection.rateLimitData.bandwidthUsed += messageSize;
    if (connection.rateLimitData.bandwidthUsed > limits.bandwidthPerMinute) {
      return {
        allowed: false,
        reason: 'Bandwidth limit exceeded',
        retryAfter: Math.ceil((connection.rateLimitData.resetTime.getTime() - Date.now()) / 1000)
      };
    }

    // Check subscription limit
    if (connection.subscriptions.size > limits.maxSubscriptions) {
      return {
        allowed: false,
        reason: 'Subscription limit exceeded'
      };
    }

    return { allowed: true };
  }

  async broadcastToRoom(room: string, message: any, excludeConnectionId?: string): Promise<number> {
    const connections = this.getRoomConnections(room);
    let sentCount = 0;

    const messageData = JSON.stringify(message);
    const messageSize = Buffer.byteLength(messageData, 'utf8');

    for (const connection of connections) {
      if (excludeConnectionId && connection.id === excludeConnectionId) {
        continue;
      }

      if (connection.ws.readyState === WebSocket.OPEN) {
        try {
          connection.ws.send(messageData);
          connection.rateLimitData.bandwidthUsed += messageSize;
          sentCount++;
        } catch (error) {
          logger.error('Failed to send message to connection', {
            connectionId: connection.id,
            error: error.message
          });
        }
      }
    }

    metrics.recordMetric('websocket', 'roomBroadcast', 1, {
      room,
      connectionCount: connections.length.toString(),
      sentCount: sentCount.toString()
    });

    return sentCount;
  }

  async broadcastToUser(userId: string, message: any): Promise<number> {
    const connections = this.getUserConnections(userId);
    let sentCount = 0;

    const messageData = JSON.stringify(message);
    const messageSize = Buffer.byteLength(messageData, 'utf8');

    for (const connection of connections) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        try {
          connection.ws.send(messageData);
          connection.rateLimitData.bandwidthUsed += messageSize;
          sentCount++;
        } catch (error) {
          logger.error('Failed to send message to user connection', {
            connectionId: connection.id,
            userId,
            error: error.message
          });
        }
      }
    }

    metrics.recordMetric('websocket', 'userBroadcast', 1, {
      userId,
      connectionCount: connections.length.toString(),
      sentCount: sentCount.toString()
    });

    return sentCount;
  }

  async sendToConnection(connectionId: string, message: any): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const messageData = JSON.stringify(message);
      const messageSize = Buffer.byteLength(messageData, 'utf8');
      
      connection.ws.send(messageData);
      connection.rateLimitData.bandwidthUsed += messageSize;
      
      return true;
    } catch (error) {
      logger.error('Failed to send message to connection', {
        connectionId,
        error: error.message
      });
      return false;
    }
  }

  getStats(): ConnectionStats {
    const now = Date.now();
    const connections = Array.from(this.connections.values());
    
    const totalConnections = connections.length;
    const activeConnections = connections.filter(
      conn => now - conn.lastActivity.getTime() < 300000 // 5 minutes
    ).length;
    
    const authenticatedConnections = connections.filter(
      conn => conn.userId
    ).length;

    const connectionsByPlan: Record<string, number> = {};
    const connectionsByRoom: Record<string, number> = {};
    let totalConnectionTime = 0;
    let totalMessages = 0;
    let totalBandwidth = 0;

    connections.forEach(conn => {
      // Plan stats
      connectionsByPlan[conn.metadata.plan] = (connectionsByPlan[conn.metadata.plan] || 0) + 1;
      
      // Room stats
      if (conn.metadata.room) {
        connectionsByRoom[conn.metadata.room] = (connectionsByRoom[conn.metadata.room] || 0) + 1;
      }
      
      // Aggregate stats
      totalConnectionTime += now - conn.connectedAt.getTime();
      totalMessages += conn.rateLimitData.messageCount;
      totalBandwidth += conn.rateLimitData.bandwidthUsed;
    });

    const averageConnectionTime = totalConnections > 0 ? totalConnectionTime / totalConnections : 0;
    const messagesPerSecond = totalMessages / Math.max(1, (now - this.getOldestConnectionTime()) / 1000);

    return {
      totalConnections,
      activeConnections,
      authenticatedConnections,
      connectionsByPlan,
      connectionsByRoom,
      averageConnectionTime,
      messagesPerSecond,
      bandwidthUsage: totalBandwidth
    };
  }

  private generateConnectionId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getClientIP(req: any): string {
    return req.headers['x-forwarded-for']?.split(',')[0] ||
           req.headers['x-real-ip'] ||
           req.socket.remoteAddress ||
           'unknown';
  }

  private getMaxSubscriptions(plan: string): number {
    switch (plan) {
      case 'enterprise': return 500;
      case 'pro': return 100;
      case 'free': 
      default: return 10;
    }
  }

  private getRateLimits(plan: string): {
    messagesPerMinute: number;
    bandwidthPerMinute: number; // bytes
    maxSubscriptions: number;
  } {
    switch (plan) {
      case 'enterprise':
        return {
          messagesPerMinute: 1000,
          bandwidthPerMinute: 10 * 1024 * 1024, // 10MB
          maxSubscriptions: 500
        };
      case 'pro':
        return {
          messagesPerMinute: 300,
          bandwidthPerMinute: 2 * 1024 * 1024, // 2MB
          maxSubscriptions: 100
        };
      case 'free':
      default:
        return {
          messagesPerMinute: 60,
          bandwidthPerMinute: 512 * 1024, // 512KB
          maxSubscriptions: 10
        };
    }
  }

  private async persistConnection(connection: Connection): Promise<void> {
    try {
      const connectionData = {
        id: connection.id,
        userId: connection.userId,
        connectedAt: connection.connectedAt.toISOString(),
        metadata: JSON.stringify(connection.metadata),
        subscriptionCount: connection.subscriptions.size
      };

      await this.redis.setex(
        `ws_connection:${connection.id}`,
        3600, // 1 hour TTL
        JSON.stringify(connectionData)
      );

      // Add to global connection set
      await this.redis.sadd('ws_connections', connection.id);
      
    } catch (error) {
      logger.error('Failed to persist connection', {
        connectionId: connection.id,
        error: error.message
      });
    }
  }

  private async removePersistedConnection(connectionId: string): Promise<void> {
    try {
      await this.redis.del(`ws_connection:${connectionId}`);
      await this.redis.srem('ws_connections', connectionId);
    } catch (error) {
      logger.error('Failed to remove persisted connection', {
        connectionId,
        error: error.message
      });
    }
  }

  private startCleanupTask(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections();
    }, 60000); // Run every minute
  }

  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 30000); // Run every 30 seconds
  }

  private cleanupStaleConnections(): void {
    const now = Date.now();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    
    const staleConnections: string[] = [];
    
    this.connections.forEach((connection, connectionId) => {
      // Check if connection is stale
      if (now - connection.lastActivity.getTime() > staleThreshold ||
          connection.ws.readyState === WebSocket.CLOSED ||
          connection.ws.readyState === WebSocket.CLOSING) {
        staleConnections.push(connectionId);
      }
    });

    // Remove stale connections
    staleConnections.forEach(connectionId => {
      logger.info('Cleaning up stale connection', { connectionId });
      this.unregisterConnection(connectionId);
    });

    if (staleConnections.length > 0) {
      metrics.recordMetric('websocket', 'staleConnectionsRemoved', staleConnections.length);
    }
  }

  private collectMetrics(): void {
    const stats = this.getStats();
    
    metrics.recordMetric('websocket', 'totalConnections', stats.totalConnections);
    metrics.recordMetric('websocket', 'activeConnections', stats.activeConnections);
    metrics.recordMetric('websocket', 'authenticatedConnections', stats.authenticatedConnections);
    metrics.recordMetric('websocket', 'averageConnectionTime', stats.averageConnectionTime);
    metrics.recordMetric('websocket', 'messagesPerSecond', stats.messagesPerSecond);
    metrics.recordMetric('websocket', 'bandwidthUsage', stats.bandwidthUsage);

    // Record plan distribution
    Object.entries(stats.connectionsByPlan).forEach(([plan, count]) => {
      metrics.recordMetric('websocket', 'connectionsByPlan', count, { plan });
    });
  }

  private getOldestConnectionTime(): number {
    let oldest = Date.now();
    this.connections.forEach(conn => {
      oldest = Math.min(oldest, conn.connectedAt.getTime());
    });
    return oldest;
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    this.redis.disconnect();
  }
}