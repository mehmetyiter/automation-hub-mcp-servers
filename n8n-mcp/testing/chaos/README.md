# Chaos Engineering Framework

A comprehensive chaos engineering framework for testing the resilience and reliability of the n8n-MCP automation platform.

## Overview

This framework provides tools and experiments to systematically introduce controlled failures into the system to identify weaknesses, test recovery mechanisms, and improve overall system resilience.

## Features

- **Chaos Orchestrator**: Central management system for chaos experiments
- **Network Chaos**: Latency injection, packet loss, bandwidth throttling, DNS chaos
- **Infrastructure Chaos**: CPU/Memory/Disk stress, pod termination, node failures
- **Automated Rollback**: Safety mechanisms with configurable triggers
- **Metrics Collection**: Performance impact analysis and lessons learned
- **CLI Interface**: Easy-to-use command-line tool for experiment management
- **Scheduling**: Automated execution of chaos experiments
- **Safety First**: Built-in safeguards and rollback mechanisms

## Architecture

```
├── chaos-orchestrator.ts     # Main orchestrator engine
├── experiments/
│   ├── network-chaos.ts      # Network-level chaos experiments
│   └── infrastructure-chaos.ts # Infrastructure-level chaos
├── chaos-cli.ts             # Command-line interface
└── README.md               # Documentation
```

## Quick Start

### 1. Initialize the Chaos Orchestrator

```bash
# Install dependencies
npm install

# Initialize the orchestrator
npx ts-node testing/chaos/chaos-cli.ts init
```

### 2. Create Your First Experiment

```bash
# Create a network latency experiment
npx ts-node testing/chaos/chaos-cli.ts create network-latency \
  --targets "api-gateway,auth-service" \
  --latency 200 \
  --duration 300000 \
  --name "API Latency Test"
```

### 3. Execute the Experiment

```bash
# List available experiments
npx ts-node testing/chaos/chaos-cli.ts list

# Run an experiment
npx ts-node testing/chaos/chaos-cli.ts run <experiment-id>

# Monitor progress
npx ts-node testing/chaos/chaos-cli.ts status <execution-id>
```

## Experiment Types

### Network Chaos

| Experiment | Description | Parameters |
|------------|-------------|------------|
| Network Latency | Inject artificial latency | `latencyMs`, `targets`, `duration` |
| Packet Loss | Simulate packet loss | `lossPercentage`, `targets`, `duration` |
| Bandwidth Throttling | Limit bandwidth | `bandwidthMbps`, `targets`, `duration` |
| DNS Chaos | DNS resolution issues | `domains`, `chaosType`, `intensity` |
| Connection Pool Exhaustion | Exhaust connection pools | `maxConnections`, `target` |
| SSL/TLS Certificate Chaos | Certificate validation issues | `endpoints`, `chaosType` |
| Network Partition | Split-brain scenarios | `groupA`, `groupB`, `partitionType` |

### Infrastructure Chaos

| Experiment | Description | Parameters |
|------------|-------------|------------|
| CPU Stress | High CPU utilization | `cpuPercentage`, `targets`, `cores` |
| Memory Stress | Memory pressure | `memoryPercentage`, `pattern` |
| Disk I/O Stress | High disk I/O | `ioType`, `intensity`, `fileSize` |
| Pod Termination | Kill Kubernetes pods | `namespace`, `killPercentage` |
| Node Failure | Simulate node failures | `nodes`, `failureType` |
| Service Disruption | Service interruptions | `services`, `disruptionType` |
| Resource Exhaustion | Exhaust system resources | `resourceType`, `exhaustionPercentage` |

## Safety Mechanisms

### Rollback Triggers

Experiments can be automatically rolled back based on configurable triggers:

```typescript
rollbackTriggers: [
  {
    metric: 'response_time_p99',
    threshold: 5000,
    operator: 'gt',
    duration: 30000
  },
  {
    metric: 'error_rate',
    threshold: 10,
    operator: 'gt',
    duration: 15000
  }
]
```

### Safety Checks

- Pre-execution system health validation
- Automated rollback on metric thresholds
- Manual emergency stop capabilities
- Resource cleanup on experiment completion
- Gradual chaos introduction (ramp-up)

## Predefined Scenarios

### Quick Tests

```bash
# API Gateway resilience test
npx ts-node testing/chaos/chaos-cli.ts scenario api-gateway-test

# Database stress test
npx ts-node testing/chaos/chaos-cli.ts scenario database-stress

# Comprehensive chaos test
npx ts-node testing/chaos/chaos-cli.ts scenario full-chaos
```

### Example Scenarios

#### 1. Microservice Resilience Test
```bash
# Test circuit breaker patterns
npx ts-node testing/chaos/chaos-cli.ts create cpu-stress \
  --targets "payment-service" \
  --cpu 95 \
  --duration 180000 \
  --name "Circuit Breaker Test"
```

#### 2. Database Failover Test
```bash
# Simulate database connection issues
npx ts-node testing/chaos/chaos-cli.ts create network-latency \
  --targets "database-primary" \
  --latency 5000 \
  --duration 240000 \
  --name "DB Failover Test"
```

#### 3. Load Balancer Test
```bash
# Test load balancer behavior under pod failures
npx ts-node testing/chaos/chaos-cli.ts create pod-termination \
  --namespace "production" \
  --targets "web-servers" \
  --kill-percentage 50 \
  --duration 300000
```

## CLI Commands

### Experiment Management

```bash
# List experiments
chaos list [--active] [--type <type>]

# Show experiment details
chaos show <experiment-id>

# Create experiments
chaos create <type> [options]

# Execute experiments
chaos run <experiment-id> [--force]

# Stop execution
chaos stop <execution-id>

# Check status
chaos status [execution-id]
```

### Analytics

```bash
# Execution summary
chaos analytics summary [--days <days>]

# Experiment results
chaos analytics results <experiment-id>
```

### Predefined Scenarios

```bash
# Network scenarios
chaos scenario api-gateway-test
chaos scenario cdn-failure
chaos scenario dns-chaos

# Infrastructure scenarios  
chaos scenario database-stress
chaos scenario microservice-chaos
chaos scenario node-failure

# Comprehensive tests
chaos scenario full-chaos
chaos scenario resilience-suite
```

## Configuration

### Environment Variables

```bash
# Database connection
export CHAOS_DB_HOST=localhost
export CHAOS_DB_PORT=5432
export CHAOS_DB_NAME=chaos_db

# Redis connection
export CHAOS_REDIS_HOST=localhost  
export CHAOS_REDIS_PORT=6379

# Kubernetes integration
export KUBECONFIG=/path/to/kubeconfig

# Monitoring integration
export PROMETHEUS_URL=http://localhost:9090
export GRAFANA_URL=http://localhost:3000
```

### Custom Experiments

Create custom experiments by extending the base classes:

```typescript
import { ChaosOrchestrator, ChaosExperiment } from './chaos-orchestrator';

class CustomChaosExperiments {
  constructor(private orchestrator: ChaosOrchestrator) {}

  async createCustomExperiment(options: any): Promise<string> {
    const experiment: Omit<ChaosExperiment, 'id' | 'created_at'> = {
      name: 'Custom Experiment',
      description: 'Custom chaos experiment',
      target: options.target,
      type: 'custom_chaos',
      parameters: options.parameters,
      enabled: true,
      rollbackTriggers: options.rollbackTriggers || [],
      metadata: options.metadata || {}
    };

    return await this.orchestrator.createExperiment(experiment);
  }
}
```

## Metrics and Monitoring

### Key Metrics Tracked

- **Performance**: Response times (p50, p95, p99), throughput
- **Reliability**: Error rates, success rates, availability
- **Resource Utilization**: CPU, memory, disk, network usage
- **System Health**: Service status, pod counts, node health

### Integration with Monitoring

- Prometheus metrics collection
- Grafana dashboard visualization  
- Custom alerting rules
- Real-time monitoring during experiments

### Impact Analysis

After each experiment, the system generates:

- Performance degradation analysis
- Error rate impact assessment
- Recovery time measurements
- Blast radius identification
- Lessons learned documentation

## Best Practices

### 1. Start Small
- Begin with low-impact experiments
- Gradually increase intensity
- Test in non-production environments first

### 2. Define Clear Objectives
- Set specific hypotheses to test
- Define success/failure criteria
- Document expected outcomes

### 3. Monitor Continuously
- Watch key metrics during experiments
- Set appropriate rollback triggers
- Have manual stop procedures ready

### 4. Plan for Rollback
- Test rollback procedures beforehand
- Automate recovery where possible
- Document manual recovery steps

### 5. Learn and Iterate
- Analyze results thoroughly
- Document lessons learned
- Improve system resilience based on findings

## Troubleshooting

### Common Issues

1. **Experiment Won't Start**
   - Check system prerequisites
   - Verify target availability
   - Review safety constraints

2. **Automatic Rollback Triggered**
   - Check rollback trigger thresholds
   - Verify monitoring metrics
   - Review system capacity

3. **Rollback Failed**
   - Execute manual recovery procedures
   - Check system logs for errors
   - Verify connectivity to targets

### Debug Mode

Enable debug logging for detailed information:

```bash
export CHAOS_LOG_LEVEL=debug
export CHAOS_DEBUG=true
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add your chaos experiments
4. Write tests for your experiments
5. Submit a pull request

### Adding New Experiment Types

1. Extend the `ChaosType` enum
2. Implement the chaos handler
3. Add rollback functionality
4. Create CLI commands
5. Document the experiment

## Security Considerations

- Run experiments in isolated environments
- Limit blast radius with proper targeting
- Use least privilege access
- Monitor for security-related impacts
- Have incident response procedures ready

## License

This chaos engineering framework is part of the n8n-MCP project and follows the same license terms.

## Support

For questions, issues, or contributions:

- Create GitHub issues for bugs
- Submit feature requests via pull requests
- Join the community discussions
- Review the troubleshooting guide

---

**⚠️ Warning**: Chaos experiments can impact system performance and availability. Always run experiments in appropriate environments with proper safety measures in place.