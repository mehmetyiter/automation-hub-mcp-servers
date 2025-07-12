import { useState, useCallback, useRef, useEffect } from 'react';

export interface NotificationAction {
  label: string;
  action: () => void;
  variant?: 'primary' | 'secondary';
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  actions?: NotificationAction[];
  autoClose?: boolean;
  duration?: number;
  persistent?: boolean;
}

export interface UseNotificationsReturn {
  notifications: Notification[];
  show: (notification: Omit<Notification, 'id'>) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  update: (id: string, updates: Partial<Notification>) => void;
}

export const useNotifications = (): UseNotificationsReturn => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const generateId = useCallback(() => {
    return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const dismiss = useCallback((id: string) => {
    // Clear any existing timeout
    const timeoutId = timeoutRefs.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutRefs.current.delete(id);
    }

    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    // Clear all timeouts
    timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
    timeoutRefs.current.clear();
    
    setNotifications([]);
  }, []);

  const show = useCallback((notificationData: Omit<Notification, 'id'>) => {
    const id = generateId();
    const notification: Notification = {
      id,
      autoClose: true,
      duration: 5000,
      ...notificationData
    };

    setNotifications(prev => [...prev, notification]);

    // Set auto-dismiss timer if enabled
    if (notification.autoClose && !notification.persistent) {
      const timeoutId = setTimeout(() => {
        dismiss(id);
      }, notification.duration);
      
      timeoutRefs.current.set(id, timeoutId);
    }

    return id;
  }, [generateId, dismiss]);

  const update = useCallback((id: string, updates: Partial<Notification>) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, ...updates }
          : notification
      )
    );
  }, []);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
      timeoutRefs.current.clear();
    };
  }, []);

  return {
    notifications,
    show,
    dismiss,
    dismissAll,
    update
  };
};

// Convenience methods for different notification types
export const createNotificationHelpers = (useNotificationsHook: UseNotificationsReturn) => {
  const { show } = useNotificationsHook;

  return {
    success: (title: string, message: string, options?: Partial<Notification>) =>
      show({ type: 'success', title, message, ...options }),
    
    error: (title: string, message: string, options?: Partial<Notification>) =>
      show({ type: 'error', title, message, persistent: true, ...options }),
    
    warning: (title: string, message: string, options?: Partial<Notification>) =>
      show({ type: 'warning', title, message, ...options }),
    
    info: (title: string, message: string, options?: Partial<Notification>) =>
      show({ type: 'info', title, message, ...options }),
  };
};