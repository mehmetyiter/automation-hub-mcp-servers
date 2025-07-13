#!/usr/bin/env ts-node

import { Command } from 'commander';
import { ChaosOrchestrator } from './chaos-orchestrator';
import { NetworkChaosExperiments } from './experiments/network-chaos';
import { InfrastructureChaosExperiments } from './experiments/infrastructure-chaos';
import { LoggingService } from '../../src/observability/logging';
import { Pool } from 'pg';
import { Redis } from 'ioredis';

const logger = LoggingService.getInstance();

class ChaosCLI {
  private orchestrator: ChaosOrchestrator;
  private networkChaos: NetworkChaosExperiments;
  private infraChaos: InfrastructureChaosExperiments;
  private program: Command;

  constructor() {
    this.orchestrator = new ChaosOrchestrator();
    this.networkChaos = new NetworkChaosExperiments(this.orchestrator);
    this.infraChaos = new InfrastructureChaosExperiments(this.orchestrator);
    this.program = new Command();
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('chaos')
      .description('Chaos Engineering CLI for n8n-MCP')
      .version('1.0.0');

    // Initialize command
    this.program
      .command('init')
      .description('Initialize chaos orchestrator')
      .action(async () => {
        try {
          await this.orchestrator.initialize();
          console.log('✅ Chaos orchestrator initialized');
        } catch (error) {
          console.error('❌ Failed to initialize:', error.message);
          process.exit(1);
        }
      });

    // List experiments
    this.program
      .command('list')
      .alias('ls')
      .description('List all chaos experiments')
      .option('-a, --active', 'Show only active experiments')
      .option('-t, --type <type>', 'Filter by experiment type')
      .action(async (options) => {
        try {
          let experiments = this.orchestrator.listExperiments();
          
          if (options.active) {
            const activeExecutions = this.orchestrator.getActiveExecutions();
            const activeExpIds = new Set(activeExecutions.map(exec => exec.experiment_id));
            experiments = experiments.filter(exp => activeExpIds.has(exp.id));
          }
          
          if (options.type) {
            experiments = experiments.filter(exp => exp.type === options.type);
          }

          if (experiments.length === 0) {
            console.log('No experiments found');
            return;
          }

          console.table(experiments.map(exp => ({
            ID: exp.id.substring(0, 8),
            Name: exp.name,
            Type: exp.type,
            Target: exp.target,
            Enabled: exp.enabled ? '✅' : '❌',
            Created: exp.created_at.toISOString().split('T')[0]
          })));
        } catch (error) {
          console.error('❌ Failed to list experiments:', error.message);
        }
      });

    // Show experiment details
    this.program
      .command('show <experimentId>')
      .description('Show detailed information about an experiment')
      .action(async (experimentId) => {
        try {
          const experiment = this.orchestrator.getExperiment(experimentId);
          if (!experiment) {
            console.error(`❌ Experiment ${experimentId} not found`);
            return;
          }

          console.log('\n📋 Experiment Details:');
          console.log(`  ID: ${experiment.id}`);
          console.log(`  Name: ${experiment.name}`);
          console.log(`  Description: ${experiment.description}`);
          console.log(`  Type: ${experiment.type}`);
          console.log(`  Target: ${experiment.target}`);
          console.log(`  Enabled: ${experiment.enabled ? '✅' : '❌'}`);
          console.log(`  Created: ${experiment.created_at.toISOString()}`);
          
          console.log('\n⚙️ Parameters:');
          console.log(JSON.stringify(experiment.parameters, null, 2));
          
          console.log('\n🔄 Rollback Triggers:');
          experiment.rollbackTriggers.forEach((trigger, i) => {
            console.log(`  ${i + 1}. ${trigger.metric} ${trigger.operator} ${trigger.threshold}`);
          });

          // Show executions
          const executions = this.orchestrator.listExecutions(experimentId);
          if (executions.length > 0) {
            console.log('\n📈 Recent Executions:');
            console.table(executions.slice(-5).map(exec => ({
              ID: exec.id.substring(0, 8),
              Status: exec.status,
              Started: exec.started_at.toISOString(),
              Duration: exec.ended_at ? 
                `${Math.round((exec.ended_at.getTime() - exec.started_at.getTime()) / 1000)}s` : 
                'Running'
            })));
          }
        } catch (error) {
          console.error('❌ Failed to show experiment:', error.message);
        }
      });

    // Execute experiment
    this.program
      .command('run <experimentId>')
      .description('Execute a chaos experiment')
      .option('-f, --force', 'Force execution even if disabled')
      .action(async (experimentId, options) => {
        try {
          const executionId = await this.orchestrator.executeExperiment(
            experimentId, 
            options.force
          );
          
          console.log(`🚀 Experiment execution started`);
          console.log(`  Experiment ID: ${experimentId}`);
          console.log(`  Execution ID: ${executionId}`);
          console.log('\nUse "chaos status <executionId>" to monitor progress');
        } catch (error) {
          console.error('❌ Failed to execute experiment:', error.message);
        }
      });

    // Stop execution
    this.program
      .command('stop <executionId>')
      .description('Stop a running chaos experiment execution')
      .action(async (executionId) => {
        try {
          await this.orchestrator.stopExecution(executionId);
          console.log(`🛑 Execution ${executionId} stopped`);
        } catch (error) {
          console.error('❌ Failed to stop execution:', error.message);
        }
      });

    // Show execution status
    this.program
      .command('status [executionId]')
      .description('Show execution status (all active if no ID provided)')
      .action(async (executionId) => {
        try {
          if (executionId) {
            const execution = this.orchestrator.getExecution(executionId);
            if (!execution) {
              console.error(`❌ Execution ${executionId} not found`);
              return;
            }

            console.log('\n📊 Execution Status:');
            console.log(`  ID: ${execution.id}`);
            console.log(`  Experiment: ${execution.experiment_id}`);
            console.log(`  Status: ${this.getStatusEmoji(execution.status)} ${execution.status}`);
            console.log(`  Started: ${execution.started_at.toISOString()}`);
            
            if (execution.ended_at) {
              const duration = execution.ended_at.getTime() - execution.started_at.getTime();
              console.log(`  Duration: ${Math.round(duration / 1000)}s`);
            }
            
            if (execution.rollback_triggered) {
              console.log(`  ⚠️ Rollback: ${execution.rollback_reason}`);
            }

            if (execution.results.impact_analysis) {
              const impact = execution.results.impact_analysis;
              console.log('\n📈 Impact Analysis:');
              console.log(`  Performance Degradation: ${impact.performance_degradation.toFixed(1)}%`);
              console.log(`  Error Rate Increase: ${impact.error_rate_increase.toFixed(1)}%`);
              console.log(`  Availability Impact: ${impact.availability_impact.toFixed(1)}%`);
              console.log(`  Recovery Time: ${Math.round(impact.recovery_time / 1000)}s`);
            }
          } else {
            const activeExecutions = this.orchestrator.getActiveExecutions();
            
            if (activeExecutions.length === 0) {
              console.log('No active executions');
              return;
            }

            console.log('\n🏃 Active Executions:');
            console.table(activeExecutions.map(exec => ({
              ID: exec.id.substring(0, 8),
              Experiment: exec.experiment_id.substring(0, 8),
              Status: exec.status,
              Started: exec.started_at.toISOString().split('T')[1].split('.')[0],
              Duration: `${Math.round((Date.now() - exec.started_at.getTime()) / 1000)}s`
            })));
          }
        } catch (error) {
          console.error('❌ Failed to get status:', error.message);
        }
      });

    // Create experiment commands
    const createCmd = this.program
      .command('create')
      .description('Create new chaos experiments');

    // Network experiments
    createCmd
      .command('network-latency')
      .description('Create network latency experiment')
      .requiredOption('-t, --targets <targets>', 'Target services (comma-separated)')
      .requiredOption('-l, --latency <ms>', 'Latency in milliseconds', parseInt)
      .requiredOption('-d, --duration <ms>', 'Duration in milliseconds', parseInt)
      .option('-n, --name <name>', 'Experiment name')
      .action(async (options) => {
        try {
          const targets = options.targets.split(',').map((t: string) => t.trim());
          const experimentId = await this.networkChaos.createLatencyExperiment({
            name: options.name,
            targets,
            latencyMs: options.latency,
            duration: options.duration
          });
          
          console.log(`✅ Network latency experiment created: ${experimentId}`);
        } catch (error) {
          console.error('❌ Failed to create experiment:', error.message);
        }
      });

    createCmd
      .command('cpu-stress')
      .description('Create CPU stress experiment')
      .requiredOption('-t, --targets <targets>', 'Target services (comma-separated)')
      .requiredOption('-c, --cpu <percentage>', 'CPU percentage', parseInt)
      .requiredOption('-d, --duration <ms>', 'Duration in milliseconds', parseInt)
      .option('-n, --name <name>', 'Experiment name')
      .option('--cores <cores>', 'Number of cores', parseInt)
      .action(async (options) => {
        try {
          const targets = options.targets.split(',').map((t: string) => t.trim());
          const experimentId = await this.infraChaos.createCPUStressExperiment({
            name: options.name,
            targets,
            cpuPercentage: options.cpu,
            duration: options.duration,
            cores: options.cores
          });
          
          console.log(`✅ CPU stress experiment created: ${experimentId}`);
        } catch (error) {
          console.error('❌ Failed to create experiment:', error.message);
        }
      });

    // Predefined scenario commands
    const scenarioCmd = this.program
      .command('scenario')
      .description('Run predefined chaos scenarios');

    scenarioCmd
      .command('api-gateway-test')
      .description('Run API gateway resilience test')
      .option('-d, --duration <ms>', 'Duration in milliseconds', parseInt, 300000)
      .action(async (options) => {
        try {
          const experimentId = await this.networkChaos.runAPIGatewayLatencyTest(options.duration);
          console.log(`🚀 API Gateway test started: ${experimentId}`);
        } catch (error) {
          console.error('❌ Failed to start scenario:', error.message);
        }
      });

    scenarioCmd
      .command('database-stress')
      .description('Run database stress test')
      .option('-d, --duration <ms>', 'Duration in milliseconds', parseInt, 240000)
      .action(async (options) => {
        try {
          const experimentId = await this.infraChaos.runDatabaseMemoryPressure(options.duration);
          console.log(`🚀 Database stress test started: ${experimentId}`);
        } catch (error) {
          console.error('❌ Failed to start scenario:', error.message);
        }
      });

    scenarioCmd
      .command('full-chaos')
      .description('Run comprehensive chaos test')
      .option('-d, --duration <ms>', 'Duration in milliseconds', parseInt, 900000)
      .action(async (options) => {
        try {
          const experiments = await this.infraChaos.runFullInfrastructureStressTest(options.duration);
          console.log(`🚀 Full chaos test started with ${experiments.length} experiments`);
          console.log('Experiment IDs:', experiments.join(', '));
        } catch (error) {
          console.error('❌ Failed to start scenario:', error.message);
        }
      });

    // Analytics commands
    const analyticsCmd = this.program
      .command('analytics')
      .alias('stats')
      .description('Analyze chaos experiment results');

    analyticsCmd
      .command('summary')
      .description('Show execution summary statistics')
      .option('-d, --days <days>', 'Days to analyze', parseInt, 7)
      .action(async (options) => {
        try {
          const executions = this.orchestrator.listExecutions();
          const cutoff = new Date(Date.now() - options.days * 24 * 60 * 60 * 1000);
          const recentExecutions = executions.filter(exec => exec.started_at >= cutoff);

          if (recentExecutions.length === 0) {
            console.log(`No executions found in the last ${options.days} days`);
            return;
          }

          const stats = this.calculateExecutionStats(recentExecutions);
          
          console.log(`\n📊 Execution Summary (Last ${options.days} days):`);
          console.log(`  Total Executions: ${stats.total}`);
          console.log(`  Successful: ${stats.successful} (${stats.successRate.toFixed(1)}%)`);
          console.log(`  Failed: ${stats.failed}`);
          console.log(`  Rolled Back: ${stats.rolledBack}`);
          console.log(`  Average Duration: ${Math.round(stats.avgDuration / 1000)}s`);
          console.log(`  Total Duration: ${Math.round(stats.totalDuration / 3600000)}h`);

          if (stats.experimentTypes.size > 0) {
            console.log('\n🔬 Experiment Types:');
            for (const [type, count] of stats.experimentTypes) {
              console.log(`  ${type}: ${count}`);
            }
          }
        } catch (error) {
          console.error('❌ Failed to generate summary:', error.message);
        }
      });

    // Cleanup command
    this.program
      .command('cleanup')
      .description('Cleanup chaos orchestrator resources')
      .action(async () => {
        try {
          await this.orchestrator.cleanup();
          console.log('✅ Cleanup completed');
        } catch (error) {
          console.error('❌ Cleanup failed:', error.message);
        }
      });
  }

  private getStatusEmoji(status: string): string {
    const emojis: Record<string, string> = {
      pending: '⏳',
      running: '🏃',
      completed: '✅',
      failed: '❌',
      rolled_back: '🔄',
      terminated: '🛑'
    };
    return emojis[status] || '❓';
  }

  private calculateExecutionStats(executions: any[]): any {
    const stats = {
      total: executions.length,
      successful: 0,
      failed: 0,
      rolledBack: 0,
      avgDuration: 0,
      totalDuration: 0,
      successRate: 0,
      experimentTypes: new Map<string, number>()
    };

    let totalDuration = 0;
    let completedExecutions = 0;

    for (const exec of executions) {
      // Count by status
      switch (exec.status) {
        case 'completed':
          stats.successful++;
          break;
        case 'failed':
          stats.failed++;
          break;
        case 'rolled_back':
          stats.rolledBack++;
          break;
      }

      // Calculate duration for completed executions
      if (exec.ended_at) {
        const duration = exec.ended_at.getTime() - exec.started_at.getTime();
        totalDuration += duration;
        completedExecutions++;
      }

      // Count experiment types
      const experiment = this.orchestrator.getExperiment(exec.experiment_id);
      if (experiment) {
        const count = stats.experimentTypes.get(experiment.type) || 0;
        stats.experimentTypes.set(experiment.type, count + 1);
      }
    }

    stats.avgDuration = completedExecutions > 0 ? totalDuration / completedExecutions : 0;
    stats.totalDuration = totalDuration;
    stats.successRate = stats.total > 0 ? (stats.successful / stats.total) * 100 : 0;

    return stats;
  }

  async run(): Promise<void> {
    try {
      await this.program.parseAsync(process.argv);
    } catch (error) {
      console.error('❌ CLI Error:', error.message);
      process.exit(1);
    }
  }
}

// Main execution
if (require.main === module) {
  const cli = new ChaosCLI();
  cli.run().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { ChaosCLI };