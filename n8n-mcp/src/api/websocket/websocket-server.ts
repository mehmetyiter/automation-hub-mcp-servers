import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';
import { Pool } from 'pg';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

export class WebSocketServer {
  private io: SocketIOServer;
  private db: Pool;
  private activeConnections: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

  constructor(httpServer: HTTPServer, db: Pool) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.db = db;
    
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = verify(token, process.env.JWT_SECRET!) as any;
        
        // Verify user exists and is active
        const user = await this.db.query(
          'SELECT id, role, is_active FROM users WHERE id = $1',
          [decoded.userId]
        );

        if (user.rows.length === 0 || !user.rows[0].is_active) {
          return next(new Error('Invalid or inactive user'));
        }

        socket.userId = decoded.userId;
        socket.userRole = user.rows[0].role;
        
        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`User ${socket.userId} connected with socket ${socket.id}`);
      
      this.handleConnection(socket);
      this.handleSubscriptions(socket);
      this.handleDisconnection(socket);
    });
  }

  private handleConnection(socket: AuthenticatedSocket) {
    const userId = socket.userId!;
    
    // Add to active connections
    if (!this.activeConnections.has(userId)) {
      this.activeConnections.set(userId, new Set());
    }
    this.activeConnections.get(userId)!.add(socket.id);

    // Store connection in database
    this.db.query(
      `INSERT INTO realtime_subscriptions (user_id, connection_id, subscribed_events, created_at, last_ping_at)
       VALUES ($1, $2, $3, NOW(), NOW())`,
      [userId, socket.id, ['connection']]
    );

    // Send connection confirmation
    socket.emit('connected', {
      type: 'connection',
      message: 'Successfully connected to real-time service',
      userId: userId,
      timestamp: new Date()
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
      
      // Update last ping time
      this.db.query(
        'UPDATE realtime_subscriptions SET last_ping_at = NOW() WHERE connection_id = $1',
        [socket.id]
      );
    });
  }

  private handleSubscriptions(socket: AuthenticatedSocket) {
    // Subscribe to specific event types
    socket.on('subscribe', async (data: { events: string[], filters?: any }) => {
      try {
        const { events, filters = {} } = data;
        const userId = socket.userId!;

        // Validate events
        const validEvents = [
          'credential.created',
          'credential.updated', 
          'credential.deleted',
          'usage.updated',
          'cost.alert',
          'security.alert',
          'system.notification'
        ];

        const invalidEvents = events.filter(event => !validEvents.includes(event));
        if (invalidEvents.length > 0) {
          socket.emit('error', {
            code: 'INVALID_EVENTS',
            message: `Invalid event types: ${invalidEvents.join(', ')}`,
            validEvents
          });
          return;
        }

        // Update subscription in database
        await this.db.query(
          `UPDATE realtime_subscriptions 
           SET subscribed_events = $1, filters = $2, last_ping_at = NOW()
           WHERE user_id = $3 AND connection_id = $4`,
          [events, JSON.stringify(filters), userId, socket.id]
        );

        // Join socket rooms for each event type
        events.forEach(event => {
          socket.join(`${userId}:${event}`);
        });

        socket.emit('subscribed', {
          events,
          filters,
          timestamp: new Date()
        });

      } catch (error) {
        console.error('Subscription error:', error);
        socket.emit('error', {
          code: 'SUBSCRIPTION_ERROR',
          message: 'Failed to process subscription'
        });
      }
    });

    // Unsubscribe from events
    socket.on('unsubscribe', async (data: { events: string[] }) => {
      try {
        const { events } = data;
        const userId = socket.userId!;

        // Remove from socket rooms
        events.forEach(event => {
          socket.leave(`${userId}:${event}`);
        });

        // Update database subscription
        const currentSub = await this.db.query(
          'SELECT subscribed_events FROM realtime_subscriptions WHERE user_id = $1 AND connection_id = $2',
          [userId, socket.id]
        );

        if (currentSub.rows.length > 0) {
          const currentEvents = currentSub.rows[0].subscribed_events;
          const updatedEvents = currentEvents.filter((event: string) => !events.includes(event));
          
          await this.db.query(
            'UPDATE realtime_subscriptions SET subscribed_events = $1 WHERE user_id = $2 AND connection_id = $3',
            [updatedEvents, userId, socket.id]
          );
        }

        socket.emit('unsubscribed', {
          events,
          timestamp: new Date()
        });

      } catch (error) {
        console.error('Unsubscription error:', error);
        socket.emit('error', {
          code: 'UNSUBSCRIPTION_ERROR',
          message: 'Failed to process unsubscription'
        });
      }
    });
  }

  private handleDisconnection(socket: AuthenticatedSocket) {
    socket.on('disconnect', async () => {
      const userId = socket.userId!;
      
      console.log(`User ${userId} disconnected (socket ${socket.id})`);
      
      // Remove from active connections
      if (this.activeConnections.has(userId)) {
        this.activeConnections.get(userId)!.delete(socket.id);
        if (this.activeConnections.get(userId)!.size === 0) {
          this.activeConnections.delete(userId);
        }
      }

      // Mark subscription as inactive
      await this.db.query(
        'UPDATE realtime_subscriptions SET is_active = false WHERE connection_id = $1',
        [socket.id]
      );
    });
  }

  // Public method to send message to specific user
  public sendToUser(userId: string, message: any) {
    const userConnections = this.activeConnections.get(userId);
    if (userConnections) {
      userConnections.forEach(socketId => {
        this.io.to(socketId).emit('message', message);
      });
    }
  }

  // Public method to send message to users subscribed to specific event
  public sendToSubscribers(eventType: string, message: any, userIds?: string[]) {
    if (userIds) {
      // Send to specific users
      userIds.forEach(userId => {
        this.io.to(`${userId}:${eventType}`).emit('message', message);
      });
    } else {
      // Send to all subscribers of this event type
      this.io.to(eventType).emit('message', message);
    }
  }

  // Get active connection count
  public getActiveConnectionCount(): number {
    return Array.from(this.activeConnections.values())
      .reduce((total, connections) => total + connections.size, 0);
  }

  // Get users online
  public getActiveUsers(): string[] {
    return Array.from(this.activeConnections.keys());
  }

  // Send system notification to all connected users
  public broadcastSystemNotification(message: any) {
    this.io.emit('system_notification', {
      type: 'system',
      data: message,
      timestamp: new Date()
    });
  }

  // Send notification to specific user roles
  public sendToUsersByRole(roles: string[], message: any) {
    this.activeConnections.forEach((connections, userId) => {
      // Note: In a real implementation, you'd need to store user roles
      // For now, this is a placeholder
      connections.forEach(socketId => {
        const socket = this.io.sockets.sockets.get(socketId) as AuthenticatedSocket;
        if (socket && socket.userRole && roles.includes(socket.userRole)) {
          socket.emit('message', message);
        }
      });
    });
  }

  // Cleanup inactive connections periodically
  public async cleanupInactiveConnections() {
    try {
      const cutoffTime = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      
      await this.db.query(
        'DELETE FROM realtime_subscriptions WHERE last_ping_at < $1 OR is_active = false',
        [cutoffTime]
      );
      
      console.log('Cleaned up inactive WebSocket connections');
    } catch (error) {
      console.error('Failed to cleanup inactive connections:', error);
    }
  }

  // Start periodic cleanup
  public startPeriodicCleanup() {
    // Clean up every 5 minutes
    setInterval(() => {
      this.cleanupInactiveConnections();
    }, 5 * 60 * 1000);
  }
}