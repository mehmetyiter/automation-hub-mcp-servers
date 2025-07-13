import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import { ExecutionService } from '../services/execution';
import { ConfigService } from '../services/config';
import { formatDate, formatStatus, formatDuration } from '../utils/formatters';

export function executionCommands(program: Command) {
  const execution = program
    .command('execution')
    .alias('exec')
    .description('Execution management commands');

  execution
    .command('list <workflowId>')
    .alias('ls')
    .description('List executions for a workflow')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .option('-l, --limit <limit>', 'Number of executions to display', '20')
    .option('-s, --status <status>', 'Filter by status (success/error/running)')
    .option('--json', 'Output as JSON')
    .action(async (workflowId, options) => {
      try {
        const configService = new ConfigService();
        const auth = await configService.getAuth(options.profile);
        
        if (!auth) {
          console.error(chalk.red('Not authenticated. Run "n8n-mcp auth login" first.'));
          process.exit(1);
        }

        const executionService = new ExecutionService(auth);
        const spinner = ora('Fetching executions...').start();

        try {
          const executions = await executionService.list(workflowId, {
            limit: parseInt(options.limit),
            status: options.status
          });

          spinner.stop();

          if (options.json) {
            console.log(JSON.stringify(executions, null, 2));
            return;
          }

          if (executions.data.length === 0) {
            console.log(chalk.yellow('No executions found'));
            return;
          }

          const tableData = [
            ['ID', 'Status', 'Started', 'Duration', 'Mode']
          ];

          executions.data.forEach(exec => {
            tableData.push([
              exec.id,
              formatStatus(exec.finished, exec.status),
              formatDate(exec.startedAt),
              formatDuration(exec.startedAt, exec.stoppedAt),
              exec.mode || 'manual'
            ]);
          });

          console.log(table(tableData));
          console.log(chalk.gray(`\nTotal: ${executions.pagination.total} executions`));
        } catch (error: any) {
          spinner.fail(chalk.red('Failed to fetch executions'));
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  execution
    .command('get <id>')
    .description('Get execution details')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .option('-o, --output <file>', 'Save to file')
    .option('--json', 'Output as JSON')
    .action(async (id, options) => {
      try {
        const configService = new ConfigService();
        const auth = await configService.getAuth(options.profile);
        
        if (!auth) {
          console.error(chalk.red('Not authenticated. Run "n8n-mcp auth login" first.'));
          process.exit(1);
        }

        const executionService = new ExecutionService(auth);
        const spinner = ora('Fetching execution...').start();

        try {
          const execution = await executionService.get(id);
          spinner.stop();

          if (options.output) {
            await fs.writeFile(options.output, JSON.stringify(execution, null, 2));
            console.log(chalk.green(`✓ Execution saved to ${options.output}`));
            return;
          }

          if (options.json) {
            console.log(JSON.stringify(execution, null, 2));
            return;
          }

          console.log(chalk.bold('\nExecution Details:\n'));
          console.log(chalk.cyan('ID:'), execution.id);
          console.log(chalk.cyan('Workflow ID:'), execution.workflowId);
          console.log(chalk.cyan('Status:'), formatStatus(execution.finished, execution.status));
          console.log(chalk.cyan('Started:'), formatDate(execution.startedAt));
          console.log(chalk.cyan('Stopped:'), formatDate(execution.stoppedAt));
          console.log(chalk.cyan('Duration:'), formatDuration(execution.startedAt, execution.stoppedAt));
          console.log(chalk.cyan('Mode:'), execution.mode || 'manual');
          
          if (execution.data && Object.keys(execution.data).length > 0) {
            console.log(chalk.bold('\nExecution Data:'));
            console.log(JSON.stringify(execution.data, null, 2));
          }

          if (execution.error) {
            console.log(chalk.bold.red('\nError:'));
            console.log(chalk.red(execution.error.message));
            if (execution.error.stack && process.env.DEBUG) {
              console.log(chalk.gray(execution.error.stack));
            }
          }
        } catch (error: any) {
          spinner.fail(chalk.red('Failed to fetch execution'));
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  execution
    .command('stop <id>')
    .description('Stop a running execution')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .action(async (id, options) => {
      try {
        const configService = new ConfigService();
        const auth = await configService.getAuth(options.profile);
        
        if (!auth) {
          console.error(chalk.red('Not authenticated. Run "n8n-mcp auth login" first.'));
          process.exit(1);
        }

        const executionService = new ExecutionService(auth);
        const spinner = ora('Stopping execution...').start();

        try {
          await executionService.stop(id);
          spinner.succeed(chalk.green('Execution stopped successfully!'));
        } catch (error: any) {
          spinner.fail(chalk.red('Failed to stop execution'));
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  execution
    .command('retry <id>')
    .description('Retry a failed execution')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .option('--wait', 'Wait for execution to complete')
    .action(async (id, options) => {
      try {
        const configService = new ConfigService();
        const auth = await configService.getAuth(options.profile);
        
        if (!auth) {
          console.error(chalk.red('Not authenticated. Run "n8n-mcp auth login" first.'));
          process.exit(1);
        }

        const executionService = new ExecutionService(auth);
        const spinner = ora('Retrying execution...').start();

        try {
          const newExecution = await executionService.retry(id);
          
          if (options.wait) {
            spinner.text = 'Waiting for execution to complete...';
            const result = await executionService.waitForCompletion(newExecution.id);
            spinner.succeed(chalk.green('Execution completed!'));
            console.log(chalk.gray(`New Execution ID: ${result.id}`));
            console.log(chalk.gray(`Status: ${result.status}`));
          } else {
            spinner.succeed(chalk.green('Execution retry started!'));
            console.log(chalk.gray(`New Execution ID: ${newExecution.id}`));
            console.log(chalk.gray('Use "n8n-mcp execution get <id>" to check status'));
          }
        } catch (error: any) {
          spinner.fail(chalk.red('Failed to retry execution'));
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  execution
    .command('watch <id>')
    .description('Watch execution in real-time')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .action(async (id, options) => {
      try {
        const configService = new ConfigService();
        const auth = await configService.getAuth(options.profile);
        
        if (!auth) {
          console.error(chalk.red('Not authenticated. Run "n8n-mcp auth login" first.'));
          process.exit(1);
        }

        const executionService = new ExecutionService(auth);
        console.log(chalk.cyan(`Watching execution ${id}...\n`));

        try {
          await executionService.watch(id, (event) => {
            const timestamp = new Date().toLocaleTimeString();
            
            switch (event.type) {
              case 'node-started':
                console.log(
                  chalk.gray(`[${timestamp}]`) + ' ' +
                  chalk.blue('▶ Node started:') + ' ' +
                  chalk.cyan(event.data.nodeName)
                );
                break;
                
              case 'node-finished':
                console.log(
                  chalk.gray(`[${timestamp}]`) + ' ' +
                  chalk.green('✓ Node finished:') + ' ' +
                  chalk.cyan(event.data.nodeName)
                );
                break;
                
              case 'node-error':
                console.log(
                  chalk.gray(`[${timestamp}]`) + ' ' +
                  chalk.red('✖ Node error:') + ' ' +
                  chalk.cyan(event.data.nodeName) + ' - ' +
                  chalk.red(event.data.error)
                );
                break;
                
              case 'execution-finished':
                console.log(
                  chalk.gray(`[${timestamp}]`) + ' ' +
                  chalk.bold.green('✓ Execution completed')
                );
                break;
                
              case 'execution-error':
                console.log(
                  chalk.gray(`[${timestamp}]`) + ' ' +
                  chalk.bold.red('✖ Execution failed:') + ' ' +
                  chalk.red(event.data.error)
                );
                break;
                
              default:
                console.log(
                  chalk.gray(`[${timestamp}]`) + ' ' +
                  chalk.gray(event.type) + ': ' +
                  JSON.stringify(event.data)
                );
            }
          });
        } catch (error: any) {
          console.error(chalk.red('Failed to watch execution'));
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });
}

// Import fs for file operations
import * as fs from 'fs/promises';