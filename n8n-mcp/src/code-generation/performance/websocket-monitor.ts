import { EventEmitter } from 'events';
import * as WebSocket from 'ws';
import { RealTimeMetrics, PerformanceThresholds, PerformanceAlert } from './performance-profiler';

export interface MonitoringSession {
  id: string;
  codeId: string;
  startTime: number;
  metricsBuffer: TimestampedMetrics[];
  clients: Set<WebSocket>;
  interval?: NodeJS.Timeout;
  options: MonitoringOptions;
}

export interface TimestampedMetrics extends RealTimeMetrics {
  timestamp: number;
}

export interface MonitoringOptions {
  interval?: number;
  bufferSize?: number;
  thresholds?: PerformanceThresholds;
  enableAlerts?: boolean;
  enableTrends?: boolean;
}

export interface WebSocketMessage {
  type: 'metrics_update' | 'alert' | 'session_start' | 'session_end' | 'error';
  sessionId: string;
  data?: any;
  timestamp: number;
}

export interface MemoryLeakAnalysis {
  leaksDetected: MemoryLeakInfo[];
  growthRate: number; // bytes per second
  projectedLeakage: {
    in1Hour: number;
    in24Hours: number;
    in7Days: number;
  };
  recommendations: string[];
}

export interface MemoryLeakInfo {
  type: 'heap' | 'external' | 'rss';
  severity: 'low' | 'medium' | 'high' | 'critical';
  growthRate: number;
  startValue: number;
  currentValue: number;
  detectedAt: Date;
}

export class RealTimePerformanceMonitor extends EventEmitter {
  private wsServer?: WebSocket.Server;
  private activeMonitors: Map<string, MonitoringSession> = new Map();
  private metricsHistory: Map<string, TimestampedMetrics[]> = new Map();
  private readonly MAX_HISTORY_SIZE = 1000;

  constructor(port?: number) {
    super();
    if (port) {
      this.initializeWebSocketServer(port);
    }
  }

  private initializeWebSocketServer(port: number): void {
    console.log(`🌐 Initializing WebSocket server on port ${port}...`);
    
    this.wsServer = new WebSocket.Server({ port });
    
    this.wsServer.on('connection', (ws: WebSocket, request) => {
      console.log(`🔗 New WebSocket connection from ${request.socket.remoteAddress}`);
      
      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });
      
      ws.on('close', () => {
        console.log('📡 WebSocket connection closed');
        this.removeClientFromSessions(ws);
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.removeClientFromSessions(ws);
      });
      
      // Send welcome message
      this.sendMessage(ws, {
        type: 'session_start',
        sessionId: 'server',
        data: { message: 'Connected to real-time performance monitor' },
        timestamp: Date.now()
      });
    });
    
    console.log(`✅ WebSocket server started on port ${port}`);\n  }

  async startWebSocketMonitoring(\n    codeId: string,\n    options: MonitoringOptions = {}\n  ): Promise<string> {\n    const sessionId = `ws_monitor_${codeId}_${Date.now()}`;\n    const interval = options.interval || 1000;\n    \n    console.log(`🚀 Starting WebSocket monitoring for ${codeId} (session: ${sessionId})`);\n    \n    const session: MonitoringSession = {\n      id: sessionId,\n      codeId,\n      startTime: Date.now(),\n      metricsBuffer: [],\n      clients: new Set<WebSocket>(),\n      options\n    };\n    \n    // Start metrics collection\n    const monitoringInterval = setInterval(async () => {\n      try {\n        const metrics = await this.collectInstantMetrics(codeId);\n        const timestampedMetrics: TimestampedMetrics = {\n          ...metrics,\n          timestamp: Date.now()\n        };\n        \n        // Add to session buffer\n        session.metricsBuffer.push(timestampedMetrics);\n        \n        // Maintain buffer size\n        const bufferSize = options.bufferSize || 100;\n        if (session.metricsBuffer.length > bufferSize) {\n          session.metricsBuffer.shift();\n        }\n        \n        // Add to history\n        this.addToHistory(codeId, timestampedMetrics);\n        \n        // Check thresholds and generate alerts\n        if (options.thresholds && options.enableAlerts) {\n          const alerts = this.checkThresholds(metrics, options.thresholds);\n          alerts.forEach(alert => {\n            console.warn(`⚠️ Performance Alert: ${alert.message}`);\n            this.broadcastAlert(session, alert);\n            this.emit('alert', alert);\n          });\n        }\n        \n        // Broadcast metrics to all connected clients\n        this.broadcastMetrics(session, timestampedMetrics);\n        \n        // Emit metrics event\n        this.emit('metrics', timestampedMetrics);\n        \n      } catch (error) {\n        console.error('Real-time monitoring error:', error);\n        this.broadcastError(session, error);\n      }\n    }, interval);\n    \n    session.interval = monitoringInterval;\n    this.activeMonitors.set(sessionId, session);\n    \n    return sessionId;\n  }\n\n  async stopWebSocketMonitoring(sessionId: string): Promise<void> {\n    const session = this.activeMonitors.get(sessionId);\n    if (!session) {\n      console.warn(`⚠️ Monitoring session not found: ${sessionId}`);\n      return;\n    }\n    \n    console.log(`⏹️ Stopping WebSocket monitoring: ${sessionId}`);\n    \n    // Clear interval\n    if (session.interval) {\n      clearInterval(session.interval);\n    }\n    \n    // Notify clients\n    this.broadcastSessionEnd(session);\n    \n    // Clean up\n    this.activeMonitors.delete(sessionId);\n    \n    console.log(`✅ Monitoring session stopped: ${sessionId}`);\n  }\n\n  subscribeToSession(sessionId: string, ws: WebSocket): boolean {\n    const session = this.activeMonitors.get(sessionId);\n    if (!session) {\n      this.sendError(ws, `Session not found: ${sessionId}`);\n      return false;\n    }\n    \n    session.clients.add(ws);\n    \n    // Send current buffer to new client\n    this.sendMessage(ws, {\n      type: 'metrics_update',\n      sessionId,\n      data: {\n        buffer: session.metricsBuffer,\n        sessionInfo: {\n          codeId: session.codeId,\n          startTime: session.startTime,\n          duration: Date.now() - session.startTime\n        }\n      },\n      timestamp: Date.now()\n    });\n    \n    console.log(`📱 Client subscribed to session: ${sessionId}`);\n    return true;\n  }\n\n  unsubscribeFromSession(sessionId: string, ws: WebSocket): void {\n    const session = this.activeMonitors.get(sessionId);\n    if (session) {\n      session.clients.delete(ws);\n      console.log(`📴 Client unsubscribed from session: ${sessionId}`);\n    }\n  }\n\n  async detectMemoryLeaks(codeId: string, timeWindow: string = '1h'): Promise<MemoryLeakAnalysis> {\n    console.log(`🔍 Analyzing memory leaks for ${codeId} (window: ${timeWindow})...`);\n    \n    const memoryHistory = this.getMemoryHistory(codeId, timeWindow);\n    \n    if (memoryHistory.length < 10) {\n      return {\n        leaksDetected: [],\n        growthRate: 0,\n        projectedLeakage: { in1Hour: 0, in24Hours: 0, in7Days: 0 },\n        recommendations: ['Insufficient data for leak analysis. Monitor for longer period.']\n      };\n    }\n    \n    const leaksDetected = this.analyzeMemoryTrends(memoryHistory);\n    const growthRate = this.calculateGrowthRate(memoryHistory);\n    const projectedLeakage = this.projectMemoryUsage(memoryHistory);\n    const recommendations = this.generateMemoryOptimizations(memoryHistory);\n    \n    console.log(`📊 Memory leak analysis completed. Leaks detected: ${leaksDetected.length}`);\n    \n    return {\n      leaksDetected,\n      growthRate,\n      projectedLeakage,\n      recommendations\n    };\n  }\n\n  private async collectInstantMetrics(codeId: string): Promise<RealTimeMetrics> {\n    const timestamp = Date.now();\n    const memoryUsage = process.memoryUsage();\n    const cpuUsage = process.cpuUsage();\n    \n    // Get previous metrics for trend calculation\n    const history = this.metricsHistory.get(codeId) || [];\n    const previous = history.length > 0 ? history[history.length - 1] : null;\n    \n    const trends = this.calculateTrends(\n      { memory: memoryUsage, cpu: { user: cpuUsage.user / 1000, system: cpuUsage.system / 1000, total: (cpuUsage.user + cpuUsage.system) / 1000 } },\n      previous\n    );\n    \n    return {\n      timestamp,\n      codeId,\n      memory: {\n        heapUsed: memoryUsage.heapUsed,\n        heapTotal: memoryUsage.heapTotal,\n        rss: memoryUsage.rss,\n        external: memoryUsage.external\n      },\n      cpu: {\n        user: cpuUsage.user / 1000,\n        system: cpuUsage.system / 1000,\n        total: (cpuUsage.user + cpuUsage.system) / 1000\n      },\n      trends,\n      eventLoop: await this.measureEventLoopLag(),\n      gc: this.getGCStats()\n    };\n  }\n\n  private calculateTrends(current: any, previous: TimestampedMetrics | null): any {\n    if (!previous) {\n      return {\n        memory: { direction: 'stable', rate: 0 },\n        cpu: { direction: 'stable', rate: 0 }\n      };\n    }\n    \n    const timeDiff = (Date.now() - previous.timestamp) / 1000; // seconds\n    const memoryDiff = current.memory.heapUsed - previous.memory.heapUsed;\n    const cpuDiff = current.cpu.total - previous.cpu.total;\n    \n    return {\n      memory: {\n        direction: memoryDiff > 1024 * 1024 ? 'increasing' : memoryDiff < -1024 * 1024 ? 'decreasing' : 'stable',\n        rate: memoryDiff / timeDiff\n      },\n      cpu: {\n        direction: cpuDiff > 10 ? 'increasing' : cpuDiff < -10 ? 'decreasing' : 'stable',\n        rate: cpuDiff / timeDiff\n      }\n    };\n  }\n\n  private async measureEventLoopLag(): Promise<number> {\n    return new Promise((resolve) => {\n      const start = process.hrtime.bigint();\n      setImmediate(() => {\n        const lag = Number(process.hrtime.bigint() - start) / 1000000;\n        resolve(lag);\n      });\n    });\n  }\n\n  private getGCStats(): any {\n    return {\n      forced: false,\n      duration: 0,\n      type: 'unknown'\n    };\n  }\n\n  private checkThresholds(metrics: RealTimeMetrics, thresholds: PerformanceThresholds): PerformanceAlert[] {\n    const alerts: PerformanceAlert[] = [];\n    \n    // Memory threshold checks\n    if (thresholds.memory?.heapUsed && metrics.memory.heapUsed > thresholds.memory.heapUsed) {\n      alerts.push({\n        type: 'memory',\n        severity: 'high',\n        message: `Heap usage (${(metrics.memory.heapUsed / 1024 / 1024).toFixed(2)}MB) exceeds threshold`,\n        timestamp: metrics.timestamp,\n        value: metrics.memory.heapUsed,\n        threshold: thresholds.memory.heapUsed\n      });\n    }\n    \n    // CPU threshold checks\n    if (thresholds.cpu?.total && metrics.cpu.total > thresholds.cpu.total) {\n      alerts.push({\n        type: 'cpu',\n        severity: 'medium',\n        message: `CPU usage (${metrics.cpu.total.toFixed(2)}ms) exceeds threshold`,\n        timestamp: metrics.timestamp,\n        value: metrics.cpu.total,\n        threshold: thresholds.cpu.total\n      });\n    }\n    \n    // Event loop lag check\n    if (thresholds.eventLoopLag && metrics.eventLoop > thresholds.eventLoopLag) {\n      alerts.push({\n        type: 'eventloop',\n        severity: 'critical',\n        message: `Event loop lag (${metrics.eventLoop.toFixed(2)}ms) exceeds threshold`,\n        timestamp: metrics.timestamp,\n        value: metrics.eventLoop,\n        threshold: thresholds.eventLoopLag\n      });\n    }\n    \n    return alerts;\n  }\n\n  private addToHistory(codeId: string, metrics: TimestampedMetrics): void {\n    let history = this.metricsHistory.get(codeId) || [];\n    history.push(metrics);\n    \n    // Maintain history size\n    if (history.length > this.MAX_HISTORY_SIZE) {\n      history = history.slice(-this.MAX_HISTORY_SIZE);\n    }\n    \n    this.metricsHistory.set(codeId, history);\n  }\n\n  private getMemoryHistory(codeId: string, timeWindow: string): TimestampedMetrics[] {\n    const history = this.metricsHistory.get(codeId) || [];\n    const now = Date.now();\n    \n    // Parse time window\n    const windowMs = this.parseTimeWindow(timeWindow);\n    const cutoff = now - windowMs;\n    \n    return history.filter(metric => metric.timestamp >= cutoff);\n  }\n\n  private parseTimeWindow(timeWindow: string): number {\n    const match = timeWindow.match(/(\\d+)([hmd])/);  // hours, minutes, days\n    if (!match) return 3600000; // Default 1 hour\n    \n    const value = parseInt(match[1]);\n    const unit = match[2];\n    \n    switch (unit) {\n      case 'm': return value * 60 * 1000;\n      case 'h': return value * 60 * 60 * 1000;\n      case 'd': return value * 24 * 60 * 60 * 1000;\n      default: return 3600000;\n    }\n  }\n\n  private analyzeMemoryTrends(history: TimestampedMetrics[]): MemoryLeakInfo[] {\n    const leaks: MemoryLeakInfo[] = [];\n    \n    if (history.length < 10) return leaks;\n    \n    const first = history[0];\n    const last = history[history.length - 1];\n    const duration = (last.timestamp - first.timestamp) / 1000; // seconds\n    \n    // Analyze heap growth\n    const heapGrowth = last.memory.heapUsed - first.memory.heapUsed;\n    const heapGrowthRate = heapGrowth / duration;\n    \n    if (heapGrowthRate > 1024 * 10) { // 10KB/s threshold\n      leaks.push({\n        type: 'heap',\n        severity: heapGrowthRate > 1024 * 1024 ? 'critical' : 'high',\n        growthRate: heapGrowthRate,\n        startValue: first.memory.heapUsed,\n        currentValue: last.memory.heapUsed,\n        detectedAt: new Date()\n      });\n    }\n    \n    // Analyze RSS growth\n    const rssGrowth = last.memory.rss - first.memory.rss;\n    const rssGrowthRate = rssGrowth / duration;\n    \n    if (rssGrowthRate > 1024 * 50) { // 50KB/s threshold\n      leaks.push({\n        type: 'rss',\n        severity: rssGrowthRate > 1024 * 1024 * 5 ? 'critical' : 'medium',\n        growthRate: rssGrowthRate,\n        startValue: first.memory.rss,\n        currentValue: last.memory.rss,\n        detectedAt: new Date()\n      });\n    }\n    \n    return leaks;\n  }\n\n  private calculateGrowthRate(history: TimestampedMetrics[]): number {\n    if (history.length < 2) return 0;\n    \n    const first = history[0];\n    const last = history[history.length - 1];\n    const duration = (last.timestamp - first.timestamp) / 1000;\n    \n    return (last.memory.heapUsed - first.memory.heapUsed) / duration;\n  }\n\n  private projectMemoryUsage(history: TimestampedMetrics[]): {\n    in1Hour: number;\n    in24Hours: number;\n    in7Days: number;\n  } {\n    const growthRate = this.calculateGrowthRate(history);\n    const currentUsage = history[history.length - 1]?.memory.heapUsed || 0;\n    \n    return {\n      in1Hour: currentUsage + (growthRate * 3600),\n      in24Hours: currentUsage + (growthRate * 86400),\n      in7Days: currentUsage + (growthRate * 604800)\n    };\n  }\n\n  private generateMemoryOptimizations(history: TimestampedMetrics[]): string[] {\n    const recommendations: string[] = [];\n    const growthRate = this.calculateGrowthRate(history);\n    \n    if (growthRate > 1024 * 1024) { // 1MB/s\n      recommendations.push('Critical memory leak detected. Review object references and event listeners.');\n      recommendations.push('Consider implementing object pooling for frequently created objects.');\n      recommendations.push('Add explicit garbage collection triggers at appropriate intervals.');\n    } else if (growthRate > 1024 * 100) { // 100KB/s\n      recommendations.push('Moderate memory growth detected. Monitor for memory leaks.');\n      recommendations.push('Consider optimizing data structures and reducing object creation.');\n    }\n    \n    if (history.length > 0) {\n      const avgHeapUsage = history.reduce((sum, m) => sum + m.memory.heapUsed, 0) / history.length;\n      if (avgHeapUsage > 100 * 1024 * 1024) { // 100MB\n        recommendations.push('High average memory usage. Consider code splitting or lazy loading.');\n      }\n    }\n    \n    return recommendations;\n  }\n\n  // WebSocket message handling\n  private handleWebSocketMessage(ws: WebSocket, data: any): void {\n    switch (data.type) {\n      case 'subscribe':\n        if (data.sessionId) {\n          this.subscribeToSession(data.sessionId, ws);\n        }\n        break;\n      case 'unsubscribe':\n        if (data.sessionId) {\n          this.unsubscribeFromSession(data.sessionId, ws);\n        }\n        break;\n      case 'get_sessions':\n        this.sendActiveSessions(ws);\n        break;\n      default:\n        this.sendError(ws, `Unknown message type: ${data.type}`);\n    }\n  }\n\n  private broadcastMetrics(session: MonitoringSession, metrics: TimestampedMetrics): void {\n    const message: WebSocketMessage = {\n      type: 'metrics_update',\n      sessionId: session.id,\n      data: metrics,\n      timestamp: Date.now()\n    };\n    \n    session.clients.forEach(client => {\n      if (client.readyState === WebSocket.OPEN) {\n        this.sendMessage(client, message);\n      }\n    });\n  }\n\n  private broadcastAlert(session: MonitoringSession, alert: PerformanceAlert): void {\n    const message: WebSocketMessage = {\n      type: 'alert',\n      sessionId: session.id,\n      data: alert,\n      timestamp: Date.now()\n    };\n    \n    session.clients.forEach(client => {\n      if (client.readyState === WebSocket.OPEN) {\n        this.sendMessage(client, message);\n      }\n    });\n  }\n\n  private broadcastError(session: MonitoringSession, error: any): void {\n    const message: WebSocketMessage = {\n      type: 'error',\n      sessionId: session.id,\n      data: { error: error.message || String(error) },\n      timestamp: Date.now()\n    };\n    \n    session.clients.forEach(client => {\n      if (client.readyState === WebSocket.OPEN) {\n        this.sendMessage(client, message);\n      }\n    });\n  }\n\n  private broadcastSessionEnd(session: MonitoringSession): void {\n    const message: WebSocketMessage = {\n      type: 'session_end',\n      sessionId: session.id,\n      data: { reason: 'Session terminated' },\n      timestamp: Date.now()\n    };\n    \n    session.clients.forEach(client => {\n      if (client.readyState === WebSocket.OPEN) {\n        this.sendMessage(client, message);\n      }\n    });\n  }\n\n  private sendMessage(ws: WebSocket, message: WebSocketMessage): void {\n    try {\n      ws.send(JSON.stringify(message));\n    } catch (error) {\n      console.error('Failed to send WebSocket message:', error);\n    }\n  }\n\n  private sendError(ws: WebSocket, errorMessage: string): void {\n    this.sendMessage(ws, {\n      type: 'error',\n      sessionId: 'server',\n      data: { error: errorMessage },\n      timestamp: Date.now()\n    });\n  }\n\n  private sendActiveSessions(ws: WebSocket): void {\n    const sessions = Array.from(this.activeMonitors.values()).map(session => ({\n      id: session.id,\n      codeId: session.codeId,\n      startTime: session.startTime,\n      clientCount: session.clients.size,\n      metricsCount: session.metricsBuffer.length\n    }));\n    \n    this.sendMessage(ws, {\n      type: 'metrics_update',\n      sessionId: 'server',\n      data: { activeSessions: sessions },\n      timestamp: Date.now()\n    });\n  }\n\n  private removeClientFromSessions(ws: WebSocket): void {\n    this.activeMonitors.forEach(session => {\n      session.clients.delete(ws);\n    });\n  }\n\n  // Cleanup\n  async shutdown(): Promise<void> {\n    console.log('🛑 Shutting down real-time performance monitor...');\n    \n    // Stop all monitoring sessions\n    const stopPromises = Array.from(this.activeMonitors.keys()).map(sessionId => \n      this.stopWebSocketMonitoring(sessionId)\n    );\n    await Promise.all(stopPromises);\n    \n    // Close WebSocket server\n    if (this.wsServer) {\n      this.wsServer.close();\n    }\n    \n    // Clear data\n    this.metricsHistory.clear();\n    \n    console.log('✅ Real-time performance monitor shutdown complete');\n  }\n\n  // Utility methods\n  getActiveSessions(): string[] {\n    return Array.from(this.activeMonitors.keys());\n  }\n\n  getSessionInfo(sessionId: string): MonitoringSession | undefined {\n    return this.activeMonitors.get(sessionId);\n  }\n\n  getMetricsHistory(codeId: string): TimestampedMetrics[] {\n    return this.metricsHistory.get(codeId) || [];\n  }\n}