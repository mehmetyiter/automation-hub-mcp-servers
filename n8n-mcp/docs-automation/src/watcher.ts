import chokidar from 'chokidar';
import * as path from 'path';
import chalk from 'chalk';
import { debounce } from 'lodash';

export interface WatcherOptions {
  directory?: string;
  config?: string;
  onChange: (file: string) => Promise<void>;
  debounceMs?: number;
  ignore?: string[];
}

export class DocsWatcher {
  private watcher?: chokidar.FSWatcher;
  private options: WatcherOptions;
  private debouncedOnChange: (file: string) => Promise<void>;

  constructor(options: WatcherOptions) {
    this.options = {
      debounceMs: 1000,
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/docs/**' // Don't watch generated docs
      ],
      ...options
    };

    // Debounce the onChange callback to prevent rapid successive calls
    this.debouncedOnChange = debounce(
      this.options.onChange,
      this.options.debounceMs
    );
  }

  start(): void {
    const watchPaths = this.getWatchPaths();
    
    console.log(chalk.blue('Starting file watcher...'));
    console.log(chalk.gray(`Watching: ${watchPaths.join(', ')}`));
    
    this.watcher = chokidar.watch(watchPaths, {
      ignored: this.options.ignore,
      ignoreInitial: true,
      persistent: true,
      followSymlinks: false,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 100
      }
    });

    this.watcher
      .on('change', this.handleFileChange.bind(this))
      .on('add', this.handleFileAdd.bind(this))
      .on('unlink', this.handleFileDelete.bind(this))
      .on('error', this.handleError.bind(this))
      .on('ready', () => {
        console.log(chalk.green('File watcher ready'));
      });
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      console.log(chalk.gray('File watcher stopped'));
    }
  }

  private getWatchPaths(): string[] {
    const paths: string[] = [];
    
    if (this.options.directory) {
      paths.push(this.options.directory);
    }
    
    if (this.options.config) {
      try {
        const config = require(path.resolve(this.options.config));
        
        // Watch OpenAPI specs
        if (config.api?.input) {
          paths.push(config.api.input);
        }
        
        // Watch SDK source directories
        if (config.sdk?.languages) {
          config.sdk.languages.forEach((lang: string) => {
            const sdkPath = config.sdk.input || `./sdk/${lang}`;
            paths.push(sdkPath);
          });
        }
        
        // Watch reference docs includes
        if (config.reference?.include) {
          paths.push(...config.reference.include);
        }
        
        // Watch source files for SDK docs
        paths.push('./src/**/*.ts');
        paths.push('./src/**/*.js');
        paths.push('./**/*.md');
        
      } catch (error) {
        console.warn(chalk.yellow('Warning: Could not load config file, watching default paths'));
        paths.push('./src/**/*', './**/*.md', './openapi.yaml');
      }
    } else {
      // Default paths to watch
      paths.push(
        './src/**/*',
        './**/*.md',
        './openapi.yaml',
        './package.json'
      );
    }
    
    return [...new Set(paths)]; // Remove duplicates
  }

  private async handleFileChange(filePath: string): Promise<void> {
    console.log(chalk.blue(`File changed: ${filePath}`));
    await this.processFileChange(filePath);
  }

  private async handleFileAdd(filePath: string): Promise<void> {
    console.log(chalk.green(`File added: ${filePath}`));
    await this.processFileChange(filePath);
  }

  private async handleFileDelete(filePath: string): Promise<void> {
    console.log(chalk.red(`File deleted: ${filePath}`));
    await this.processFileChange(filePath);
  }

  private async processFileChange(filePath: string): Promise<void> {
    try {
      const relativePath = path.relative(process.cwd(), filePath);
      const changeType = this.detectChangeType(relativePath);
      
      console.log(chalk.gray(`Change type: ${changeType}`));
      
      // Call the debounced onChange handler
      await this.debouncedOnChange(relativePath);
      
    } catch (error) {
      console.error(chalk.red(`Error processing file change: ${error}`));
    }
  }

  private detectChangeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath).toLowerCase();
    
    // OpenAPI specs
    if (basename.includes('openapi') || 
        basename.includes('swagger') || 
        ['.yaml', '.yml', '.json'].includes(ext) && filePath.includes('api')) {
      return 'api-spec';
    }
    
    // Source code
    if (['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
      if (filePath.includes('sdk/') || filePath.includes('client/')) {
        return 'sdk-source';
      }
      return 'source-code';
    }
    
    // Documentation
    if (ext === '.md') {
      if (basename === 'readme.md') {
        return 'readme';
      }
      if (basename === 'changelog.md') {
        return 'changelog';
      }
      return 'documentation';
    }
    
    // Configuration
    if (['package.json', 'tsconfig.json', 'docs.config.json'].includes(basename)) {
      return 'configuration';
    }
    
    return 'other';
  }

  private handleError(error: Error): void {
    console.error(chalk.red('File watcher error:'), error);
  }

  // Utility methods for specific change types
  async handleApiSpecChange(filePath: string): Promise<void> {
    console.log(chalk.blue('Regenerating API documentation...'));
    // This would be called by the consumer when they detect API spec changes
  }

  async handleSourceChange(filePath: string): Promise<void> {
    console.log(chalk.blue('Regenerating SDK documentation...'));
    // This would be called by the consumer when they detect source changes
  }

  async handleDocumentationChange(filePath: string): Promise<void> {
    console.log(chalk.blue('Regenerating reference documentation...'));
    // This would be called by the consumer when they detect doc changes
  }

  // Get change statistics
  getStats(): { totalChanges: number; changesByType: Record<string, number> } {
    // This could be implemented to track changes over time
    return {
      totalChanges: 0,
      changesByType: {}
    };
  }

  // Batch processing for multiple rapid changes
  async processBatch(files: string[]): Promise<void> {
    const groupedByType: Record<string, string[]> = {};
    
    files.forEach(file => {
      const type = this.detectChangeType(file);
      if (!groupedByType[type]) {
        groupedByType[type] = [];
      }
      groupedByType[type].push(file);
    });

    console.log(chalk.blue(`Processing batch of ${files.length} files:`));
    
    for (const [type, typeFiles] of Object.entries(groupedByType)) {
      console.log(chalk.gray(`  ${type}: ${typeFiles.length} files`));
    }

    // Process each type efficiently
    for (const [type, typeFiles] of Object.entries(groupedByType)) {
      switch (type) {
        case 'api-spec':
          await this.handleApiSpecChange(typeFiles[0]); // Only need one to trigger regen
          break;
        case 'sdk-source':
        case 'source-code':
          await this.handleSourceChange(typeFiles[0]);
          break;
        case 'documentation':
          await this.handleDocumentationChange(typeFiles[0]);
          break;
      }
    }
  }
}