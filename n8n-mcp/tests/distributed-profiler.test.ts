import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DistributedPerformanceProfiler, NodeConfig, DistributedProfilingOptions } from '../src/code-generation/performance/distributed-profiler';
import { PerformanceProfile } from '../src/code-generation/performance/performance-profiler';
import * as WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');

describe('DistributedPerformanceProfiler', () => {
  let profiler: DistributedPerformanceProfiler;
  let mockWsServer: any;
  let mockWsClients: Map<string, any>;

  beforeEach(() => {
    profiler = new DistributedPerformanceProfiler();
    mockWsClients = new Map();
    
    // Mock WebSocket.Server
    mockWsServer = {
      on: jest.fn(),
      close: jest.fn(),
      address: jest.fn().mockReturnValue({ port: 8080 })
    };
    
    (WebSocket as any).Server = jest.fn().mockImplementation(() => mockWsServer);
    
    // Mock WebSocket client
    (WebSocket as any).mockImplementation((url: string) => {
      const mockClient = {
        on: jest.fn(),
        send: jest.fn(),
        close: jest.fn(),
        readyState: WebSocket.OPEN,
        url
      };
      
      // Extract node ID from URL
      const nodeId = url.split('/').pop() || 'unknown';
      mockWsClients.set(nodeId, mockClient);
      
      // Simulate connection
      setTimeout(() => {
        const openHandler = mockClient.on.mock.calls.find(call => call[0] === 'open');
        if (openHandler) openHandler[1]();
      }, 10);
      
      return mockClient;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization and Coordination', () => {
    it('should initialize distributed profiler', () => {
      expect(profiler).toBeDefined();
      expect(profiler).toBeInstanceOf(DistributedPerformanceProfiler);
    });

    it('should set up coordination server', async () => {
      const nodes: NodeConfig[] = [
        { id: 'node1', endpoint: 'ws://localhost:3001' },
        { id: 'node2', endpoint: 'ws://localhost:3002' }
      ];

      // Mock profileAcrossNodes to test coordination
      const profilePromise = profiler.profileAcrossNodes(
        'test-code',
        nodes,
        'const result = 1 + 1;',
        {},
        {}
      );

      // Wait for WebSocket setup
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(WebSocket.Server).toHaveBeenCalled();
      expect(mockWsServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
      
      // Cleanup
      profilePromise.catch(() => {}); // Ignore errors for this test
    });
  });

  describe('Node Connection Management', () => {
    it('should connect to all nodes', async () => {
      const nodes: NodeConfig[] = [
        { id: 'node1', endpoint: 'ws://localhost:3001' },
        { id: 'node2', endpoint: 'ws://localhost:3002' },
        { id: 'node3', endpoint: 'ws://localhost:3003' }
      ];

      // Start profiling
      const profilePromise = profiler.profileAcrossNodes(
        'test-code',
        nodes,
        'return true;',
        {},
        {}
      );

      // Wait for connections
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify connections were made
      expect(mockWsClients.size).toBe(3);
      expect(mockWsClients.has('node1')).toBe(true);
      expect(mockWsClients.has('node2')).toBe(true);
      expect(mockWsClients.has('node3')).toBe(true);

      // Cleanup
      profilePromise.catch(() => {});
    });

    it('should handle node connection failures gracefully', async () => {
      const nodes: NodeConfig[] = [
        { id: 'node1', endpoint: 'ws://localhost:3001' },
        { id: 'fail-node', endpoint: 'ws://invalid-host:9999' }
      ];

      // Mock connection failure
      const originalImpl = (WebSocket as any).mockImplementation;
      (WebSocket as any).mockImplementation((url: string) => {
        if (url.includes('invalid-host')) {
          const mockClient = {
            on: jest.fn(),
            send: jest.fn(),
            close: jest.fn()
          };
          
          // Simulate error
          setTimeout(() => {
            const errorHandler = mockClient.on.mock.calls.find(call => call[0] === 'error');
            if (errorHandler) errorHandler[1](new Error('Connection failed'));
          }, 10);
          
          return mockClient;
        }
        return originalImpl(url);
      });

      const profilePromise = profiler.profileAcrossNodes(
        'test-code',
        nodes,
        'return true;',
        {},
        {}
      );

      // Expect it to handle the error gracefully
      await expect(profilePromise).rejects.toThrow();
    });
  });

  describe('Clock Synchronization', () => {
    it('should synchronize clocks across nodes', async () => {
      const nodes: NodeConfig[] = [
        { id: 'node1', endpoint: 'ws://localhost:3001' },
        { id: 'node2', endpoint: 'ws://localhost:3002' }
      ];

      // Mock clock sync responses
      mockWsClients.forEach((client) => {
        client.on.mockImplementation((event: string, handler: Function) => {
          if (event === 'message') {
            // Simulate clock sync response
            setTimeout(() => {
              handler(JSON.stringify({
                type: 'clock_sync_response',
                serverReceiveTime: Date.now(),
                serverSendTime: Date.now() + 1
              }));
            }, 5);
          }
        });
      });

      // This will fail but we're testing the sync mechanism
      const profilePromise = profiler.profileAcrossNodes(
        'test-code',
        nodes,
        'return true;',
        {},
        {}
      );

      await new Promise(resolve => setTimeout(resolve, 200));

      // Verify clock sync messages were sent
      mockWsClients.forEach((client) => {
        const sentMessages = client.send.mock.calls.map((call: any) => JSON.parse(call[0]));
        const clockSyncMessages = sentMessages.filter((msg: any) => 
          msg.type === 'coordination' || msg.type === 'clock_sync_request'
        );
        expect(clockSyncMessages.length).toBeGreaterThan(0);
      });

      profilePromise.catch(() => {});
    });
  });

  describe('Distributed Profiling Execution', () => {
    it('should profile code across multiple nodes', async () => {
      const nodes: NodeConfig[] = [
        { id: 'node1', endpoint: 'ws://localhost:3001', capabilities: ['compute'] },
        { id: 'node2', endpoint: 'ws://localhost:3002', capabilities: ['compute'] }
      ];

      const code = `
        const items = [1, 2, 3, 4, 5];
        const result = items.map(x => x * 2);
        return result;
      `;

      // Mock successful profiling responses
      const mockProfile: PerformanceProfile = {
        id: 'profile-123',
        codeId: 'test-code',
        timestamp: new Date(),
        executionProfile: {
          totalTime: 50,
          phases: [],
          functionCalls: [],
          asyncOperations: [],
          hotspots: []
        },
        memoryProfile: {
          heapSnapshot: {
            totalSize: 1000000,
            usedSize: 500000,
            limit: 2000000,
            objects: []
          },
          leaks: [],
          allocations: [],
          gcActivity: {
            collections: 0,
            totalTime: 0,
            averageTime: 0,
            frequency: 0,
            type: 'scavenge'
          }
        },
        cpuProfile: {
          samples: [],
          totalSamples: 100,
          sampleInterval: 10,
          threads: []
        },
        resourceUsage: {
          cpu: { user: 10, system: 5, total: 15 },
          memory: { rss: 100000, heapTotal: 50000, heapUsed: 25000, external: 1000 },
          io: { bytesRead: 1000, bytesWritten: 500, syscalls: 10 }
        },
        bottlenecks: [],
        optimizationSuggestions: [],
        overallScore: 85
      };

      // Setup mock responses
      let messageHandlers: Map<string, Function> = new Map();
      
      mockWsClients.forEach((client, nodeId) => {
        client.on.mockImplementation((event: string, handler: Function) => {
          if (event === 'message') {
            messageHandlers.set(nodeId, handler);
          }
        });
        
        client.send.mockImplementation((message: string) => {
          const msg = JSON.parse(message);
          
          // Simulate responses
          setTimeout(() => {
            const handler = messageHandlers.get(nodeId);
            if (!handler) return;
            
            if (msg.type === 'deploy_agent') {
              handler(JSON.stringify({
                messageId: msg.messageId,
                success: true
              }));
            } else if (msg.type === 'start_profiling') {
              handler(JSON.stringify({
                messageId: msg.messageId,
                profile: mockProfile
              }));
            } else if (msg.type === 'ping') {
              handler(JSON.stringify({
                messageId: msg.messageId,
                pong: true
              }));
            } else if (msg.type === 'bandwidth_test') {
              handler(JSON.stringify({
                messageId: msg.messageId,
                payload: 'x'.repeat(msg.size || 1024)
              }));
            } else if (msg.type === 'resource_contention') {
              handler(JSON.stringify({
                messageId: msg.messageId,
                contention: {
                  cpuContention: 0.3,
                  memoryPressure: 0.2,
                  ioBandwidth: 0.1,
                  networkCongestion: 0.05,
                  queueDepth: 5
                }
              }));
            }
          }, 10);
        });
      });

      // Execute profiling
      const result = await profiler.profileAcrossNodes(
        'test-code',
        nodes,
        code,
        { $input: { all: () => [] } },
        { parallel: true, networkAnalysis: true }
      );

      expect(result).toBeDefined();
      expect(result.id).toContain('dist_profile_');
      expect(result.nodes).toHaveLength(2);
      expect(result.aggregatedMetrics).toBeDefined();
      expect(result.overallScore).toBeGreaterThan(0);
    });

    it('should handle partial node failures', async () => {
      const nodes: NodeConfig[] = [
        { id: 'node1', endpoint: 'ws://localhost:3001' },
        { id: 'node2', endpoint: 'ws://localhost:3002' },
        { id: 'node3', endpoint: 'ws://localhost:3003' }
      ];

      // Mock one node failing
      let messageHandlers: Map<string, Function> = new Map();
      
      mockWsClients.forEach((client, nodeId) => {
        client.on.mockImplementation((event: string, handler: Function) => {
          if (event === 'message') {
            messageHandlers.set(nodeId, handler);
          }
        });
        
        client.send.mockImplementation((message: string) => {
          const msg = JSON.parse(message);
          const handler = messageHandlers.get(nodeId);
          
          if (!handler) return;
          
          setTimeout(() => {
            if (nodeId === 'node2') {
              // Simulate failure
              handler(JSON.stringify({
                messageId: msg.messageId,
                error: 'Node failure'
              }));
            } else {
              // Success response
              handler(JSON.stringify({
                messageId: msg.messageId,
                success: true,
                profile: {} // Minimal profile
              }));
            }
          }, 10);
        });
      });

      const result = await profiler.profileAcrossNodes(
        'test-code',
        nodes,
        'return true;',
        {},
        {}
      );

      expect(result.nodes.filter(n => n.status === 'success').length).toBe(2);
      expect(result.nodes.filter(n => n.status === 'failed').length).toBe(1);
    });
  });

  describe('Network Analysis', () => {
    it('should analyze network performance between nodes', async () => {
      const nodes: NodeConfig[] = [
        { id: 'node1', endpoint: 'ws://localhost:3001' },
        { id: 'node2', endpoint: 'ws://localhost:3002' }
      ];

      // Mock network metrics
      let messageHandlers: Map<string, Function> = new Map();
      
      mockWsClients.forEach((client, nodeId) => {
        client.on.mockImplementation((event: string, handler: Function) => {
          if (event === 'message') {
            messageHandlers.set(nodeId, handler);
          }
        });
        
        client.send.mockImplementation((message: string) => {
          const msg = JSON.parse(message);
          const handler = messageHandlers.get(nodeId);
          
          if (!handler) return;
          
          setTimeout(() => {
            if (msg.type === 'ping') {
              handler(JSON.stringify({ messageId: msg.messageId }));
            } else if (msg.type === 'bandwidth_test') {
              handler(JSON.stringify({
                messageId: msg.messageId,
                payload: 'x'.repeat(1024)
              }));
            } else if (msg.type === 'measure_latency_to') {
              handler(JSON.stringify({
                messageId: msg.messageId,
                latency: Math.random() * 50 + 10 // 10-60ms
              }));
            } else {
              handler(JSON.stringify({
                messageId: msg.messageId,
                success: true
              }));
            }
          }, Math.random() * 20); // Variable latency
        });
      });

      const result = await profiler.profileAcrossNodes(
        'test-code',
        nodes,
        'return true;',
        {},
        { networkAnalysis: true }
      );

      expect(result.networkAnalysis).toBeDefined();
      expect(result.networkAnalysis?.interNodeLatency.size).toBeGreaterThan(0);
      expect(result.networkAnalysis?.totalNetworkTime).toBeGreaterThanOrEqual(0);
    });

    it('should detect communication patterns', async () => {
      const nodes: NodeConfig[] = [
        { id: 'node1', endpoint: 'ws://localhost:3001' },
        { id: 'node2', endpoint: 'ws://localhost:3002' },
        { id: 'node3', endpoint: 'ws://localhost:3003' }
      ];

      // Simulate trace events
      (profiler as any).traceEvents = [
        {
          timestamp: Date.now(),
          nodeId: 'node1',
          eventType: 'communication',
          data: { source: 'node1', target: 'node2', type: 'broadcast', size: 1024 }
        },
        {
          timestamp: Date.now() + 10,
          nodeId: 'node1',
          eventType: 'communication',
          data: { source: 'node1', target: 'node3', type: 'broadcast', size: 1024 }
        },
        {
          timestamp: Date.now() + 100,
          nodeId: 'node2',
          eventType: 'communication',
          data: { source: 'node2', target: 'node3', type: 'direct', size: 512 }
        }
      ];

      // Mock basic responses
      mockWsClients.forEach((client) => {
        client.send.mockImplementation((message: string) => {
          const msg = JSON.parse(message);
          setTimeout(() => {
            client.on.mock.calls
              .filter((call: any) => call[0] === 'message')
              .forEach((call: any) => {
                call[1](JSON.stringify({
                  messageId: msg.messageId,
                  success: true
                }));
              });
          }, 10);
        });
      });

      const result = await profiler.profileAcrossNodes(
        'test-code',
        nodes,
        'return true;',
        {},
        { networkAnalysis: true }
      );

      expect(result.networkAnalysis?.communicationPatterns).toBeDefined();
      const patterns = result.networkAnalysis?.communicationPatterns || [];
      expect(patterns.some(p => p.pattern === 'broadcast')).toBe(true);
    });
  });

  describe('Load Distribution Analysis', () => {
    it('should analyze load distribution across nodes', async () => {
      const nodes: NodeConfig[] = [
        { id: 'node1', endpoint: 'ws://localhost:3001' },
        { id: 'node2', endpoint: 'ws://localhost:3002' },
        { id: 'node3', endpoint: 'ws://localhost:3003' }
      ];

      // Mock different execution times for each node
      const mockProfiles = [
        { totalTime: 100 }, // node1 - overloaded
        { totalTime: 30 },  // node2 - normal
        { totalTime: 10 }   // node3 - underutilized
      ];

      let nodeIndex = 0;
      mockWsClients.forEach((client) => {
        const profileIndex = nodeIndex++;
        client.send.mockImplementation((message: string) => {
          const msg = JSON.parse(message);
          
          setTimeout(() => {
            client.on.mock.calls
              .filter((call: any) => call[0] === 'message')
              .forEach((call: any) => {
                if (msg.type === 'start_profiling') {
                  call[1](JSON.stringify({
                    messageId: msg.messageId,
                    profile: {
                      executionProfile: mockProfiles[profileIndex % mockProfiles.length],
                      memoryProfile: {},
                      cpuProfile: {},
                      resourceUsage: {},
                      bottlenecks: [],
                      optimizationSuggestions: []
                    }
                  }));
                } else {
                  call[1](JSON.stringify({
                    messageId: msg.messageId,
                    success: true
                  }));
                }
              });
          }, 10);
        });
      });

      const result = await profiler.profileAcrossNodes(
        'test-code',
        nodes,
        'return true;',
        {},
        {}
      );

      expect(result.distributionAnalysis).toBeDefined();
      expect(result.distributionAnalysis.loadBalance.overloadedNodes).toContain('node1');
      expect(result.distributionAnalysis.loadBalance.underutilizedNodes).toContain('node3');
      expect(result.distributionAnalysis.loadBalance.coefficient).toBeGreaterThan(0);
    });

    it('should calculate parallel efficiency', async () => {
      const nodes: NodeConfig[] = [
        { id: 'node1', endpoint: 'ws://localhost:3001' },
        { id: 'node2', endpoint: 'ws://localhost:3002' }
      ];

      // Mock responses
      mockWsClients.forEach((client) => {
        client.send.mockImplementation((message: string) => {
          const msg = JSON.parse(message);
          
          setTimeout(() => {
            client.on.mock.calls
              .filter((call: any) => call[0] === 'message')
              .forEach((call: any) => {
                call[1](JSON.stringify({
                  messageId: msg.messageId,
                  success: true,
                  profile: {
                    executionProfile: { totalTime: 50 },
                    resourceUsage: { cpu: { total: 25 } }
                  }
                }));
              });
          }, 10);
        });
      });

      const result = await profiler.profileAcrossNodes(
        'test-code',
        nodes,
        'return true;',
        {},
        {}
      );

      expect(result.distributionAnalysis.parallelEfficiency).toBeDefined();
      expect(result.distributionAnalysis.parallelEfficiency.efficiency).toBeGreaterThan(0);
      expect(result.distributionAnalysis.parallelEfficiency.efficiency).toBeLessThanOrEqual(1);
      expect(result.distributionAnalysis.parallelEfficiency.speedup).toBeGreaterThan(0);
    });
  });

  describe('Report Generation', () => {
    it('should generate comprehensive distributed profiling report', async () => {
      const mockProfile = {
        id: 'dist_profile_123',
        codeId: 'test-code',
        timestamp: new Date(),
        nodes: [
          {
            nodeId: 'node1',
            profile: {
              executionProfile: { totalTime: 100 }
            } as any,
            networkMetrics: {
              latency: { average: 25, p95: 40, p99: 50, min: 10, max: 60 },
              bandwidth: { upload: 1000000, download: 2000000, utilization: 0.7 },
              packetLoss: 0.01,
              jitter: 5,
              hops: 3
            },
            resourceContention: {
              cpuContention: 0.3,
              memoryPressure: 0.2,
              ioBandwidth: 0.5,
              networkCongestion: 0.1,
              queueDepth: 10
            },
            synchronizationOverhead: 15,
            status: 'success' as const
          }
        ],
        aggregatedMetrics: {
          totalExecutionTime: 100,
          averageNodeTime: 100,
          slowestNode: 'node1',
          fastestNode: 'node1',
          variance: 0,
          standardDeviation: 0,
          resourceUtilization: {
            cpu: 50,
            memory: 1000000,
            network: 0.7,
            io: 0.5
          }
        },
        distributionAnalysis: {
          loadBalance: {
            coefficient: 0.1,
            imbalance: 0.1,
            overloadedNodes: [],
            underutilizedNodes: []
          },
          dataLocality: {
            localityScore: 0.8,
            crossNodeTransfers: 10,
            dataMovementCost: 100,
            recommendations: ['Use data replication']
          },
          parallelEfficiency: {
            efficiency: 0.85,
            speedup: 1.7,
            scalability: 85,
            amdahlLimit: 0.9
          }
        },
        bottlenecks: [],
        recommendations: ['Optimize network topology'],
        overallScore: 85
      };

      const report = await profiler.generateDistributedReport(mockProfile as any);

      expect(report).toContain('Distributed Performance Profile Report');
      expect(report).toContain('node1');
      expect(report).toContain('85/100');
      expect(report).toContain('Load Balance Coefficient');
      expect(report).toContain('Parallel Efficiency');
      expect(report).toContain('Recommendations');
    });
  });
});