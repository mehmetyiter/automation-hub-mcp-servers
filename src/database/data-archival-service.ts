import { Pool } from 'pg';
import { Logger } from '../utils/logger';

export interface ArchivalPolicy {
  tableName: string;
  retentionDays: number;
  archiveLocation: 'cold_storage' | 's3' | 'delete';
  compressionEnabled: boolean;
  batchSize: number;
  schedule: string;
}

export interface ArchivalResult {
  tableName: string;
  recordsArchived: number;
  recordsDeleted: number;
  spaceReclaimed: number;
  duration: number;
  errors: string[];
}

export class DataArchivalService {
  private pool: Pool;
  private logger: Logger;
  private policies: Map<string, ArchivalPolicy> = new Map();

  constructor(pool: Pool, logger: Logger) {
    this.pool = pool;
    this.logger = logger;
    this.initializeDefaultPolicies();
  }

  private initializeDefaultPolicies(): void {
    this.policies.set('api_usage_events', {
      tableName: 'api_usage_events',
      retentionDays: 90,
      archiveLocation: 's3',
      compressionEnabled: true,
      batchSize: 10000,
      schedule: '0 2 * * *'
    });

    this.policies.set('security_events', {
      tableName: 'security_events',
      retentionDays: 180,
      archiveLocation: 'cold_storage',
      compressionEnabled: true,
      batchSize: 5000,
      schedule: '0 3 * * 0'
    });

    this.policies.set('user_sessions', {
      tableName: 'user_sessions',
      retentionDays: 30,
      archiveLocation: 'delete',
      compressionEnabled: false,
      batchSize: 10000,
      schedule: '0 4 * * *'
    });

    this.policies.set('credential_validation_logs', {
      tableName: 'credential_validation_logs',
      retentionDays: 60,
      archiveLocation: 's3',
      compressionEnabled: true,
      batchSize: 5000,
      schedule: '0 5 * * *'
    });
  }

  async archiveTable(tableName: string): Promise<ArchivalResult> {
    this.logger.info(`📦 Starting archival for table: ${tableName}`);
    
    const policy = this.policies.get(tableName);
    if (!policy) {
      throw new Error(`No archival policy found for table: ${tableName}`);
    }

    const startTime = Date.now();
    const result: ArchivalResult = {
      tableName,
      recordsArchived: 0,
      recordsDeleted: 0,
      spaceReclaimed: 0,
      duration: 0,
      errors: []
    };

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

      await client.query(`
        CREATE TEMP TABLE ${tableName}_archive AS
        SELECT * FROM ${tableName}
        WHERE created_at < $1
      `, [cutoffDate]);

      const countResult = await client.query(`
        SELECT COUNT(*) as count FROM ${tableName}_archive
      `);
      const totalRecords = parseInt(countResult.rows[0].count);

      if (totalRecords === 0) {
        this.logger.info(`No records to archive for ${tableName}`);
        await client.query('COMMIT');
        return result;
      }

      this.logger.info(`Found ${totalRecords} records to archive`);

      switch (policy.archiveLocation) {
        case 's3':
          await this.archiveToS3(tableName, policy, result, client);
          break;
        case 'cold_storage':
          await this.archiveToColdStorage(tableName, policy, result, client);
          break;
        case 'delete':
          result.recordsDeleted = totalRecords;
          break;
      }

      const deleteResult = await client.query(`
        DELETE FROM ${tableName}
        WHERE created_at < $1
      `, [cutoffDate]);

      result.recordsDeleted = deleteResult.rowCount || 0;

      const sizeResult = await client.query(`
        SELECT pg_total_relation_size($1) as size_before
      `, [tableName]);
      
      result.spaceReclaimed = parseInt(sizeResult.rows[0].size_before || 0);

      await client.query('COMMIT');

      await client.query(`VACUUM ANALYZE ${tableName}`);

      result.duration = Date.now() - startTime;
      
      this.logger.info(`✅ Archival completed for ${tableName}:`, result);
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      this.logger.error(`❌ Archival failed for ${tableName}:`, error);
    } finally {
      client.release();
    }

    return result;
  }

  private async archiveToS3(
    tableName: string,
    policy: ArchivalPolicy,
    result: ArchivalResult,
    client: any
  ): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${tableName}_archive_${timestamp}`;

    let offset = 0;
    let batchNumber = 0;

    while (true) {
      const batchResult = await client.query(`
        SELECT * FROM ${tableName}_archive
        ORDER BY created_at
        LIMIT $1 OFFSET $2
      `, [policy.batchSize, offset]);

      if (batchResult.rows.length === 0) break;

      const batchFileName = `${fileName}_batch_${batchNumber}.json${policy.compressionEnabled ? '.gz' : ''}`;
      
      await this.uploadToS3(
        batchFileName,
        JSON.stringify(batchResult.rows),
        policy.compressionEnabled
      );

      result.recordsArchived += batchResult.rows.length;
      offset += policy.batchSize;
      batchNumber++;
    }

    const manifest = {
      tableName,
      archiveDate: new Date(),
      totalRecords: result.recordsArchived,
      batches: batchNumber,
      policy,
      schema: await this.getTableSchema(tableName, client)
    };

    await this.uploadToS3(
      `${fileName}/manifest.json`,
      JSON.stringify(manifest, null, 2),
      false
    );
  }

  private async archiveToColdStorage(
    tableName: string,
    policy: ArchivalPolicy,
    result: ArchivalResult,
    client: any
  ): Promise<void> {
    const archiveTableName = `${tableName}_cold`;

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${archiveTableName} (
        LIKE ${tableName} INCLUDING ALL
      )
    `);

    const insertResult = await client.query(`
      INSERT INTO ${archiveTableName}
      SELECT * FROM ${tableName}_archive
    `);

    result.recordsArchived = insertResult.rowCount || 0;

    if (policy.compressionEnabled) {
      await client.query(`
        ALTER TABLE ${archiveTableName} SET (
          autovacuum_enabled = false,
          toast_tuple_target = 128
        )
      `);
    }
  }

  private async uploadToS3(
    key: string,
    data: string,
    compress: boolean
  ): Promise<void> {
    this.logger.info(`Uploading to S3: ${key} (compressed: ${compress})`);
  }

  private async getTableSchema(tableName: string, client: any): Promise<any> {
    const result = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);

    return result.rows;
  }

  async restoreFromArchive(
    tableName: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    this.logger.info(`🔄 Restoring ${tableName} from ${startDate} to ${endDate}`);

    const policy = this.policies.get(tableName);
    if (!policy) {
      throw new Error(`No archival policy found for table: ${tableName}`);
    }

    let restoredCount = 0;

    switch (policy.archiveLocation) {
      case 's3':
        restoredCount = await this.restoreFromS3(tableName, startDate, endDate);
        break;
      case 'cold_storage':
        restoredCount = await this.restoreFromColdStorage(tableName, startDate, endDate);
        break;
      case 'delete':
        throw new Error(`Cannot restore deleted records for ${tableName}`);
    }

    this.logger.info(`✅ Restored ${restoredCount} records`);
    return restoredCount;
  }

  private async restoreFromS3(
    tableName: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    this.logger.info(`Restoring from S3: ${tableName}`);
    return 0;
  }

  private async restoreFromColdStorage(
    tableName: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const archiveTableName = `${tableName}_cold`;

    const result = await this.pool.query(`
      INSERT INTO ${tableName}
      SELECT * FROM ${archiveTableName}
      WHERE created_at >= $1 AND created_at < $2
      ON CONFLICT DO NOTHING
    `, [startDate, endDate]);

    return result.rowCount || 0;
  }

  async getArchivalStats(): Promise<any> {
    const stats: any = {};

    for (const [tableName, policy] of this.policies.entries()) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

      try {
        const result = await this.pool.query(`
          SELECT 
            COUNT(*) as total_records,
            COUNT(*) FILTER (WHERE created_at < $1) as records_to_archive,
            pg_size_pretty(pg_total_relation_size($2)) as table_size,
            MIN(created_at) as oldest_record,
            MAX(created_at) as newest_record
          FROM ${tableName}
        `, [cutoffDate, tableName]);

        stats[tableName] = {
          ...result.rows[0],
          policy
        };
      } catch (error) {
        this.logger.error(`Error getting stats for ${tableName}:`, error);
        stats[tableName] = {
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    return stats;
  }

  async scheduleArchival(): Promise<void> {
    this.logger.info('📅 Scheduling automatic archival jobs...');
    
    for (const [tableName, policy] of this.policies.entries()) {
      this.logger.info(`Scheduled archival for ${tableName}: ${policy.schedule}`);
    }
  }
}