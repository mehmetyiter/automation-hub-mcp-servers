import { EventEmitter } from 'events';
import * as WebSocket from 'ws';
import { performance } from 'perf_hooks';
import { PerformanceProfile, ResourceUsage, Bottleneck, ExecutionProfile } from './performance-profiler.js';
import * as crypto from 'crypto';

export interface NodeConfig {
  id: string;
  endpoint: string;
  region?: string;
  capabilities?: string[];
  maxLoad?: number;
}

export interface DistributedProfilingOptions {
  timeout?: number;
  retries?: number;
  parallel?: boolean;
  aggregationStrategy?: 'average' | 'max' | 'min' | 'percentile';
  networkAnalysis?: boolean;
  resourceContention?: boolean;
  traceDistribution?: boolean;
}

export interface DistributedProfile {
  id: string;
  codeId: string;
  timestamp: Date;
  nodes: NodeProfile[];
  aggregatedMetrics: AggregatedMetrics;
  networkAnalysis?: NetworkAnalysis;
  distributionAnalysis: DistributionAnalysis;
  bottlenecks: DistributedBottleneck[];
  recommendations: string[];
  overallScore: number;
}

export interface NodeProfile {
  nodeId: string;
  profile: PerformanceProfile;
  networkMetrics: NetworkMetrics;
  resourceContention: ResourceContention;
  synchronizationOverhead: number;
  status: 'success' | 'failed' | 'timeout';
  error?: string;
}

export interface NetworkMetrics {
  latency: {
    min: number;
    max: number;
    average: number;
    p95: number;
    p99: number;
  };
  bandwidth: {
    upload: number;
    download: number;
    utilization: number;
  };
  packetLoss: number;
  jitter: number;
  hops: number;
}

export interface ResourceContention {
  cpuContention: number;
  memoryPressure: number;
  ioBandwidth: number;
  networkCongestion: number;
  queueDepth: number;
}

export interface AggregatedMetrics {
  totalExecutionTime: number;
  averageNodeTime: number;
  slowestNode: string;
  fastestNode: string;
  variance: number;
  standardDeviation: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
    network: number;
    io: number;
  };
}

export interface NetworkAnalysis {
  totalNetworkTime: number;
  interNodeLatency: Map<string, Map<string, number>>;
  communicationPatterns: CommunicationPattern[];
  bottleneckLinks: NetworkBottleneck[];
  optimalRouting: RoutingRecommendation[];
}

export interface CommunicationPattern {
  pattern: 'broadcast' | 'scatter-gather' | 'pipeline' | 'mesh' | 'star';
  frequency: number;
  dataVolume: number;
  efficiency: number;
}

export interface NetworkBottleneck {
  fromNode: string;
  toNode: string;
  latency: number;
  bandwidth: number;
  congestion: number;
  impact: number;
}

export interface RoutingRecommendation {
  currentPath: string[];
  recommendedPath: string[];
  expectedImprovement: number;
  reason: string;
}

export interface DistributionAnalysis {
  loadBalance: {
    coefficient: number; // Gini coefficient for load distribution
    imbalance: number;
    overloadedNodes: string[];
    underutilizedNodes: string[];
  };
  dataLocality: {
    localityScore: number;
    crossNodeTransfers: number;
    dataMovementCost: number;
    recommendations: string[];
  };
  parallelEfficiency: {
    efficiency: number;
    speedup: number;
    scalability: number;
    amdahlLimit: number;
  };
}

export interface DistributedBottleneck extends Bottleneck {
  nodes: string[];
  networkImpact: number;
  synchronizationCost: number;
  distributedSolution: string;
}

export interface TraceEvent {
  timestamp: number;
  nodeId: string;
  eventType: 'start' | 'end' | 'communication' | 'sync' | 'resource';
  data: any;
  duration?: number;
}

export class DistributedPerformanceProfiler extends EventEmitter {
  private wsConnections: Map<string, WebSocket> = new Map();
  private nodeProfiles: Map<string, NodeProfile> = new Map();
  private traceEvents: TraceEvent[] = [];
  private coordinationServer?: WebSocket.Server;
  
  constructor() {
    super();
    console.log('🌐 Distributed Performance Profiler initialized');
  }

  async profileAcrossNodes(
    codeId: string,
    nodes: NodeConfig[],
    code: string,
    executionContext: any,
    options: DistributedProfilingOptions = {}
  ): Promise<DistributedProfile> {
    console.log(`🚀 Starting distributed profiling across ${nodes.length} nodes`);
    
    const profileId = this.generateDistributedProfileId(codeId);
    const startTime = performance.now();
    
    try {
      // Initialize coordination
      await this.initializeCoordination(nodes);
      
      // Synchronize clocks across nodes
      await this.synchronizeClocks(nodes);
      
      // Deploy profiling agents
      const deploymentResults = await this.deployProfilingAgents(nodes, code, executionContext);
      
      // Execute distributed profiling
      const nodeResults = await this.executeDistributedProfiling(
        nodes,
        codeId,
        code,
        executionContext,
        options
      );
      
      // Collect network metrics
      const networkAnalysis = options.networkAnalysis ? 
        await this.analyzeNetworkPerformance(nodes, nodeResults) : 
        undefined;
      
      // Analyze distribution
      const distributionAnalysis = this.analyzeDistribution(nodeResults);
      
      // Aggregate results
      const aggregatedMetrics = this.aggregateMetrics(nodeResults);
      
      // Identify distributed bottlenecks
      const bottlenecks = await this.identifyDistributedBottlenecks(
        nodeResults,
        networkAnalysis,
        distributionAnalysis
      );
      
      // Generate recommendations
      const recommendations = this.generateDistributedRecommendations(
        bottlenecks,
        distributionAnalysis,
        networkAnalysis
      );
      
      const profile: DistributedProfile = {
        id: profileId,
        codeId,
        timestamp: new Date(),
        nodes: nodeResults,
        aggregatedMetrics,
        networkAnalysis,
        distributionAnalysis,
        bottlenecks,
        recommendations,
        overallScore: this.calculateDistributedScore(
          aggregatedMetrics,
          distributionAnalysis,
          bottlenecks
        )
      };
      
      console.log(`✅ Distributed profiling completed in ${performance.now() - startTime}ms`);
      
      return profile;
    } finally {
      // Cleanup
      await this.cleanup();
    }
  }

  private async initializeCoordination(nodes: NodeConfig[]): Promise<void> {
    console.log('🔧 Initializing distributed coordination...');
    
    // Set up coordination server
    this.coordinationServer = new WebSocket.Server({ port: 0 });
    const port = (this.coordinationServer.address() as any).port;
    
    this.coordinationServer.on('connection', (ws, req) => {
      const nodeId = req.url?.substring(1);
      if (nodeId) {
        this.wsConnections.set(nodeId, ws);
        console.log(`✅ Node ${nodeId} connected`);
      }
    });
    
    // Connect to all nodes
    const connectionPromises = nodes.map(node => this.connectToNode(node, port));
    await Promise.all(connectionPromises);
  }

  private async connectToNode(node: NodeConfig, coordinationPort: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${node.endpoint}/profiler/${node.id}`);
      
      ws.on('open', () => {
        this.wsConnections.set(node.id, ws);
        
        // Send coordination info
        ws.send(JSON.stringify({
          type: 'coordination',
          coordinationPort,
          nodeId: node.id
        }));
        
        resolve();
      });
      
      ws.on('error', (error) => {
        console.error(`Failed to connect to node ${node.id}:`, error);
        reject(error);
      });
    });
  }

  private async synchronizeClocks(nodes: NodeConfig[]): Promise<void> {
    console.log('🕐 Synchronizing clocks across nodes...');
    
    const syncResults = await Promise.all(
      nodes.map(node => this.syncNodeClock(node))
    );
    
    // Calculate clock offsets
    const offsets = new Map<string, number>();
    syncResults.forEach((offset, index) => {
      offsets.set(nodes[index].id, offset);
    });
    
    // Broadcast offsets to all nodes
    const syncMessage = {
      type: 'clock_sync',
      offsets: Array.from(offsets.entries())
    };
    
    this.broadcast(syncMessage);
  }

  private async syncNodeClock(node: NodeConfig): Promise<number> {
    const ws = this.wsConnections.get(node.id);
    if (!ws) throw new Error(`No connection to node ${node.id}`);
    
    const samples: number[] = [];
    
    // Take multiple samples for accuracy
    for (let i = 0; i < 10; i++) {
      const t1 = performance.now();
      
      const response = await this.sendAndWaitForResponse(ws, {
        type: 'clock_sync_request',
        timestamp: t1
      });
      
      const t4 = performance.now();
      const t2 = response.serverReceiveTime;
      const t3 = response.serverSendTime;
      
      // Calculate offset using NTP algorithm
      const offset = ((t2 - t1) + (t3 - t4)) / 2;
      samples.push(offset);
    }
    
    // Use median to reduce outliers
    samples.sort((a, b) => a - b);
    return samples[Math.floor(samples.length / 2)];
  }

  private async deployProfilingAgents(
    nodes: NodeConfig[],
    code: string,
    context: any
  ): Promise<Map<string, boolean>> {
    console.log('📦 Deploying profiling agents...');
    
    const deploymentResults = new Map<string, boolean>();
    
    const deployPromises = nodes.map(async (node) => {
      try {
        const ws = this.wsConnections.get(node.id);
        if (!ws) throw new Error(`No connection to node ${node.id}`);
        
        await this.sendAndWaitForResponse(ws, {
          type: 'deploy_agent',
          code,
          context,
          config: {
            enableTracing: true,
            enableResourceMonitoring: true,
            sampleRate: 100
          }
        });
        
        deploymentResults.set(node.id, true);
      } catch (error) {
        console.error(`Failed to deploy to node ${node.id}:`, error);
        deploymentResults.set(node.id, false);
      }
    });
    
    await Promise.all(deployPromises);
    return deploymentResults;
  }

  private async executeDistributedProfiling(
    nodes: NodeConfig[],
    codeId: string,
    code: string,
    context: any,
    options: DistributedProfilingOptions
  ): Promise<NodeProfile[]> {
    console.log('🔬 Executing distributed profiling...');
    
    // Start profiling on all nodes
    const profilingPromises = nodes.map(node => 
      this.profileNode(node, codeId, code, context, options)
    );
    
    // Execute in parallel or sequentially based on options
    let results: NodeProfile[];
    if (options.parallel !== false) {
      results = await Promise.all(profilingPromises);
    } else {
      results = [];
      for (const promise of profilingPromises) {
        results.push(await promise);
      }
    }
    
    // Store results
    results.forEach(profile => {
      this.nodeProfiles.set(profile.nodeId, profile);
    });
    
    return results;
  }

  private async profileNode(
    node: NodeConfig,
    codeId: string,
    code: string,
    context: any,
    options: DistributedProfilingOptions
  ): Promise<NodeProfile> {
    const ws = this.wsConnections.get(node.id);
    if (!ws) {
      return {
        nodeId: node.id,
        profile: {} as PerformanceProfile,
        networkMetrics: this.getDefaultNetworkMetrics(),
        resourceContention: this.getDefaultResourceContention(),
        synchronizationOverhead: 0,
        status: 'failed',
        error: 'No connection to node'
      };
    }
    
    try {
      // Start profiling
      const startTime = performance.now();
      
      const response = await this.sendAndWaitForResponse(ws, {
        type: 'start_profiling',
        codeId,
        code,
        context,
        options: {
          duration: options.timeout || 30000,
          includeNetworkAnalysis: options.networkAnalysis,
          includeResourceContention: options.resourceContention
        }
      }, options.timeout || 30000);
      
      const endTime = performance.now();
      
      // Collect network metrics during profiling
      const networkMetrics = await this.measureNetworkMetrics(node);
      
      // Measure resource contention
      const resourceContention = options.resourceContention ? 
        await this.measureResourceContention(node) :
        this.getDefaultResourceContention();
      
      return {
        nodeId: node.id,
        profile: response.profile,
        networkMetrics,
        resourceContention,
        synchronizationOverhead: endTime - startTime - response.profile.executionProfile.totalTime,
        status: 'success'
      };
    } catch (error) {
      return {
        nodeId: node.id,
        profile: {} as PerformanceProfile,
        networkMetrics: this.getDefaultNetworkMetrics(),
        resourceContention: this.getDefaultResourceContention(),
        synchronizationOverhead: 0,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async measureNetworkMetrics(node: NodeConfig): Promise<NetworkMetrics> {
    const ws = this.wsConnections.get(node.id);
    if (!ws) return this.getDefaultNetworkMetrics();
    
    const latencySamples: number[] = [];
    const bandwidthTests: { upload: number; download: number }[] = [];
    
    // Measure latency
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      await this.sendAndWaitForResponse(ws, { type: 'ping' });
      const latency = performance.now() - start;
      latencySamples.push(latency);
    }
    
    // Measure bandwidth
    for (let size of [1024, 10240, 102400]) { // 1KB, 10KB, 100KB
      const payload = crypto.randomBytes(size);
      
      // Upload test
      const uploadStart = performance.now();
      await this.sendAndWaitForResponse(ws, { 
        type: 'bandwidth_test',
        direction: 'upload',
        payload: payload.toString('base64')
      });
      const uploadTime = performance.now() - uploadStart;
      const uploadBandwidth = (size * 8) / (uploadTime / 1000); // bits per second
      
      // Download test
      const downloadStart = performance.now();
      const response = await this.sendAndWaitForResponse(ws, {
        type: 'bandwidth_test',
        direction: 'download',
        size
      });
      const downloadTime = performance.now() - downloadStart;
      const downloadBandwidth = (response.payload.length * 8) / (downloadTime / 1000);
      
      bandwidthTests.push({
        upload: uploadBandwidth,
        download: downloadBandwidth
      });
    }
    
    // Calculate statistics
    latencySamples.sort((a, b) => a - b);
    
    return {
      latency: {
        min: latencySamples[0],
        max: latencySamples[latencySamples.length - 1],
        average: latencySamples.reduce((a, b) => a + b) / latencySamples.length,
        p95: latencySamples[Math.floor(latencySamples.length * 0.95)],
        p99: latencySamples[Math.floor(latencySamples.length * 0.99)]
      },
      bandwidth: {
        upload: Math.max(...bandwidthTests.map(t => t.upload)),
        download: Math.max(...bandwidthTests.map(t => t.download)),
        utilization: 0.7 // Estimated
      },
      packetLoss: 0, // Would need ICMP access
      jitter: this.calculateJitter(latencySamples),
      hops: 10 // Would need traceroute
    };
  }

  private calculateJitter(samples: number[]): number {
    if (samples.length < 2) return 0;
    
    let jitterSum = 0;
    for (let i = 1; i < samples.length; i++) {
      jitterSum += Math.abs(samples[i] - samples[i - 1]);
    }
    
    return jitterSum / (samples.length - 1);
  }

  private async measureResourceContention(node: NodeConfig): Promise<ResourceContention> {
    const ws = this.wsConnections.get(node.id);
    if (!ws) return this.getDefaultResourceContention();
    
    const response = await this.sendAndWaitForResponse(ws, {
      type: 'resource_contention'
    });
    
    return response.contention;
  }

  private async analyzeNetworkPerformance(
    nodes: NodeConfig[],
    nodeResults: NodeProfile[]
  ): Promise<NetworkAnalysis> {
    console.log('🔍 Analyzing network performance...');
    
    // Measure inter-node latency
    const interNodeLatency = await this.measureInterNodeLatency(nodes);
    
    // Analyze communication patterns from trace events
    const communicationPatterns = this.analyzeCommunicationPatterns();
    
    // Identify bottleneck links
    const bottleneckLinks = this.identifyNetworkBottlenecks(
      interNodeLatency,
      communicationPatterns
    );
    
    // Generate routing recommendations
    const optimalRouting = this.generateRoutingRecommendations(
      interNodeLatency,
      bottleneckLinks
    );
    
    // Calculate total network time
    const totalNetworkTime = nodeResults.reduce(
      (sum, node) => sum + node.synchronizationOverhead,
      0
    );
    
    return {
      totalNetworkTime,
      interNodeLatency,
      communicationPatterns,
      bottleneckLinks,
      optimalRouting
    };
  }

  private async measureInterNodeLatency(
    nodes: NodeConfig[]
  ): Promise<Map<string, Map<string, number>>> {
    const latencyMap = new Map<string, Map<string, number>>();
    
    for (const fromNode of nodes) {
      const nodeLatencies = new Map<string, number>();
      
      for (const toNode of nodes) {
        if (fromNode.id !== toNode.id) {
          const latency = await this.measureNodeToNodeLatency(fromNode, toNode);
          nodeLatencies.set(toNode.id, latency);
        }
      }
      
      latencyMap.set(fromNode.id, nodeLatencies);
    }
    
    return latencyMap;
  }

  private async measureNodeToNodeLatency(
    fromNode: NodeConfig,
    toNode: NodeConfig
  ): Promise<number> {
    const ws = this.wsConnections.get(fromNode.id);
    if (!ws) return Infinity;
    
    try {
      const response = await this.sendAndWaitForResponse(ws, {
        type: 'measure_latency_to',
        targetNode: toNode.id,
        targetEndpoint: toNode.endpoint
      });
      
      return response.latency;
    } catch {
      return Infinity;
    }
  }

  private analyzeCommunicationPatterns(): CommunicationPattern[] {
    const patterns: Map<string, CommunicationPattern> = new Map();
    
    // Analyze trace events
    const communications = this.traceEvents.filter(e => e.eventType === 'communication');
    
    // Detect broadcast pattern
    const broadcasts = this.detectBroadcastPattern(communications);
    if (broadcasts.frequency > 0) {
      patterns.set('broadcast', broadcasts);
    }
    
    // Detect scatter-gather pattern
    const scatterGather = this.detectScatterGatherPattern(communications);
    if (scatterGather.frequency > 0) {
      patterns.set('scatter-gather', scatterGather);
    }
    
    // Detect pipeline pattern
    const pipeline = this.detectPipelinePattern(communications);
    if (pipeline.frequency > 0) {
      patterns.set('pipeline', pipeline);
    }
    
    return Array.from(patterns.values());
  }

  private detectBroadcastPattern(events: TraceEvent[]): CommunicationPattern {
    let frequency = 0;
    let dataVolume = 0;
    
    // Look for one-to-many communication patterns
    const grouped = this.groupEventsByTimestamp(events, 100); // 100ms window
    
    for (const group of grouped) {
      const sources = new Set(group.map(e => e.data.source));
      const targets = new Set(group.map(e => e.data.target));
      
      if (sources.size === 1 && targets.size > 2) {
        frequency++;
        dataVolume += group.reduce((sum, e) => sum + (e.data.size || 0), 0);
      }
    }
    
    return {
      pattern: 'broadcast',
      frequency,
      dataVolume,
      efficiency: frequency > 0 ? 0.8 : 0 // Broadcasts are generally efficient
    };
  }

  private detectScatterGatherPattern(events: TraceEvent[]): CommunicationPattern {
    let frequency = 0;
    let dataVolume = 0;
    
    // Look for scatter followed by gather
    const scatters = events.filter(e => e.data.type === 'scatter');
    const gathers = events.filter(e => e.data.type === 'gather');
    
    for (const scatter of scatters) {
      const correspondingGather = gathers.find(
        g => g.timestamp > scatter.timestamp && 
             g.timestamp < scatter.timestamp + 5000 && // 5s window
             g.data.correlationId === scatter.data.correlationId
      );
      
      if (correspondingGather) {
        frequency++;
        dataVolume += scatter.data.size + correspondingGather.data.size;
      }
    }
    
    return {
      pattern: 'scatter-gather',
      frequency,
      dataVolume,
      efficiency: frequency > 0 ? 0.7 : 0
    };
  }

  private detectPipelinePattern(events: TraceEvent[]): CommunicationPattern {
    let frequency = 0;
    let dataVolume = 0;
    
    // Look for sequential communication patterns
    const chains = this.findCommunicationChains(events);
    
    for (const chain of chains) {
      if (chain.length >= 3) { // At least 3 nodes in pipeline
        frequency++;
        dataVolume += chain.reduce((sum, e) => sum + (e.data.size || 0), 0);
      }
    }
    
    return {
      pattern: 'pipeline',
      frequency,
      dataVolume,
      efficiency: frequency > 0 ? 0.6 : 0 // Pipelines have overhead
    };
  }

  private groupEventsByTimestamp(events: TraceEvent[], windowMs: number): TraceEvent[][] {
    const groups: TraceEvent[][] = [];
    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
    
    let currentGroup: TraceEvent[] = [];
    let groupStart = sorted[0]?.timestamp || 0;
    
    for (const event of sorted) {
      if (event.timestamp - groupStart <= windowMs) {
        currentGroup.push(event);
      } else {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [event];
        groupStart = event.timestamp;
      }
    }
    
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  }

  private findCommunicationChains(events: TraceEvent[]): TraceEvent[][] {
    const chains: TraceEvent[][] = [];
    const used = new Set<TraceEvent>();
    
    for (const event of events) {
      if (!used.has(event)) {
        const chain = this.buildChain(event, events, used);
        if (chain.length > 1) {
          chains.push(chain);
        }
      }
    }
    
    return chains;
  }

  private buildChain(
    start: TraceEvent,
    events: TraceEvent[],
    used: Set<TraceEvent>
  ): TraceEvent[] {
    const chain = [start];
    used.add(start);
    
    let current = start;
    while (true) {
      const next = events.find(
        e => !used.has(e) &&
             e.data.source === current.data.target &&
             e.timestamp > current.timestamp &&
             e.timestamp < current.timestamp + 1000 // 1s window
      );
      
      if (!next) break;
      
      chain.push(next);
      used.add(next);
      current = next;
    }
    
    return chain;
  }

  private identifyNetworkBottlenecks(
    latencyMap: Map<string, Map<string, number>>,
    patterns: CommunicationPattern[]
  ): NetworkBottleneck[] {
    const bottlenecks: NetworkBottleneck[] = [];
    
    // Find high-latency links
    for (const [fromNode, toNodes] of latencyMap) {
      for (const [toNode, latency] of toNodes) {
        if (latency > 100) { // 100ms threshold
          bottlenecks.push({
            fromNode,
            toNode,
            latency,
            bandwidth: 0, // Would need actual measurement
            congestion: latency / 10, // Rough estimate
            impact: this.calculateBottleneckImpact(fromNode, toNode, patterns)
          });
        }
      }
    }
    
    // Sort by impact
    return bottlenecks.sort((a, b) => b.impact - a.impact);
  }

  private calculateBottleneckImpact(
    fromNode: string,
    toNode: string,
    patterns: CommunicationPattern[]
  ): number {
    // Calculate based on how often this link is used in patterns
    let usage = 0;
    
    for (const pattern of patterns) {
      if (pattern.pattern === 'broadcast') {
        usage += pattern.frequency * 0.5;
      } else if (pattern.pattern === 'scatter-gather') {
        usage += pattern.frequency * 0.7;
      } else if (pattern.pattern === 'pipeline') {
        usage += pattern.frequency * 1.0;
      }
    }
    
    return Math.min(100, usage * 10);
  }

  private generateRoutingRecommendations(
    latencyMap: Map<string, Map<string, number>>,
    bottlenecks: NetworkBottleneck[]
  ): RoutingRecommendation[] {
    const recommendations: RoutingRecommendation[] = [];
    
    for (const bottleneck of bottlenecks) {
      // Find alternative paths
      const alternativePath = this.findAlternativePath(
        bottleneck.fromNode,
        bottleneck.toNode,
        latencyMap
      );
      
      if (alternativePath && alternativePath.totalLatency < bottleneck.latency * 0.8) {
        recommendations.push({
          currentPath: [bottleneck.fromNode, bottleneck.toNode],
          recommendedPath: alternativePath.path,
          expectedImprovement: (bottleneck.latency - alternativePath.totalLatency) / bottleneck.latency * 100,
          reason: `Reduce latency from ${bottleneck.latency}ms to ${alternativePath.totalLatency}ms`
        });
      }
    }
    
    return recommendations;
  }

  private findAlternativePath(
    from: string,
    to: string,
    latencyMap: Map<string, Map<string, number>>
  ): { path: string[]; totalLatency: number } | null {
    // Simple 2-hop path finding
    const fromLatencies = latencyMap.get(from);
    if (!fromLatencies) return null;
    
    let bestPath: string[] | null = null;
    let bestLatency = Infinity;
    
    for (const [intermediate, latency1] of fromLatencies) {
      if (intermediate === to) continue;
      
      const intermediateLatencies = latencyMap.get(intermediate);
      if (!intermediateLatencies) continue;
      
      const latency2 = intermediateLatencies.get(to);
      if (latency2 !== undefined) {
        const totalLatency = latency1 + latency2;
        if (totalLatency < bestLatency) {
          bestLatency = totalLatency;
          bestPath = [from, intermediate, to];
        }
      }
    }
    
    return bestPath ? { path: bestPath, totalLatency: bestLatency } : null;
  }

  private analyzeDistribution(nodeResults: NodeProfile[]): DistributionAnalysis {
    // Calculate load balance
    const executionTimes = nodeResults.map(n => n.profile.executionProfile?.totalTime || 0);
    const avgTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
    
    // Calculate Gini coefficient for load distribution
    const sortedTimes = [...executionTimes].sort((a, b) => a - b);
    let giniSum = 0;
    for (let i = 0; i < sortedTimes.length; i++) {
      giniSum += (2 * i - sortedTimes.length - 1) * sortedTimes[i];
    }
    const giniCoefficient = giniSum / (sortedTimes.length * executionTimes.reduce((a, b) => a + b, 0));
    
    // Identify overloaded and underutilized nodes
    const overloadedNodes = nodeResults
      .filter(n => (n.profile.executionProfile?.totalTime || 0) > avgTime * 1.5)
      .map(n => n.nodeId);
    
    const underutilizedNodes = nodeResults
      .filter(n => (n.profile.executionProfile?.totalTime || 0) < avgTime * 0.5)
      .map(n => n.nodeId);
    
    // Calculate parallel efficiency
    const serialTime = Math.max(...executionTimes);
    const parallelTime = avgTime;
    const speedup = serialTime / parallelTime;
    const efficiency = speedup / nodeResults.length;
    
    // Amdahl's Law limit
    const parallelFraction = 0.9; // Assume 90% parallelizable
    const amdahlLimit = 1 / ((1 - parallelFraction) + parallelFraction / nodeResults.length);
    
    return {
      loadBalance: {
        coefficient: giniCoefficient,
        imbalance: Math.abs(giniCoefficient),
        overloadedNodes,
        underutilizedNodes
      },
      dataLocality: {
        localityScore: 0.7, // Would need actual data transfer analysis
        crossNodeTransfers: 42, // Placeholder
        dataMovementCost: 100, // MB transferred
        recommendations: [
          'Consider data replication for frequently accessed datasets',
          'Use node affinity for data-intensive operations'
        ]
      },
      parallelEfficiency: {
        efficiency,
        speedup,
        scalability: efficiency * 100,
        amdahlLimit
      }
    };
  }

  private aggregateMetrics(nodeResults: NodeProfile[]): AggregatedMetrics {
    const executionTimes = nodeResults.map(n => n.profile.executionProfile?.totalTime || 0);
    const cpuUsages = nodeResults.map(n => n.profile.resourceUsage?.cpu.total || 0);
    const memoryUsages = nodeResults.map(n => n.profile.resourceUsage?.memory.heapUsed || 0);
    
    const totalTime = Math.max(...executionTimes);
    const avgTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
    
    // Calculate variance and standard deviation
    const variance = executionTimes.reduce((sum, time) => 
      sum + Math.pow(time - avgTime, 2), 0
    ) / executionTimes.length;
    
    const stdDev = Math.sqrt(variance);
    
    // Find slowest and fastest nodes
    const slowestIndex = executionTimes.indexOf(Math.max(...executionTimes));
    const fastestIndex = executionTimes.indexOf(Math.min(...executionTimes));
    
    return {
      totalExecutionTime: totalTime,
      averageNodeTime: avgTime,
      slowestNode: nodeResults[slowestIndex]?.nodeId || 'unknown',
      fastestNode: nodeResults[fastestIndex]?.nodeId || 'unknown',
      variance,
      standardDeviation: stdDev,
      resourceUtilization: {
        cpu: cpuUsages.reduce((a, b) => a + b, 0) / cpuUsages.length,
        memory: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
        network: 0.65, // Placeholder
        io: 0.45 // Placeholder
      }
    };
  }

  private async identifyDistributedBottlenecks(
    nodeResults: NodeProfile[],
    networkAnalysis?: NetworkAnalysis,
    distributionAnalysis?: DistributionAnalysis
  ): Promise<DistributedBottleneck[]> {
    const bottlenecks: DistributedBottleneck[] = [];
    
    // Aggregate node-level bottlenecks
    const nodeBottlenecks = new Map<string, Bottleneck[]>();
    for (const node of nodeResults) {
      if (node.profile.bottlenecks) {
        nodeBottlenecks.set(node.nodeId, node.profile.bottlenecks);
      }
    }
    
    // Find common bottlenecks across nodes
    const commonBottlenecks = this.findCommonBottlenecks(nodeBottlenecks);
    
    // Add network bottlenecks
    if (networkAnalysis) {
      for (const netBottleneck of networkAnalysis.bottleneckLinks) {
        bottlenecks.push({
          type: 'io',
          location: `Network link ${netBottleneck.fromNode} -> ${netBottleneck.toNode}`,
          impact: netBottleneck.impact,
          description: `High latency (${netBottleneck.latency}ms) on network link`,
          solution: 'Optimize network topology or increase bandwidth',
          nodes: [netBottleneck.fromNode, netBottleneck.toNode],
          networkImpact: netBottleneck.impact,
          synchronizationCost: netBottleneck.latency,
          distributedSolution: 'Consider edge caching or regional replication'
        });
      }
    }
    
    // Add load imbalance bottlenecks
    if (distributionAnalysis && distributionAnalysis.loadBalance.imbalance > 0.3) {
      bottlenecks.push({
        type: 'algorithm',
        location: 'Load distribution',
        impact: distributionAnalysis.loadBalance.imbalance * 100,
        description: `Load imbalance detected (Gini coefficient: ${distributionAnalysis.loadBalance.coefficient.toFixed(2)})`,
        solution: 'Rebalance workload distribution',
        nodes: distributionAnalysis.loadBalance.overloadedNodes,
        networkImpact: 0,
        synchronizationCost: 0,
        distributedSolution: 'Implement dynamic load balancing or work stealing'
      });
    }
    
    // Sort by impact
    return bottlenecks.sort((a, b) => b.impact - a.impact);
  }

  private findCommonBottlenecks(
    nodeBottlenecks: Map<string, Bottleneck[]>
  ): DistributedBottleneck[] {
    const bottleneckCounts = new Map<string, { bottleneck: Bottleneck; nodes: string[] }>();
    
    for (const [nodeId, bottlenecks] of nodeBottlenecks) {
      for (const bottleneck of bottlenecks) {
        const key = `${bottleneck.type}-${bottleneck.location}`;
        const existing = bottleneckCounts.get(key);
        
        if (existing) {
          existing.nodes.push(nodeId);
        } else {
          bottleneckCounts.set(key, {
            bottleneck,
            nodes: [nodeId]
          });
        }
      }
    }
    
    // Convert to distributed bottlenecks
    const distributed: DistributedBottleneck[] = [];
    for (const { bottleneck, nodes } of bottleneckCounts.values()) {
      if (nodes.length > 1) { // Bottleneck appears on multiple nodes
        distributed.push({
          ...bottleneck,
          nodes,
          networkImpact: 0,
          synchronizationCost: 0,
          distributedSolution: `Address ${bottleneck.type} bottleneck across ${nodes.length} nodes`
        });
      }
    }
    
    return distributed;
  }

  private generateDistributedRecommendations(
    bottlenecks: DistributedBottleneck[],
    distribution: DistributionAnalysis,
    network?: NetworkAnalysis
  ): string[] {
    const recommendations: string[] = [];
    
    // Bottleneck-based recommendations
    for (const bottleneck of bottlenecks.slice(0, 5)) { // Top 5
      recommendations.push(bottleneck.distributedSolution);
    }
    
    // Load balance recommendations
    if (distribution.loadBalance.imbalance > 0.3) {
      recommendations.push(
        'Implement dynamic load balancing to improve resource utilization',
        'Consider work stealing for better task distribution'
      );
    }
    
    // Data locality recommendations
    if (distribution.dataLocality.localityScore < 0.8) {
      recommendations.push(...distribution.dataLocality.recommendations);
    }
    
    // Parallel efficiency recommendations
    if (distribution.parallelEfficiency.efficiency < 0.7) {
      recommendations.push(
        'Reduce synchronization overhead between nodes',
        'Increase task granularity to improve parallel efficiency',
        `Current efficiency (${(distribution.parallelEfficiency.efficiency * 100).toFixed(1)}%) is below Amdahl's limit (${(distribution.parallelEfficiency.amdahlLimit * 100).toFixed(1)}%)`
      );
    }
    
    // Network recommendations
    if (network && network.totalNetworkTime > 1000) {
      recommendations.push(
        'High network overhead detected - consider colocating communicating components',
        'Implement message batching to reduce network round trips'
      );
      
      if (network.optimalRouting.length > 0) {
        recommendations.push(
          `Reroute communications for ${network.optimalRouting[0].expectedImprovement.toFixed(1)}% improvement`
        );
      }
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  private calculateDistributedScore(
    metrics: AggregatedMetrics,
    distribution: DistributionAnalysis,
    bottlenecks: DistributedBottleneck[]
  ): number {
    let score = 100;
    
    // Penalize for execution time variance
    const variancePenalty = Math.min(20, metrics.standardDeviation / metrics.averageNodeTime * 20);
    score -= variancePenalty;
    
    // Penalize for load imbalance
    const imbalancePenalty = distribution.loadBalance.imbalance * 30;
    score -= imbalancePenalty;
    
    // Penalize for low parallel efficiency
    const efficiencyPenalty = (1 - distribution.parallelEfficiency.efficiency) * 30;
    score -= efficiencyPenalty;
    
    // Penalize for bottlenecks
    const bottleneckPenalty = Math.min(20, bottlenecks.length * 2);
    score -= bottleneckPenalty;
    
    return Math.max(0, Math.round(score));
  }

  private async sendAndWaitForResponse(
    ws: WebSocket,
    message: any,
    timeout: number = 5000
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const messageId = crypto.randomUUID();
      const timeoutId = setTimeout(() => {
        reject(new Error('Response timeout'));
      }, timeout);
      
      const handler = (data: WebSocket.Data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.messageId === messageId) {
            clearTimeout(timeoutId);
            ws.off('message', handler);
            resolve(response);
          }
        } catch (error) {
          // Ignore parse errors
        }
      };
      
      ws.on('message', handler);
      ws.send(JSON.stringify({ ...message, messageId }));
    });
  }

  private broadcast(message: any): void {
    const messageStr = JSON.stringify(message);
    for (const ws of this.wsConnections.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    }
  }

  private generateDistributedProfileId(codeId: string): string {
    return `dist_profile_${codeId}_${Date.now()}`;
  }

  private getDefaultNetworkMetrics(): NetworkMetrics {
    return {
      latency: { min: 0, max: 0, average: 0, p95: 0, p99: 0 },
      bandwidth: { upload: 0, download: 0, utilization: 0 },
      packetLoss: 0,
      jitter: 0,
      hops: 0
    };
  }

  private getDefaultResourceContention(): ResourceContention {
    return {
      cpuContention: 0,
      memoryPressure: 0,
      ioBandwidth: 0,
      networkCongestion: 0,
      queueDepth: 0
    };
  }

  private async cleanup(): Promise<void> {
    // Close all WebSocket connections
    for (const ws of this.wsConnections.values()) {
      ws.close();
    }
    this.wsConnections.clear();
    
    // Close coordination server
    if (this.coordinationServer) {
      this.coordinationServer.close();
    }
    
    // Clear data
    this.nodeProfiles.clear();
    this.traceEvents = [];
  }

  async generateDistributedReport(profile: DistributedProfile): Promise<string> {
    return `
# Distributed Performance Profile Report
## Profile ID: ${profile.id}
## Generated: ${profile.timestamp.toISOString()}
## Overall Score: ${profile.overallScore}/100

### Execution Summary
- Total Nodes: ${profile.nodes.length}
- Successful Nodes: ${profile.nodes.filter(n => n.status === 'success').length}
- Total Execution Time: ${profile.aggregatedMetrics.totalExecutionTime.toFixed(2)}ms
- Average Node Time: ${profile.aggregatedMetrics.averageNodeTime.toFixed(2)}ms
- Standard Deviation: ${profile.aggregatedMetrics.standardDeviation.toFixed(2)}ms

### Node Performance
${profile.nodes.map(node => `
#### Node ${node.nodeId} (${node.status})
- Execution Time: ${node.profile.executionProfile?.totalTime.toFixed(2) || 'N/A'}ms
- Network Latency: ${node.networkMetrics.latency.average.toFixed(2)}ms (p95: ${node.networkMetrics.latency.p95.toFixed(2)}ms)
- Synchronization Overhead: ${node.synchronizationOverhead.toFixed(2)}ms
- Resource Contention: CPU ${(node.resourceContention.cpuContention * 100).toFixed(1)}%, Memory ${(node.resourceContention.memoryPressure * 100).toFixed(1)}%
${node.error ? `- Error: ${node.error}` : ''}
`).join('\n')}

### Load Distribution Analysis
- Load Balance Coefficient: ${profile.distributionAnalysis.loadBalance.coefficient.toFixed(3)}
- Overloaded Nodes: ${profile.distributionAnalysis.loadBalance.overloadedNodes.join(', ') || 'None'}
- Underutilized Nodes: ${profile.distributionAnalysis.loadBalance.underutilizedNodes.join(', ') || 'None'}

### Parallel Efficiency
- Efficiency: ${(profile.distributionAnalysis.parallelEfficiency.efficiency * 100).toFixed(1)}%
- Speedup: ${profile.distributionAnalysis.parallelEfficiency.speedup.toFixed(2)}x
- Scalability: ${profile.distributionAnalysis.parallelEfficiency.scalability.toFixed(1)}%
- Amdahl's Limit: ${(profile.distributionAnalysis.parallelEfficiency.amdahlLimit * 100).toFixed(1)}%

${profile.networkAnalysis ? `
### Network Analysis
- Total Network Time: ${profile.networkAnalysis.totalNetworkTime.toFixed(2)}ms
- Communication Patterns:
${profile.networkAnalysis.communicationPatterns.map(p => 
  `  - ${p.pattern}: ${p.frequency} occurrences, ${(p.dataVolume / 1024).toFixed(2)}KB transferred`
).join('\n')}
- Network Bottlenecks:
${profile.networkAnalysis.bottleneckLinks.slice(0, 5).map(b => 
  `  - ${b.fromNode} → ${b.toNode}: ${b.latency.toFixed(2)}ms latency (Impact: ${b.impact.toFixed(1)}%)`
).join('\n')}
` : ''}

### Distributed Bottlenecks
${profile.bottlenecks.slice(0, 10).map(b => `
- **${b.type.toUpperCase()}** at ${b.location} (Impact: ${b.impact.toFixed(1)}%)
  Nodes affected: ${b.nodes.join(', ')}
  ${b.description}
  Solution: ${b.distributedSolution}
`).join('\n')}

### Recommendations
${profile.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

### Resource Utilization
- CPU: ${(profile.aggregatedMetrics.resourceUtilization.cpu).toFixed(1)}%
- Memory: ${(profile.aggregatedMetrics.resourceUtilization.memory / 1024 / 1024).toFixed(2)}MB
- Network: ${(profile.aggregatedMetrics.resourceUtilization.network * 100).toFixed(1)}%
- I/O: ${(profile.aggregatedMetrics.resourceUtilization.io * 100).toFixed(1)}%
`;
  }
}