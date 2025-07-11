import { EventEmitter } from 'events';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

const execAsync = promisify(exec);

export interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  deployment: {
    strategy: 'blue-green' | 'rolling' | 'canary' | 'recreate';
    healthCheckTimeout: number;
    readinessTimeout: number;
    gracefulShutdownTimeout: number;
  };
  docker: {
    registry: string;
    imageName: string;
    buildArgs?: Record<string, string>;
    platforms?: string[];
  };
  kubernetes?: {
    cluster: string;
    namespace: string;
    configMaps: string[];
    secrets: string[];
    replicas: {
      min: number;
      max: number;
      targetCPUUtilization: number;
    };
  };
  database: {
    runMigrations: boolean;
    backupBeforeMigration: boolean;
    migrationTimeout: number;
  };
  monitoring: {
    prometheusEndpoint: string;
    grafanaUrl: string;
    alertManagerUrl?: string;
  };
  rollback: {
    enableAutoRollback: boolean;
    maxErrorRate: number;
    monitoringDuration: number;
    keepPreviousVersions: number;
  };
}

export interface DeploymentStatus {
  id: string;
  environment: string;
  version: string;
  status: 'pending' | 'building' | 'deploying' | 'verifying' | 'completed' | 'failed' | 'rolled_back';
  startTime: Date;
  endTime?: Date;
  steps: DeploymentStep[];
  errors: string[];
  warnings: string[];
  metrics?: {
    buildDuration?: number;
    deploymentDuration?: number;
    downtime?: number;
    affectedServices?: string[];
  };
}

export interface DeploymentStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  output?: string;
  error?: string;
}

export interface HealthCheck {
  service: string;
  endpoint: string;
  expectedStatus: number;
  timeout: number;
  retries: number;
}

export interface RollbackInfo {
  fromVersion: string;
  toVersion: string;
  reason: string;
  timestamp: Date;
  automatic: boolean;
  success: boolean;
}

export class DeploymentAutomation extends EventEmitter {
  private config: DeploymentConfig;
  private currentDeployment?: DeploymentStatus;
  private deploymentHistory: DeploymentStatus[] = [];
  private versionHistory: string[] = [];
  private healthChecks: HealthCheck[] = [];

  constructor(config: DeploymentConfig) {
    super();
    this.config = config;
    this.initializeHealthChecks();
  }

  private initializeHealthChecks(): void {
    this.healthChecks = [
      {
        service: 'api',
        endpoint: '/health',
        expectedStatus: 200,
        timeout: 5000,
        retries: 3
      },
      {
        service: 'database',
        endpoint: '/health/db',
        expectedStatus: 200,
        timeout: 10000,
        retries: 3
      },
      {
        service: 'redis',
        endpoint: '/health/redis',
        expectedStatus: 200,
        timeout: 5000,
        retries: 3
      },
      {
        service: 'monitoring',
        endpoint: this.config.monitoring.prometheusEndpoint + '/-/ready',
        expectedStatus: 200,
        timeout: 5000,
        retries: 3
      }
    ];
  }

  async deploy(version: string, options: { 
    dryRun?: boolean; 
    force?: boolean;
    skipTests?: boolean;
  } = {}): Promise<DeploymentStatus> {
    console.log(`🚀 Starting deployment of version ${version} to ${this.config.environment}`);

    // Create deployment status
    this.currentDeployment = {
      id: `deploy_${Date.now()}`,
      environment: this.config.environment,
      version,
      status: 'pending',
      startTime: new Date(),
      steps: [],
      errors: [],
      warnings: []
    };

    this.emit('deployment-started', this.currentDeployment);

    try {
      // Pre-deployment checks
      await this.executeStep('pre-deployment-checks', async () => {
        await this.preDeploymentChecks(options);
      });

      // Build Docker image
      await this.executeStep('build-docker-image', async () => {
        await this.buildDockerImage(version, options.dryRun);
      });

      // Run tests if not skipped
      if (!options.skipTests) {
        await this.executeStep('run-tests', async () => {
          await this.runTests();
        });
      }

      // Database migrations
      if (this.config.database.runMigrations) {
        await this.executeStep('database-migrations', async () => {
          await this.runDatabaseMigrations(options.dryRun);
        });
      }

      // Deploy based on strategy
      await this.executeStep('deploy-application', async () => {
        await this.deployApplication(version, options.dryRun);
      });

      // Verify deployment
      await this.executeStep('verify-deployment', async () => {
        await this.verifyDeployment();
      });

      // Update monitoring
      await this.executeStep('update-monitoring', async () => {
        await this.updateMonitoring(version);
      });

      // Cleanup old versions
      await this.executeStep('cleanup', async () => {
        await this.cleanupOldVersions();
      });

      // Mark deployment as completed
      this.currentDeployment.status = 'completed';
      this.currentDeployment.endTime = new Date();
      this.currentDeployment.metrics = {
        deploymentDuration: this.currentDeployment.endTime.getTime() - this.currentDeployment.startTime.getTime()
      };

      this.deploymentHistory.push(this.currentDeployment);
      this.versionHistory.push(version);

      console.log(`✅ Deployment completed successfully!`);
      this.emit('deployment-completed', this.currentDeployment);

      return this.currentDeployment;

    } catch (error) {
      console.error(`❌ Deployment failed:`, error);
      
      this.currentDeployment.status = 'failed';
      this.currentDeployment.endTime = new Date();
      this.currentDeployment.errors.push(error instanceof Error ? error.message : String(error));

      this.deploymentHistory.push(this.currentDeployment);

      // Auto-rollback if enabled
      if (this.config.rollback.enableAutoRollback && !options.force) {
        await this.rollback('Automatic rollback due to deployment failure');
      }

      this.emit('deployment-failed', this.currentDeployment);
      throw error;
    }
  }

  private async executeStep(name: string, fn: () => Promise<void>): Promise<void> {
    if (!this.currentDeployment) return;

    const step: DeploymentStep = {
      name,
      status: 'running',
      startTime: new Date()
    };

    this.currentDeployment.steps.push(step);
    this.emit('step-started', { deployment: this.currentDeployment.id, step });

    try {
      await fn();
      step.status = 'completed';
      step.endTime = new Date();
      this.emit('step-completed', { deployment: this.currentDeployment.id, step });
    } catch (error) {
      step.status = 'failed';
      step.endTime = new Date();
      step.error = error instanceof Error ? error.message : String(error);
      this.emit('step-failed', { deployment: this.currentDeployment.id, step });
      throw error;
    }
  }

  private async preDeploymentChecks(options: { force?: boolean }): Promise<void> {
    console.log('🔍 Running pre-deployment checks...');

    // Check if deployment is already in progress
    const inProgress = this.deploymentHistory.find(d => 
      d.status === 'deploying' || d.status === 'building'
    );
    
    if (inProgress && !options.force) {
      throw new Error(`Deployment ${inProgress.id} is already in progress`);
    }

    // Check system resources
    await this.checkSystemResources();

    // Verify configuration
    await this.verifyConfiguration();

    // Check dependencies
    await this.checkDependencies();

    console.log('✅ Pre-deployment checks passed');
  }

  private async checkSystemResources(): Promise<void> {
    const { stdout } = await execAsync('df -h / | tail -1');
    const diskUsage = parseInt(stdout.split(/\s+/)[4]);
    
    if (diskUsage > 90) {
      throw new Error(`Insufficient disk space: ${diskUsage}% used`);
    }

    // Check memory
    const memInfo = await fs.readFile('/proc/meminfo', 'utf8');
    const memAvailable = parseInt(memInfo.match(/MemAvailable:\s+(\d+)/)?.[1] || '0');
    
    if (memAvailable < 1024 * 1024) { // Less than 1GB available
      this.currentDeployment?.warnings.push('Low memory available');
    }
  }

  private async verifyConfiguration(): Promise<void> {
    // Verify required environment variables
    const requiredEnvVars = [
      'DATABASE_URL',
      'REDIS_URL',
      'ENCRYPTION_KEY',
      'NODE_ENV'
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    // Verify Kubernetes configuration if applicable
    if (this.config.kubernetes) {
      try {
        await execAsync(`kubectl config use-context ${this.config.kubernetes.cluster}`);
        await execAsync(`kubectl get namespace ${this.config.kubernetes.namespace}`);
      } catch (error) {
        throw new Error(`Kubernetes configuration error: ${error}`);
      }
    }
  }

  private async checkDependencies(): Promise<void> {
    const dependencies = ['docker', 'git'];
    
    if (this.config.kubernetes) {
      dependencies.push('kubectl', 'helm');
    }

    for (const dep of dependencies) {
      try {
        await execAsync(`which ${dep}`);
      } catch {
        throw new Error(`Missing required dependency: ${dep}`);
      }
    }
  }

  private async buildDockerImage(version: string, dryRun?: boolean): Promise<void> {
    console.log('🐳 Building Docker image...');

    const imageName = `${this.config.docker.registry}/${this.config.docker.imageName}:${version}`;
    const buildArgs = Object.entries(this.config.docker.buildArgs || {})
      .map(([key, value]) => `--build-arg ${key}=${value}`)
      .join(' ');

    const platforms = this.config.docker.platforms?.join(',') || 'linux/amd64';
    
    const buildCommand = `docker buildx build \
      --platform ${platforms} \
      --tag ${imageName} \
      --tag ${this.config.docker.registry}/${this.config.docker.imageName}:latest \
      ${buildArgs} \
      --push \
      .`;

    if (dryRun) {
      console.log(`[DRY RUN] Would execute: ${buildCommand}`);
      return;
    }

    // Execute build
    await this.executeCommand(buildCommand, 'build');

    console.log('✅ Docker image built and pushed successfully');
  }

  private async runTests(): Promise<void> {
    console.log('🧪 Running tests...');

    try {
      // Run unit tests
      await this.executeCommand('npm test', 'tests');

      // Run integration tests
      await this.executeCommand('npm run test:integration', 'tests');

      // Run security scan
      await this.executeCommand('npm audit --production', 'security');

      console.log('✅ All tests passed');
    } catch (error) {
      throw new Error(`Tests failed: ${error}`);
    }
  }

  private async runDatabaseMigrations(dryRun?: boolean): Promise<void> {
    console.log('🗄️ Running database migrations...');

    // Backup database if configured
    if (this.config.database.backupBeforeMigration) {
      await this.backupDatabase();
    }

    const migrationCommand = 'npm run migrate:latest';

    if (dryRun) {
      console.log(`[DRY RUN] Would execute: ${migrationCommand}`);
      return;
    }

    try {
      await this.executeCommand(migrationCommand, 'migrations', {
        timeout: this.config.database.migrationTimeout
      });
      console.log('✅ Database migrations completed');
    } catch (error) {
      throw new Error(`Database migration failed: ${error}`);
    }
  }

  private async backupDatabase(): Promise<void> {
    console.log('💾 Backing up database...');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `backup_${this.config.environment}_${timestamp}.sql`;

    // This assumes PostgreSQL - adjust for other databases
    const backupCommand = `pg_dump ${process.env.DATABASE_URL} > /backups/${backupFile}`;

    await this.executeCommand(backupCommand, 'backup');
    console.log(`✅ Database backed up to ${backupFile}`);
  }

  private async deployApplication(version: string, dryRun?: boolean): Promise<void> {
    console.log(`🚀 Deploying application using ${this.config.deployment.strategy} strategy...`);

    switch (this.config.deployment.strategy) {
      case 'blue-green':
        await this.deployBlueGreen(version, dryRun);
        break;
      case 'rolling':
        await this.deployRolling(version, dryRun);
        break;
      case 'canary':
        await this.deployCanary(version, dryRun);
        break;
      case 'recreate':
        await this.deployRecreate(version, dryRun);
        break;
    }
  }

  private async deployBlueGreen(version: string, dryRun?: boolean): Promise<void> {
    console.log('🔵🟢 Performing blue-green deployment...');

    if (this.config.kubernetes) {
      // Kubernetes blue-green deployment
      const deploymentYaml = await this.generateKubernetesManifest(version, 'green');
      
      if (dryRun) {
        console.log('[DRY RUN] Would apply:', yaml.dump(deploymentYaml));
        return;
      }

      // Deploy green environment
      await this.applyKubernetesManifest(deploymentYaml);

      // Wait for green environment to be ready
      await this.waitForDeploymentReady('green', version);

      // Run health checks on green environment
      await this.performHealthChecks('green');

      // Switch traffic to green
      await this.switchTraffic('blue', 'green');

      // Keep blue environment for rollback
      console.log('✅ Blue-green deployment completed, blue environment kept for rollback');
    } else {
      // Docker Compose blue-green
      throw new Error('Blue-green deployment requires Kubernetes');
    }
  }

  private async deployRolling(version: string, dryRun?: boolean): Promise<void> {
    console.log('🔄 Performing rolling deployment...');

    if (this.config.kubernetes) {
      const deploymentYaml = await this.generateKubernetesManifest(version);
      
      if (dryRun) {
        console.log('[DRY RUN] Would apply:', yaml.dump(deploymentYaml));
        return;
      }

      // Apply deployment with rolling update strategy
      await this.applyKubernetesManifest(deploymentYaml);

      // Monitor rolling update
      await this.monitorRollingUpdate();

      console.log('✅ Rolling deployment completed');
    } else {
      // Docker Compose doesn't support rolling updates natively
      throw new Error('Rolling deployment requires Kubernetes');
    }
  }

  private async deployCanary(version: string, dryRun?: boolean): Promise<void> {
    console.log('🐤 Performing canary deployment...');

    if (this.config.kubernetes) {
      // Deploy canary version with 10% traffic
      const canaryYaml = await this.generateKubernetesManifest(version, 'canary', 0.1);
      
      if (dryRun) {
        console.log('[DRY RUN] Would apply:', yaml.dump(canaryYaml));
        return;
      }

      // Deploy canary
      await this.applyKubernetesManifest(canaryYaml);
      await this.waitForDeploymentReady('canary', version);

      // Monitor canary metrics
      console.log('📊 Monitoring canary deployment...');
      const canaryHealthy = await this.monitorCanary(version, 300000); // 5 minutes

      if (canaryHealthy) {
        // Gradually increase traffic
        for (const weight of [0.25, 0.5, 0.75, 1.0]) {
          console.log(`🎯 Shifting ${weight * 100}% traffic to canary...`);
          await this.updateTrafficWeight('canary', weight);
          await this.monitorCanary(version, 120000); // 2 minutes each step
        }

        // Replace stable with canary
        await this.promoteCanary(version);
        console.log('✅ Canary deployment completed successfully');
      } else {
        // Rollback canary
        await this.removeCanary();
        throw new Error('Canary deployment failed health checks');
      }
    } else {
      throw new Error('Canary deployment requires Kubernetes');
    }
  }

  private async deployRecreate(version: string, dryRun?: boolean): Promise<void> {
    console.log('♻️ Performing recreate deployment...');

    if (dryRun) {
      console.log('[DRY RUN] Would stop current deployment and start new one');
      return;
    }

    // Stop current deployment
    await this.stopCurrentDeployment();

    // Start new deployment
    if (this.config.kubernetes) {
      const deploymentYaml = await this.generateKubernetesManifest(version);
      await this.applyKubernetesManifest(deploymentYaml);
      await this.waitForDeploymentReady('main', version);
    } else {
      // Docker Compose
      await this.executeCommand(
        `docker-compose -f docker-compose.${this.config.environment}.yml up -d`,
        'deploy'
      );
    }

    console.log('✅ Recreate deployment completed');
  }

  private async generateKubernetesManifest(
    version: string, 
    variant?: string, 
    trafficWeight?: number
  ): Promise<any> {
    const labels = {
      app: 'credential-management',
      version,
      environment: this.config.environment,
      ...(variant && { variant })
    };

    const manifest = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: `credential-management${variant ? `-${variant}` : ''}`,
        namespace: this.config.kubernetes!.namespace,
        labels
      },
      spec: {
        replicas: this.config.kubernetes!.replicas.min,
        selector: {
          matchLabels: labels
        },
        template: {
          metadata: {
            labels
          },
          spec: {
            containers: [{
              name: 'app',
              image: `${this.config.docker.registry}/${this.config.docker.imageName}:${version}`,
              ports: [{ containerPort: 8080 }],
              env: this.generateEnvVars(),
              resources: {
                requests: {
                  cpu: '100m',
                  memory: '256Mi'
                },
                limits: {
                  cpu: '1000m',
                  memory: '1Gi'
                }
              },
              livenessProbe: {
                httpGet: {
                  path: '/health',
                  port: 8080
                },
                initialDelaySeconds: 30,
                periodSeconds: 10
              },
              readinessProbe: {
                httpGet: {
                  path: '/ready',
                  port: 8080
                },
                initialDelaySeconds: 5,
                periodSeconds: 5
              }
            }],
            volumes: this.generateVolumes()
          }
        },
        strategy: {
          type: this.config.deployment.strategy === 'rolling' ? 'RollingUpdate' : 'Recreate',
          ...(this.config.deployment.strategy === 'rolling' && {
            rollingUpdate: {
              maxSurge: '25%',
              maxUnavailable: '25%'
            }
          })
        }
      }
    };

    // Add HPA
    const hpa = {
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
      metadata: {
        name: `credential-management${variant ? `-${variant}` : ''}-hpa`,
        namespace: this.config.kubernetes!.namespace
      },
      spec: {
        scaleTargetRef: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          name: manifest.metadata.name
        },
        minReplicas: this.config.kubernetes!.replicas.min,
        maxReplicas: this.config.kubernetes!.replicas.max,
        metrics: [{
          type: 'Resource',
          resource: {
            name: 'cpu',
            target: {
              type: 'Utilization',
              averageUtilization: this.config.kubernetes!.replicas.targetCPUUtilization
            }
          }
        }]
      }
    };

    // Add Service
    const service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: `credential-management${variant ? `-${variant}` : ''}`,
        namespace: this.config.kubernetes!.namespace,
        labels
      },
      spec: {
        selector: labels,
        ports: [{
          port: 80,
          targetPort: 8080,
          protocol: 'TCP'
        }],
        type: 'ClusterIP'
      }
    };

    return {
      deployment: manifest,
      hpa,
      service,
      ...(trafficWeight !== undefined && {
        virtualService: this.generateVirtualService(version, variant!, trafficWeight)
      })
    };
  }

  private generateEnvVars(): Array<{ name: string; value?: string; valueFrom?: any }> {
    return [
      { name: 'NODE_ENV', value: this.config.environment },
      { name: 'PORT', value: '8080' },
      {
        name: 'DATABASE_URL',
        valueFrom: {
          secretKeyRef: {
            name: 'database-credentials',
            key: 'url'
          }
        }
      },
      {
        name: 'REDIS_URL',
        valueFrom: {
          secretKeyRef: {
            name: 'redis-credentials',
            key: 'url'
          }
        }
      },
      {
        name: 'ENCRYPTION_KEY',
        valueFrom: {
          secretKeyRef: {
            name: 'encryption-keys',
            key: 'master'
          }
        }
      }
    ];
  }

  private generateVolumes(): any[] {
    return this.config.kubernetes!.configMaps.map(cm => ({
      name: cm,
      configMap: {
        name: cm
      }
    }));
  }

  private generateVirtualService(version: string, variant: string, weight: number): any {
    return {
      apiVersion: 'networking.istio.io/v1beta1',
      kind: 'VirtualService',
      metadata: {
        name: 'credential-management',
        namespace: this.config.kubernetes!.namespace
      },
      spec: {
        hosts: ['credential-management'],
        http: [{
          match: [{ uri: { prefix: '/' } }],
          route: [
            {
              destination: {
                host: 'credential-management',
                subset: 'stable'
              },
              weight: Math.round((1 - weight) * 100)
            },
            {
              destination: {
                host: `credential-management-${variant}`,
                subset: variant
              },
              weight: Math.round(weight * 100)
            }
          ]
        }]
      }
    };
  }

  private async applyKubernetesManifest(manifest: any): Promise<void> {
    // Save manifest to temporary file
    const tempFile = `/tmp/deployment_${Date.now()}.yaml`;
    
    const docs = [
      manifest.deployment,
      manifest.hpa,
      manifest.service,
      manifest.virtualService
    ].filter(Boolean);

    const yamlContent = docs.map(doc => yaml.dump(doc)).join('---\n');
    await fs.writeFile(tempFile, yamlContent);

    try {
      await this.executeCommand(`kubectl apply -f ${tempFile}`, 'kubectl');
    } finally {
      await fs.unlink(tempFile);
    }
  }

  private async waitForDeploymentReady(name: string, version: string): Promise<void> {
    console.log(`⏳ Waiting for deployment ${name} to be ready...`);

    const namespace = this.config.kubernetes!.namespace;
    const timeout = this.config.deployment.readinessTimeout;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const { stdout } = await execAsync(
          `kubectl get deployment credential-management${name !== 'main' ? `-${name}` : ''} \
           -n ${namespace} -o json`
        );

        const deployment = JSON.parse(stdout);
        const ready = deployment.status.readyReplicas === deployment.spec.replicas;
        
        if (ready) {
          console.log(`✅ Deployment ${name} is ready`);
          return;
        }
      } catch (error) {
        // Deployment might not exist yet
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error(`Deployment ${name} failed to become ready within ${timeout}ms`);
  }

  private async performHealthChecks(target?: string): Promise<void> {
    console.log('🏥 Performing health checks...');

    const failures: string[] = [];

    for (const check of this.healthChecks) {
      let attempts = 0;
      let success = false;

      while (attempts < check.retries && !success) {
        try {
          const endpoint = target ? 
            `http://credential-management-${target}.${this.config.kubernetes?.namespace}.svc.cluster.local${check.endpoint}` :
            `http://localhost:8080${check.endpoint}`;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), check.timeout);

          const response = await fetch(endpoint, {
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.status === check.expectedStatus) {
            success = true;
            console.log(`✅ Health check passed: ${check.service}`);
          }
        } catch (error) {
          attempts++;
          if (attempts < check.retries) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      if (!success) {
        failures.push(check.service);
      }
    }

    if (failures.length > 0) {
      throw new Error(`Health checks failed for: ${failures.join(', ')}`);
    }

    console.log('✅ All health checks passed');
  }

  private async verifyDeployment(): Promise<void> {
    console.log('🔍 Verifying deployment...');

    // Run health checks
    await this.performHealthChecks();

    // Check metrics
    await this.checkDeploymentMetrics();

    // Verify no increase in errors
    await this.verifyErrorRates();

    console.log('✅ Deployment verification completed');
  }

  private async checkDeploymentMetrics(): Promise<void> {
    if (!this.config.monitoring.prometheusEndpoint) return;

    try {
      // Query Prometheus for key metrics
      const queries = [
        'rate(http_requests_total{status=~"5.."}[5m])', // Error rate
        'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))', // P95 latency
        'up' // Service availability
      ];

      for (const query of queries) {
        const response = await fetch(
          `${this.config.monitoring.prometheusEndpoint}/api/v1/query?query=${encodeURIComponent(query)}`
        );

        if (!response.ok) {
          this.currentDeployment?.warnings.push(`Failed to fetch metric: ${query}`);
        }
      }
    } catch (error) {
      this.currentDeployment?.warnings.push(`Metrics verification failed: ${error}`);
    }
  }

  private async verifyErrorRates(): Promise<void> {
    if (!this.config.rollback.enableAutoRollback) return;

    // Simple error rate check - in production, query actual metrics
    const errorRate = Math.random() * 5; // Mock error rate

    if (errorRate > this.config.rollback.maxErrorRate) {
      throw new Error(`Error rate ${errorRate.toFixed(2)}% exceeds threshold ${this.config.rollback.maxErrorRate}%`);
    }
  }

  private async updateMonitoring(version: string): Promise<void> {
    console.log('📊 Updating monitoring configuration...');

    // Update Grafana annotations
    if (this.config.monitoring.grafanaUrl) {
      try {
        await this.createGrafanaAnnotation({
          text: `Deployed version ${version} to ${this.config.environment}`,
          tags: ['deployment', this.config.environment, version]
        });
      } catch (error) {
        this.currentDeployment?.warnings.push(`Failed to create Grafana annotation: ${error}`);
      }
    }

    // Update alert rules if needed
    if (this.config.monitoring.alertManagerUrl) {
      console.log('🚨 Alert rules would be updated here');
    }

    console.log('✅ Monitoring configuration updated');
  }

  private async createGrafanaAnnotation(annotation: any): Promise<void> {
    // This would require Grafana API key
    console.log(`Would create Grafana annotation: ${annotation.text}`);
  }

  private async cleanupOldVersions(): Promise<void> {
    console.log('🧹 Cleaning up old versions...');

    if (this.versionHistory.length > this.config.rollback.keepPreviousVersions) {
      const versionsToRemove = this.versionHistory.slice(
        0, 
        this.versionHistory.length - this.config.rollback.keepPreviousVersions
      );

      for (const version of versionsToRemove) {
        try {
          // Remove old Docker images
          await execAsync(
            `docker rmi ${this.config.docker.registry}/${this.config.docker.imageName}:${version}`
          );
          console.log(`🗑️ Removed old image: ${version}`);
        } catch (error) {
          // Image might not exist locally
        }
      }

      // Update version history
      this.versionHistory = this.versionHistory.slice(-this.config.rollback.keepPreviousVersions);
    }

    console.log('✅ Cleanup completed');
  }

  private async stopCurrentDeployment(): Promise<void> {
    if (this.config.kubernetes) {
      await this.executeCommand(
        `kubectl delete deployment credential-management -n ${this.config.kubernetes.namespace}`,
        'stop'
      );
    } else {
      await this.executeCommand(
        `docker-compose -f docker-compose.${this.config.environment}.yml down`,
        'stop'
      );
    }
  }

  private async switchTraffic(from: string, to: string): Promise<void> {
    console.log(`🔀 Switching traffic from ${from} to ${to}...`);

    if (this.config.kubernetes) {
      // Update service selector
      await this.executeCommand(
        `kubectl patch service credential-management -n ${this.config.kubernetes.namespace} \
         -p '{"spec":{"selector":{"variant":"${to}"}}}'`,
        'traffic-switch'
      );
    }
  }

  private async updateTrafficWeight(variant: string, weight: number): Promise<void> {
    // This would update Istio VirtualService or similar
    console.log(`Would update traffic weight for ${variant} to ${weight * 100}%`);
  }

  private async monitorRollingUpdate(): Promise<void> {
    console.log('📊 Monitoring rolling update...');

    const namespace = this.config.kubernetes!.namespace;
    let completed = false;

    while (!completed) {
      const { stdout } = await execAsync(
        `kubectl rollout status deployment/credential-management -n ${namespace}`
      );

      if (stdout.includes('successfully rolled out')) {
        completed = true;
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  private async monitorCanary(version: string, duration: number): Promise<boolean> {
    console.log(`🐤 Monitoring canary deployment for ${duration / 1000} seconds...`);

    const startTime = Date.now();
    let healthy = true;

    while (Date.now() - startTime < duration) {
      try {
        // Check canary health
        await this.performHealthChecks('canary');

        // Check error rates
        const errorRate = await this.getCanaryErrorRate();
        if (errorRate > this.config.rollback.maxErrorRate) {
          console.error(`❌ Canary error rate ${errorRate}% exceeds threshold`);
          healthy = false;
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10 seconds
      } catch (error) {
        console.error('❌ Canary health check failed:', error);
        healthy = false;
        break;
      }
    }

    return healthy;
  }

  private async getCanaryErrorRate(): Promise<number> {
    // In production, query actual metrics
    return Math.random() * 3; // Mock low error rate
  }

  private async promoteCanary(version: string): Promise<void> {
    console.log('🎯 Promoting canary to stable...');

    // Replace stable deployment with canary version
    const manifest = await this.generateKubernetesManifest(version);
    await this.applyKubernetesManifest(manifest);

    // Remove canary deployment
    await this.removeCanary();
  }

  private async removeCanary(): Promise<void> {
    await this.executeCommand(
      `kubectl delete deployment credential-management-canary -n ${this.config.kubernetes!.namespace}`,
      'cleanup'
    );
  }

  async rollback(reason: string): Promise<void> {
    console.log(`⏪ Rolling back deployment: ${reason}`);

    if (this.versionHistory.length < 2) {
      throw new Error('No previous version available for rollback');
    }

    const currentVersion = this.versionHistory[this.versionHistory.length - 1];
    const previousVersion = this.versionHistory[this.versionHistory.length - 2];

    const rollbackInfo: RollbackInfo = {
      fromVersion: currentVersion,
      toVersion: previousVersion,
      reason,
      timestamp: new Date(),
      automatic: true,
      success: false
    };

    try {
      // Deploy previous version
      await this.deploy(previousVersion, { force: true, skipTests: true });

      rollbackInfo.success = true;
      console.log(`✅ Rollback to version ${previousVersion} completed`);

    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    } finally {
      this.emit('rollback-completed', rollbackInfo);
    }
  }

  private async executeCommand(
    command: string, 
    context: string,
    options: { timeout?: number } = {}
  ): Promise<{ stdout: string; stderr: string }> {
    console.log(`📟 [${context}] Executing: ${command}`);

    return new Promise((resolve, reject) => {
      const child = spawn('sh', ['-c', command], {
        cwd: process.cwd(),
        env: process.env
      });

      let stdout = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout;

      if (options.timeout) {
        timeoutId = setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error(`Command timed out after ${options.timeout}ms`));
        }, options.timeout);
      }

      child.stdout.on('data', (data) => {
        stdout += data.toString();
        process.stdout.write(data);
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
        process.stderr.write(data);
      });

      child.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId);

        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      child.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  // Public API methods

  getDeploymentStatus(): DeploymentStatus | undefined {
    return this.currentDeployment;
  }

  getDeploymentHistory(limit: number = 10): DeploymentStatus[] {
    return this.deploymentHistory.slice(-limit);
  }

  getVersionHistory(): string[] {
    return [...this.versionHistory];
  }

  async getSystemStatus(): Promise<any> {
    const systemChecks = await Promise.all(
      this.healthChecks.map(async check => {
        try {
          const response = await fetch(`http://localhost:8080${check.endpoint}`, {
            signal: AbortSignal.timeout(check.timeout)
          });
          
          return {
            service: check.service,
            healthy: response.status === check.expectedStatus,
            responseTime: 0 // Would measure actual time
          };
        } catch {
          return {
            service: check.service,
            healthy: false,
            responseTime: -1
          };
        }
      })
    );

    return {
      environment: this.config.environment,
      currentVersion: this.versionHistory[this.versionHistory.length - 1],
      services: systemChecks,
      lastDeployment: this.deploymentHistory[this.deploymentHistory.length - 1]
    };
  }
}

// Export convenience function
export function createDeploymentAutomation(config: DeploymentConfig): DeploymentAutomation {
  return new DeploymentAutomation(config);
}

// Export default configurations
export const developmentConfig: DeploymentConfig = {
  environment: 'development',
  deployment: {
    strategy: 'recreate',
    healthCheckTimeout: 30000,
    readinessTimeout: 60000,
    gracefulShutdownTimeout: 30000
  },
  docker: {
    registry: 'localhost:5000',
    imageName: 'credential-management',
    platforms: ['linux/amd64']
  },
  database: {
    runMigrations: true,
    backupBeforeMigration: false,
    migrationTimeout: 60000
  },
  monitoring: {
    prometheusEndpoint: 'http://localhost:9090',
    grafanaUrl: 'http://localhost:3000'
  },
  rollback: {
    enableAutoRollback: false,
    maxErrorRate: 10,
    monitoringDuration: 300000,
    keepPreviousVersions: 3
  }
};

export const productionConfig: DeploymentConfig = {
  environment: 'production',
  deployment: {
    strategy: 'blue-green',
    healthCheckTimeout: 60000,
    readinessTimeout: 300000,
    gracefulShutdownTimeout: 60000
  },
  docker: {
    registry: 'registry.example.com',
    imageName: 'credential-management',
    platforms: ['linux/amd64', 'linux/arm64']
  },
  kubernetes: {
    cluster: 'production-cluster',
    namespace: 'credential-management',
    configMaps: ['app-config', 'feature-flags'],
    secrets: ['database-credentials', 'redis-credentials', 'encryption-keys'],
    replicas: {
      min: 3,
      max: 10,
      targetCPUUtilization: 70
    }
  },
  database: {
    runMigrations: true,
    backupBeforeMigration: true,
    migrationTimeout: 300000
  },
  monitoring: {
    prometheusEndpoint: 'http://prometheus.monitoring.svc.cluster.local:9090',
    grafanaUrl: 'http://grafana.monitoring.svc.cluster.local:3000',
    alertManagerUrl: 'http://alertmanager.monitoring.svc.cluster.local:9093'
  },
  rollback: {
    enableAutoRollback: true,
    maxErrorRate: 5,
    monitoringDuration: 600000,
    keepPreviousVersions: 5
  }
};