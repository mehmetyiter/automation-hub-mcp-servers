import { ChaosOrchestrator, ChaosExperiment } from '../chaos-orchestrator';
import { LoggingService } from '../../../src/observability/logging';

const logger = LoggingService.getInstance();

export class InfrastructureChaosExperiments {
  constructor(private orchestrator: ChaosOrchestrator) {}

  // CPU Stress Experiments
  async createCPUStressExperiment(options: {
    name?: string;
    targets: string[];
    cpuPercentage: number;
    duration: number;
    cores?: number;
  }): Promise<string> {
    const experiment: Omit<ChaosExperiment, 'id' | 'created_at'> = {
      name: options.name || 'CPU Stress Test',
      description: `Stress CPU to ${options.cpuPercentage}% on ${options.targets.join(', ')}`,
      target: options.targets[0],
      type: 'cpu_stress',
      parameters: {
        targets: options.targets,
        intensity: options.cpuPercentage,
        duration: options.duration,
        cores: options.cores || 0, // 0 means all cores
        stress_method: 'cpu_intensive_loops',
        ramp_up_time: 10000 // 10 seconds
      },
      enabled: true,
      rollbackTriggers: [
        {
          metric: 'cpu_usage',
          threshold: Math.min(options.cpuPercentage + 20, 95),
          operator: 'gt',
          duration: 30000
        },
        {
          metric: 'response_time_p95',
          threshold: 5000,
          operator: 'gt',
          duration: 20000
        },
        {
          metric: 'system_load_average',
          threshold: 10,
          operator: 'gt',
          duration: 15000
        }
      ],
      metadata: {
        category: 'infrastructure',
        severity: 'medium',
        resource_type: 'cpu'
      }
    };

    return await this.orchestrator.createExperiment(experiment);
  }

  // Memory Stress Experiments
  async createMemoryStressExperiment(options: {
    name?: string;
    targets: string[];
    memoryPercentage: number;
    duration: number;
    pattern?: 'fill' | 'leak' | 'fragmentation';
  }): Promise<string> {
    const experiment: Omit<ChaosExperiment, 'id' | 'created_at'> = {
      name: options.name || 'Memory Stress Test',
      description: `Stress memory to ${options.memoryPercentage}% on ${options.targets.join(', ')}`,
      target: options.targets[0],
      type: 'memory_stress',
      parameters: {
        targets: options.targets,
        intensity: options.memoryPercentage,
        duration: options.duration,
        pattern: options.pattern || 'fill',
        allocation_size: '100MB',
        release_pattern: 'end_of_experiment'
      },
      enabled: true,
      rollbackTriggers: [
        {
          metric: 'memory_usage',
          threshold: Math.min(options.memoryPercentage + 15, 90),
          operator: 'gt',
          duration: 20000
        },
        {
          metric: 'oom_killer_invocations',
          threshold: 1,
          operator: 'gte',
          duration: 0
        },
        {
          metric: 'swap_usage',
          threshold: 80,
          operator: 'gt',
          duration: 30000
        }
      ],
      metadata: {
        category: 'infrastructure',
        severity: 'high',
        resource_type: 'memory'
      }
    };

    return await this.orchestrator.createExperiment(experiment);
  }

  // Disk I/O Stress Experiments
  async createDiskIOStressExperiment(options: {
    name?: string;
    targets: string[];
    ioType: 'read' | 'write' | 'mixed';
    intensity: number; // IOPS
    duration: number;
    fileSize?: string;
  }): Promise<string> {
    const experiment: Omit<ChaosExperiment, 'id' | 'created_at'> = {
      name: options.name || 'Disk I/O Stress Test',
      description: `${options.ioType} I/O stress at ${options.intensity} IOPS`,
      target: options.targets[0],
      type: 'disk_io_stress',
      parameters: {
        targets: options.targets,
        io_type: options.ioType,
        intensity: options.intensity,
        duration: options.duration,
        file_size: options.fileSize || '1GB',
        block_size: '4K',
        sync_mode: true
      },
      enabled: true,
      rollbackTriggers: [
        {
          metric: 'disk_usage',
          threshold: 90,
          operator: 'gt',
          duration: 10000
        },
        {
          metric: 'disk_io_wait',
          threshold: 50,
          operator: 'gt',
          duration: 30000
        },
        {
          metric: 'file_system_errors',
          threshold: 5,
          operator: 'gt',
          duration: 5000
        }
      ],
      metadata: {
        category: 'infrastructure',
        severity: 'medium',
        resource_type: 'disk'
      }
    };

    return await this.orchestrator.createExperiment(experiment);
  }

  // Pod/Container Termination
  async createPodTerminationExperiment(options: {
    name?: string;
    namespace: string;
    labelSelector?: string;
    podNames?: string[];
    killPercentage: number;
    duration: number;
    gracePeriod?: number;
  }): Promise<string> {
    const experiment: Omit<ChaosExperiment, 'id' | 'created_at'> = {
      name: options.name || 'Pod Termination Chaos',
      description: `Terminate ${options.killPercentage}% of pods in ${options.namespace}`,
      target: options.namespace,
      type: 'pod_termination',
      parameters: {
        namespace: options.namespace,
        label_selector: options.labelSelector,
        pod_names: options.podNames,
        kill_percentage: options.killPercentage,
        duration: options.duration,
        grace_period: options.gracePeriod || 30,
        kill_signal: 'SIGTERM',
        interval: 60000 // Kill pods every minute
      },
      enabled: true,
      rollbackTriggers: [
        {
          metric: 'pod_ready_percentage',
          threshold: 70,
          operator: 'lt',
          duration: 60000
        },
        {
          metric: 'service_availability',
          threshold: 95,
          operator: 'lt',
          duration: 30000
        },
        {
          metric: 'pending_pods',
          threshold: 10,
          operator: 'gt',
          duration: 120000
        }
      ],
      metadata: {
        category: 'infrastructure',
        severity: 'high',
        kubernetes: true
      }
    };

    return await this.orchestrator.createExperiment(experiment);
  }

  // Node Failure Simulation
  async createNodeFailureExperiment(options: {
    name?: string;
    nodes: string[];
    failureType: 'shutdown' | 'drain' | 'isolate';
    duration: number;
    graceful?: boolean;
  }): Promise<string> {
    const experiment: Omit<ChaosExperiment, 'id' | 'created_at'> = {
      name: options.name || 'Node Failure Simulation',
      description: `${options.failureType} nodes: ${options.nodes.join(', ')}`,
      target: options.nodes[0],
      type: 'pod_termination', // Using pod_termination type for node-level chaos
      parameters: {
        targets: options.nodes,
        failure_type: options.failureType,
        duration: options.duration,
        graceful: options.graceful !== false,
        drain_timeout: 300000, // 5 minutes
        isolation_rules: {
          network: true,
          storage: false
        }
      },
      enabled: true,
      rollbackTriggers: [
        {
          metric: 'cluster_node_count',
          threshold: options.nodes.length,
          operator: 'lt',
          duration: 60000
        },
        {
          metric: 'unschedulable_pods',
          threshold: 50,
          operator: 'gt',
          duration: 180000
        },
        {
          metric: 'cluster_health_score',
          threshold: 70,
          operator: 'lt',
          duration: 120000
        }
      ],
      metadata: {
        category: 'infrastructure',
        severity: 'critical',
        kubernetes: true,
        affects_scheduling: true
      }
    };

    return await this.orchestrator.createExperiment(experiment);
  }

  // Service Disruption
  async createServiceDisruptionExperiment(options: {
    name?: string;
    services: string[];
    disruptionType: 'stop' | 'restart' | 'config_corruption' | 'permission_denial';
    duration: number;
    namespace?: string;
  }): Promise<string> {
    const experiment: Omit<ChaosExperiment, 'id' | 'created_at'> = {
      name: options.name || 'Service Disruption',
      description: `${options.disruptionType} services: ${options.services.join(', ')}`,
      target: options.services[0],
      type: 'service_disruption',
      parameters: {
        services: options.services,
        disruption_type: options.disruptionType,
        duration: options.duration,
        namespace: options.namespace,
        restart_delay: 30000,
        config_backup: true
      },
      enabled: true,
      rollbackTriggers: [
        {
          metric: 'service_health_check',
          threshold: 80,
          operator: 'lt',
          duration: 45000
        },
        {
          metric: 'dependent_service_errors',
          threshold: 25,
          operator: 'gt',
          duration: 20000
        }
      ],
      metadata: {
        category: 'infrastructure',
        severity: 'high',
        service_disruption: true
      }
    };

    return await this.orchestrator.createExperiment(experiment);
  }

  // Resource Exhaustion (File Descriptors, Connections, etc.)
  async createResourceExhaustionExperiment(options: {
    name?: string;
    targets: string[];
    resourceType: 'file_descriptors' | 'network_connections' | 'process_limits' | 'semaphores';
    exhaustionPercentage: number;
    duration: number;
  }): Promise<string> {
    const experiment: Omit<ChaosExperiment, 'id' | 'created_at'> = {
      name: options.name || `${options.resourceType} Exhaustion`,
      description: `Exhaust ${options.exhaustionPercentage}% of ${options.resourceType}`,
      target: options.targets[0],
      type: 'memory_stress', // Using memory_stress type for resource exhaustion
      parameters: {
        targets: options.targets,
        resource_type: options.resourceType,
        exhaustion_percentage: options.exhaustionPercentage,
        duration: options.duration,
        hold_resources: true,
        gradual_increase: true
      },
      enabled: true,
      rollbackTriggers: [
        {
          metric: `${options.resourceType}_usage`,
          threshold: Math.min(options.exhaustionPercentage + 10, 95),
          operator: 'gt',
          duration: 20000
        },
        {
          metric: 'system_call_errors',
          threshold: 100,
          operator: 'gt',
          duration: 10000
        }
      ],
      metadata: {
        category: 'infrastructure',
        severity: 'high',
        resource_type: options.resourceType
      }
    };

    return await this.orchestrator.createExperiment(experiment);
  }

  // Kernel Module Chaos
  async createKernelModuleChaosExperiment(options: {
    name?: string;
    targets: string[];
    modules: string[];
    chaosType: 'unload' | 'reload' | 'parameter_change';
    duration: number;
  }): Promise<string> {
    const experiment: Omit<ChaosExperiment, 'id' | 'created_at'> = {
      name: options.name || 'Kernel Module Chaos',
      description: `${options.chaosType} kernel modules: ${options.modules.join(', ')}`,
      target: options.targets[0],
      type: 'service_disruption',
      parameters: {
        targets: options.targets,
        kernel_modules: options.modules,
        chaos_type: options.chaosType,
        duration: options.duration,
        safety_checks: true,
        backup_before: true
      },
      enabled: true,
      rollbackTriggers: [
        {
          metric: 'kernel_errors',
          threshold: 1,
          operator: 'gte',
          duration: 0
        },
        {
          metric: 'system_stability',
          threshold: 90,
          operator: 'lt',
          duration: 30000
        }
      ],
      metadata: {
        category: 'infrastructure',
        severity: 'critical',
        kernel_level: true,
        requires_privileges: true
      }
    };

    return await this.orchestrator.createExperiment(experiment);
  }

  // Predefined Infrastructure Test Scenarios
  async runWebServerStressTest(duration = 300000): Promise<string> {
    return await this.createCPUStressExperiment({
      name: 'Web Server CPU Stress',
      targets: ['web-server-cluster'],
      cpuPercentage: 80,
      duration,
      cores: 2
    });
  }

  async runDatabaseMemoryPressure(duration = 240000): Promise<string> {
    return await this.createMemoryStressExperiment({
      name: 'Database Memory Pressure',
      targets: ['database-primary', 'database-replica'],
      memoryPercentage: 85,
      duration,
      pattern: 'fill'
    });
  }

  async runMicroserviceChaosKill(duration = 180000): Promise<string> {
    return await this.createPodTerminationExperiment({
      name: 'Microservice Random Kills',
      namespace: 'production',
      labelSelector: 'app=microservice',
      killPercentage: 30,
      duration,
      gracePeriod: 10
    });
  }

  async runStorageIOStorm(duration = 360000): Promise<string> {
    return await this.createDiskIOStressExperiment({
      name: 'Storage I/O Storm',
      targets: ['storage-cluster'],
      ioType: 'mixed',
      intensity: 1000,
      duration,
      fileSize: '2GB'
    });
  }

  async runWorkerNodeFailure(duration = 600000): Promise<string> {
    return await this.createNodeFailureExperiment({
      name: 'Worker Node Failure',
      nodes: ['worker-node-1', 'worker-node-2'],
      failureType: 'drain',
      duration,
      graceful: true
    });
  }

  // Composite Infrastructure Stress Tests
  async runFullInfrastructureStressTest(duration = 900000): Promise<string[]> {
    logger.info('Starting comprehensive infrastructure stress test');

    const experiments = await Promise.all([
      // Phase 1: Resource stress
      this.createCPUStressExperiment({
        name: 'Phase 1: CPU Stress',
        targets: ['app-servers'],
        cpuPercentage: 70,
        duration: duration / 3
      }),

      this.createMemoryStressExperiment({
        name: 'Phase 1: Memory Pressure',
        targets: ['cache-servers'],
        memoryPercentage: 80,
        duration: duration / 3
      }),

      // Phase 2: Service disruption
      this.createPodTerminationExperiment({
        name: 'Phase 2: Pod Chaos',
        namespace: 'default',
        labelSelector: 'tier=backend',
        killPercentage: 25,
        duration: duration / 3
      }),

      // Phase 3: Infrastructure failure
      this.createNodeFailureExperiment({
        name: 'Phase 3: Node Failure',
        nodes: ['worker-node-3'],
        failureType: 'isolate',
        duration: duration / 3
      })
    ]);

    // Execute experiments in phases
    const [cpuExp, memExp, podExp, nodeExp] = experiments;
    
    // Phase 1: Resource stress (parallel)
    await Promise.all([
      this.orchestrator.executeExperiment(cpuExp, true),
      this.orchestrator.executeExperiment(memExp, true)
    ]);
    
    // Wait for phase 1 to complete
    setTimeout(() => {
      // Phase 2: Service disruption
      this.orchestrator.executeExperiment(podExp, true);
    }, duration / 3);
    
    setTimeout(() => {
      // Phase 3: Infrastructure failure
      this.orchestrator.executeExperiment(nodeExp, true);
    }, (duration * 2) / 3);

    return experiments;
  }

  // Resilience Pattern Tests
  async runCircuitBreakerTest(duration = 300000): Promise<string> {
    return await this.createServiceDisruptionExperiment({
      name: 'Circuit Breaker Resilience Test',
      services: ['payment-service', 'notification-service'],
      disruptionType: 'stop',
      duration,
      namespace: 'production'
    });
  }

  async runBulkheadIsolationTest(duration = 240000): Promise<string> {
    return await this.createResourceExhaustionExperiment({
      name: 'Bulkhead Isolation Test',
      targets: ['connection-pool-service'],
      resourceType: 'network_connections',
      exhaustionPercentage: 90,
      duration
    });
  }

  async runTimeoutHandlingTest(duration = 180000): Promise<string> {
    return await this.createCPUStressExperiment({
      name: 'Timeout Handling Test',
      targets: ['slow-service'],
      cpuPercentage: 95,
      duration,
      cores: 1
    });
  }
}