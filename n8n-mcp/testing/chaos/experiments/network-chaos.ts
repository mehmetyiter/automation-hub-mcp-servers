import { ChaosOrchestrator, ChaosExperiment } from '../chaos-orchestrator';
import { LoggingService } from '../../../src/observability/logging';

const logger = LoggingService.getInstance();

export class NetworkChaosExperiments {
  constructor(private orchestrator: ChaosOrchestrator) {}

  // Network Latency Experiments
  async createLatencyExperiment(options: {
    name?: string;
    targets: string[];
    latencyMs: number;
    duration: number;
    schedule?: any;
  }): Promise<string> {
    const experiment: Omit<ChaosExperiment, 'id' | 'created_at'> = {
      name: options.name || 'Network Latency Injection',
      description: `Inject ${options.latencyMs}ms latency to ${options.targets.join(', ')}`,
      target: options.targets[0],
      type: 'network_latency',
      parameters: {
        targets: options.targets,
        intensity: options.latencyMs,
        duration: options.duration,
        conditions: {
          max_latency: options.latencyMs * 2,
          min_success_rate: 95
        }
      },
      schedule: options.schedule,
      enabled: true,
      rollbackTriggers: [
        {
          metric: 'response_time_p99',
          threshold: options.latencyMs * 3,
          operator: 'gt',
          duration: 30000
        },
        {
          metric: 'error_rate',
          threshold: 10,
          operator: 'gt',
          duration: 15000
        }
      ],
      metadata: {
        category: 'network',
        severity: 'medium',
        blast_radius: options.targets
      }
    };

    return await this.orchestrator.createExperiment(experiment);
  }

  // Packet Loss Experiments
  async createPacketLossExperiment(options: {
    name?: string;
    targets: string[];
    lossPercentage: number;
    duration: number;
  }): Promise<string> {
    const experiment: Omit<ChaosExperiment, 'id' | 'created_at'> = {
      name: options.name || 'Network Packet Loss',
      description: `Inject ${options.lossPercentage}% packet loss to ${options.targets.join(', ')}`,
      target: options.targets[0],
      type: 'network_latency', // Using network_latency type with packet loss params
      parameters: {
        targets: options.targets,
        packet_loss: options.lossPercentage,
        duration: options.duration,
        conditions: {
          max_packet_loss: options.lossPercentage * 1.5,
          min_connectivity: 80
        }
      },
      enabled: true,
      rollbackTriggers: [
        {
          metric: 'connectivity_percentage',
          threshold: 70,
          operator: 'lt',
          duration: 20000
        },
        {
          metric: 'error_rate',
          threshold: 15,
          operator: 'gt',
          duration: 10000
        }
      ],
      metadata: {
        category: 'network',
        severity: 'high',
        blast_radius: options.targets
      }
    };

    return await this.orchestrator.createExperiment(experiment);
  }

  // Bandwidth Throttling
  async createBandwidthThrottleExperiment(options: {
    name?: string;
    targets: string[];
    bandwidthMbps: number;
    duration: number;
  }): Promise<string> {
    const experiment: Omit<ChaosExperiment, 'id' | 'created_at'> = {
      name: options.name || 'Bandwidth Throttling',
      description: `Throttle bandwidth to ${options.bandwidthMbps}Mbps for ${options.targets.join(', ')}`,
      target: options.targets[0],
      type: 'network_latency',
      parameters: {
        targets: options.targets,
        bandwidth_limit: options.bandwidthMbps,
        duration: options.duration,
        unit: 'mbps'
      },
      enabled: true,
      rollbackTriggers: [
        {
          metric: 'throughput_mbps',
          threshold: options.bandwidthMbps * 0.5,
          operator: 'lt',
          duration: 30000
        },
        {
          metric: 'queue_depth',
          threshold: 1000,
          operator: 'gt',
          duration: 20000
        }
      ],
      metadata: {
        category: 'network',
        severity: 'medium',
        expected_impact: `Reduced bandwidth to ${options.bandwidthMbps}Mbps`
      }
    };

    return await this.orchestrator.createExperiment(experiment);
  }

  // DNS Chaos
  async createDNSChaosExperiment(options: {
    name?: string;
    domains: string[];
    chaosType: 'delay' | 'error' | 'random';
    intensity: number;
    duration: number;
  }): Promise<string> {
    const experiment: Omit<ChaosExperiment, 'id' | 'created_at'> = {
      name: options.name || 'DNS Chaos',
      description: `DNS ${options.chaosType} for domains: ${options.domains.join(', ')}`,
      target: 'dns_resolver',
      type: 'dependency_chaos',
      parameters: {
        targets: options.domains,
        chaos_type: options.chaosType,
        intensity: options.intensity,
        duration: options.duration,
        dns_config: {
          delay_ms: options.chaosType === 'delay' ? options.intensity : 0,
          error_rate: options.chaosType === 'error' ? options.intensity : 0,
          random_responses: options.chaosType === 'random'
        }
      },
      enabled: true,
      rollbackTriggers: [
        {
          metric: 'dns_resolution_time',
          threshold: 5000,
          operator: 'gt',
          duration: 15000
        },
        {
          metric: 'dns_success_rate',
          threshold: 90,
          operator: 'lt',
          duration: 10000
        }
      ],
      metadata: {
        category: 'network',
        severity: 'high',
        affected_domains: options.domains
      }
    };

    return await this.orchestrator.createExperiment(experiment);
  }

  // Connection Pool Exhaustion
  async createConnectionPoolExhaustionExperiment(options: {
    name?: string;
    target: string;
    maxConnections: number;
    duration: number;
  }): Promise<string> {
    const experiment: Omit<ChaosExperiment, 'id' | 'created_at'> = {
      name: options.name || 'Connection Pool Exhaustion',
      description: `Exhaust connection pool for ${options.target}`,
      target: options.target,
      type: 'dependency_chaos',
      parameters: {
        targets: [options.target],
        attack_type: 'connection_exhaustion',
        max_connections: options.maxConnections,
        duration: options.duration,
        connection_hold_time: 60000 // Hold connections for 1 minute
      },
      enabled: true,
      rollbackTriggers: [
        {
          metric: 'available_connections',
          threshold: 5,
          operator: 'lt',
          duration: 10000
        },
        {
          metric: 'connection_timeout_rate',
          threshold: 50,
          operator: 'gt',
          duration: 5000
        }
      ],
      metadata: {
        category: 'network',
        severity: 'critical',
        resource_target: 'connection_pool'
      }
    };

    return await this.orchestrator.createExperiment(experiment);
  }

  // SSL/TLS Certificate Chaos
  async createSSLChaosExperiment(options: {
    name?: string;
    endpoints: string[];
    chaosType: 'expired' | 'invalid' | 'self_signed';
    duration: number;
  }): Promise<string> {
    const experiment: Omit<ChaosExperiment, 'id' | 'created_at'> = {
      name: options.name || 'SSL/TLS Certificate Chaos',
      description: `SSL certificate ${options.chaosType} for ${options.endpoints.join(', ')}`,
      target: options.endpoints[0],
      type: 'dependency_chaos',
      parameters: {
        targets: options.endpoints,
        ssl_chaos_type: options.chaosType,
        duration: options.duration,
        certificate_config: {
          type: options.chaosType,
          validation_bypass: false
        }
      },
      enabled: true,
      rollbackTriggers: [
        {
          metric: 'ssl_handshake_success_rate',
          threshold: 80,
          operator: 'lt',
          duration: 5000
        },
        {
          metric: 'ssl_error_rate',
          threshold: 20,
          operator: 'gt',
          duration: 10000
        }
      ],
      metadata: {
        category: 'network',
        severity: 'high',
        security_impact: true
      }
    };

    return await this.orchestrator.createExperiment(experiment);
  }

  // Network Partition (Split Brain)
  async createNetworkPartitionExperiment(options: {
    name?: string;
    groupA: string[];
    groupB: string[];
    duration: number;
    partitionType: 'complete' | 'partial';
  }): Promise<string> {
    const experiment: Omit<ChaosExperiment, 'id' | 'created_at'> = {
      name: options.name || 'Network Partition',
      description: `${options.partitionType} network partition between groups`,
      target: 'network_infrastructure',
      type: 'network_latency',
      parameters: {
        group_a: options.groupA,
        group_b: options.groupB,
        partition_type: options.partitionType,
        duration: options.duration,
        isolation_rules: {
          block_all: options.partitionType === 'complete',
          allow_percentage: options.partitionType === 'partial' ? 10 : 0
        }
      },
      enabled: true,
      rollbackTriggers: [
        {
          metric: 'cluster_health_score',
          threshold: 50,
          operator: 'lt',
          duration: 30000
        },
        {
          metric: 'leader_election_failures',
          threshold: 3,
          operator: 'gt',
          duration: 15000
        }
      ],
      metadata: {
        category: 'network',
        severity: 'critical',
        split_brain_risk: true,
        affected_groups: [...options.groupA, ...options.groupB]
      }
    };

    return await this.orchestrator.createExperiment(experiment);
  }

  // Predefined experiment templates
  async runAPIGatewayLatencyTest(duration = 300000): Promise<string> {
    return await this.createLatencyExperiment({
      name: 'API Gateway Latency Test',
      targets: ['api-gateway', 'load-balancer'],
      latencyMs: 200,
      duration,
      schedule: {
        type: 'once',
        enabled: false
      }
    });
  }

  async runDatabaseConnectionStorm(duration = 180000): Promise<string> {
    return await this.createConnectionPoolExhaustionExperiment({
      name: 'Database Connection Storm',
      target: 'postgresql-primary',
      maxConnections: 100,
      duration
    });
  }

  async runCDNPacketLossTest(duration = 240000): Promise<string> {
    return await this.createPacketLossExperiment({
      name: 'CDN Packet Loss Test',
      targets: ['cdn-edge-servers'],
      lossPercentage: 5,
      duration
    });
  }

  async runMicroservicePartitionTest(duration = 300000): Promise<string> {
    return await this.createNetworkPartitionExperiment({
      name: 'Microservice Network Partition',
      groupA: ['user-service', 'auth-service'],
      groupB: ['workflow-service', 'execution-service'],
      duration,
      partitionType: 'partial'
    });
  }

  // Composite experiments (multiple chaos types)
  async runComprehensiveNetworkStressTest(duration = 600000): Promise<string[]> {
    logger.info('Starting comprehensive network stress test');

    const experiments = await Promise.all([
      // Phase 1: Light stress
      this.createLatencyExperiment({
        name: 'Phase 1: Light Latency',
        targets: ['api-gateway'],
        latencyMs: 100,
        duration: duration / 3
      }),

      // Phase 2: Medium stress  
      this.createPacketLossExperiment({
        name: 'Phase 2: Packet Loss',
        targets: ['backend-services'],
        lossPercentage: 2,
        duration: duration / 3
      }),

      // Phase 3: Heavy stress
      this.createBandwidthThrottleExperiment({
        name: 'Phase 3: Bandwidth Throttle',
        targets: ['database-cluster'],
        bandwidthMbps: 10,
        duration: duration / 3
      })
    ]);

    // Schedule them to run sequentially
    const [exp1, exp2, exp3] = experiments;
    
    // Execute first experiment immediately
    await this.orchestrator.executeExperiment(exp1, true);
    
    // Schedule subsequent experiments
    setTimeout(() => {
      this.orchestrator.executeExperiment(exp2, true);
    }, duration / 3);
    
    setTimeout(() => {
      this.orchestrator.executeExperiment(exp3, true);
    }, (duration * 2) / 3);

    return experiments;
  }
}