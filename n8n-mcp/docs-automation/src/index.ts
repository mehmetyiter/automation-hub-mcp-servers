#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { ApiDocsGenerator } from './generators/api-docs';
import { ChangelogGenerator } from './generators/changelog';
import { SDKDocsGenerator } from './generators/sdk-docs';
import { ReferenceDocsGenerator } from './generators/reference-docs';
import { DocsValidator } from './validators/validate-docs';
import { DocsServer } from './server';
import { DocsWatcher } from './watcher';
import { version } from '../package.json';

const program = new Command();

console.log(chalk.cyan(`
╔╦╗╔═╗╔═╗╔═╗  ╔═╗╦ ╦╔╦╗╔═╗╔╦╗╔═╗╔╦╗╦╔═╗╔╗╔
 ║║║ ║║  ╚═╗  ╠═╣║ ║ ║ ║ ║║║║╠═╣ ║ ║║ ║║║║
═╩╝╚═╝╚═╝╚═╝  ╩ ╩╚═╝ ╩ ╚═╝╩ ╩╩ ╩ ╩ ╩╚═╝╝╚╝
`));
console.log(chalk.gray(`Version ${version}\n`));

program
  .name('n8n-mcp-docs')
  .description('Documentation automation for n8n-MCP')
  .version(version);

// Generate command group
const generate = program
  .command('generate')
  .alias('g')
  .description('Generate documentation');

generate
  .command('api')
  .description('Generate API documentation from OpenAPI spec')
  .option('-i, --input <file>', 'OpenAPI spec file', './openapi.yaml')
  .option('-o, --output <dir>', 'Output directory', './docs/api')
  .option('-f, --format <format>', 'Output format (markdown|html|pdf)', 'markdown')
  .option('--theme <theme>', 'Documentation theme', 'default')
  .action(async (options) => {
    try {
      const generator = new ApiDocsGenerator();
      await generator.generate({
        input: options.input,
        output: options.output,
        format: options.format,
        theme: options.theme
      });
      console.log(chalk.green('✓ API documentation generated successfully!'));
    } catch (error: any) {
      console.error(chalk.red('Error generating API docs:'), error.message);
      process.exit(1);
    }
  });

generate
  .command('changelog')
  .description('Generate changelog from git commits')
  .option('-o, --output <file>', 'Output file', 'CHANGELOG.md')
  .option('-f, --from <tag>', 'Start tag/commit')
  .option('-t, --to <tag>', 'End tag/commit', 'HEAD')
  .option('--preset <preset>', 'Commit convention preset', 'angular')
  .option('--release-count <count>', 'Number of releases to include', '0')
  .action(async (options) => {
    try {
      const generator = new ChangelogGenerator();
      await generator.generate({
        output: options.output,
        from: options.from,
        to: options.to,
        preset: options.preset,
        releaseCount: parseInt(options.releaseCount)
      });
      console.log(chalk.green('✓ Changelog generated successfully!'));
    } catch (error: any) {
      console.error(chalk.red('Error generating changelog:'), error.message);
      process.exit(1);
    }
  });

generate
  .command('sdk-docs')
  .description('Generate SDK documentation')
  .option('-l, --language <language>', 'SDK language', 'typescript')
  .option('-i, --input <dir>', 'SDK source directory')
  .option('-o, --output <dir>', 'Output directory', './docs/sdk')
  .option('--include-examples', 'Include code examples', true)
  .action(async (options) => {
    try {
      const generator = new SDKDocsGenerator();
      await generator.generate({
        language: options.language,
        input: options.input || `./sdk/${options.language}`,
        output: options.output,
        includeExamples: options.includeExamples
      });
      console.log(chalk.green('✓ SDK documentation generated successfully!'));
    } catch (error: any) {
      console.error(chalk.red('Error generating SDK docs:'), error.message);
      process.exit(1);
    }
  });

generate
  .command('reference')
  .description('Generate complete reference documentation')
  .option('-c, --config <file>', 'Configuration file', './docs.config.json')
  .option('-o, --output <dir>', 'Output directory', './docs')
  .action(async (options) => {
    try {
      const generator = new ReferenceDocsGenerator();
      await generator.generate({
        config: options.config,
        output: options.output
      });
      console.log(chalk.green('✓ Reference documentation generated successfully!'));
    } catch (error: any) {
      console.error(chalk.red('Error generating reference docs:'), error.message);
      process.exit(1);
    }
  });

generate
  .command('all')
  .description('Generate all documentation')
  .option('-c, --config <file>', 'Configuration file', './docs.config.json')
  .action(async (options) => {
    try {
      console.log(chalk.cyan('Generating all documentation...\n'));
      
      // Generate API docs
      console.log(chalk.blue('→ Generating API documentation...'));
      const apiGenerator = new ApiDocsGenerator();
      await apiGenerator.generateFromConfig(options.config);
      
      // Generate changelog
      console.log(chalk.blue('→ Generating changelog...'));
      const changelogGenerator = new ChangelogGenerator();
      await changelogGenerator.generateFromConfig(options.config);
      
      // Generate SDK docs
      console.log(chalk.blue('→ Generating SDK documentation...'));
      const sdkGenerator = new SDKDocsGenerator();
      await sdkGenerator.generateFromConfig(options.config);
      
      // Generate reference docs
      console.log(chalk.blue('→ Generating reference documentation...'));
      const referenceGenerator = new ReferenceDocsGenerator();
      await referenceGenerator.generate({ config: options.config });
      
      console.log(chalk.green('\n✓ All documentation generated successfully!'));
    } catch (error: any) {
      console.error(chalk.red('Error generating documentation:'), error.message);
      process.exit(1);
    }
  });

// Validate command
program
  .command('validate')
  .description('Validate documentation')
  .option('-d, --dir <directory>', 'Documentation directory', './docs')
  .option('--fix', 'Attempt to fix issues automatically')
  .option('--strict', 'Enable strict validation')
  .action(async (options) => {
    try {
      const validator = new DocsValidator();
      const results = await validator.validate({
        directory: options.dir,
        fix: options.fix,
        strict: options.strict
      });
      
      if (results.errors.length === 0) {
        console.log(chalk.green('✓ Documentation is valid!'));
      } else {
        console.log(chalk.red(`✗ Found ${results.errors.length} errors`));
        results.errors.forEach(error => {
          console.log(chalk.red(`  - ${error.file}: ${error.message}`));
        });
        process.exit(1);
      }
      
      if (results.warnings.length > 0) {
        console.log(chalk.yellow(`⚠ ${results.warnings.length} warnings`));
        results.warnings.forEach(warning => {
          console.log(chalk.yellow(`  - ${warning.file}: ${warning.message}`));
        });
      }
    } catch (error: any) {
      console.error(chalk.red('Error validating documentation:'), error.message);
      process.exit(1);
    }
  });

// Serve command
program
  .command('serve')
  .description('Serve documentation locally')
  .option('-p, --port <port>', 'Server port', '3000')
  .option('-d, --dir <directory>', 'Documentation directory', './docs')
  .option('--watch', 'Watch for changes and rebuild')
  .option('--open', 'Open in browser')
  .action(async (options) => {
    try {
      const server = new DocsServer({
        port: parseInt(options.port),
        docsDir: options.dir,
        watch: options.watch,
        open: options.open
      });
      
      await server.start();
      
      console.log(chalk.green(`\n✓ Documentation server running at http://localhost:${options.port}`));
      
      if (options.watch) {
        console.log(chalk.gray('Watching for changes...'));
        const watcher = new DocsWatcher({
          directory: options.dir,
          onChange: async () => {
            console.log(chalk.blue('Changes detected, regenerating...'));
            // Regenerate docs
          }
        });
        watcher.start();
      }
    } catch (error: any) {
      console.error(chalk.red('Error starting server:'), error.message);
      process.exit(1);
    }
  });

// Watch command
program
  .command('watch')
  .description('Watch files and regenerate documentation on changes')
  .option('-c, --config <file>', 'Configuration file', './docs.config.json')
  .action(async (options) => {
    try {
      const watcher = new DocsWatcher({
        config: options.config,
        onChange: async (file) => {
          console.log(chalk.blue(`File changed: ${file}`));
          console.log(chalk.gray('Regenerating documentation...'));
          
          // Determine what to regenerate based on file
          if (file.includes('openapi')) {
            const apiGenerator = new ApiDocsGenerator();
            await apiGenerator.generateFromConfig(options.config);
          } else if (file.endsWith('.ts') || file.endsWith('.js')) {
            const sdkGenerator = new SDKDocsGenerator();
            await sdkGenerator.generateFromConfig(options.config);
          }
          
          console.log(chalk.green('✓ Documentation updated'));
        }
      });
      
      console.log(chalk.cyan('Watching for changes...\n'));
      watcher.start();
    } catch (error: any) {
      console.error(chalk.red('Error watching files:'), error.message);
      process.exit(1);
    }
  });

// Init command
program
  .command('init')
  .description('Initialize documentation configuration')
  .option('-t, --type <type>', 'Documentation type (api|sdk|full)', 'full')
  .action(async (options) => {
    try {
      const config = {
        version: '1.0.0',
        name: 'n8n-MCP Documentation',
        output: './docs',
        api: {
          input: './openapi.yaml',
          output: './docs/api',
          format: 'markdown'
        },
        changelog: {
          output: 'CHANGELOG.md',
          preset: 'angular'
        },
        sdk: {
          languages: ['typescript', 'python', 'go'],
          output: './docs/sdk'
        },
        reference: {
          include: ['./src/**/*.ts', './README.md'],
          exclude: ['**/*.test.ts', '**/node_modules/**']
        },
        serve: {
          port: 3000,
          theme: 'default'
        }
      };
      
      await require('fs').promises.writeFile(
        './docs.config.json',
        JSON.stringify(config, null, 2)
      );
      
      console.log(chalk.green('✓ Documentation configuration created!'));
      console.log(chalk.gray('\nNext steps:'));
      console.log(chalk.gray('1. Edit docs.config.json to customize settings'));
      console.log(chalk.gray('2. Run "n8n-mcp-docs generate all" to generate documentation'));
      console.log(chalk.gray('3. Run "n8n-mcp-docs serve" to preview documentation'));
    } catch (error: any) {
      console.error(chalk.red('Error initializing configuration:'), error.message);
      process.exit(1);
    }
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command
if (!process.argv.slice(2).length) {
  program.outputHelp();
}