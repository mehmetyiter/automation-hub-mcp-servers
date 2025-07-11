import { io, Socket } from 'socket.io-client';

export interface WebSocketMessage {
  type: string;
  event: string;
  data: any;
  timestamp: Date;
  requestId?: string;
}

export interface WebSocketClientConfig {
  url: string;
  token: string;
  autoReconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export type MessageHandler = (message: WebSocketMessage) => void;
export type ErrorHandler = (error: any) => void;
export type ConnectionHandler = () => void;

export class WebSocketClient {
  private socket: Socket | null = null;
  private config: WebSocketClientConfig;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private errorHandlers: Set<ErrorHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private disconnectionHandlers: Set<ConnectionHandler> = new Set();
  private isConnected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;

  constructor(config: WebSocketClientConfig) {
    this.config = {
      autoReconnect: true,
      reconnectAttempts: 5,
      reconnectDelay: 5000,
      ...config
    };
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.config.url, {
          auth: {
            token: this.config.token
          },
          transports: ['websocket', 'polling'],
          autoConnect: true
        });

        this.setupEventHandlers();

        this.socket.on('connect', () => {
          console.log('WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Clear reconnect timer
          if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
          }

          this.connectionHandlers.forEach(handler => handler());
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          this.isConnected = false;
          this.errorHandlers.forEach(handler => handler(error));
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  private setupEventHandlers() {
    if (!this.socket) return;

    // Handle incoming messages
    this.socket.on('message', (message: WebSocketMessage) => {
      const handlers = this.messageHandlers.get(message.event);
      if (handlers) {
        handlers.forEach(handler => handler(message));
      }

      // Also trigger generic message handlers
      const genericHandlers = this.messageHandlers.get('*');
      if (genericHandlers) {
        genericHandlers.forEach(handler => handler(message));
      }
    });

    // Handle connection confirmation
    this.socket.on('connected', (data) => {
      console.log('WebSocket connection confirmed:', data);
    });

    // Handle subscription confirmations
    this.socket.on('subscribed', (data) => {
      console.log('Subscribed to events:', data.events);
    });

    this.socket.on('unsubscribed', (data) => {
      console.log('Unsubscribed from events:', data.events);
    });

    // Handle errors
    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.errorHandlers.forEach(handler => handler(error));
    });

    // Handle disconnection
    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.isConnected = false;
      this.disconnectionHandlers.forEach(handler => handler());

      // Auto-reconnect if enabled
      if (this.config.autoReconnect && 
          this.reconnectAttempts < this.config.reconnectAttempts!) {
        this.scheduleReconnect();
      }
    });

    // Handle pong responses
    this.socket.on('pong', (data) => {
      // Connection is alive
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay! * this.reconnectAttempts;

    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(error => {
        console.error('Reconnect attempt failed:', error);
      });
    }, delay);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.isConnected = false;
  }

  // Subscribe to specific events
  subscribe(events: string[], filters?: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Subscription timeout'));
      }, 5000);

      this.socket.once('subscribed', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.socket.emit('subscribe', { events, filters });
    });
  }

  // Unsubscribe from events
  unsubscribe(events: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Unsubscription timeout'));
      }, 5000);

      this.socket.once('unsubscribed', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.socket.emit('unsubscribe', { events });
    });
  }

  // Send ping to keep connection alive
  ping() {
    if (this.socket && this.isConnected) {
      this.socket.emit('ping');
    }
  }

  // Event handlers
  onMessage(event: string, handler: MessageHandler) {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, new Set());
    }
    this.messageHandlers.get(event)!.add(handler);
  }

  offMessage(event: string, handler: MessageHandler) {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.messageHandlers.delete(event);
      }
    }
  }

  onError(handler: ErrorHandler) {
    this.errorHandlers.add(handler);
  }

  offError(handler: ErrorHandler) {
    this.errorHandlers.delete(handler);
  }

  onConnect(handler: ConnectionHandler) {
    this.connectionHandlers.add(handler);
  }

  offConnect(handler: ConnectionHandler) {
    this.connectionHandlers.delete(handler);
  }

  onDisconnect(handler: ConnectionHandler) {
    this.disconnectionHandlers.add(handler);
  }

  offDisconnect(handler: ConnectionHandler) {
    this.disconnectionHandlers.delete(handler);
  }

  // Getters
  get connected(): boolean {
    return this.isConnected;
  }

  get connectionId(): string | undefined {
    return this.socket?.id;
  }
}

// Create default WebSocket client
let defaultClient: WebSocketClient | null = null;

export const getWebSocketClient = (): WebSocketClient => {
  if (!defaultClient) {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Authentication token required for WebSocket connection');
    }

    defaultClient = new WebSocketClient({
      url: import.meta.env.VITE_WS_URL || 'ws://localhost:3001',
      token
    });
  }

  return defaultClient;
};

export const connectWebSocket = async (): Promise<WebSocketClient> => {
  const client = getWebSocketClient();
  await client.connect();
  return client;
};