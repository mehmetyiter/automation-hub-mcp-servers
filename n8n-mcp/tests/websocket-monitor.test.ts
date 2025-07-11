import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RealTimePerformanceMonitor, MonitoringOptions } from '../src/code-generation/performance/websocket-monitor';
import { RealTimeMetrics } from '../src/code-generation/performance/performance-profiler';
import * as WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');

describe('RealTimePerformanceMonitor', () => {
  let monitor: RealTimePerformanceMonitor;
  let mockWsServer: any;
  let mockClients: WebSocket[];

  beforeEach(() => {
    jest.useFakeTimers();
    monitor = new RealTimePerformanceMonitor();
    mockClients = [];
    
    // Mock WebSocket.Server
    mockWsServer = {
      on: jest.fn((event, handler) => {
        if (event === 'connection') {
          // Simulate client connections
          setTimeout(() => {
            const mockClient = createMockWebSocketClient();
            mockClients.push(mockClient);
            handler(mockClient, { url: '/test' });
          }, 100);
        }
      }),
      close: jest.fn(),
      address: jest.fn().mockReturnValue({ port: 8081 })
    };
    
    (WebSocket as any).Server = jest.fn().mockImplementation(() => mockWsServer);
  });

  afterEach(async () => {
    await monitor.shutdown();
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  function createMockWebSocketClient(): any {
    return {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      on: jest.fn(),
      close: jest.fn()
    };
  }

  describe('WebSocket Server', () => {
    it('should start WebSocket server on specified port', async () => {
      await monitor.startWebSocketServer(8082);
      
      expect(WebSocket.Server).toHaveBeenCalledWith({ port: 8082 });
      expect(mockWsServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should handle client connections', async () => {
      await monitor.startWebSocketServer();
      
      // Simulate connection
      jest.advanceTimersByTime(100);
      
      expect(mockClients.length).toBe(1);
      expect(mockClients[0].on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockClients[0].on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockClients[0].on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should send welcome message on connection', async () => {
      await monitor.startWebSocketServer();
      jest.advanceTimersByTime(100);
      
      expect(mockClients[0].send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockClients[0].send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('metrics_update');
      expect(sentMessage.data.message).toContain('Connected');
    });
  });

  describe('Monitoring Sessions', () => {
    it('should start monitoring session', async () => {
      const options: MonitoringOptions = {
        interval: 500,
        bufferSize: 100,
        enableAlerts: true,
        thresholds: {
          memory: { heapUsed: 100 * 1024 * 1024 },
          cpu: { total: 80 }
        }
      };
      
      const sessionId = await monitor.startWebSocketMonitoring('test-code', options);
      
      expect(sessionId).toMatch(/^ws_monitor_test-code_\d+$/);
      expect(monitor.getActiveSessions()).toContain(sessionId);
    });

    it('should calculate optimal buffer size based on sessions', async () => {
      // Start multiple sessions
      const sessions = [];
      for (let i = 0; i < 5; i++) {
        const sessionId = await monitor.startWebSocketMonitoring(`code-${i}`);
        sessions.push(sessionId);
      }
      
      // Buffer size should adapt
      const sessionInfo = monitor.getSessionInfo(sessions[4]);
      expect(sessionInfo?.bufferSize).toBeDefined();
      expect(sessionInfo?.bufferSize).toBeLessThanOrEqual(1000);
    });

    it('should stop monitoring session', async () => {
      const sessionId = await monitor.startWebSocketMonitoring('test-code');
      
      await monitor.stopWebSocketMonitoring(sessionId);
      
      expect(monitor.getActiveSessions()).not.toContain(sessionId);
      expect(monitor.getSessionInfo(sessionId)).toBeUndefined();
    });

    it('should collect metrics periodically', async () => {
      const sessionId = await monitor.startWebSocketMonitoring('test-code', {
        interval: 100
      });
      
      // Wait for several intervals
      jest.advanceTimersByTime(350);
      
      const history = monitor.getMetricsHistory('test-code');
      expect(history.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Client Management', () => {
    beforeEach(async () => {
      await monitor.startWebSocketServer();
      jest.advanceTimersByTime(100);
    });

    it('should handle client subscription to session', async () => {
      const sessionId = await monitor.startWebSocketMonitoring('test-code');
      const client = mockClients[0];
      
      const subscribed = monitor.subscribeToSession(sessionId, client);
      
      expect(subscribed).toBe(true);
      expect(client.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"metrics_update"')
      );
    });

    it('should handle subscription to non-existent session', () => {
      const client = mockClients[0];
      
      const subscribed = monitor.subscribeToSession('invalid-session', client);
      
      expect(subscribed).toBe(false);
      expect(client.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });

    it('should unsubscribe client from session', async () => {
      const sessionId = await monitor.startWebSocketMonitoring('test-code');
      const client = mockClients[0];
      
      monitor.subscribeToSession(sessionId, client);
      monitor.unsubscribeFromSession(sessionId, client);
      
      const session = monitor.getSessionInfo(sessionId);
      expect(session?.clients.has(client)).toBe(false);
    });

    it('should handle client disconnection', async () => {
      const sessionId = await monitor.startWebSocketMonitoring('test-code');
      const client = mockClients[0];
      
      monitor.subscribeToSession(sessionId, client);
      
      // Simulate disconnect
      const closeHandler = client.on.mock.calls.find(call => call[0] === 'close');
      if (closeHandler) closeHandler[1]();
      
      const session = monitor.getSessionInfo(sessionId);
      expect(session?.clients.has(client)).toBe(false);
    });
  });

  describe('Metrics Broadcasting', () => {
    let sessionId: string;
    let client: any;

    beforeEach(async () => {
      await monitor.startWebSocketServer();
      jest.advanceTimersByTime(100);
      
      sessionId = await monitor.startWebSocketMonitoring('test-code', {
        interval: 100
      });
      
      client = mockClients[0];
      monitor.subscribeToSession(sessionId, client);
      client.send.mockClear();
    });

    it('should broadcast metrics to subscribed clients', () => {
      jest.advanceTimersByTime(100);
      
      expect(client.send).toHaveBeenCalled();
      const message = JSON.parse(client.send.mock.calls[0][0]);
      expect(message.type).toBe('metrics_update');
      expect(message.sessionId).toBe(sessionId);
      expect(message.data).toHaveProperty('timestamp');
      expect(message.data).toHaveProperty('memory');
      expect(message.data).toHaveProperty('cpu');
    });

    it('should not send to closed connections', () => {
      client.readyState = WebSocket.CLOSED;
      
      jest.advanceTimersByTime(100);
      
      expect(client.send).not.toHaveBeenCalled();
    });
  });

  describe('Threshold Alerts', () => {
    it('should generate alerts when thresholds are exceeded', async () => {
      const alerts: any[] = [];
      monitor.on('alert', (alert) => alerts.push(alert));
      
      const sessionId = await monitor.startWebSocketMonitoring('test-code', {
        interval: 100,
        enableAlerts: true,
        thresholds: {
          memory: { heapUsed: 1 }, // Very low threshold to trigger
          cpu: { total: 0.1 }
        }
      });
      
      jest.advanceTimersByTime(100);
      
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].type).toMatch(/memory|cpu/);
      expect(alerts[0].severity).toBeDefined();
    });

    it('should broadcast alerts to clients', async () => {
      await monitor.startWebSocketServer();
      jest.advanceTimersByTime(100);
      
      const sessionId = await monitor.startWebSocketMonitoring('test-code', {
        interval: 100,
        enableAlerts: true,
        thresholds: {
          eventLoopLag: 1 // Low threshold
        }
      });
      
      const client = mockClients[0];
      monitor.subscribeToSession(sessionId, client);
      client.send.mockClear();
      
      jest.advanceTimersByTime(100);
      
      const messages = client.send.mock.calls.map(call => JSON.parse(call[0]));
      const alertMessage = messages.find(m => m.type === 'alert');
      
      if (alertMessage) {
        expect(alertMessage.data.type).toBe('eventloop');
        expect(alertMessage.data.severity).toBeDefined();
      }
    });
  });

  describe('Memory Leak Detection', () => {
    it('should detect memory leaks with exponential smoothing', async () => {
      // Create history with increasing memory usage
      const history: any[] = [];
      for (let i = 0; i < 20; i++) {
        history.push({
          timestamp: Date.now() - (20 - i) * 1000,
          memory: {
            heapUsed: 50 * 1024 * 1024 + i * 5 * 1024 * 1024, // Growing by 5MB each time
            heapTotal: 200 * 1024 * 1024,
            rss: 300 * 1024 * 1024,
            external: 10 * 1024 * 1024
          },
          cpu: { user: 100, system: 50, total: 150 }
        });
      }
      
      // Inject history
      (monitor as any).metricsHistory.set('test-code', history);
      
      const analysis = await monitor.detectMemoryLeaks('test-code', '1m');
      
      expect(analysis.leaksDetected.length).toBeGreaterThan(0);
      expect(analysis.growthRate).toBeGreaterThan(0);
      expect(analysis.projectedLeakage.in1Hour).toBeGreaterThan(history[history.length - 1].memory.heapUsed);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
    });

    it('should apply exponential smoothing correctly', () => {
      const data = [
        { memory: { heapUsed: 100 }, timestamp: 1000 },
        { memory: { heapUsed: 110 }, timestamp: 2000 },
        { memory: { heapUsed: 105 }, timestamp: 3000 },
        { memory: { heapUsed: 120 }, timestamp: 4000 },
        { memory: { heapUsed: 115 }, timestamp: 5000 }
      ];
      
      const smoothed = (monitor as any).applyExponentialSmoothing(data, 0.3);
      
      expect(smoothed.length).toBe(5);
      expect(smoothed[0]).toBe(100);
      
      // Check smoothing effect
      for (let i = 1; i < smoothed.length; i++) {
        expect(smoothed[i]).toBeGreaterThan(0);
        expect(smoothed[i]).toBeLessThan(150);
      }
    });

    it('should calculate linear regression for trend analysis', () => {
      const data = [100, 120, 140, 160, 180]; // Perfect linear growth
      
      const regression = (monitor as any).calculateLinearRegression(data);
      
      expect(regression.slope).toBeCloseTo(20, 1);
      expect(regression.r2).toBeCloseTo(1, 2); // Perfect fit
    });

    it('should detect statistical anomalies', () => {
      const data = [100, 102, 98, 101, 99, 200, 103, 97]; // 200 is anomaly
      
      const anomalies = (monitor as any).detectStatisticalAnomalies(data);
      
      expect(anomalies).toContain(5); // Index of 200
    });

    it('should handle insufficient data for leak detection', async () => {
      const analysis = await monitor.detectMemoryLeaks('new-code', '1m');
      
      expect(analysis.leaksDetected).toHaveLength(0);
      expect(analysis.growthRate).toBe(0);
      expect(analysis.recommendations[0]).toContain('Insufficient data');
    });
  });

  describe('WebSocket Message Handling', () => {
    let client: any;

    beforeEach(async () => {
      await monitor.startWebSocketServer();
      jest.advanceTimersByTime(100);
      client = mockClients[0];
      
      // Setup message handler
      const messageHandler = client.on.mock.calls.find(call => call[0] === 'message');
      client.simulateMessage = (data: any) => {
        if (messageHandler) {
          messageHandler[1](JSON.stringify(data));
        }
      };
    });

    it('should handle subscribe message', async () => {
      const sessionId = await monitor.startWebSocketMonitoring('test-code');
      client.send.mockClear();
      
      client.simulateMessage({
        type: 'subscribe',
        sessionId
      });
      
      expect(client.send).toHaveBeenCalled();
      const response = JSON.parse(client.send.mock.calls[0][0]);
      expect(response.data.buffer).toBeDefined();
    });

    it('should handle unsubscribe message', async () => {
      const sessionId = await monitor.startWebSocketMonitoring('test-code');
      monitor.subscribeToSession(sessionId, client);
      
      client.simulateMessage({
        type: 'unsubscribe',
        sessionId
      });
      
      const session = monitor.getSessionInfo(sessionId);
      expect(session?.clients.has(client)).toBe(false);
    });

    it('should handle get_sessions message', () => {
      client.send.mockClear();
      
      client.simulateMessage({
        type: 'get_sessions'
      });
      
      expect(client.send).toHaveBeenCalled();
      const response = JSON.parse(client.send.mock.calls[0][0]);
      expect(response.data.activeSessions).toBeDefined();
      expect(Array.isArray(response.data.activeSessions)).toBe(true);
    });

    it('should handle unknown message type', () => {
      client.send.mockClear();
      
      client.simulateMessage({
        type: 'unknown_type'
      });
      
      expect(client.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"error"')
      );
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate event loop lag', async () => {
      const lag = await (monitor as any).measureEventLoopLag();
      
      expect(lag).toBeGreaterThanOrEqual(0);
      expect(lag).toBeLessThan(1000); // Should be less than 1 second
    });

    it('should track GC stats', () => {
      const stats = (monitor as any).getGCStats();
      
      expect(stats).toHaveProperty('forced');
      expect(stats).toHaveProperty('duration');
      expect(stats).toHaveProperty('type');
    });

    it('should calculate performance trends', () => {
      const current = {
        memory: { heapUsed: 120 * 1024 * 1024 },
        cpu: { total: 150 }
      };
      
      const previous = {
        timestamp: Date.now() - 1000,
        memory: { heapUsed: 100 * 1024 * 1024 },
        cpu: { total: 100 }
      };
      
      const trends = (monitor as any).calculateTrends(current, previous);
      
      expect(trends.memory.direction).toBe('increasing');
      expect(trends.memory.rate).toBeGreaterThan(0);
      expect(trends.cpu.direction).toBe('increasing');
    });
  });

  describe('Cleanup and Shutdown', () => {
    it('should stop all active sessions on shutdown', async () => {
      const sessions = [];
      for (let i = 0; i < 3; i++) {
        sessions.push(await monitor.startWebSocketMonitoring(`code-${i}`));
      }
      
      await monitor.shutdown();
      
      expect(monitor.getActiveSessions()).toHaveLength(0);
      sessions.forEach(sessionId => {
        expect(monitor.getSessionInfo(sessionId)).toBeUndefined();
      });
    });

    it('should close WebSocket server on shutdown', async () => {
      await monitor.startWebSocketServer();
      
      await monitor.shutdown();
      
      expect(mockWsServer.close).toHaveBeenCalled();
    });

    it('should clear metrics history on shutdown', async () => {
      await monitor.startWebSocketMonitoring('test-code');
      jest.advanceTimersByTime(500);
      
      await monitor.shutdown();
      
      expect(monitor.getMetricsHistory('test-code')).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid session creation and deletion', async () => {
      const sessions = [];
      
      // Create many sessions quickly
      for (let i = 0; i < 10; i++) {
        sessions.push(await monitor.startWebSocketMonitoring(`rapid-${i}`));
      }
      
      // Delete them all
      for (const sessionId of sessions) {
        await monitor.stopWebSocketMonitoring(sessionId);
      }
      
      expect(monitor.getActiveSessions()).toHaveLength(0);
    });

    it('should handle metrics buffer overflow', async () => {
      const sessionId = await monitor.startWebSocketMonitoring('test-code', {
        interval: 10,
        bufferSize: 5
      });
      
      // Generate many metrics quickly
      jest.advanceTimersByTime(100);
      
      const session = monitor.getSessionInfo(sessionId);
      expect(session?.metricsBuffer.length).toBeLessThanOrEqual(5);
    });

    it('should handle WebSocket send errors gracefully', async () => {
      await monitor.startWebSocketServer();
      jest.advanceTimersByTime(100);
      
      const client = mockClients[0];
      client.send.mockImplementation(() => {
        throw new Error('Send failed');
      });
      
      const sessionId = await monitor.startWebSocketMonitoring('test-code');
      
      // Should not throw when broadcasting
      expect(() => {
        monitor.subscribeToSession(sessionId, client);
        jest.advanceTimersByTime(100);
      }).not.toThrow();
    });
  });
});