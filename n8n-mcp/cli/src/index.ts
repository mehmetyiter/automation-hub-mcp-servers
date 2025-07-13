#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import updateNotifier from 'update-notifier';
import { authCommands } from './commands/auth';
import { workflowCommands } from './commands/workflow';
import { executionCommands } from './commands/execution';
import { generateCommands } from './commands/generate';
import { deployCommands } from './commands/deploy';
import { logsCommands } from './commands/logs';
import { configCommands } from './commands/config';
import { initCommand } from './commands/init';
import { version } from '../package.json';

// Check for updates
const pkg = require('../package.json');
updateNotifier({ pkg }).notify();

const program = new Command();

// ASCII Art Banner
const banner = `
 ╔═╗╔═╗╔╗╔   ╔╦╗╔═╗╔═╗   ╔═╗╦  ╦
 ║║║╚═╗║║║───║║║║  ╠═╝───║  ║  ║
 ╝╚╝╚═╝╝╚╝   ╩ ╩╚═╝╩     ╚═╝╩═╝╩
`;

console.log(chalk.cyan(banner));
console.log(chalk.gray(`Version ${version}\n`));

program
  .name('n8n-mcp')
  .description('CLI for n8n-MCP workflow automation platform')
  .version(version);

// Initialize command
program
  .command('init')
  .description('Initialize a new n8n-MCP project')
  .option('-n, --name <name>', 'Project name')
  .option('-t, --template <template>', 'Project template', 'basic')
  .option('--skip-install', 'Skip npm install')
  .action(initCommand);

// Add command groups
authCommands(program);
workflowCommands(program);
executionCommands(program);
generateCommands(program);
deployCommands(program);
logsCommands(program);
configCommands(program);

// Global error handler
process.on('unhandledRejection', (err: any) => {
  console.error(chalk.red('\n✖ An unexpected error occurred:'));
  console.error(chalk.red(err.message || err));
  if (err.stack && process.env.DEBUG) {
    console.error(chalk.gray(err.stack));
  }
  process.exit(1);
});

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}