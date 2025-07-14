import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { WebSocketServer } from 'ws';
import { PerformanceProfile, RealTimeMetrics, PerformanceAlert } from './performance-profiler.js';

// Define TimestampedMetrics locally
interface TimestampedMetrics extends RealTimeMetrics {
  timestamp: number;
}

export interface MonitoringOptions {
  interval?: number;           // Metrics collection interval (ms)
  bufferSize?: number;         // Max buffer size per session
  enableAlerts?: boolean;      // Enable real-time alerts
  thresholds?: PerformanceThresholds;
  maxConnections?: number;     // Max WebSocket connections
}

export interface PerformanceThresholds {
  memory?: {
    heapUsed?: number;
    rss?: number;
  };
  cpu?: {
    total?: number;
    user?: number;
    system?: number;
  };
  eventLoopLag?: number;
}

export interface WebSocketMessage {
  type: 'metrics_update' | 'alert' | 'session_end' | 'error';
  sessionId: string;
  data: any;
  timestamp: number;
}

export interface MonitoringSession {
  id: string;
  codeId: string;
  startTime: number;
  metricsBuffer: TimestampedMetrics[];
  clients: Set<WebSocket>;
  options: MonitoringOptions;
  interval?: NodeJS.Timeout;
  bufferSize?: number;
}

export interface MemoryLeakInfo {
  type: 'heap' | 'rss' | 'external';
  severity: 'low' | 'medium' | 'high' | 'critical';
  growthRate: number;          // bytes per second
  startValue: number;
  currentValue: number;
  detectedAt: Date;
}

export interface MemoryLeakAnalysis {
  leaksDetected: MemoryLeakInfo[];
  growthRate: number;
  projectedLeakage: {
    in1Hour: number;
    in24Hours: number;
    in7Days: number;
  };
  recommendations: string[];
}

export class RealTimePerformanceMonitor extends EventEmitter {
  private wsServer?: WebSocketServer;
  private activeMonitors: Map<string, MonitoringSession> = new Map();
  private metricsHistory: Map<string, TimestampedMetrics[]> = new Map();
  private readonly MAX_HISTORY_SIZE = 1000;

  constructor() {
    super();
    console.log('🚀 Real-time Performance Monitor initialized');
  }

  async startWebSocketServer(port: number = 8081): Promise<void> {
    console.log(`🌐 Starting WebSocket server on port ${port}...`);
    
    this.wsServer = new WebSocketServer({ port });
    
    this.wsServer.on('connection', (ws: WebSocket, request: any) => {
      console.log('🔌 New WebSocket client connected');
      
      ws.addListener('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          this.sendError(ws, 'Invalid JSON message');
        }
      });
      
      ws.on('close', () => {
        console.log('📴 WebSocket client disconnected');
        this.removeClientFromSessions(ws);
      });
      
      ws.on('error', (error: any) => {
        console.error('WebSocket error:', error);
        this.removeClientFromSessions(ws);
      });
      
      // Send welcome message
      this.sendMessage(ws, {
        type: 'metrics_update',
        sessionId: 'server',
        data: { message: 'Connected to Performance Monitor' },
        timestamp: Date.now()
      });
    });
    
    console.log(`✅ WebSocket server started on port ${port}`);
  }

  async startWebSocketMonitoring(
    codeId: string,
    options: MonitoringOptions = {}
  ): Promise<string> {
    const sessionId = `ws_monitor_${codeId}_${Date.now()}`;
    const interval = options.interval || 1000;
    
    console.log(`🚀 Starting WebSocket monitoring for ${codeId} (session: ${sessionId})`);
    
    // Dynamic buffer sizing optimization
    const bufferSize = this.calculateOptimalBufferSize(this.activeMonitors.size);
    
    const session: MonitoringSession = {
      id: sessionId,
      codeId,
      startTime: Date.now(),
      metricsBuffer: [],
      clients: new Set<WebSocket>(),
      options,
      bufferSize
    };
    
    // Start metrics collection
    const monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.collectInstantMetrics(codeId);
        const timestampedMetrics: TimestampedMetrics = {
          ...metrics,
          timestamp: Date.now()
        };
        
        // Add to session buffer with dynamic sizing
        session.metricsBuffer.push(timestampedMetrics);
        
        // Maintain optimal buffer size
        if (session.metricsBuffer.length > bufferSize) {
          session.metricsBuffer.shift();
        }
        
        // Add to history
        this.addToHistory(codeId, timestampedMetrics);
        
        // Check thresholds and generate alerts
        if (options.thresholds && options.enableAlerts) {
          const alerts = this.checkThresholds(metrics, options.thresholds);
          alerts.forEach(alert => {
            console.warn(`⚠️ Performance Alert: ${alert.message}`);
            this.broadcastAlert(session, alert);
            this.emit('alert', alert);
          });
        }
        
        // Broadcast metrics to all connected clients
        this.broadcastMetrics(session, timestampedMetrics);
        
        // Emit metrics event
        this.emit('metrics', timestampedMetrics);
        
      } catch (error) {
        console.error('Real-time monitoring error:', error);
        this.broadcastError(session, error);
      }
    }, interval);
    
    session.interval = monitoringInterval;
    this.activeMonitors.set(sessionId, session);
    
    return sessionId;
  }

  // Dynamic buffer sizing optimization (from optimization suggestions)
  private calculateOptimalBufferSize(sessionCount: number): number {
    const baseSize = 500;
    const perSessionSize = Math.min(200, 1000 / Math.max(1, sessionCount));
    return Math.max(baseSize, perSessionSize * sessionCount);
  }

  async stopWebSocketMonitoring(sessionId: string): Promise<void> {
    const session = this.activeMonitors.get(sessionId);
    if (!session) {
      console.warn(`⚠️ Monitoring session not found: ${sessionId}`);
      return;
    }
    
    console.log(`⏹️ Stopping WebSocket monitoring: ${sessionId}`);
    
    // Clear interval
    if (session.interval) {
      clearInterval(session.interval);
    }
    
    // Notify clients
    this.broadcastSessionEnd(session);
    
    // Clean up
    this.activeMonitors.delete(sessionId);
    
    console.log(`✅ Monitoring session stopped: ${sessionId}`);
  }

  subscribeToSession(sessionId: string, ws: WebSocket): boolean {
    const session = this.activeMonitors.get(sessionId);
    if (!session) {
      this.sendError(ws, `Session not found: ${sessionId}`);
      return false;
    }
    
    session.clients.add(ws);
    
    // Send current buffer to new client
    this.sendMessage(ws, {
      type: 'metrics_update',
      sessionId,
      data: {
        buffer: session.metricsBuffer,
        sessionInfo: {
          codeId: session.codeId,
          startTime: session.startTime,
          duration: Date.now() - session.startTime
        }
      },
      timestamp: Date.now()
    });
    
    console.log(`📱 Client subscribed to session: ${sessionId}`);
    return true;
  }

  unsubscribeFromSession(sessionId: string, ws: WebSocket): void {
    const session = this.activeMonitors.get(sessionId);
    if (session) {
      session.clients.delete(ws);
      console.log(`📴 Client unsubscribed from session: ${sessionId}`);
    }
  }

  // Enhanced memory leak detection with exponential smoothing
  async detectMemoryLeaks(codeId: string, timeWindow: string = '1h'): Promise<MemoryLeakAnalysis> {
    console.log(`🔍 Analyzing memory leaks for ${codeId} (window: ${timeWindow})...`);
    
    const memoryHistory = this.getMemoryHistory(codeId, timeWindow);
    
    if (memoryHistory.length < 10) {
      return {
        leaksDetected: [],
        growthRate: 0,
        projectedLeakage: { in1Hour: 0, in24Hours: 0, in7Days: 0 },
        recommendations: ['Insufficient data for leak analysis. Monitor for longer period.']
      };
    }
    
    // Apply enhanced analysis with exponential smoothing
    const leaksDetected = this.analyzeMemoryTrendsOptimized(memoryHistory);
    const growthRate = this.calculateGrowthRate(memoryHistory);
    const projectedLeakage = this.projectMemoryUsage(memoryHistory);
    const recommendations = this.generateMemoryOptimizations(memoryHistory);
    
    console.log(`📊 Memory leak analysis completed. Leaks detected: ${leaksDetected.length}`);
    
    return {
      leaksDetected,
      growthRate,
      projectedLeakage,
      recommendations
    };
  }

  // Enhanced memory trend analysis with exponential smoothing (from optimization suggestions)
  private analyzeMemoryTrendsOptimized(history: TimestampedMetrics[]): MemoryLeakInfo[] {
    if (history.length < 10) return [];
    
    // Apply exponential smoothing
    const smoothedData = this.applyExponentialSmoothing(history, 0.3);
    
    // Use linear regression for more accurate trend detection
    const trendLine = this.calculateLinearRegression(smoothedData);
    
    // Detect anomalies using standard deviation
    const anomalies = this.detectStatisticalAnomalies(smoothedData);
    
    return this.combineAnalysisResults(trendLine, anomalies);
  }

  private applyExponentialSmoothing(data: TimestampedMetrics[], alpha: number): number[] {
    if (data.length === 0) return [];
    
    const smoothed: number[] = [];
    smoothed[0] = data[0].memory.heapUsed;
    
    for (let i = 1; i < data.length; i++) {
      smoothed[i] = alpha * data[i].memory.heapUsed + (1 - alpha) * smoothed[i - 1];
    }
    
    return smoothed;
  }

  private calculateLinearRegression(data: number[]): { slope: number; intercept: number; r2: number } {
    const n = data.length;
    if (n < 2) return { slope: 0, intercept: 0, r2: 0 };
    
    const xSum = n * (n - 1) / 2; // sum of indices 0,1,2...n-1
    const ySum = data.reduce((sum, val) => sum + val, 0);
    const xxSum = n * (n - 1) * (2 * n - 1) / 6; // sum of squares of indices
    const xySum = data.reduce((sum, val, i) => sum + val * i, 0);
    
    const slope = (n * xySum - xSum * ySum) / (n * xxSum - xSum * xSum);
    const intercept = (ySum - slope * xSum) / n;
    
    // Calculate R-squared
    const yMean = ySum / n;
    const ssTotal = data.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const ssRes = data.reduce((sum, val, i) => {
      const predicted = slope * i + intercept;
      return sum + Math.pow(val - predicted, 2);
    }, 0);
    
    const r2 = 1 - (ssRes / ssTotal);
    
    return { slope, intercept, r2 };
  }

  private detectStatisticalAnomalies(data: number[]): number[] {
    if (data.length < 3) return [];
    
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);
    
    const threshold = 2 * stdDev; // 2-sigma rule
    
    return data.map((val, index) => {
      return Math.abs(val - mean) > threshold ? index : -1;
    }).filter(index => index !== -1);
  }

  private combineAnalysisResults(trendLine: any, anomalies: number[]): MemoryLeakInfo[] {
    const leaks: MemoryLeakInfo[] = [];
    
    // Check for significant upward trend
    if (trendLine.slope > 1024 * 10 && trendLine.r2 > 0.7) { // 10KB/s with good correlation
      leaks.push({
        type: 'heap',
        severity: trendLine.slope > 1024 * 1024 ? 'critical' : 'high',
        growthRate: trendLine.slope,
        startValue: trendLine.intercept,
        currentValue: trendLine.intercept + trendLine.slope * (Date.now() / 1000),
        detectedAt: new Date()
      });
    }
    
    // Check anomalies
    if (anomalies.length > 0) {
      leaks.push({
        type: 'heap',
        severity: 'medium',
        growthRate: 0,
        startValue: 0,
        currentValue: 0,
        detectedAt: new Date()
      });
    }
    
    return leaks;
  }

  private async collectInstantMetrics(codeId: string): Promise<RealTimeMetrics> {
    const timestamp = Date.now();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Get previous metrics for trend calculation
    const history = this.metricsHistory.get(codeId) || [];
    const previous = history.length > 0 ? history[history.length - 1] : null;
    
    const trends = this.calculateTrends(
      { memory: memoryUsage, cpu: { user: cpuUsage.user / 1000, system: cpuUsage.system / 1000, total: (cpuUsage.user + cpuUsage.system) / 1000 } },
      previous
    );
    
    return {
      timestamp,
      codeId,
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        rss: memoryUsage.rss,
        external: memoryUsage.external
      },
      cpu: {
        user: cpuUsage.user / 1000,
        system: cpuUsage.system / 1000,
        total: (cpuUsage.user + cpuUsage.system) / 1000
      },
      trends,
      eventLoop: await this.measureEventLoopLag(),
      gc: this.getGCStats()
    };
  }

  private calculateTrends(current: any, previous: TimestampedMetrics | null): any {
    if (!previous) {
      return {
        memory: { direction: 'stable', rate: 0 },
        cpu: { direction: 'stable', rate: 0 }
      };
    }
    
    const timeDiff = (Date.now() - previous.timestamp) / 1000; // seconds
    const memoryDiff = current.memory.heapUsed - previous.memory.heapUsed;
    const cpuDiff = current.cpu.total - previous.cpu.total;
    
    return {
      memory: {
        direction: memoryDiff > 1024 * 1024 ? 'increasing' : memoryDiff < -1024 * 1024 ? 'decreasing' : 'stable',
        rate: memoryDiff / timeDiff
      },
      cpu: {
        direction: cpuDiff > 10 ? 'increasing' : cpuDiff < -10 ? 'decreasing' : 'stable',
        rate: cpuDiff / timeDiff
      }
    };
  }

  private async measureEventLoopLag(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000;
        resolve(lag);
      });
    });
  }

  private getGCStats(): any {
    return {
      forced: false,
      duration: 0,
      type: 'unknown'
    };
  }

  private checkThresholds(metrics: RealTimeMetrics, thresholds: PerformanceThresholds): PerformanceAlert[] {
    const alerts: PerformanceAlert[] = [];
    
    // Memory threshold checks
    if (thresholds.memory?.heapUsed && metrics.memory.heapUsed > thresholds.memory.heapUsed) {
      alerts.push({
        type: 'memory',
        severity: 'high',
        message: `Heap usage (${(metrics.memory.heapUsed / 1024 / 1024).toFixed(2)}MB) exceeds threshold`,
        timestamp: metrics.timestamp,
        value: metrics.memory.heapUsed,
        threshold: thresholds.memory.heapUsed
      });
    }
    
    // CPU threshold checks
    if (thresholds.cpu?.total && metrics.cpu.total > thresholds.cpu.total) {
      alerts.push({
        type: 'cpu',
        severity: 'medium',
        message: `CPU usage (${metrics.cpu.total.toFixed(2)}ms) exceeds threshold`,
        timestamp: metrics.timestamp,
        value: metrics.cpu.total,
        threshold: thresholds.cpu.total
      });
    }
    
    // Event loop lag check
    if (thresholds.eventLoopLag && metrics.eventLoop > thresholds.eventLoopLag) {
      alerts.push({
        type: 'eventloop',
        severity: 'critical',
        message: `Event loop lag (${metrics.eventLoop.toFixed(2)}ms) exceeds threshold`,
        timestamp: metrics.timestamp,
        value: metrics.eventLoop,
        threshold: thresholds.eventLoopLag
      });
    }
    
    return alerts;
  }

  private addToHistory(codeId: string, metrics: TimestampedMetrics): void {
    let history = this.metricsHistory.get(codeId) || [];
    history.push(metrics);
    
    // Maintain history size with dynamic buffer optimization
    const optimalSize = this.calculateOptimalBufferSize(this.activeMonitors.size);
    if (history.length > optimalSize) {
      history = history.slice(-optimalSize);
    }
    
    this.metricsHistory.set(codeId, history);
  }

  private getMemoryHistory(codeId: string, timeWindow: string): TimestampedMetrics[] {
    const history = this.metricsHistory.get(codeId) || [];
    const now = Date.now();
    
    // Parse time window
    const windowMs = this.parseTimeWindow(timeWindow);
    const cutoff = now - windowMs;
    
    return history.filter(metric => metric.timestamp >= cutoff);
  }

  private parseTimeWindow(timeWindow: string): number {
    const match = timeWindow.match(/(\d+)([hmd])/);  // hours, minutes, days
    if (!match) return 3600000; // Default 1 hour
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 3600000;
    }
  }

  private calculateGrowthRate(history: TimestampedMetrics[]): number {
    if (history.length < 2) return 0;
    
    const first = history[0];
    const last = history[history.length - 1];
    const duration = (last.timestamp - first.timestamp) / 1000;
    
    return (last.memory.heapUsed - first.memory.heapUsed) / duration;
  }

  private projectMemoryUsage(history: TimestampedMetrics[]): {
    in1Hour: number;
    in24Hours: number;
    in7Days: number;
  } {
    const growthRate = this.calculateGrowthRate(history);
    const currentUsage = history[history.length - 1]?.memory.heapUsed || 0;
    
    return {
      in1Hour: currentUsage + (growthRate * 3600),
      in24Hours: currentUsage + (growthRate * 86400),
      in7Days: currentUsage + (growthRate * 604800)
    };
  }

  private generateMemoryOptimizations(history: TimestampedMetrics[]): string[] {
    const recommendations: string[] = [];
    const growthRate = this.calculateGrowthRate(history);
    
    if (growthRate > 1024 * 1024) { // 1MB/s
      recommendations.push('Critical memory leak detected. Review object references and event listeners.');
      recommendations.push('Consider implementing object pooling for frequently created objects.');
      recommendations.push('Add explicit garbage collection triggers at appropriate intervals.');
    } else if (growthRate > 1024 * 100) { // 100KB/s
      recommendations.push('Moderate memory growth detected. Monitor for memory leaks.');
      recommendations.push('Consider optimizing data structures and reducing object creation.');
    }
    
    if (history.length > 0) {
      const avgHeapUsage = history.reduce((sum, m) => sum + m.memory.heapUsed, 0) / history.length;
      if (avgHeapUsage > 100 * 1024 * 1024) { // 100MB
        recommendations.push('High average memory usage. Consider code splitting or lazy loading.');
      }
    }
    
    return recommendations;
  }

  // WebSocket message handling
  private handleWebSocketMessage(ws: WebSocket, data: any): void {
    switch (data.type) {
      case 'subscribe':
        if (data.sessionId) {
          this.subscribeToSession(data.sessionId, ws);
        }
        break;
      case 'unsubscribe':
        if (data.sessionId) {
          this.unsubscribeFromSession(data.sessionId, ws);
        }
        break;
      case 'get_sessions':
        this.sendActiveSessions(ws);
        break;
      default:
        this.sendError(ws, `Unknown message type: ${data.type}`);
    }
  }

  private broadcastMetrics(session: MonitoringSession, metrics: TimestampedMetrics): void {
    const message: WebSocketMessage = {
      type: 'metrics_update',
      sessionId: session.id,
      data: metrics,
      timestamp: Date.now()
    };
    
    session.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        this.sendMessage(client, message);
      }
    });
  }

  private broadcastAlert(session: MonitoringSession, alert: PerformanceAlert): void {
    const message: WebSocketMessage = {
      type: 'alert',
      sessionId: session.id,
      data: alert,
      timestamp: Date.now()
    };
    
    session.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        this.sendMessage(client, message);
      }
    });
  }

  private broadcastError(session: MonitoringSession, error: any): void {
    const message: WebSocketMessage = {
      type: 'error',
      sessionId: session.id,
      data: { error: error.message || String(error) },
      timestamp: Date.now()
    };
    
    session.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        this.sendMessage(client, message);
      }
    });
  }

  private broadcastSessionEnd(session: MonitoringSession): void {
    const message: WebSocketMessage = {
      type: 'session_end',
      sessionId: session.id,
      data: { reason: 'Session terminated' },
      timestamp: Date.now()
    };
    
    session.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        this.sendMessage(client, message);
      }
    });
  }

  private sendMessage(ws: WebSocket, message: WebSocketMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send WebSocket message:', error);
    }
  }

  private sendError(ws: WebSocket, errorMessage: string): void {
    this.sendMessage(ws, {
      type: 'error',
      sessionId: 'server',
      data: { error: errorMessage },
      timestamp: Date.now()
    });
  }

  private sendActiveSessions(ws: WebSocket): void {
    const sessions = Array.from(this.activeMonitors.values()).map(session => ({
      id: session.id,
      codeId: session.codeId,
      startTime: session.startTime,
      clientCount: session.clients.size,
      metricsCount: session.metricsBuffer.length
    }));
    
    this.sendMessage(ws, {
      type: 'metrics_update',
      sessionId: 'server',
      data: { activeSessions: sessions },
      timestamp: Date.now()
    });
  }

  private removeClientFromSessions(ws: WebSocket): void {
    this.activeMonitors.forEach(session => {
      session.clients.delete(ws);
    });
  }

  // Cleanup
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down real-time performance monitor...');
    
    // Stop all monitoring sessions
    const stopPromises = Array.from(this.activeMonitors.keys()).map(sessionId => 
      this.stopWebSocketMonitoring(sessionId)
    );
    await Promise.all(stopPromises);
    
    // Close WebSocket server
    if (this.wsServer) {
      this.wsServer.close();
    }
    
    // Clear data
    this.metricsHistory.clear();
    
    console.log('✅ Real-time performance monitor shutdown complete');
  }

  // Utility methods
  getActiveSessions(): string[] {
    return Array.from(this.activeMonitors.keys());
  }

  getSessionInfo(sessionId: string): MonitoringSession | undefined {
    return this.activeMonitors.get(sessionId);
  }

  getMetricsHistory(codeId: string): TimestampedMetrics[] {
    return this.metricsHistory.get(codeId) || [];
  }
}