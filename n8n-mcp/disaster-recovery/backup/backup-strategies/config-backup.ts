import * as fs from 'fs';
import * as path from 'path';
import { LoggingService } from '../../../src/observability/logging';
import { BackupConfig } from '../backup-orchestrator';

const logger = LoggingService.getInstance();

export class ConfigBackupStrategy {
  private configSources = [
    { type: 'env', path: '.env', sensitive: true },
    { type: 'json', path: 'config/default.json', sensitive: false },
    { type: 'json', path: 'config/production.json', sensitive: false },
    { type: 'json', path: 'config/monitoring.json', sensitive: false },
    { type: 'yaml', path: 'docker-compose.yml', sensitive: false },
    { type: 'yaml', path: 'kubernetes/*.yaml', sensitive: false },
    { type: 'nginx', path: '/etc/nginx/sites-enabled/*', sensitive: false },
    { type: 'systemd', path: '/etc/systemd/system/n8n-mcp*', sensitive: false }
  ];

  constructor(private config: BackupConfig) {}

  async backup(outputPath: string): Promise<void> {
    const startTime = Date.now();
    logger.info('Starting configuration backup', { outputPath });

    try {
      const configs: ConfigBackup = {
        timestamp: new Date().toISOString(),
        version: process.env.VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'production',
        configs: []
      };

      // Collect all configuration files
      for (const source of this.configSources) {
        try {
          const content = await this.readConfig(source);
          if (content) {
            configs.configs.push({
              type: source.type,
              path: source.path,
              content: source.sensitive ? this.sanitizeConfig(content) : content,
              sensitive: source.sensitive,
              checksum: this.calculateChecksum(content)
            });
          }
        } catch (error) {
          logger.warn('Failed to backup config', { source, error });
        }
      }

      // Add runtime configuration
      configs.runtime = await this.collectRuntimeConfig();

      // Add database configuration (schema, migrations state)
      configs.database = await this.collectDatabaseConfig();

      // Write backup file
      await fs.promises.writeFile(
        outputPath,
        JSON.stringify(configs, null, 2)
      );

      const stats = await fs.promises.stat(outputPath);
      const duration = Date.now() - startTime;

      logger.info('Configuration backup completed', {
        outputPath,
        size: stats.size,
        configCount: configs.configs.length,
        duration
      });

    } catch (error) {
      logger.error('Configuration backup failed', { error, outputPath });
      throw error;
    }
  }

  async restore(backupPath: string, targetDir: string): Promise<void> {
    const startTime = Date.now();
    logger.info('Starting configuration restore', { backupPath, targetDir });

    try {
      // Read backup file
      const content = await fs.promises.readFile(backupPath, 'utf-8');
      const backup: ConfigBackup = JSON.parse(content);

      // Validate backup
      this.validateBackup(backup);

      // Create restore report
      const report: RestoreReport = {
        timestamp: new Date().toISOString(),
        backupTimestamp: backup.timestamp,
        restored: [],
        skipped: [],
        failed: []
      };

      // Restore each configuration
      for (const config of backup.configs) {
        try {
          if (config.sensitive) {
            // Skip sensitive configs - they need manual review
            report.skipped.push({
              path: config.path,
              reason: 'Sensitive configuration requires manual review'
            });
            continue;
          }

          await this.restoreConfig(config, targetDir);
          report.restored.push(config.path);

        } catch (error) {
          report.failed.push({
            path: config.path,
            error: error.message
          });
          logger.error('Failed to restore config', { config: config.path, error });
        }
      }

      // Write restore report
      const reportPath = path.join(targetDir, 'config-restore-report.json');
      await fs.promises.writeFile(
        reportPath,
        JSON.stringify(report, null, 2)
      );

      const duration = Date.now() - startTime;
      logger.info('Configuration restore completed', {
        backupPath,
        targetDir,
        restored: report.restored.length,
        skipped: report.skipped.length,
        failed: report.failed.length,
        duration
      });

    } catch (error) {
      logger.error('Configuration restore failed', { error, backupPath });
      throw error;
    }
  }

  private async readConfig(source: ConfigSource): Promise<string | null> {
    try {
      if (source.path.includes('*')) {
        // Handle glob patterns
        const files = await this.findFiles(source.path);
        const contents: Record<string, string> = {};
        
        for (const file of files) {
          contents[file] = await fs.promises.readFile(file, 'utf-8');
        }
        
        return JSON.stringify(contents, null, 2);
      } else {
        return await fs.promises.readFile(source.path, 'utf-8');
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // File doesn't exist
      }
      throw error;
    }
  }

  private sanitizeConfig(content: string): string {
    // Remove sensitive values but keep structure
    const patterns = [
      { regex: /password["']?\s*[:=]\s*["']?[^"'\n,}]+/gi, replacement: 'password=***' },
      { regex: /api_key["']?\s*[:=]\s*["']?[^"'\n,}]+/gi, replacement: 'api_key=***' },
      { regex: /secret["']?\s*[:=]\s*["']?[^"'\n,}]+/gi, replacement: 'secret=***' },
      { regex: /token["']?\s*[:=]\s*["']?[^"'\n,}]+/gi, replacement: 'token=***' },
      { regex: /private_key["']?\s*[:=]\s*["']?[^"'\n,}]+/gi, replacement: 'private_key=***' },
      { regex: /AWS_[A-Z_]+=[^\n]+/g, replacement: (match: string) => {
        const key = match.split('=')[0];
        return `${key}=***`;
      }}
    ];

    let sanitized = content;
    for (const pattern of patterns) {
      sanitized = sanitized.replace(pattern.regex, pattern.replacement as any);
    }

    return sanitized;
  }

  private calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async collectRuntimeConfig(): Promise<RuntimeConfig> {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsage: process.memoryUsage(),
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        VERSION: process.env.VERSION
      },
      loadedModules: Object.keys(require.cache)
    };
  }

  private async collectDatabaseConfig(): Promise<DatabaseConfig> {
    // This would collect database schema and migration state
    // Simplified version
    return {
      migrations: {
        current: '20240115120000',
        pending: []
      },
      schema: {
        version: '1.0.0',
        tables: 42,
        indexes: 128
      }
    };
  }

  private validateBackup(backup: ConfigBackup): void {
    if (!backup.timestamp || !backup.configs) {
      throw new Error('Invalid backup format');
    }

    if (backup.configs.length === 0) {
      throw new Error('Backup contains no configurations');
    }

    // Check version compatibility
    const currentVersion = process.env.VERSION || '1.0.0';
    if (backup.version && !this.isVersionCompatible(backup.version, currentVersion)) {
      logger.warn('Version mismatch in backup', {
        backupVersion: backup.version,
        currentVersion
      });
    }
  }

  private async restoreConfig(config: ConfigItem, targetDir: string): Promise<void> {
    const targetPath = path.join(targetDir, config.path);
    
    // Ensure directory exists
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });

    if (typeof config.content === 'string') {
      await fs.promises.writeFile(targetPath, config.content);
    } else {
      // Handle multiple files (from glob patterns)
      for (const [filePath, content] of Object.entries(config.content)) {
        const fullPath = path.join(targetDir, filePath);
        await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.promises.writeFile(fullPath, content);
      }
    }
  }

  private async findFiles(pattern: string): Promise<string[]> {
    const glob = require('glob');
    return new Promise((resolve, reject) => {
      glob(pattern, (err: Error, files: string[]) => {
        if (err) reject(err);
        else resolve(files);
      });
    });
  }

  private isVersionCompatible(backupVersion: string, currentVersion: string): boolean {
    // Simple major version check
    const backupMajor = parseInt(backupVersion.split('.')[0]);
    const currentMajor = parseInt(currentVersion.split('.')[0]);
    return backupMajor === currentMajor;
  }
}

interface ConfigSource {
  type: string;
  path: string;
  sensitive: boolean;
}

interface ConfigBackup {
  timestamp: string;
  version: string;
  environment: string;
  configs: ConfigItem[];
  runtime?: RuntimeConfig;
  database?: DatabaseConfig;
}

interface ConfigItem {
  type: string;
  path: string;
  content: string | Record<string, string>;
  sensitive: boolean;
  checksum: string;
}

interface RuntimeConfig {
  nodeVersion: string;
  platform: string;
  arch: string;
  memoryUsage: NodeJS.MemoryUsage;
  env: Record<string, string | undefined>;
  loadedModules: string[];
}

interface DatabaseConfig {
  migrations: {
    current: string;
    pending: string[];
  };
  schema: {
    version: string;
    tables: number;
    indexes: number;
  };
}

interface RestoreReport {
  timestamp: string;
  backupTimestamp: string;
  restored: string[];
  skipped: Array<{ path: string; reason: string }>;
  failed: Array<{ path: string; error: string }>;
}