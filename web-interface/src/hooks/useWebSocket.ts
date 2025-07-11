import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  WebSocketClient, 
  WebSocketMessage, 
  getWebSocketClient, 
  MessageHandler,
  ErrorHandler,
  ConnectionHandler 
} from '../services/websocket-client';

export interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnectOnClose?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: any | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  subscribe: (events: string[], filters?: any) => Promise<void>;
  unsubscribe: (events: string[]) => Promise<void>;
  sendMessage: (message: any) => void;
  client: WebSocketClient | null;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<any>(null);
  const clientRef = useRef<WebSocketClient | null>(null);

  const connect = useCallback(async () => {
    if (isConnecting || isConnected) return;

    setIsConnecting(true);
    setError(null);

    try {
      clientRef.current = getWebSocketClient();
      await clientRef.current.connect();
      setIsConnected(true);
      setIsConnecting(false);
      options.onConnect?.();
    } catch (err) {
      setError(err);
      setIsConnecting(false);
      options.onError?.(err);
    }
  }, [isConnecting, isConnected, options]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    options.onDisconnect?.();
  }, [options]);

  const subscribe = useCallback(async (events: string[], filters?: any) => {
    if (!clientRef.current || !isConnected) {
      throw new Error('WebSocket not connected');
    }
    return clientRef.current.subscribe(events, filters);
  }, [isConnected]);

  const unsubscribe = useCallback(async (events: string[]) => {
    if (!clientRef.current || !isConnected) {
      throw new Error('WebSocket not connected');
    }
    return clientRef.current.unsubscribe(events);
  }, [isConnected]);

  const sendMessage = useCallback((message: any) => {
    if (!clientRef.current || !isConnected) {
      throw new Error('WebSocket not connected');
    }
    // This would be implemented if the WebSocket server supports custom messages
    console.warn('Custom message sending not implemented');
  }, [isConnected]);

  useEffect(() => {
    if (options.autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [options.autoConnect]);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    sendMessage,
    client: clientRef.current
  };
}

// Hook for listening to specific WebSocket events
export function useWebSocketEvent(
  eventName: string, 
  handler: MessageHandler,
  options: UseWebSocketOptions = {}
) {
  const { client, isConnected, ...websocket } = useWebSocket(options);
  const handlerRef = useRef(handler);

  // Update handler ref when it changes
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (client && isConnected) {
      const wrappedHandler: MessageHandler = (message) => {
        handlerRef.current(message);
      };

      client.onMessage(eventName, wrappedHandler);

      return () => {
        client.offMessage(eventName, wrappedHandler);
      };
    }
  }, [client, isConnected, eventName]);

  return websocket;
}

// Hook for real-time updates with automatic subscription
export function useRealTimeUpdates(
  events: string[],
  handler: MessageHandler,
  filters?: any,
  options: UseWebSocketOptions = {}
) {
  const [subscribed, setSubscribed] = useState(false);
  const { client, isConnected, subscribe, unsubscribe, ...websocket } = useWebSocket({
    autoConnect: true,
    ...options
  });

  // Subscribe to events when connected
  useEffect(() => {
    if (isConnected && !subscribed) {
      subscribe(events, filters)
        .then(() => setSubscribed(true))
        .catch(error => console.error('Failed to subscribe to events:', error));
    }

    return () => {
      if (subscribed) {
        unsubscribe(events).catch(error => 
          console.error('Failed to unsubscribe from events:', error)
        );
      }
    };
  }, [isConnected, subscribed, events, filters, subscribe, unsubscribe]);

  // Set up message handler
  useWebSocketEvent('*', handler, { autoConnect: false });

  return {
    ...websocket,
    isConnected,
    subscribed,
    client
  };
}

// Hook for credential real-time updates
export function useCredentialUpdates(handler: MessageHandler) {
  return useRealTimeUpdates(
    ['credential.created', 'credential.updated', 'credential.deleted'],
    handler
  );
}

// Hook for usage/cost alerts
export function useCostAlerts(handler: MessageHandler) {
  return useRealTimeUpdates(
    ['cost.alert', 'usage.limit_reached', 'budget.exceeded'],
    handler
  );
}

// Hook for security alerts
export function useSecurityAlerts(handler: MessageHandler) {
  return useRealTimeUpdates(
    ['security.alert', 'security.incident', 'security.threat_detected'],
    handler
  );
}

// Hook for system notifications
export function useSystemNotifications(handler: MessageHandler) {
  return useRealTimeUpdates(
    ['system.notification', 'system.maintenance', 'system.update'],
    handler
  );
}