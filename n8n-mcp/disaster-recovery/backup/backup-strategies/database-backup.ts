import { Pool } from 'pg';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import { LoggingService } from '../../../src/observability/logging';
import { MetricsService } from '../../../src/observability/metrics';
import { BackupConfig } from '../backup-orchestrator';

const exec = promisify(execCallback);
const logger = LoggingService.getInstance();
const metrics = MetricsService.getInstance();

export class DatabaseBackupStrategy {
  constructor(
    private dbPool: Pool,
    private config: BackupConfig
  ) {}

  async backup(outputPath: string): Promise<void> {
    const startTime = Date.now();
    logger.info('Starting database backup', { outputPath });

    try {
      // Get database connection info
      const dbConfig = this.dbPool.options;
      
      // Build pg_dump command with optimizations
      const pgDumpCommand = this.buildPgDumpCommand(dbConfig, outputPath);
      
      // Execute backup
      logger.debug('Executing pg_dump', { command: pgDumpCommand.replace(/PGPASSWORD=\S+/, 'PGPASSWORD=***') });
      const { stdout, stderr } = await exec(pgDumpCommand);
      
      if (stderr && !stderr.includes('warning')) {
        throw new Error(`pg_dump error: ${stderr}`);
      }
      
      // Verify backup file was created
      const stats = await fs.promises.stat(outputPath);
      if (stats.size === 0) {
        throw new Error('Backup file is empty');
      }
      
      const duration = Date.now() - startTime;
      logger.info('Database backup completed', {
        outputPath,
        size: stats.size,
        duration
      });
      
      metrics.recordMetric('backup', 'databaseDuration', duration);
      metrics.recordMetric('backup', 'databaseSize', stats.size);
      
    } catch (error) {
      logger.error('Database backup failed', { error, outputPath });
      throw error;
    }
  }

  async restore(backupPath: string, targetDatabase?: string): Promise<void> {
    const startTime = Date.now();
    logger.info('Starting database restore', { backupPath, targetDatabase });

    try {
      const dbConfig = this.dbPool.options;
      const database = targetDatabase || dbConfig.database;
      
      // Build pg_restore command
      const pgRestoreCommand = this.buildPgRestoreCommand(dbConfig, backupPath, database);
      
      // Execute restore
      logger.debug('Executing pg_restore');
      const { stdout, stderr } = await exec(pgRestoreCommand);
      
      if (stderr && !stderr.includes('warning')) {
        throw new Error(`pg_restore error: ${stderr}`);
      }
      
      // Verify restore
      await this.verifyRestore(database);
      
      const duration = Date.now() - startTime;
      logger.info('Database restore completed', {
        backupPath,
        database,
        duration
      });
      
      metrics.recordMetric('backup', 'restoreDuration', duration);
      
    } catch (error) {
      logger.error('Database restore failed', { error, backupPath });
      throw error;
    }
  }

  async performIncrementalBackup(outputPath: string, lastBackupTimestamp: Date): Promise<void> {
    const startTime = Date.now();
    logger.info('Starting incremental database backup', { outputPath, since: lastBackupTimestamp });

    try {
      // Export only changed data since last backup
      const incrementalQuery = `
        COPY (
          SELECT tablename, 'INSERT' as operation, row_to_json(t.*) as data
          FROM (
            SELECT * FROM information_schema.tables 
            WHERE table_schema = 'public'
          ) tables,
          LATERAL (
            SELECT * FROM %I 
            WHERE updated_at > $1
          ) t
        ) TO STDOUT WITH (FORMAT CSV, HEADER true);
      `;
      
      // This is a simplified example - real implementation would be more complex
      const client = await this.dbPool.connect();
      try {
        const stream = client.query(incrementalQuery, [lastBackupTimestamp]);
        const writeStream = fs.createWriteStream(outputPath);
        
        await new Promise((resolve, reject) => {
          stream.pipe(writeStream)
            .on('finish', resolve)
            .on('error', reject);
        });
        
      } finally {
        client.release();
      }
      
      const duration = Date.now() - startTime;
      const stats = await fs.promises.stat(outputPath);
      
      logger.info('Incremental backup completed', {
        outputPath,
        size: stats.size,
        duration
      });
      
    } catch (error) {
      logger.error('Incremental backup failed', { error });
      throw error;
    }
  }

  private buildPgDumpCommand(dbConfig: any, outputPath: string): string {
    const env = [
      `PGPASSWORD='${dbConfig.password}'`
    ];
    
    const args = [
      'pg_dump',
      `-h ${dbConfig.host || 'localhost'}`,
      `-p ${dbConfig.port || 5432}`,
      `-U ${dbConfig.user}`,
      `-d ${dbConfig.database}`,
      '-Fc', // Custom format for flexibility
      '-j 4', // Use 4 parallel jobs
      '--no-owner',
      '--no-privileges',
      '--if-exists',
      '--clean',
      '--no-comments',
      '--exclude-table-data=audit_logs*', // Exclude large audit tables
      '--exclude-table-data=temp_*', // Exclude temporary tables
      `-f ${outputPath}`
    ];
    
    // Add compression level based on config
    if (this.config.compressionLevel > 0) {
      args.push(`-Z ${this.config.compressionLevel}`);
    }
    
    return `${env.join(' ')} ${args.join(' ')}`;
  }

  private buildPgRestoreCommand(dbConfig: any, backupPath: string, database: string): string {
    const env = [
      `PGPASSWORD='${dbConfig.password}'`
    ];
    
    const args = [
      'pg_restore',
      `-h ${dbConfig.host || 'localhost'}`,
      `-p ${dbConfig.port || 5432}`,
      `-U ${dbConfig.user}`,
      `-d ${database}`,
      '-j 4', // Use 4 parallel jobs
      '--no-owner',
      '--no-privileges',
      '--if-exists',
      '--clean',
      '--disable-triggers', // Disable triggers during restore
      backupPath
    ];
    
    return `${env.join(' ')} ${args.join(' ')}`;
  }

  private async verifyRestore(database: string): Promise<void> {
    const client = await this.dbPool.connect();
    
    try {
      // Check table count
      const tableCountResult = await client.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      `);
      
      const tableCount = parseInt(tableCountResult.rows[0].count);
      if (tableCount === 0) {
        throw new Error('No tables found after restore');
      }
      
      // Check critical tables exist
      const criticalTables = ['users', 'workspaces', 'workflows', 'credentials'];
      for (const table of criticalTables) {
        const exists = await client.query(
          `SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          )`,
          [table]
        );
        
        if (!exists.rows[0].exists) {
          throw new Error(`Critical table missing: ${table}`);
        }
      }
      
      logger.info('Database restore verification passed', {
        database,
        tableCount
      });
      
    } finally {
      client.release();
    }
  }

  async getBackupSize(database: string): Promise<number> {
    const result = await this.dbPool.query(`
      SELECT pg_database_size($1) as size
    `, [database]);
    
    return parseInt(result.rows[0].size);
  }

  async performPointInTimeRecovery(targetTime: Date, outputPath: string): Promise<void> {
    logger.info('Starting point-in-time recovery', { targetTime });
    
    // This would require WAL archiving to be set up
    // Implementation would restore from base backup + apply WAL files up to target time
    
    throw new Error('Point-in-time recovery not implemented yet');
  }
}