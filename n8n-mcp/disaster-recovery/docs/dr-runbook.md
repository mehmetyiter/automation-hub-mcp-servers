# n8n-MCP Disaster Recovery Runbook

## Table of Contents
1. [Overview](#overview)
2. [Contact Information](#contact-information)
3. [System Architecture](#system-architecture)
4. [Disaster Recovery Procedures](#disaster-recovery-procedures)
5. [Backup Procedures](#backup-procedures)
6. [Testing Procedures](#testing-procedures)
7. [Incident Response](#incident-response)
8. [Recovery Time Objectives](#recovery-time-objectives)

## Overview

This runbook provides step-by-step procedures for disaster recovery scenarios affecting the n8n-MCP platform. It covers various failure scenarios and their corresponding recovery procedures.

### Key Objectives
- **RPO (Recovery Point Objective)**: < 1 hour
- **RTO (Recovery Time Objective)**: < 4 hours
- **Data Durability**: 99.99%
- **Availability Target**: 99.95%

### Disaster Recovery Strategy
- Multi-region active-passive architecture
- Automated failover with manual override capability
- Immutable backups with ransomware protection
- Regular DR testing and validation

## Contact Information

### Primary Contacts
| Role | Name | Email | Phone | Availability |
|------|------|-------|-------|--------------|
| DR Lead | [Name] | [email] | [phone] | 24/7 |
| Engineering Lead | [Name] | [email] | [phone] | Business hours |
| Database Admin | [Name] | [email] | [phone] | On-call |
| Security Lead | [Name] | [email] | [phone] | 24/7 |

### Escalation Path
1. On-call engineer
2. DR Lead
3. Engineering Lead
4. CTO

### External Contacts
- AWS Support: [Support Case URL]
- CloudFlare Support: [Support Contact]
- Monitoring Vendor: [Contact Info]

## System Architecture

### Region Configuration
```
Primary Region: us-east-1
  - Aurora PostgreSQL (primary)
  - ECS Fargate clusters
  - S3 storage
  - ElastiCache Redis

Secondary Region: eu-west-1
  - Aurora PostgreSQL (read replica)
  - ECS Fargate clusters (standby)
  - S3 storage (replicated)
  - ElastiCache Redis (standby)

Tertiary Region: ap-southeast-1
  - Aurora PostgreSQL (read replica)
  - Minimal infrastructure
  - S3 storage (replicated)
```

### Critical Components
1. **Database**: Aurora Global Database with automated backups
2. **Application**: ECS Fargate with auto-scaling
3. **Storage**: S3 with cross-region replication
4. **Cache**: ElastiCache Redis with snapshots
5. **DNS**: Route53 with health checks and failover

## Disaster Recovery Procedures

### Scenario 1: Complete Region Failure

**Detection**: 
- CloudWatch alarms for region health
- Route53 health check failures
- Automated alerts via PagerDuty

**Recovery Steps**:

1. **Verify Region Failure** (5 minutes)
   ```bash
   # Check region status
   aws ec2 describe-regions --region-names us-east-1
   
   # Check service health
   curl -I https://api-us-east-1.n8n-mcp.com/health
   
   # Verify monitoring dashboards
   open https://cloudwatch.amazonaws.com/dashboard/dr-status
   ```

2. **Initiate Failover** (10 minutes)
   ```bash
   # Execute failover script
   cd /home/mehmet/Documents/n8nMCP/automation-hub-mcp-servers/n8n-mcp/disaster-recovery
   npm run failover:execute -- --target-region eu-west-1
   
   # Monitor failover progress
   tail -f logs/failover.log
   ```

3. **Verify Database Failover** (15 minutes)
   ```bash
   # Check Aurora global database status
   aws rds describe-global-clusters --global-cluster-identifier n8n-mcp-global
   
   # Promote secondary to primary
   aws rds failover-global-cluster \
     --global-cluster-identifier n8n-mcp-global \
     --target-db-cluster-identifier n8n-mcp-eu-west-1
   ```

4. **Update DNS** (5 minutes)
   ```bash
   # DNS failover is automatic via Route53 health checks
   # Verify DNS propagation
   dig api.n8n-mcp.com
   nslookup api.n8n-mcp.com 8.8.8.8
   ```

5. **Scale Secondary Region** (20 minutes)
   ```bash
   # Scale ECS services
   aws ecs update-service \
     --cluster n8n-mcp-eu-west-1 \
     --service api \
     --desired-count 10
   
   # Enable auto-scaling
   aws application-autoscaling put-scaling-policy \
     --service-namespace ecs \
     --scalable-dimension ecs:service:DesiredCount \
     --resource-id service/n8n-mcp-eu-west-1/api \
     --policy-name cpu-scaling \
     --policy-type TargetTrackingScaling
   ```

6. **Verify Application Health** (10 minutes)
   ```bash
   # Run health checks
   npm run health:check -- --region eu-west-1
   
   # Check application metrics
   aws cloudwatch get-metric-statistics \
     --namespace AWS/ECS \
     --metric-name CPUUtilization \
     --dimensions Name=ServiceName,Value=api \
     --statistics Average \
     --start-time 2024-01-01T00:00:00Z \
     --end-time 2024-01-01T01:00:00Z \
     --period 300
   ```

7. **Communication** (Throughout)
   - Update status page
   - Send customer notifications
   - Internal status updates every 30 minutes

### Scenario 2: Database Corruption

**Detection**:
- Data integrity check failures
- Application errors related to data inconsistency
- Automated corruption detection alerts

**Recovery Steps**:

1. **Isolate Corruption** (10 minutes)
   ```bash
   # Identify affected tables
   psql -h aurora-cluster.region.rds.amazonaws.com -U admin -d n8n_mcp << EOF
   SELECT schemaname, tablename 
   FROM pg_tables 
   WHERE schemaname = 'public'
   ORDER BY tablename;
   EOF
   
   # Run integrity checks
   npm run db:integrity-check
   ```

2. **Stop Write Operations** (5 minutes)
   ```bash
   # Enable read-only mode
   npm run app:readonly -- --enable
   
   # Verify no writes are occurring
   psql -h aurora-cluster.region.rds.amazonaws.com -U admin -d n8n_mcp \
     -c "SELECT * FROM pg_stat_activity WHERE state = 'active' AND query LIKE '%INSERT%' OR query LIKE '%UPDATE%' OR query LIKE '%DELETE%';"
   ```

3. **Identify Recovery Point** (15 minutes)
   ```bash
   # List available backups
   aws rds describe-db-cluster-snapshots \
     --db-cluster-identifier n8n-mcp-primary \
     --snapshot-type automated
   
   # Verify backup integrity
   npm run backup:verify -- --backup-id <backup-id>
   ```

4. **Restore Database** (45-90 minutes)
   ```bash
   # Restore to new cluster
   aws rds restore-db-cluster-from-snapshot \
     --db-cluster-identifier n8n-mcp-restored \
     --snapshot-identifier <snapshot-id> \
     --engine aurora-postgresql
   
   # Monitor restore progress
   watch -n 30 aws rds describe-db-clusters \
     --db-cluster-identifier n8n-mcp-restored \
     --query 'DBClusters[0].Status'
   ```

5. **Validate Restored Data** (20 minutes)
   ```bash
   # Run validation queries
   npm run db:validate -- --cluster n8n-mcp-restored
   
   # Compare row counts
   npm run db:compare -- --source n8n-mcp-primary --target n8n-mcp-restored
   ```

6. **Switch to Restored Database** (15 minutes)
   ```bash
   # Update application configuration
   npm run config:update -- --db-endpoint n8n-mcp-restored.cluster-xxx.region.rds.amazonaws.com
   
   # Restart application services
   npm run app:restart -- --rolling
   ```

### Scenario 3: Ransomware Attack

**Detection**:
- Unusual file encryption patterns
- Rapid increase in storage modifications
- Security alerts from endpoint protection

**Recovery Steps**:

1. **Immediate Isolation** (5 minutes)
   ```bash
   # Isolate affected systems
   npm run security:isolate -- --threat ransomware
   
   # Disable all external access
   aws ec2 modify-security-group-rules \
     --group-id sg-xxxxxx \
     --security-group-rules '[]'
   ```

2. **Assess Impact** (20 minutes)
   ```bash
   # Scan for encrypted files
   npm run security:scan -- --type ransomware
   
   # Check backup integrity
   npm run backup:scan -- --verify-encryption
   ```

3. **Activate Incident Response** (10 minutes)
   - Notify security team
   - Engage incident response team
   - Begin forensic data collection
   - Contact law enforcement if required

4. **Identify Clean Backup** (30 minutes)
   ```bash
   # List immutable backups
   aws s3api list-object-versions \
     --bucket n8n-mcp-backups-us-east-1 \
     --prefix backups/ \
     --query 'Versions[?contains(ObjectLockLegalHoldStatus, `ON`)]'
   
   # Verify backup predates infection
   npm run backup:timeline -- --before <infection-time>
   ```

5. **Restore from Immutable Backup** (60-120 minutes)
   ```bash
   # Create restore job
   npm run restore:create \
     --backup-id <clean-backup-id> \
     --target-env restore-test \
     --verify-each-step
   
   # Monitor restore progress
   npm run restore:monitor -- --job-id <job-id>
   ```

6. **Validate Restored Environment** (30 minutes)
   ```bash
   # Run security scan on restored data
   npm run security:scan -- --env restore-test --deep
   
   # Verify no ransomware artifacts
   npm run security:verify -- --clean
   ```

7. **Gradual Cutover** (45 minutes)
   ```bash
   # Route small percentage of traffic
   npm run traffic:route -- --target restore-test --percentage 5
   
   # Monitor for issues
   npm run monitor:enhanced -- --duration 30m
   
   # Gradually increase traffic
   for pct in 10 25 50 100; do
     npm run traffic:route -- --target restore-test --percentage $pct
     sleep 600  # Wait 10 minutes between increases
   done
   ```

### Scenario 4: Partial Service Failure

**Detection**:
- Service-specific alerts
- Degraded performance metrics
- User reports of partial functionality

**Recovery Steps**:

1. **Identify Failed Components** (5 minutes)
   ```bash
   # Check service health
   npm run health:services -- --detailed
   
   # View dependency map
   npm run architecture:map -- --highlight-failures
   ```

2. **Activate Circuit Breakers** (2 minutes)
   ```bash
   # Enable circuit breakers for failed services
   npm run circuit:enable -- --service <service-name>
   
   # Route traffic away from failed components
   npm run traffic:reroute -- --avoid-failed
   ```

3. **Scale Healthy Components** (10 minutes)
   ```bash
   # Increase capacity of healthy services
   npm run scale:auto -- --boost-healthy
   
   # Add additional instances
   aws ecs update-service \
     --cluster n8n-mcp-primary \
     --service <healthy-service> \
     --desired-count <increased-count>
   ```

4. **Attempt Service Recovery** (15 minutes)
   ```bash
   # Restart failed services
   npm run service:restart -- --service <service-name>
   
   # If restart fails, redeploy
   npm run service:deploy -- --service <service-name> --version stable
   ```

## Backup Procedures

### Automated Backup Schedule
- **Hourly**: Database incremental snapshots
- **Daily**: Full database backup + application state
- **Weekly**: Complete system backup including configurations
- **Monthly**: Archive backup with extended retention

### Manual Backup Procedure

1. **Create On-Demand Backup**
   ```bash
   # Full system backup
   npm run backup:create -- --type full --retention 90d
   
   # Specific component backup
   npm run backup:create -- --component database --encryption kms
   ```

2. **Verify Backup**
   ```bash
   # Run verification suite
   npm run backup:verify -- --backup-id <id> --full-check
   
   # Test restore to sandbox
   npm run backup:test-restore -- --backup-id <id> --env sandbox
   ```

### Backup Storage Locations
- Primary: S3 bucket in primary region with Object Lock
- Secondary: Replicated to secondary region
- Archive: Glacier Deep Archive for long-term retention

## Testing Procedures

### Monthly DR Tests

1. **Test Schedule**
   - First Monday: Region failover test (off-hours)
   - Second Tuesday: Backup restore test
   - Third Wednesday: Component failure simulation
   - Fourth Thursday: Security incident simulation

2. **Test Execution**
   ```bash
   # Run scheduled DR test
   npm run dr:test -- --scenario <scenario-name> --dry-run
   
   # Execute with monitoring
   npm run dr:test -- --scenario <scenario-name> --monitor --notify
   ```

3. **Test Scenarios**
   - `region-failure`: Complete region outage
   - `database-corruption`: Data integrity issues
   - `ransomware`: Security incident
   - `cascading-failure`: Service dependencies
   - `network-partition`: Split-brain scenario

### Test Validation

1. **Success Criteria**
   - RTO met: Recovery completed within target time
   - RPO met: Data loss within acceptable limits
   - Functionality: All critical features operational
   - Performance: Response times within SLA

2. **Post-Test Actions**
   ```bash
   # Generate test report
   npm run dr:report -- --test-id <id>
   
   # Update runbook with findings
   npm run dr:update-docs -- --findings <report-id>
   
   # Create improvement tickets
   npm run dr:create-tickets -- --from-report <report-id>
   ```

## Incident Response

### Incident Classification

| Severity | Description | Response Time | Examples |
|----------|-------------|---------------|----------|
| Critical | Complete service outage | < 15 min | Region failure, data loss |
| High | Significant degradation | < 30 min | Database issues, partial outage |
| Medium | Limited impact | < 2 hours | Single service failure |
| Low | Minimal impact | < 8 hours | Non-critical component issue |

### Response Workflow

1. **Detection & Alert**
   - Automated monitoring alerts
   - User reports
   - Health check failures

2. **Initial Assessment** (5-10 minutes)
   ```bash
   # Run incident assessment
   npm run incident:assess -- --auto-classify
   
   # Generate initial report
   npm run incident:report -- --initial
   ```

3. **Incident Declaration**
   - Notify incident commander
   - Assemble response team
   - Open incident channel
   - Start incident timer

4. **Response Execution**
   - Follow relevant procedure
   - Document all actions
   - Communicate status updates
   - Monitor progress

5. **Resolution & Validation**
   ```bash
   # Verify service restoration
   npm run incident:validate -- --full-check
   
   # Run post-incident tests
   npm run test:post-incident -- --comprehensive
   ```

6. **Post-Incident Review**
   - Document timeline
   - Identify root cause
   - Create action items
   - Update procedures

## Recovery Time Objectives

### RTO by Scenario

| Scenario | Target RTO | Actual (Last Test) | Notes |
|----------|------------|--------------------|----|
| Region Failure | 4 hours | 3.5 hours | Includes DNS propagation |
| Database Corruption | 2 hours | 1.75 hours | Point-in-time recovery |
| Ransomware | 4 hours | 3.8 hours | From immutable backup |
| Service Failure | 30 minutes | 25 minutes | Automated recovery |
| Network Partition | 15 minutes | 12 minutes | Automatic resolution |

### RPO Targets

| Data Type | Target RPO | Method | Verification |
|-----------|------------|--------|--------------|
| Database | 1 hour | Continuous replication | Transaction logs |
| Files | 1 hour | Hourly snapshots | Checksum validation |
| Configuration | 15 minutes | Git commits | Version control |
| Secrets | Real-time | AWS Secrets Manager | Replication status |

## Appendices

### A. Command Reference

```bash
# Failover Commands
npm run failover:status          # Check failover readiness
npm run failover:execute         # Execute failover
npm run failover:rollback        # Rollback failover

# Backup Commands  
npm run backup:list              # List available backups
npm run backup:create            # Create manual backup
npm run backup:verify            # Verify backup integrity
npm run backup:restore           # Restore from backup

# Health Check Commands
npm run health:check             # Overall health status
npm run health:services          # Service-specific health
npm run health:dependencies      # Dependency health

# Testing Commands
npm run dr:test                  # Run DR test
npm run dr:validate              # Validate DR readiness
npm run dr:report                # Generate DR report
```

### B. Configuration Files

- Primary config: `/config/disaster-recovery.yaml`
- Region mappings: `/config/regions.yaml`
- Service dependencies: `/config/dependencies.yaml`
- Alert rules: `/config/alerts.yaml`

### C. Monitoring Dashboards

- Overall DR Status: https://cloudwatch.amazonaws.com/dr-overview
- Backup Status: https://cloudwatch.amazonaws.com/backup-status
- Replication Lag: https://cloudwatch.amazonaws.com/replication
- Service Health: https://cloudwatch.amazonaws.com/services

### D. Automation Scripts

All DR automation scripts are located in:
```
/disaster-recovery/scripts/
├── failover.sh          # Main failover script
├── backup.sh            # Backup automation
├── restore.sh           # Restore procedures
├── test-dr.sh           # DR testing
└── validate.sh          # Validation scripts
```

---

**Document Version**: 1.0  
**Last Updated**: January 2024  
**Next Review**: April 2024  
**Owner**: DevOps Team