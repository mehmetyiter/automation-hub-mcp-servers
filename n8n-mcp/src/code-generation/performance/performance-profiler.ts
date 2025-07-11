import { PerformanceObserver, performance } from 'perf_hooks';
import { AIService } from '../../ai-service';
import { CodeGenerationDatabase } from '../database/code-generation-db';
import * as v8 from 'v8';
import * as os from 'os';
import { 
  PerformanceError,
  ValidationError 
} from '../errors/custom-errors';
import { ExecutionContext } from '../types/common-types';
import { EventEmitter } from 'events';
import { RealTimePerformanceMonitor, MonitoringOptions } from './websocket-monitor';
import { 
  DistributedPerformanceProfiler, 
  NodeConfig, 
  DistributedProfilingOptions,
  DistributedProfile 
} from './distributed-profiler';

export interface PerformanceProfile {
  id: string;
  codeId: string;
  timestamp: Date;
  executionProfile: ExecutionProfile;
  memoryProfile: MemoryProfile;
  cpuProfile: CPUProfile;
  resourceUsage: ResourceUsage;
  bottlenecks: Bottleneck[];
  optimizationSuggestions: OptimizationSuggestion[];
  overallScore: number;
}

export interface ExecutionProfile {
  totalTime: number;
  phases: ExecutionPhase[];
  functionCalls: FunctionCall[];
  asyncOperations: AsyncOperation[];
  hotspots: CodeHotspot[];
}

export interface ExecutionPhase {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
  percentage: number;
}

export interface FunctionCall {
  name: string;
  callCount: number;
  totalTime: number;
  averageTime: number;
  maxTime: number;
  minTime: number;
}

export interface AsyncOperation {
  type: 'promise' | 'timeout' | 'immediate' | 'io';
  count: number;
  totalWaitTime: number;
  averageWaitTime: number;
}

export interface CodeHotspot {
  location: string;
  timeSpent: number;
  percentage: number;
  optimizable: boolean;
  suggestion?: string;
}

export interface MemoryProfile {
  heapSnapshot: HeapSnapshot;
  leaks: MemoryLeak[];
  allocations: MemoryAllocation[];
  gcActivity: GCActivity;
}

export interface HeapSnapshot {
  totalSize: number;
  usedSize: number;
  limit: number;
  objects: ObjectAllocation[];
}

export interface ObjectAllocation {
  type: string;
  count: number;
  size: number;
  retained: number;
}

export interface MemoryLeak {
  location: string;
  type: string;
  size: number;
  growthRate: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface MemoryAllocation {
  timestamp: number;
  size: number;
  type: string;
  stack?: string;
}

export interface GCActivity {
  collections: number;
  totalTime: number;
  averageTime: number;
  frequency: number;
  type: 'scavenge' | 'mark-sweep' | 'incremental';
}

export interface CPUProfile {
  samples: CPUSample[];
  totalSamples: number;
  sampleInterval: number;
  threads: ThreadProfile[];
}

export interface CPUSample {
  timestamp: number;
  cpu: number;
  function: string;
  line?: number;
}

export interface ThreadProfile {
  id: number;
  cpuTime: number;
  idleTime: number;
  blocked: number;
}

export interface ResourceUsage {
  cpu: {
    user: number;
    system: number;
    total: number;
  };
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  io: {
    bytesRead: number;
    bytesWritten: number;
    syscalls: number;
  };
}

export interface Bottleneck {
  type: 'cpu' | 'memory' | 'io' | 'algorithm';
  location: string;
  impact: number; // 0-100
  description: string;
  solution: string;
}

export interface OptimizationSuggestion {
  category: 'performance' | 'memory' | 'algorithm' | 'async' | 'caching';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  implementation: string;
  expectedImprovement: number; // percentage
  effort: number; // hours
}

// Real-time monitoring interfaces (some moved to websocket-monitor.ts)
export interface RealTimeMetrics {
  timestamp: number;
  codeId: string;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  cpu: {
    user: number;
    system: number;
    total: number;
  };
  trends: PerformanceTrends;
  eventLoop: number; // lag in ms
  gc: GCInfo;
}

export interface PerformanceTrends {
  memory: {
    direction: 'increasing' | 'decreasing' | 'stable';
    rate: number; // bytes per second
  };
  cpu: {
    direction: 'increasing' | 'decreasing' | 'stable';
    rate: number; // ms per second
  };
}

export interface GCInfo {
  forced: boolean;
  duration: number;
  type: string;
}

export interface PerformanceThresholds {
  memory?: {
    heapUsed?: number;
    rss?: number;
  };
  cpu?: {
    user?: number;
    system?: number;
    total?: number;
  };
  eventLoopLag?: number;
}

export interface PerformanceAlert {
  type: 'memory' | 'cpu' | 'eventloop' | 'memory_leak';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  value: number;
  threshold: number;
}

export interface ProfilingOptions {
  duration?: number; // ms
  sampleRate?: number; // samples per second
  includeNative?: boolean;
  trackAllocations?: boolean;
  captureStackTraces?: boolean;
}

export class PerformanceProfiler extends EventEmitter {
  private aiService: AIService;
  private database: CodeGenerationDatabase;
  private performanceObserver?: PerformanceObserver;
  private profileCache: Map<string, PerformanceProfile>;
  private activeProfiles: Map<string, any>;
  private monitoringIntervals: Map<string, NodeJS.Timeout>;
  private performanceStreams: Map<string, any>;
  private realTimeMetrics: Map<string, RealTimeMetrics[]>;
  private wsMonitor: RealTimePerformanceMonitor;
  private distributedProfiler: DistributedPerformanceProfiler;

  constructor(provider?: string) {
    super();
    this.aiService = new AIService(provider);
    this.database = new CodeGenerationDatabase();
    this.profileCache = new Map();
    this.activeProfiles = new Map();
    this.monitoringIntervals = new Map();
    this.performanceStreams = new Map();
    this.realTimeMetrics = new Map();
    this.wsMonitor = new RealTimePerformanceMonitor();
    this.distributedProfiler = new DistributedPerformanceProfiler();
  }

  async profileCodeExecution(
    codeId: string,
    code: string,
    executionContext: ExecutionContext,
    options?: ProfilingOptions
  ): Promise<PerformanceProfile> {
    console.log('🔬 Starting performance profiling...');
    
    const profileId = this.generateProfileId(codeId);
    const startTime = performance.now();
    
    try {
      // Initialize profiling
      this.initializeProfiler(options);
      
      // Collect baseline metrics
      const baselineMetrics = this.collectBaselineMetrics();
      
      // Execute code with profiling
      const executionProfile = await this.profileExecution(code, executionContext, options);
      
      // Collect memory profile
      const memoryProfile = await this.profileMemory(code, executionContext);
      
      // Collect CPU profile
      const cpuProfile = await this.profileCPU(code, executionContext, options);
      
      // Calculate resource usage
      const resourceUsage = this.calculateResourceUsage(baselineMetrics);
      
      // Identify bottlenecks
      const bottlenecks = await this.identifyBottlenecks(
        executionProfile,
        memoryProfile,
        cpuProfile
      );
      
      // Generate optimization suggestions
      const optimizationSuggestions = await this.generateOptimizationSuggestions(
        code,
        bottlenecks,
        executionProfile,
        memoryProfile
      );
      
      const endTime = performance.now();
    
      const profile: PerformanceProfile = {
        id: profileId,
        codeId,
        timestamp: new Date(),
        executionProfile,
        memoryProfile,
        cpuProfile,
        resourceUsage,
        bottlenecks,
        optimizationSuggestions,
        overallScore: this.calculateOverallScore(
          executionProfile,
          memoryProfile,
          bottlenecks
        )
      };
      
      // Cache and store profile
      this.profileCache.set(profileId, profile);
      await this.storeProfile(profile);
      
      console.log(`✅ Profiling completed in ${endTime - startTime}ms`);
      
      return profile;
    } finally {
      // Clean up performance observer to prevent memory leaks
      if (this.performanceObserver) {
        this.performanceObserver.disconnect();
        this.performanceObserver = undefined;
      }
      
      // Clear performance marks and measures
      performance.clearMarks();
      performance.clearMeasures();
    }
  }

  private initializeProfiler(options?: ProfilingOptions) {
    // Set up performance observer
    this.performanceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Process performance entries
        this.processPerformanceEntry(entry);
      }
    });
    
    this.performanceObserver.observe({ 
      entryTypes: ['measure', 'function', 'mark'] 
    });
  }

  private async profileExecution(
    code: string,
    context: ExecutionContext,
    options?: ProfilingOptions
  ): Promise<ExecutionProfile> {
    // Add timeout protection
    const PROFILING_TIMEOUT = 30000; // 30 seconds
    
    return Promise.race([
      this.actualProfiling(code, context, options),
      new Promise<ExecutionProfile>((_, reject) => 
        setTimeout(() => reject(new PerformanceError(
          'Profiling timeout exceeded',
          'execution_time',
          PROFILING_TIMEOUT,
          PROFILING_TIMEOUT
        )), PROFILING_TIMEOUT)
      )
    ]);
  }

  private async actualProfiling(
    code: string,
    context: ExecutionContext,
    options?: ProfilingOptions
  ): Promise<ExecutionProfile> {
    const phases: ExecutionPhase[] = [];
    const functionCalls: Map<string, FunctionCall> = new Map();
    const asyncOps: Map<string, AsyncOperation> = new Map();
    const hotspots: CodeHotspot[] = [];
    
    // Instrument code for profiling
    const instrumentedCode = this.instrumentCode(code);
    
    // Execute with profiling
    const startTime = performance.now();
    performance.mark('execution-start');
    
    try {
      // Create function with instrumentation
      const fn = new Function(...Object.keys(context), instrumentedCode);
      
      // Execute multiple times for accuracy
      const iterations = options?.duration ? Math.ceil(options.duration / 100) : 10;
      
      for (let i = 0; i < iterations; i++) {
        performance.mark(`iteration-${i}-start`);
        await fn(...Object.values(context));
        performance.mark(`iteration-${i}-end`);
        performance.measure(`iteration-${i}`, `iteration-${i}-start`, `iteration-${i}-end`);
      }
    } catch (error) {
      console.error('Execution profiling error:', error);
    }
    
    performance.mark('execution-end');
    performance.measure('total-execution', 'execution-start', 'execution-end');
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    
    // Analyze performance marks
    const entries = performance.getEntriesByType('measure');
    entries.forEach(entry => {
      phases.push({
        name: entry.name,
        startTime: entry.startTime,
        endTime: entry.startTime + entry.duration,
        duration: entry.duration,
        percentage: (entry.duration / totalTime) * 100
      });
    });
    
    // Clear marks
    performance.clearMarks();
    performance.clearMeasures();
    
    return {
      totalTime,
      phases,
      functionCalls: Array.from(functionCalls.values()),
      asyncOperations: Array.from(asyncOps.values()),
      hotspots
    };
  }

  private instrumentCode(code: string): string {
    // Add performance tracking to code
    return `
const __perf = {
  marks: new Map(),
  measures: new Map(),
  mark: (name) => {
    __perf.marks.set(name, performance.now());
    performance.mark(name);
  },
  measure: (name, start, end) => {
    const duration = (__perf.marks.get(end) || performance.now()) - __perf.marks.get(start);
    __perf.measures.set(name, duration);
    performance.measure(name, start, end);
  }
};

// Wrap async operations
const __originalPromise = Promise;
Promise = new Proxy(__originalPromise, {
  construct(target, args) {
    __perf.mark('promise-start');
    const promise = new target(...args);
    promise.finally(() => __perf.measure('promise', 'promise-start', 'promise-end'));
    return promise;
  }
});

// Start profiling
__perf.mark('code-start');

${code}

// End profiling
__perf.mark('code-end');
__perf.measure('code-execution', 'code-start', 'code-end');
`;
  }

  private async profileMemory(
    code: string,
    context: any
  ): Promise<MemoryProfile> {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Take initial heap snapshot
    const initialHeap = v8.getHeapStatistics();
    const heapSnapshots: v8.HeapInfo[] = [];
    const allocations: MemoryAllocation[] = [];
    
    // Track allocations during execution
    const startTime = Date.now();
    
    // Execute code multiple times to detect leaks
    for (let i = 0; i < 5; i++) {
      const beforeHeap = process.memoryUsage();
      
      // Execute code
      try {
        const fn = new Function(...Object.keys(context), code);
        await fn(...Object.values(context));
      } catch (error) {
        // Continue profiling even with errors
      }
      
      const afterHeap = process.memoryUsage();
      
      allocations.push({
        timestamp: Date.now() - startTime,
        size: afterHeap.heapUsed - beforeHeap.heapUsed,
        type: 'execution'
      });
      
      heapSnapshots.push(v8.getHeapStatistics());
      
      // Force GC between iterations
      if (global.gc) {
        global.gc();
      }
    }
    
    // Analyze heap growth for leaks
    const leaks = this.detectMemoryLeaks(heapSnapshots, allocations);
    
    // Get final heap snapshot
    const finalHeap = v8.getHeapStatistics();
    
    return {
      heapSnapshot: {
        totalSize: finalHeap.total_heap_size,
        usedSize: finalHeap.used_heap_size,
        limit: finalHeap.heap_size_limit,
        objects: this.analyzeHeapObjects()
      },
      leaks,
      allocations,
      gcActivity: {
        collections: 0, // Would need V8 flags to track
        totalTime: 0,
        averageTime: 0,
        frequency: 0,
        type: 'mark-sweep'
      }
    };
  }

  private detectMemoryLeaks(
    heapSnapshots: v8.HeapInfo[],
    allocations: MemoryAllocation[]
  ): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];
    
    if (heapSnapshots.length < 2) return leaks;
    
    // Calculate heap growth rate
    const firstHeap = heapSnapshots[0];
    const lastHeap = heapSnapshots[heapSnapshots.length - 1];
    const heapGrowth = lastHeap.used_heap_size - firstHeap.used_heap_size;
    const growthRate = heapGrowth / heapSnapshots.length;
    
    if (growthRate > 1024 * 1024) { // 1MB per iteration
      leaks.push({
        location: 'heap',
        type: 'memory',
        size: heapGrowth,
        growthRate,
        severity: growthRate > 10 * 1024 * 1024 ? 'critical' : 
                  growthRate > 5 * 1024 * 1024 ? 'high' : 'medium'
      });
    }
    
    return leaks;
  }

  private analyzeHeapObjects(): ObjectAllocation[] {
    // This would require heap snapshot API
    // For now, return placeholder data
    return [
      { type: 'Object', count: 1000, size: 32000, retained: 16000 },
      { type: 'Array', count: 500, size: 24000, retained: 12000 },
      { type: 'String', count: 2000, size: 64000, retained: 32000 }
    ];
  }

  private async profileCPU(
    code: string,
    context: ExecutionContext,
    options?: ProfilingOptions
  ): Promise<CPUProfile> {
    const samples: CPUSample[] = [];
    const sampleInterval = 1000 / (options?.sampleRate || 100); // Default 100 samples/sec
    
    // Start CPU profiling
    const startCPU = process.cpuUsage();
    const startTime = Date.now();
    
    // Execute code with sampling
    const samplingInterval = setInterval(() => {
      const usage = process.cpuUsage(startCPU);
      samples.push({
        timestamp: Date.now() - startTime,
        cpu: (usage.user + usage.system) / 1000, // Convert to ms
        function: 'main' // Would need V8 profiler for actual function names
      });
    }, sampleInterval);
    
    try {
      const fn = new Function(...Object.keys(context), code);
      await fn(...Object.values(context));
    } catch (error) {
      // Continue profiling
    }
    
    clearInterval(samplingInterval);
    
    const endCPU = process.cpuUsage(startCPU);
    
    return {
      samples,
      totalSamples: samples.length,
      sampleInterval,
      threads: [{
        id: 0,
        cpuTime: (endCPU.user + endCPU.system) / 1000,
        idleTime: 0,
        blocked: 0
      }]
    };
  }

  private collectBaselineMetrics(): {
    cpu: NodeJS.CpuUsage;
    memory: NodeJS.MemoryUsage;
    time: number;
  } {
    return {
      cpu: process.cpuUsage(),
      memory: process.memoryUsage(),
      time: Date.now()
    };
  }

  private calculateResourceUsage(baseline: {
    cpu: NodeJS.CpuUsage;
    memory: NodeJS.MemoryUsage;
    time: number;
  }): ResourceUsage {
    const currentCPU = process.cpuUsage(baseline.cpu);
    const currentMemory = process.memoryUsage();
    
    return {
      cpu: {
        user: currentCPU.user / 1000, // Convert to ms
        system: currentCPU.system / 1000,
        total: (currentCPU.user + currentCPU.system) / 1000
      },
      memory: {
        rss: currentMemory.rss,
        heapTotal: currentMemory.heapTotal,
        heapUsed: currentMemory.heapUsed,
        external: currentMemory.external
      },
      io: {
        bytesRead: 0, // Would need OS-specific tracking
        bytesWritten: 0,
        syscalls: 0
      }
    };
  }

  private async identifyBottlenecks(
    execution: ExecutionProfile,
    memory: MemoryProfile,
    cpu: CPUProfile
  ): Promise<Bottleneck[]> {
    const bottlenecks: Bottleneck[] = [];
    
    // CPU bottlenecks
    const avgCPU = cpu.samples.reduce((sum, s) => sum + s.cpu, 0) / cpu.samples.length;
    if (avgCPU > 80) {
      bottlenecks.push({
        type: 'cpu',
        location: 'main execution',
        impact: Math.min(100, avgCPU),
        description: 'High CPU usage detected',
        solution: 'Optimize algorithms and reduce computational complexity'
      });
    }
    
    // Memory bottlenecks
    if (memory.leaks.length > 0) {
      memory.leaks.forEach(leak => {
        bottlenecks.push({
          type: 'memory',
          location: leak.location,
          impact: leak.severity === 'critical' ? 90 : 
                  leak.severity === 'high' ? 70 : 50,
          description: `Memory leak detected: ${leak.growthRate / 1024 / 1024}MB per iteration`,
          solution: 'Fix memory leaks by properly cleaning up resources'
        });
      });
    }
    
    // Algorithm bottlenecks (from hotspots)
    execution.hotspots.forEach(hotspot => {
      if (hotspot.percentage > 20) {
        bottlenecks.push({
          type: 'algorithm',
          location: hotspot.location,
          impact: hotspot.percentage,
          description: `Hotspot consuming ${hotspot.percentage.toFixed(1)}% of execution time`,
          solution: hotspot.suggestion || 'Optimize this code section'
        });
      }
    });
    
    return bottlenecks;
  }

  private async generateOptimizationSuggestions(
    code: string,
    bottlenecks: Bottleneck[],
    execution: ExecutionProfile,
    memory: MemoryProfile
  ): Promise<OptimizationSuggestion[]> {
    console.log('🤔 Generating optimization suggestions...');
    
    const prompt = `
Analyze this code and performance profile to suggest optimizations:

Code:
${code}

Performance Profile:
- Total execution time: ${execution.totalTime}ms
- Memory leaks: ${memory.leaks.length}
- Bottlenecks: ${JSON.stringify(bottlenecks, null, 2)}

Generate optimization suggestions:
{
  "suggestions": [
    {
      "category": "performance|memory|algorithm|async|caching",
      "priority": "low|medium|high|critical",
      "description": "what to optimize",
      "implementation": "how to implement",
      "expectedImprovement": <percentage>,
      "effort": <hours>
    }
  ]
}

Focus on:
1. Algorithm optimizations
2. Memory usage improvements
3. Async operation optimization
4. Caching opportunities
5. Code restructuring for performance`;

    try {
      const response = await this.aiService.getJSONResponse(prompt);
      return response.suggestions || this.generateDefaultSuggestions(bottlenecks);
    } catch (error) {
      return this.generateDefaultSuggestions(bottlenecks);
    }
  }

  private generateDefaultSuggestions(bottlenecks: Bottleneck[]): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    
    bottlenecks.forEach(bottleneck => {
      if (bottleneck.type === 'cpu') {
        suggestions.push({
          category: 'algorithm',
          priority: bottleneck.impact > 80 ? 'critical' : 'high',
          description: 'Optimize CPU-intensive operations',
          implementation: 'Use more efficient algorithms or data structures',
          expectedImprovement: 30,
          effort: 4
        });
      }
      
      if (bottleneck.type === 'memory') {
        suggestions.push({
          category: 'memory',
          priority: 'high',
          description: 'Fix memory leaks',
          implementation: 'Properly dispose of resources and clear references',
          expectedImprovement: 50,
          effort: 2
        });
      }
    });
    
    // Always suggest caching
    suggestions.push({
      category: 'caching',
      priority: 'medium',
      description: 'Implement result caching',
      implementation: 'Cache frequently computed results',
      expectedImprovement: 20,
      effort: 3
    });
    
    return suggestions;
  }

  async optimizeCode(
    codeId: string,
    code: string,
    profile: PerformanceProfile
  ): Promise<string> {
    console.log('🚀 Optimizing code based on profile...');
    
    const prompt = `
Optimize this code based on the performance profile:

Original Code:
${code}

Bottlenecks:
${JSON.stringify(profile.bottlenecks, null, 2)}

Optimization Suggestions:
${JSON.stringify(profile.optimizationSuggestions, null, 2)}

Apply the suggested optimizations and return the optimized code.
Focus on:
1. Fixing identified bottlenecks
2. Implementing suggested optimizations
3. Maintaining functionality while improving performance
4. Adding appropriate comments for optimizations`;

    const optimizedCode = await this.aiService.callAI(prompt);
    
    // Clean the response
    return this.cleanOptimizedCode(optimizedCode);
  }

  private cleanOptimizedCode(code: string): string {
    // Remove markdown code blocks
    code = code.replace(/```javascript\n?/gi, '');
    code = code.replace(/```js\n?/gi, '');
    code = code.replace(/```\n?/g, '');
    
    return code.trim();
  }

  private calculateOverallScore(
    execution: ExecutionProfile,
    memory: MemoryProfile,
    bottlenecks: Bottleneck[]
  ): number {
    let score = 100;
    
    // Deduct for execution time (normalize to 100ms baseline)
    const timeScore = Math.max(0, 100 - (execution.totalTime / 100) * 10);
    score = score * 0.4 + timeScore * 0.4;
    
    // Deduct for memory issues
    const memoryScore = 100 - (memory.leaks.length * 20);
    score = score * 0.3 + memoryScore * 0.3;
    
    // Deduct for bottlenecks
    const bottleneckScore = 100 - bottlenecks.reduce((sum, b) => sum + b.impact, 0) / bottlenecks.length;
    score = score * 0.3 + bottleneckScore * 0.3;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private processPerformanceEntry(entry: PerformanceEntry) {
    // Process performance observer entries
    // Store for analysis
  }

  private generateProfileId(codeId: string): string {
    return `profile_${codeId}_${Date.now()}`;
  }

  private async storeProfile(profile: PerformanceProfile): Promise<void> {
    // Store profile in database
    console.log(`💾 Storing performance profile ${profile.id}`);
  }

  async compareProfiles(
    profileId1: string,
    profileId2: string
  ): Promise<{
    improvement: number;
    details: string;
    comparison: {
      executionTime: {
        before: number;
        after: number;
        change: number;
      };
      memoryUsage: {
        before: number;
        after: number;
        change: number;
      };
      bottlenecks: {
        before: number;
        after: number;
        resolved: Bottleneck[];
      };
    };
  }> {
    const profile1 = this.profileCache.get(profileId1);
    const profile2 = this.profileCache.get(profileId2);
    
    if (!profile1) {
      throw new ValidationError(
        'Profile 1 not found',
        { field: 'profileId1', value: profileId1 }
      );
    }
    
    if (!profile2) {
      throw new ValidationError(
        'Profile 2 not found',
        { field: 'profileId2', value: profileId2 }
      );
    }
    
    const improvement = profile2.overallScore - profile1.overallScore;
    
    return {
      improvement,
      details: `Performance ${improvement > 0 ? 'improved' : 'degraded'} by ${Math.abs(improvement)}%`,
      comparison: {
        executionTime: {
          before: profile1.executionProfile.totalTime,
          after: profile2.executionProfile.totalTime,
          change: profile2.executionProfile.totalTime - profile1.executionProfile.totalTime
        },
        memoryUsage: {
          before: profile1.memoryProfile.heapSnapshot.usedSize,
          after: profile2.memoryProfile.heapSnapshot.usedSize,
          change: profile2.memoryProfile.heapSnapshot.usedSize - profile1.memoryProfile.heapSnapshot.usedSize
        },
        bottlenecks: {
          before: profile1.bottlenecks.length,
          after: profile2.bottlenecks.length,
          resolved: profile1.bottlenecks.filter(b1 => 
            !profile2.bottlenecks.some(b2 => b2.location === b1.location)
          )
        }
      }
    };
  }

  async generatePerformanceReport(profile: PerformanceProfile): Promise<string> {
    return `
# Performance Profile Report
## Profile ID: ${profile.id}
## Generated: ${profile.timestamp.toISOString()}

### Overall Performance Score: ${profile.overallScore}/100

### Execution Profile
- Total Time: ${profile.executionProfile.totalTime.toFixed(2)}ms
- Phases: ${profile.executionProfile.phases.length}
- Function Calls: ${profile.executionProfile.functionCalls.length}
- Async Operations: ${profile.executionProfile.asyncOperations.length}

### Memory Profile
- Heap Used: ${(profile.memoryProfile.heapSnapshot.usedSize / 1024 / 1024).toFixed(2)}MB
- Heap Total: ${(profile.memoryProfile.heapSnapshot.totalSize / 1024 / 1024).toFixed(2)}MB
- Memory Leaks: ${profile.memoryProfile.leaks.length}
${profile.memoryProfile.leaks.map(leak => 
  `  - ${leak.type} leak: ${(leak.size / 1024 / 1024).toFixed(2)}MB growth (${leak.severity})`
).join('\n')}

### CPU Profile
- Total CPU Time: ${profile.cpuProfile.threads[0].cpuTime.toFixed(2)}ms
- Samples Collected: ${profile.cpuProfile.totalSamples}

### Resource Usage
- CPU: ${profile.resourceUsage.cpu.total.toFixed(2)}ms (User: ${profile.resourceUsage.cpu.user.toFixed(2)}ms, System: ${profile.resourceUsage.cpu.system.toFixed(2)}ms)
- Memory RSS: ${(profile.resourceUsage.memory.rss / 1024 / 1024).toFixed(2)}MB
- Heap Used: ${(profile.resourceUsage.memory.heapUsed / 1024 / 1024).toFixed(2)}MB

### Bottlenecks (${profile.bottlenecks.length})
${profile.bottlenecks.map(b => 
  `- **${b.type.toUpperCase()}** at ${b.location} (Impact: ${b.impact}%)
  ${b.description}
  Solution: ${b.solution}`
).join('\n\n')}

### Optimization Suggestions (${profile.optimizationSuggestions.length})
${profile.optimizationSuggestions
  .sort((a, b) => {
    const priority = { critical: 4, high: 3, medium: 2, low: 1 };
    return priority[b.priority] - priority[a.priority];
  })
  .map(s => 
    `#### ${s.priority.toUpperCase()}: ${s.description}
- Category: ${s.category}
- Implementation: ${s.implementation}
- Expected Improvement: ${s.expectedImprovement}%
- Effort: ${s.effort} hours`
  ).join('\n\n')}

### Recommendations
1. Address critical and high-priority bottlenecks first
2. Implement suggested optimizations in order of priority
3. Re-profile after each optimization to measure improvement
4. Consider caching for frequently computed results
5. Monitor memory usage in production
`;
  }

  // Real-time Performance Monitoring Implementation
  async startRealTimeMonitoring(
    codeId: string,
    options: {
      interval?: number;
      thresholds?: PerformanceThresholds;
      onAlert?: (alert: PerformanceAlert) => void;
      onMetrics?: (metrics: RealTimeMetrics) => void;
    } = {}
  ): Promise<string> {
    const monitoringId = `monitor_${codeId}_${Date.now()}`;
    const interval = options.interval || 1000; // Default 1 second
    
    console.log(`🔄 Starting real-time monitoring for ${codeId} (interval: ${interval}ms)`);
    
    // Initialize metrics storage
    this.realTimeMetrics.set(monitoringId, []);
    
    const monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.collectRealTimeMetrics(codeId);
        
        // Store metrics
        const metricsHistory = this.realTimeMetrics.get(monitoringId) || [];
        metricsHistory.push(metrics);
        
        // Keep only last 100 measurements to prevent memory issues
        if (metricsHistory.length > 100) {
          metricsHistory.shift();
        }
        this.realTimeMetrics.set(monitoringId, metricsHistory);
        
        // Check thresholds and generate alerts
        if (options.thresholds) {
          const alerts = this.checkThresholds(metrics, options.thresholds);
          alerts.forEach(alert => {
            console.warn(`⚠️ Performance Alert: ${alert.message}`);
            options.onAlert?.(alert);
          });
        }
        
        // Emit metrics
        options.onMetrics?.(metrics);
        
      } catch (error) {
        console.error('Real-time monitoring error:', error);
      }
    }, interval);
    
    this.monitoringIntervals.set(monitoringId, monitoringInterval);
    
    return monitoringId;
  }

  async stopRealTimeMonitoring(monitoringId: string): Promise<void> {
    const interval = this.monitoringIntervals.get(monitoringId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(monitoringId);
      console.log(`⏹️ Stopped real-time monitoring: ${monitoringId}`);
    }
    
    // Clean up metrics data
    this.realTimeMetrics.delete(monitoringId);
  }

  private async collectRealTimeMetrics(codeId: string): Promise<RealTimeMetrics> {
    const timestamp = Date.now();
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Get current resource usage
    const resourceMetrics = {
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        rss: memoryUsage.rss,
        external: memoryUsage.external
      },
      cpu: {
        user: cpuUsage.user / 1000, // Convert to ms
        system: cpuUsage.system / 1000,
        total: (cpuUsage.user + cpuUsage.system) / 1000
      }
    };
    
    // Calculate rates and trends
    const previousMetrics = this.getPreviousMetrics(codeId);
    const trends = this.calculateTrends(resourceMetrics, previousMetrics);
    
    return {
      timestamp,
      codeId,
      memory: resourceMetrics.memory,
      cpu: resourceMetrics.cpu,
      trends,
      eventLoop: await this.measureEventLoopLag(),
      gc: this.getGCStats()
    };
  }

  private getPreviousMetrics(codeId: string): RealTimeMetrics | null {
    for (const [_, metrics] of this.realTimeMetrics.entries()) {
      const codeMetrics = metrics.filter(m => m.codeId === codeId);
      if (codeMetrics.length > 0) {
        return codeMetrics[codeMetrics.length - 1];
      }
    }
    return null;
  }

  private calculateTrends(
    current: { memory: any; cpu: any },
    previous: RealTimeMetrics | null
  ): PerformanceTrends {
    if (!previous) {
      return {
        memory: { direction: 'stable', rate: 0 },
        cpu: { direction: 'stable', rate: 0 }
      };
    }
    
    const memoryDiff = current.memory.heapUsed - previous.memory.heapUsed;
    const cpuDiff = current.cpu.total - previous.cpu.total;
    const timeDiff = Date.now() - previous.timestamp;
    
    return {
      memory: {
        direction: memoryDiff > 0 ? 'increasing' : memoryDiff < 0 ? 'decreasing' : 'stable',
        rate: memoryDiff / (timeDiff / 1000) // bytes per second
      },
      cpu: {
        direction: cpuDiff > 0 ? 'increasing' : cpuDiff < 0 ? 'decreasing' : 'stable',
        rate: cpuDiff / (timeDiff / 1000) // ms per second
      }
    };
  }

  private async measureEventLoopLag(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        resolve(lag);
      });
    });
  }

  private getGCStats(): GCInfo {
    // Basic GC info - would require --expose-gc flag for detailed stats
    return {
      forced: false,
      duration: 0,
      type: 'unknown'
    };
  }

  private checkThresholds(
    metrics: RealTimeMetrics,
    thresholds: PerformanceThresholds
  ): PerformanceAlert[] {
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
    
    // Memory trend alerts
    if (metrics.trends.memory.direction === 'increasing' && metrics.trends.memory.rate > 1024 * 1024) { // 1MB/s
      alerts.push({
        type: 'memory_leak',
        severity: 'high',
        message: `Potential memory leak detected (${(metrics.trends.memory.rate / 1024 / 1024).toFixed(2)}MB/s growth)`,
        timestamp: metrics.timestamp,
        value: metrics.trends.memory.rate,
        threshold: 1024 * 1024
      });
    }
    
    return alerts;
  }

  getRealTimeMetrics(monitoringId: string): RealTimeMetrics[] {
    return this.realTimeMetrics.get(monitoringId) || [];
  }

  getActiveMonitors(): string[] {
    return Array.from(this.monitoringIntervals.keys());
  }

  async generateRealTimeReport(monitoringId: string): Promise<string> {
    const metrics = this.getRealTimeMetrics(monitoringId);
    
    if (metrics.length === 0) {
      return 'No real-time metrics available';
    }
    
    const latest = metrics[metrics.length - 1];
    const duration = metrics.length > 1 ? latest.timestamp - metrics[0].timestamp : 0;
    
    return `
# Real-Time Performance Report
## Monitoring ID: ${monitoringId}
## Duration: ${(duration / 1000).toFixed(2)} seconds
## Samples: ${metrics.length}

### Latest Metrics (${new Date(latest.timestamp).toISOString()})
- Memory: ${(latest.memory.heapUsed / 1024 / 1024).toFixed(2)}MB / ${(latest.memory.heapTotal / 1024 / 1024).toFixed(2)}MB
- CPU: ${latest.cpu.total.toFixed(2)}ms (User: ${latest.cpu.user.toFixed(2)}ms, System: ${latest.cpu.system.toFixed(2)}ms)
- Event Loop Lag: ${latest.eventLoop.toFixed(2)}ms

### Trends
- Memory: ${latest.trends.memory.direction} (${(latest.trends.memory.rate / 1024).toFixed(2)} KB/s)
- CPU: ${latest.trends.cpu.direction} (${latest.trends.cpu.rate.toFixed(2)} ms/s)

### Statistics
- Average Memory: ${(metrics.reduce((sum, m) => sum + m.memory.heapUsed, 0) / metrics.length / 1024 / 1024).toFixed(2)}MB
- Peak Memory: ${(Math.max(...metrics.map(m => m.memory.heapUsed)) / 1024 / 1024).toFixed(2)}MB
- Average CPU: ${(metrics.reduce((sum, m) => sum + m.cpu.total, 0) / metrics.length).toFixed(2)}ms
- Peak Event Loop Lag: ${Math.max(...metrics.map(m => m.eventLoop)).toFixed(2)}ms
`;
  }

  cleanup(): void {
    // Stop all active monitoring
    for (const [monitoringId] of this.monitoringIntervals) {
      this.stopRealTimeMonitoring(monitoringId);
    }
    
    // Shutdown WebSocket monitor
    this.wsMonitor.shutdown();
    
    // Clear all data
    this.realTimeMetrics.clear();
    this.performanceStreams.clear();
    
    console.log('🧹 Performance monitoring cleanup completed');
  }

  // WebSocket-based monitoring methods
  async startWebSocketMonitoring(
    codeId: string,
    options: MonitoringOptions = {}
  ): Promise<string> {
    console.log(`🌐 Starting WebSocket-based monitoring for ${codeId}`);
    return await this.wsMonitor.startWebSocketMonitoring(codeId, options);
  }

  async stopWebSocketMonitoring(sessionId: string): Promise<void> {
    console.log(`🛑 Stopping WebSocket monitoring session: ${sessionId}`);
    await this.wsMonitor.stopWebSocketMonitoring(sessionId);
  }

  async detectMemoryLeaks(codeId: string, timeWindow: string = '1h'): Promise<any> {
    console.log(`🔍 Detecting memory leaks for ${codeId}`);
    return await this.wsMonitor.detectMemoryLeaks(codeId, timeWindow);
  }

  initializeWebSocketServer(port: number): void {
    console.log(`🚀 Initializing WebSocket server on port ${port}`);
    this.wsMonitor = new RealTimePerformanceMonitor(port);
    
    // Set up event listeners for alerts and metrics
    this.wsMonitor.on('alert', (alert: PerformanceAlert) => {
      console.warn(`⚠️ Performance Alert: ${alert.message}`);
    });
    
    this.wsMonitor.on('metrics', (metrics: RealTimeMetrics) => {
      // Process real-time metrics if needed
      this.emit('metrics', metrics);
    });
  }

  getWebSocketMonitor(): RealTimePerformanceMonitor {
    return this.wsMonitor;
  }

  async profileDistributed(
    codeId: string,
    code: string,
    nodes: NodeConfig[],
    executionContext: ExecutionContext,
    options?: DistributedProfilingOptions
  ): Promise<DistributedProfile> {
    console.log(`🌐 Starting distributed profiling for ${codeId} across ${nodes.length} nodes`);
    
    try {
      const profile = await this.distributedProfiler.profileAcrossNodes(
        codeId,
        nodes,
        code,
        executionContext,
        options
      );
      
      // Cache the distributed profile
      this.profileCache.set(profile.id, {
        id: profile.id,
        codeId: profile.codeId,
        timestamp: profile.timestamp,
        executionProfile: profile.aggregatedMetrics as any,
        memoryProfile: {} as any,
        cpuProfile: {} as any,
        resourceUsage: {} as any,
        bottlenecks: profile.bottlenecks,
        optimizationSuggestions: profile.recommendations.map(r => ({
          category: 'performance',
          priority: 'high',
          description: r,
          implementation: '',
          expectedImprovement: 10,
          effort: 2
        })),
        overallScore: profile.overallScore
      });
      
      // Emit distributed profiling events
      this.emit('distributed-profile', profile);
      
      return profile;
    } catch (error) {
      console.error('Distributed profiling failed:', error);
      throw new PerformanceError(
        'Failed to perform distributed profiling',
        'distributed',
        0,
        0
      );
    }
  }

  async generateDistributedReport(
    profileOrId: string | DistributedProfile,
    nodes?: Array<{ id: string; endpoint: string }>
  ): Promise<string> {
    if (typeof profileOrId === 'string') {
      // Legacy compatibility - generate simple report
      console.log(`📊 Generating distributed performance report for ${profileOrId}`);
      
      return `
# Distributed Performance Report
## Code ID: ${profileOrId}
## Nodes: ${nodes?.length || 0}

### Node Performance Summary
${nodes?.map(node => `- Node ${node.id}: ${node.endpoint}`).join('\n') || 'No nodes specified'}

### Note
For detailed distributed profiling, use the profileDistributed() method.
`;
    }
    
    // Generate detailed report from actual distributed profile
    return await this.distributedProfiler.generateDistributedReport(profileOrId);
  }
}