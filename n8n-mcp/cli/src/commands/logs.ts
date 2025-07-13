import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { LogsService } from '../services/logs';
import { ConfigService } from '../services/config';
import { formatDate } from '../utils/formatters';

export function logsCommands(program: Command) {
  const logs = program
    .command('logs')
    .description('View and stream logs');

  logs
    .command('execution <id>')
    .description('View execution logs')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .option('-f, --follow', 'Follow log output')
    .option('--json', 'Output as JSON')
    .action(async (id, options) => {
      try {
        const configService = new ConfigService();
        const auth = await configService.getAuth(options.profile);
        
        if (!auth) {
          console.error(chalk.red('Not authenticated. Run "n8n-mcp auth login" first.'));
          process.exit(1);
        }

        const logsService = new LogsService(auth);

        if (options.follow) {
          console.log(chalk.cyan(`Following logs for execution ${id}...\n`));
          
          await logsService.streamExecutionLogs(id, (log) => {
            if (options.json) {
              console.log(JSON.stringify(log));
            } else {
              const timestamp = formatDate(log.timestamp);
              const level = log.level.toUpperCase().padEnd(5);
              const levelColor = {
                'error': chalk.red,
                'warn': chalk.yellow,
                'info': chalk.blue,
                'debug': chalk.gray
              }[log.level] || chalk.white;
              
              console.log(
                chalk.gray(`[${timestamp}]`) + ' ' +
                levelColor(`[${level}]`) + ' ' +
                (log.nodeName ? chalk.cyan(`[${log.nodeName}]`) + ' ' : '') +
                log.message
              );
              
              if (log.metadata && Object.keys(log.metadata).length > 0) {
                console.log(chalk.gray('  Metadata:'), log.metadata);
              }
            }
          });
        } else {
          const spinner = ora('Fetching logs...').start();
          
          try {
            const logs = await logsService.getExecutionLogs(id);
            spinner.stop();
            
            if (options.json) {
              console.log(JSON.stringify(logs, null, 2));
              return;
            }
            
            if (logs.length === 0) {
              console.log(chalk.yellow('No logs found'));
              return;
            }
            
            logs.forEach(log => {
              const timestamp = formatDate(log.timestamp);
              const level = log.level.toUpperCase().padEnd(5);
              const levelColor = {
                'error': chalk.red,
                'warn': chalk.yellow,
                'info': chalk.blue,
                'debug': chalk.gray
              }[log.level] || chalk.white;
              
              console.log(
                chalk.gray(`[${timestamp}]`) + ' ' +
                levelColor(`[${level}]`) + ' ' +
                (log.nodeName ? chalk.cyan(`[${log.nodeName}]`) + ' ' : '') +
                log.message
              );
              
              if (log.metadata && Object.keys(log.metadata).length > 0) {
                console.log(chalk.gray('  Metadata:'), log.metadata);
              }
            });
          } catch (error: any) {
            spinner.fail(chalk.red('Failed to fetch logs'));
            console.error(chalk.red(error.message));
            process.exit(1);
          }
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  logs
    .command('workflow <id>')
    .description('View workflow logs')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .option('-f, --follow', 'Follow log output')
    .option('-n, --lines <lines>', 'Number of lines to show', '100')
    .option('--since <time>', 'Show logs since time (e.g., 1h, 30m)')
    .option('--level <level>', 'Filter by log level')
    .option('--json', 'Output as JSON')
    .action(async (id, options) => {
      try {
        const configService = new ConfigService();
        const auth = await configService.getAuth(options.profile);
        
        if (!auth) {
          console.error(chalk.red('Not authenticated. Run "n8n-mcp auth login" first.'));
          process.exit(1);
        }

        const logsService = new LogsService(auth);
        
        // Parse since option
        let since;
        if (options.since) {
          const match = options.since.match(/^(\d+)([hm])$/);
          if (!match) {
            console.error(chalk.red('Invalid --since format. Use format like "1h" or "30m"'));
            process.exit(1);
          }
          const amount = parseInt(match[1]);
          const unit = match[2];
          const minutes = unit === 'h' ? amount * 60 : amount;
          since = new Date(Date.now() - minutes * 60 * 1000);
        }

        if (options.follow) {
          console.log(chalk.cyan(`Following logs for workflow ${id}...\n`));
          
          await logsService.streamWorkflowLogs(id, {
            level: options.level,
            since
          }, (log) => {
            if (options.json) {
              console.log(JSON.stringify(log));
            } else {
              const timestamp = formatDate(log.timestamp);
              const level = log.level.toUpperCase().padEnd(5);
              const levelColor = {
                'error': chalk.red,
                'warn': chalk.yellow,
                'info': chalk.blue,
                'debug': chalk.gray
              }[log.level] || chalk.white;
              
              console.log(
                chalk.gray(`[${timestamp}]`) + ' ' +
                levelColor(`[${level}]`) + ' ' +
                (log.executionId ? chalk.magenta(`[${log.executionId}]`) + ' ' : '') +
                (log.nodeName ? chalk.cyan(`[${log.nodeName}]`) + ' ' : '') +
                log.message
              );
            }
          });
        } else {
          const spinner = ora('Fetching logs...').start();
          
          try {
            const logs = await logsService.getWorkflowLogs(id, {
              limit: parseInt(options.lines),
              level: options.level,
              since
            });
            spinner.stop();
            
            if (options.json) {
              console.log(JSON.stringify(logs, null, 2));
              return;
            }
            
            if (logs.length === 0) {
              console.log(chalk.yellow('No logs found'));
              return;
            }
            
            logs.forEach(log => {
              const timestamp = formatDate(log.timestamp);
              const level = log.level.toUpperCase().padEnd(5);
              const levelColor = {
                'error': chalk.red,
                'warn': chalk.yellow,
                'info': chalk.blue,
                'debug': chalk.gray
              }[log.level] || chalk.white;
              
              console.log(
                chalk.gray(`[${timestamp}]`) + ' ' +
                levelColor(`[${level}]`) + ' ' +
                (log.executionId ? chalk.magenta(`[${log.executionId}]`) + ' ' : '') +
                (log.nodeName ? chalk.cyan(`[${log.nodeName}]`) + ' ' : '') +
                log.message
              );
            });
          } catch (error: any) {
            spinner.fail(chalk.red('Failed to fetch logs'));
            console.error(chalk.red(error.message));
            process.exit(1);
          }
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  logs
    .command('system')
    .description('View system logs')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .option('-f, --follow', 'Follow log output')
    .option('-n, --lines <lines>', 'Number of lines to show', '100')
    .option('--since <time>', 'Show logs since time (e.g., 1h, 30m)')
    .option('--level <level>', 'Filter by log level')
    .option('--service <service>', 'Filter by service')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const configService = new ConfigService();
        const auth = await configService.getAuth(options.profile);
        
        if (!auth) {
          console.error(chalk.red('Not authenticated. Run "n8n-mcp auth login" first.'));
          process.exit(1);
        }

        const logsService = new LogsService(auth);
        
        // Parse since option
        let since;
        if (options.since) {
          const match = options.since.match(/^(\d+)([hm])$/);
          if (!match) {
            console.error(chalk.red('Invalid --since format. Use format like "1h" or "30m"'));
            process.exit(1);
          }
          const amount = parseInt(match[1]);
          const unit = match[2];
          const minutes = unit === 'h' ? amount * 60 : amount;
          since = new Date(Date.now() - minutes * 60 * 1000);
        }

        if (options.follow) {
          console.log(chalk.cyan('Following system logs...\n'));
          
          await logsService.streamSystemLogs({
            level: options.level,
            service: options.service,
            since
          }, (log) => {
            if (options.json) {
              console.log(JSON.stringify(log));
            } else {
              const timestamp = formatDate(log.timestamp);
              const level = log.level.toUpperCase().padEnd(5);
              const levelColor = {
                'error': chalk.red,
                'warn': chalk.yellow,
                'info': chalk.blue,
                'debug': chalk.gray
              }[log.level] || chalk.white;
              
              console.log(
                chalk.gray(`[${timestamp}]`) + ' ' +
                levelColor(`[${level}]`) + ' ' +
                chalk.green(`[${log.service}]`) + ' ' +
                log.message
              );
              
              if (log.metadata && Object.keys(log.metadata).length > 0) {
                console.log(chalk.gray('  Metadata:'), log.metadata);
              }
            }
          });
        } else {
          const spinner = ora('Fetching system logs...').start();
          
          try {
            const logs = await logsService.getSystemLogs({
              limit: parseInt(options.lines),
              level: options.level,
              service: options.service,
              since
            });
            spinner.stop();
            
            if (options.json) {
              console.log(JSON.stringify(logs, null, 2));
              return;
            }
            
            if (logs.length === 0) {
              console.log(chalk.yellow('No logs found'));
              return;
            }
            
            logs.forEach(log => {
              const timestamp = formatDate(log.timestamp);
              const level = log.level.toUpperCase().padEnd(5);
              const levelColor = {
                'error': chalk.red,
                'warn': chalk.yellow,
                'info': chalk.blue,
                'debug': chalk.gray
              }[log.level] || chalk.white;
              
              console.log(
                chalk.gray(`[${timestamp}]`) + ' ' +
                levelColor(`[${level}]`) + ' ' +
                chalk.green(`[${log.service}]`) + ' ' +
                log.message
              );
              
              if (log.metadata && Object.keys(log.metadata).length > 0) {
                console.log(chalk.gray('  Metadata:'), log.metadata);
              }
            });
          } catch (error: any) {
            spinner.fail(chalk.red('Failed to fetch system logs'));
            console.error(chalk.red(error.message));
            process.exit(1);
          }
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });
}