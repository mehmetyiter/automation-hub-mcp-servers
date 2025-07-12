import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { LoggingService } from '../../../src/observability/logging';
import { BackupConfig } from '../backup-orchestrator';

const exec = promisify(execCallback);
const logger = LoggingService.getInstance();

export class FileBackupStrategy {
  private includePatterns = [
    'uploads/**/*',
    'workflows/**/*.json',
    'credentials/**/*.enc',
    'certificates/**/*',
    'custom-nodes/**/*',
    'static/**/*'
  ];
  
  private excludePatterns = [
    '*.log',
    '*.tmp',
    '.git/**',
    'node_modules/**',
    'dist/**',
    'coverage/**',
    '.env*'
  ];

  constructor(private config: BackupConfig) {}

  async backup(outputPath: string): Promise<void> {
    const startTime = Date.now();
    logger.info('Starting file backup', { outputPath });

    try {
      // Build tar command with includes and excludes
      const tarCommand = this.buildTarCommand(outputPath);
      
      // Execute tar
      logger.debug('Creating file archive');
      const { stdout, stderr } = await exec(tarCommand);
      
      if (stderr && !stderr.includes('Removing leading')) {
        logger.warn('Tar warnings', { stderr });
      }
      
      // Verify archive
      const stats = await fs.promises.stat(outputPath);
      if (stats.size === 0) {
        throw new Error('Archive file is empty');
      }
      
      const duration = Date.now() - startTime;
      logger.info('File backup completed', {
        outputPath,
        size: stats.size,
        duration
      });
      
    } catch (error) {
      logger.error('File backup failed', { error, outputPath });
      throw error;
    }
  }

  async restore(backupPath: string, targetDir: string): Promise<void> {
    const startTime = Date.now();
    logger.info('Starting file restore', { backupPath, targetDir });

    try {
      // Ensure target directory exists
      await fs.promises.mkdir(targetDir, { recursive: true });
      
      // Extract archive
      const extractCommand = `tar -xf ${backupPath} -C ${targetDir}`;
      logger.debug('Extracting file archive');
      const { stdout, stderr } = await exec(extractCommand);
      
      if (stderr) {
        logger.warn('Tar extraction warnings', { stderr });
      }
      
      // Set proper permissions
      await this.restorePermissions(targetDir);
      
      // Verify restore
      await this.verifyRestore(targetDir);
      
      const duration = Date.now() - startTime;
      logger.info('File restore completed', {
        backupPath,
        targetDir,
        duration
      });
      
    } catch (error) {
      logger.error('File restore failed', { error, backupPath });
      throw error;
    }
  }

  async performIncrementalBackup(outputPath: string, lastBackupDate: Date): Promise<void> {
    const startTime = Date.now();
    logger.info('Starting incremental file backup', { outputPath, since: lastBackupDate });

    try {
      // Find files modified since last backup
      const modifiedFiles = await this.findModifiedFiles(lastBackupDate);
      
      if (modifiedFiles.length === 0) {
        logger.info('No files modified since last backup');
        // Create empty archive
        await fs.promises.writeFile(outputPath, '');
        return;
      }
      
      // Create file list
      const fileListPath = `/tmp/backup-files-${Date.now()}.txt`;
      await fs.promises.writeFile(fileListPath, modifiedFiles.join('\n'));
      
      // Create incremental archive
      const tarCommand = `tar -cf ${outputPath} -T ${fileListPath}`;
      await exec(tarCommand);
      
      // Cleanup
      await fs.promises.unlink(fileListPath);
      
      const stats = await fs.promises.stat(outputPath);
      const duration = Date.now() - startTime;
      
      logger.info('Incremental file backup completed', {
        outputPath,
        size: stats.size,
        fileCount: modifiedFiles.length,
        duration
      });
      
    } catch (error) {
      logger.error('Incremental file backup failed', { error });
      throw error;
    }
  }

  private buildTarCommand(outputPath: string): string {
    const args = ['tar', '-cf', outputPath];
    
    // Add compression if not handled separately
    if (this.config.type === 'full' && this.config.compressionLevel > 0) {
      args[1] = '-czf'; // Use gzip compression
    }
    
    // Add exclude patterns
    for (const pattern of this.excludePatterns) {
      args.push(`--exclude='${pattern}'`);
    }
    
    // Add include patterns
    args.push(...this.includePatterns);
    
    return args.join(' ');
  }

  private async findModifiedFiles(since: Date): Promise<string[]> {
    const modifiedFiles: string[] = [];
    
    for (const pattern of this.includePatterns) {
      const baseDir = pattern.split('/')[0];
      const files = await this.walkDirectory(baseDir);
      
      for (const file of files) {
        const stats = await fs.promises.stat(file);
        if (stats.mtime > since) {
          modifiedFiles.push(file);
        }
      }
    }
    
    return modifiedFiles;
  }

  private async walkDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip excluded directories
          if (this.shouldExclude(fullPath)) {
            continue;
          }
          files.push(...await this.walkDirectory(fullPath));
        } else {
          // Skip excluded files
          if (!this.shouldExclude(fullPath)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Directory might not exist
      logger.debug('Directory not found', { dir, error });
    }
    
    return files;
  }

  private shouldExclude(filePath: string): boolean {
    for (const pattern of this.excludePatterns) {
      // Simple glob matching (real implementation would use a glob library)
      const regex = pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.');
      
      if (new RegExp(regex).test(filePath)) {
        return true;
      }
    }
    return false;
  }

  private async restorePermissions(targetDir: string): Promise<void> {
    // Set appropriate permissions for different file types
    const permissions = [
      { pattern: 'credentials/**/*.enc', mode: '0600' },
      { pattern: 'certificates/**/*', mode: '0644' },
      { pattern: 'workflows/**/*.json', mode: '0644' },
      { pattern: 'uploads/**/*', mode: '0644' }
    ];
    
    for (const perm of permissions) {
      try {
        await exec(`find ${targetDir} -path '${perm.pattern}' -exec chmod ${perm.mode} {} \\;`);
      } catch (error) {
        logger.warn('Failed to set permissions', { pattern: perm.pattern, error });
      }
    }
  }

  private async verifyRestore(targetDir: string): Promise<void> {
    // Check critical directories exist
    const criticalDirs = ['workflows', 'credentials', 'uploads'];
    
    for (const dir of criticalDirs) {
      const fullPath = path.join(targetDir, dir);
      try {
        await fs.promises.access(fullPath, fs.constants.R_OK);
      } catch (error) {
        logger.warn('Critical directory missing after restore', { dir: fullPath });
      }
    }
    
    logger.info('File restore verification completed', { targetDir });
  }

  async calculateBackupSize(): Promise<number> {
    let totalSize = 0;
    
    for (const pattern of this.includePatterns) {
      const baseDir = pattern.split('/')[0];
      const files = await this.walkDirectory(baseDir);
      
      for (const file of files) {
        try {
          const stats = await fs.promises.stat(file);
          totalSize += stats.size;
        } catch (error) {
          // File might have been deleted
        }
      }
    }
    
    return totalSize;
  }
}