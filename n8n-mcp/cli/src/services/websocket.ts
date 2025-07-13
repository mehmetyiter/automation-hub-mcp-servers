import { client as WebSocketClient } from 'websocket';
import { EventEmitter } from 'events';
import { AuthConfig } from './config';

export class WebSocketClient extends EventEmitter {
  private client: WebSocketClient;
  private connection: any;
  private auth: AuthConfig;

  constructor(auth: AuthConfig) {
    super();
    this.auth = auth;
    this.client = new WebSocketClient();
    
    this.client.on('connectFailed', (error) => {
      this.emit('error', error);
    });
    
    this.client.on('connect', (connection) => {
      this.connection = connection;
      this.emit('connect');
      
      connection.on('error', (error) => {
        this.emit('error', error);
      });
      
      connection.on('close', () => {
        this.emit('close');
      });
      
      connection.on('message', (message) => {
        if (message.type === 'utf8' && message.utf8Data) {
          try {
            const data = JSON.parse(message.utf8Data);
            this.emit('message', data);
          } catch (error) {
            this.emit('error', new Error('Failed to parse WebSocket message'));
          }
        }
      });
    });
  }

  connect(path: string): void {
    const wsUrl = this.auth.baseUrl.replace(/^http/, 'ws') + path;
    
    this.client.connect(wsUrl, undefined, undefined, {
      'Authorization': `Bearer ${this.auth.apiKey}`
    });
  }

  send(data: any): void {
    if (this.connection && this.connection.connected) {
      this.connection.sendUTF(JSON.stringify(data));
    }
  }

  disconnect(): void {
    if (this.connection) {
      this.connection.close();
    }
  }
}