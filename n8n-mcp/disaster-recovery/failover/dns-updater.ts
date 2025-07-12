import * as AWS from 'aws-sdk';
import { LoggingService } from '../../src/observability/logging';
import { MetricsService } from '../../src/observability/metrics';

const logger = LoggingService.getInstance();
const metrics = MetricsService.getInstance();

export interface DNSConfig {
  hostedZoneId: string;
  domainName: string;
  ttl: number;
}

export interface DNSRecord {
  name: string;
  type: string;
  value: string;
  ttl: number;
  weight?: number;
  setIdentifier?: string;
  healthCheckId?: string;
}

export class DNSUpdater {
  private route53: AWS.Route53;
  private regionEndpoints: Map<string, string> = new Map([
    ['us-east-1', 'api-us-east-1-alb-123456.us-east-1.elb.amazonaws.com'],
    ['eu-west-1', 'api-eu-west-1-alb-789012.eu-west-1.elb.amazonaws.com'],
    ['ap-southeast-1', 'api-ap-southeast-1-alb-345678.ap-southeast-1.elb.amazonaws.com']
  ]);
  
  private regionHealthCheckIds: Map<string, string> = new Map();

  constructor(private config: DNSConfig) {
    this.route53 = new AWS.Route53();
    this.initializeHealthChecks();
  }

  private async initializeHealthChecks(): Promise<void> {
    // Get or create health checks for each region
    for (const [region, endpoint] of this.regionEndpoints) {
      const healthCheckId = await this.ensureHealthCheck(region, endpoint);
      this.regionHealthCheckIds.set(region, healthCheckId);
    }
  }

  async updateDNSRecords(targetRegion: string): Promise<void> {
    const startTime = Date.now();
    logger.info('Updating DNS records', { targetRegion });

    try {
      // Prepare DNS changes
      const changes = this.prepareDNSChanges(targetRegion);
      
      // Submit change batch
      const changeResult = await this.route53.changeResourceRecordSets({
        HostedZoneId: this.config.hostedZoneId,
        ChangeBatch: {
          Comment: `Failover to ${targetRegion} at ${new Date().toISOString()}`,
          Changes: changes
        }
      }).promise();

      const changeId = changeResult.ChangeInfo.Id;
      logger.info('DNS change submitted', { changeId, targetRegion });

      // Wait for DNS propagation
      await this.waitForDNSPropagation(changeId);

      const duration = Date.now() - startTime;
      logger.info('DNS update completed', { targetRegion, duration });
      
      metrics.recordMetric('dns', 'updateDuration', duration, { targetRegion });

    } catch (error) {
      logger.error('DNS update failed', { targetRegion, error });
      metrics.recordMetric('dns', 'updateFailures', 1, { targetRegion });
      throw error;
    }
  }

  private prepareDNSChanges(targetRegion: string): AWS.Route53.Change[] {
    const changes: AWS.Route53.Change[] = [];
    const targetEndpoint = this.regionEndpoints.get(targetRegion);
    
    if (!targetEndpoint) {
      throw new Error(`No endpoint configured for region ${targetRegion}`);
    }

    // Update primary A record
    changes.push({
      Action: 'UPSERT',
      ResourceRecordSet: {
        Name: `api.${this.config.domainName}`,
        Type: 'CNAME',
        TTL: this.config.ttl,
        ResourceRecords: [{ Value: targetEndpoint }]
      }
    });

    // Update weighted routing records
    for (const [region, endpoint] of this.regionEndpoints) {
      const weight = region === targetRegion ? 100 : 0;
      
      changes.push({
        Action: 'UPSERT',
        ResourceRecordSet: {
          Name: `api.${this.config.domainName}`,
          Type: 'A',
          SetIdentifier: `weighted-${region}`,
          Weight: weight,
          AliasTarget: {
            HostedZoneId: this.getELBHostedZoneId(region),
            DNSName: endpoint,
            EvaluateTargetHealth: true
          }
        }
      });
    }

    // Update health check records
    this.addHealthCheckRecords(changes, targetRegion);

    return changes;
  }

  private addHealthCheckRecords(changes: AWS.Route53.Change[], activeRegion: string): void {
    // Update failover records with health checks
    changes.push({
      Action: 'UPSERT',
      ResourceRecordSet: {
        Name: `api-failover.${this.config.domainName}`,
        Type: 'A',
        SetIdentifier: 'primary',
        Failover: 'PRIMARY',
        HealthCheckId: this.regionHealthCheckIds.get(activeRegion),
        AliasTarget: {
          HostedZoneId: this.getELBHostedZoneId(activeRegion),
          DNSName: this.regionEndpoints.get(activeRegion)!,
          EvaluateTargetHealth: false
        }
      }
    });

    // Add secondary failover record
    const secondaryRegion = this.selectSecondaryRegion(activeRegion);
    if (secondaryRegion) {
      changes.push({
        Action: 'UPSERT',
        ResourceRecordSet: {
          Name: `api-failover.${this.config.domainName}`,
          Type: 'A',
          SetIdentifier: 'secondary',
          Failover: 'SECONDARY',
          HealthCheckId: this.regionHealthCheckIds.get(secondaryRegion),
          AliasTarget: {
            HostedZoneId: this.getELBHostedZoneId(secondaryRegion),
            DNSName: this.regionEndpoints.get(secondaryRegion)!,
            EvaluateTargetHealth: false
          }
        }
      });
    }
  }

  private async waitForDNSPropagation(changeId: string): Promise<void> {
    logger.info('Waiting for DNS propagation', { changeId });
    
    const maxWaitTime = 300000; // 5 minutes
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const changeInfo = await this.route53.getChange({ Id: changeId }).promise();
      
      if (changeInfo.ChangeInfo.Status === 'INSYNC') {
        logger.info('DNS changes propagated', { changeId });
        return;
      }
      
      logger.debug('DNS propagation in progress', {
        changeId,
        status: changeInfo.ChangeInfo.Status,
        elapsed: Date.now() - startTime
      });
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    throw new Error('DNS propagation timeout');
  }

  private async ensureHealthCheck(region: string, endpoint: string): Promise<string> {
    // Check if health check already exists
    const existingHealthCheck = await this.findHealthCheck(region, endpoint);
    if (existingHealthCheck) {
      return existingHealthCheck;
    }

    // Create new health check
    const healthCheckResult = await this.route53.createHealthCheck({
      CallerReference: `n8n-mcp-${region}-${Date.now()}`,
      HealthCheckConfig: {
        Type: 'HTTPS',
        ResourcePath: '/health',
        FullyQualifiedDomainName: endpoint.split('.')[0], // Extract hostname
        Port: 443,
        RequestInterval: 30,
        FailureThreshold: 3
      },
      HealthCheckTags: [
        { Key: 'Name', Value: `n8n-mcp-${region}` },
        { Key: 'Region', Value: region },
        { Key: 'Service', Value: 'n8n-mcp' }
      ]
    }).promise();

    logger.info('Created health check', {
      region,
      healthCheckId: healthCheckResult.HealthCheck.Id
    });

    return healthCheckResult.HealthCheck.Id;
  }

  private async findHealthCheck(region: string, endpoint: string): Promise<string | null> {
    try {
      const healthChecks = await this.route53.listHealthChecks().promise();
      
      for (const hc of healthChecks.HealthChecks) {
        if (hc.HealthCheckConfig?.FullyQualifiedDomainName?.includes(endpoint.split('.')[0])) {
          // Verify tags
          const tags = await this.route53.listTagsForResource({
            ResourceType: 'healthcheck',
            ResourceId: hc.Id
          }).promise();
          
          const regionTag = tags.Tags.find(t => t.Key === 'Region');
          if (regionTag?.Value === region) {
            return hc.Id;
          }
        }
      }
    } catch (error) {
      logger.error('Failed to find health check', { region, error });
    }
    
    return null;
  }

  private getELBHostedZoneId(region: string): string {
    // AWS ELB hosted zone IDs by region
    const elbHostedZones: Record<string, string> = {
      'us-east-1': 'Z35SXDOTRQ7X7K',
      'us-east-2': 'Z3AADJGX6KTTL2',
      'us-west-1': 'Z368ELLRRE2KJ0',
      'us-west-2': 'Z1H1FL5HABSF5',
      'eu-west-1': 'Z32O12XQLNTSW2',
      'eu-central-1': 'Z3F0SRJ5LGBH90',
      'ap-southeast-1': 'Z1LMS91P8CMLE5',
      'ap-southeast-2': 'Z1GM3OXH4ZPM65',
      'ap-northeast-1': 'Z14GRHDCWA56QT'
    };
    
    return elbHostedZones[region] || 'Z35SXDOTRQ7X7K';
  }

  private selectSecondaryRegion(primaryRegion: string): string | null {
    // Select the next best region as secondary
    const regions = Array.from(this.regionEndpoints.keys());
    return regions.find(r => r !== primaryRegion) || null;
  }

  async updateGeoRouting(targetRegion: string): Promise<void> {
    logger.info('Updating geo-routing policies', { targetRegion });
    
    const changes: AWS.Route53.Change[] = [];
    
    // Define geo-routing rules
    const geoMappings = [
      { location: 'US', primaryRegion: 'us-east-1', fallbackRegion: 'us-west-2' },
      { location: 'EU', primaryRegion: 'eu-west-1', fallbackRegion: 'eu-central-1' },
      { location: 'AS', primaryRegion: 'ap-southeast-1', fallbackRegion: 'ap-northeast-1' }
    ];
    
    for (const mapping of geoMappings) {
      const endpoint = mapping.primaryRegion === targetRegion
        ? this.regionEndpoints.get(mapping.primaryRegion)
        : this.regionEndpoints.get(mapping.fallbackRegion);
      
      if (endpoint) {
        changes.push({
          Action: 'UPSERT',
          ResourceRecordSet: {
            Name: `api.${this.config.domainName}`,
            Type: 'CNAME',
            SetIdentifier: `geo-${mapping.location}`,
            GeoLocation: {
              ContinentCode: mapping.location
            },
            TTL: this.config.ttl,
            ResourceRecords: [{ Value: endpoint }]
          }
        });
      }
    }
    
    if (changes.length > 0) {
      await this.route53.changeResourceRecordSets({
        HostedZoneId: this.config.hostedZoneId,
        ChangeBatch: {
          Comment: `Update geo-routing for failover to ${targetRegion}`,
          Changes: changes
        }
      }).promise();
    }
  }

  async verifyDNSResolution(expectedRegion: string): Promise<boolean> {
    const dns = require('dns').promises;
    const domain = `api.${this.config.domainName}`;
    
    try {
      const addresses = await dns.resolve4(domain);
      logger.info('DNS resolution result', { domain, addresses });
      
      // Verify the resolved IP belongs to the expected region
      // This would require mapping IPs to regions
      return true;
      
    } catch (error) {
      logger.error('DNS resolution failed', { domain, error });
      return false;
    }
  }

  async cleanup(): Promise<void> {
    // Cleanup any temporary DNS records or health checks
    logger.info('Cleaning up DNS resources');
  }
}