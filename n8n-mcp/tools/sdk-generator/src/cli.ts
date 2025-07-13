#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { SDKGenerator, SDKOptions } from './generator';

const program = new Command();

program
  .name('n8n-mcp-sdk-generator')
  .description('Generate SDKs for the n8n-MCP API in multiple languages')
  .version('1.0.0');

program
  .command('generate')
  .alias('g')
  .description('Generate an SDK from OpenAPI specification')
  .option('-s, --spec <path>', 'Path to OpenAPI specification file (YAML or JSON)')
  .option('-l, --language <language>', 'Target language (typescript, python, go, java, etc.)')
  .option('-o, --output <path>', 'Output directory for generated SDK')
  .option('-n, --name <name>', 'Package name for the SDK')
  .option('-v, --version <version>', 'Package version')
  .option('--no-examples', 'Skip generating example files')
  .option('--no-tests', 'Skip generating test files')
  .option('--no-types', 'Skip generating type definitions')
  .option('-i, --interactive', 'Interactive mode with prompts')
  .action(async (options) => {
    try {
      if (options.interactive || (!options.spec || !options.language || !options.output)) {
        // Interactive mode
        const answers = await promptForOptions(options);
        Object.assign(options, answers);
      }

      // Validate inputs
      if (!options.spec) {
        console.error(chalk.red('Error: OpenAPI specification file is required'));
        process.exit(1);
      }

      if (!await fs.pathExists(options.spec)) {
        console.error(chalk.red(`Error: Specification file not found: ${options.spec}`));
        process.exit(1);
      }

      // Initialize generator
      const spinner = ora('Initializing SDK generator...').start();
      const generator = new SDKGenerator(options.spec);
      
      // Check if language is supported
      const supportedLanguages = generator.getSupportedLanguages();
      if (!supportedLanguages.includes(options.language)) {
        spinner.fail(`Unsupported language: ${options.language}`);
        console.log(chalk.yellow('\nSupported languages:'));
        supportedLanguages.forEach(lang => console.log(`  - ${lang}`));
        process.exit(1);
      }

      spinner.text = `Generating ${options.language} SDK...`;

      // Prepare SDK options
      const sdkOptions: SDKOptions = {
        outputDir: path.resolve(options.output),
        packageName: options.name,
        packageVersion: options.version,
        includeExamples: options.examples !== false,
        includeTests: options.tests !== false,
        includeTypes: options.types !== false
      };

      // Generate SDK
      await generator.generateSDK(options.language, sdkOptions);
      
      spinner.succeed(chalk.green(`SDK generated successfully!`));
      
      console.log(chalk.cyan('\n📁 Generated files:'));
      await listGeneratedFiles(sdkOptions.outputDir);
      
      console.log(chalk.cyan('\n🚀 Next steps:'));
      console.log(`  1. cd ${options.output}`);
      console.log(`  2. Review the README.md file`);
      console.log(`  3. Install dependencies and start building!`);
      
    } catch (error) {
      console.error(chalk.red('\nError generating SDK:'), error.message);
      process.exit(1);
    }
  });

program
  .command('list-languages')
  .alias('ls')
  .description('List all supported languages')
  .action(async () => {
    try {
      // Use a dummy spec to initialize generator
      const dummySpec = {
        openapi: '3.0.0',
        info: { title: 'Dummy', version: '1.0.0' },
        paths: {}
      };
      
      const generator = new SDKGenerator(dummySpec);
      const languages = generator.getSupportedLanguages();
      
      console.log(chalk.cyan('Supported languages:'));
      languages.forEach(lang => {
        console.log(`  - ${chalk.green(lang)}`);
      });
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
    }
  });

program
  .command('validate')
  .alias('v')
  .description('Validate an OpenAPI specification file')
  .argument('<spec>', 'Path to OpenAPI specification file')
  .action(async (specPath) => {
    try {
      const spinner = ora('Validating specification...').start();
      
      if (!await fs.pathExists(specPath)) {
        spinner.fail(`File not found: ${specPath}`);
        process.exit(1);
      }
      
      // Try to load and parse the spec
      const generator = new SDKGenerator(specPath);
      
      spinner.succeed(chalk.green('Specification is valid!'));
      
      // Show some basic info
      const spec = JSON.parse(await fs.readFile(specPath, 'utf8'));
      console.log(chalk.cyan('\nSpecification info:'));
      console.log(`  Title: ${spec.info.title}`);
      console.log(`  Version: ${spec.info.version}`);
      console.log(`  OpenAPI Version: ${spec.openapi}`);
      
      const pathCount = Object.keys(spec.paths || {}).length;
      console.log(`  Endpoints: ${pathCount}`);
      
      const schemaCount = Object.keys(spec.components?.schemas || {}).length;
      console.log(`  Models: ${schemaCount}`);
      
    } catch (error) {
      console.error(chalk.red('\nValidation failed:'), error.message);
      process.exit(1);
    }
  });

// Interactive prompts
async function promptForOptions(existingOptions: any) {
  const questions = [];
  
  if (!existingOptions.spec) {
    questions.push({
      type: 'input',
      name: 'spec',
      message: 'Path to OpenAPI specification file:',
      validate: async (input: string) => {
        if (!input) return 'Specification file is required';
        if (!await fs.pathExists(input)) return 'File not found';
        return true;
      }
    });
  }
  
  if (!existingOptions.language) {
    // Get supported languages
    const dummySpec = {
      openapi: '3.0.0',
      info: { title: 'Dummy', version: '1.0.0' },
      paths: {}
    };
    const generator = new SDKGenerator(dummySpec);
    const languages = generator.getSupportedLanguages();
    
    questions.push({
      type: 'list',
      name: 'language',
      message: 'Select target language:',
      choices: languages
    });
  }
  
  if (!existingOptions.output) {
    questions.push({
      type: 'input',
      name: 'output',
      message: 'Output directory:',
      default: (answers: any) => `./${answers.language || existingOptions.language}-sdk`
    });
  }
  
  if (!existingOptions.name) {
    questions.push({
      type: 'input',
      name: 'name',
      message: 'Package name:',
      default: (answers: any) => {
        const lang = answers.language || existingOptions.language;
        return `n8n-mcp-${lang}-sdk`;
      }
    });
  }
  
  if (!existingOptions.version) {
    questions.push({
      type: 'input',
      name: 'version',
      message: 'Package version:',
      default: '1.0.0'
    });
  }
  
  questions.push({
    type: 'confirm',
    name: 'examples',
    message: 'Include example files?',
    default: true
  });
  
  questions.push({
    type: 'confirm',
    name: 'tests',
    message: 'Include test files?',
    default: true
  });
  
  return inquirer.prompt(questions);
}

// List generated files
async function listGeneratedFiles(dir: string, prefix = '') {
  const files = await fs.readdir(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);
    
    if (stat.isDirectory()) {
      console.log(`${prefix}📁 ${chalk.blue(file)}/`);
      await listGeneratedFiles(filePath, prefix + '  ');
    } else {
      const ext = path.extname(file);
      let icon = '📄';
      
      if (ext === '.ts' || ext === '.js') icon = '📜';
      else if (ext === '.json') icon = '📋';
      else if (ext === '.md') icon = '📝';
      else if (ext === '.yaml' || ext === '.yml') icon = '📑';
      
      console.log(`${prefix}${icon} ${file}`);
    }
  }
}

// Run CLI
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}