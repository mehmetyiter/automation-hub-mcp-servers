import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { table } from 'table';
import { ConfigService } from '../services/config';
import * as os from 'os';
import * as path from 'path';

export function configCommands(program: Command) {
  const config = program
    .command('config')
    .description('Configuration management');

  config
    .command('list')
    .alias('ls')
    .description('List all configuration values')
    .option('-p, --profile <profile>', 'Profile name')
    .action(async (options) => {
      try {
        const configService = new ConfigService();
        const configs = await configService.getAllConfigs(options.profile);
        
        if (Object.keys(configs).length === 0) {
          console.log(chalk.yellow('No configuration found'));
          return;
        }

        const tableData = [
          ['Key', 'Value']
        ];

        Object.entries(configs).forEach(([key, value]) => {
          // Mask sensitive values
          let displayValue = value;
          if (key.toLowerCase().includes('key') || 
              key.toLowerCase().includes('secret') ||
              key.toLowerCase().includes('password')) {
            displayValue = value ? '****' + value.slice(-4) : '';
          }
          
          tableData.push([key, String(displayValue)]);
        });

        console.log(table(tableData));
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  config
    .command('get <key>')
    .description('Get a configuration value')
    .option('-p, --profile <profile>', 'Profile name')
    .action(async (key, options) => {
      try {
        const configService = new ConfigService();
        const value = await configService.get(key, options.profile);
        
        if (value === undefined) {
          console.log(chalk.yellow(`Configuration key '${key}' not found`));
        } else {
          console.log(value);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  config
    .command('set <key> [value]')
    .description('Set a configuration value')
    .option('-p, --profile <profile>', 'Profile name')
    .action(async (key, value, options) => {
      try {
        const configService = new ConfigService();
        
        // If value not provided, prompt for it
        if (!value) {
          const isSecret = key.toLowerCase().includes('key') || 
                          key.toLowerCase().includes('secret') ||
                          key.toLowerCase().includes('password');
          
          const answer = await inquirer.prompt([
            {
              type: isSecret ? 'password' : 'input',
              name: 'value',
              message: `Enter value for '${key}':`,
              validate: (input) => input.length > 0 || 'Value is required'
            }
          ]);
          value = answer.value;
        }

        await configService.set(key, value, options.profile);
        console.log(chalk.green(`✓ Configuration '${key}' set`));
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  config
    .command('unset <key>')
    .alias('delete')
    .description('Remove a configuration value')
    .option('-p, --profile <profile>', 'Profile name')
    .action(async (key, options) => {
      try {
        const configService = new ConfigService();
        await configService.unset(key, options.profile);
        console.log(chalk.green(`✓ Configuration '${key}' removed`));
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  config
    .command('path')
    .description('Show configuration file path')
    .action(() => {
      const configPath = path.join(os.homedir(), '.n8n-mcp', 'config.json');
      console.log(chalk.cyan('Configuration file:'), configPath);
    });

  config
    .command('reset')
    .description('Reset all configuration')
    .option('-p, --profile <profile>', 'Profile name')
    .option('-f, --force', 'Skip confirmation')
    .action(async (options) => {
      try {
        if (!options.force) {
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: options.profile 
                ? `Are you sure you want to reset configuration for profile '${options.profile}'?`
                : 'Are you sure you want to reset all configuration?',
              default: false
            }
          ]);

          if (!confirm) {
            console.log(chalk.yellow('Reset cancelled'));
            return;
          }
        }

        const configService = new ConfigService();
        if (options.profile) {
          await configService.resetProfile(options.profile);
          console.log(chalk.green(`✓ Profile '${options.profile}' configuration reset`));
        } else {
          await configService.resetAll();
          console.log(chalk.green('✓ All configuration reset'));
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  config
    .command('editor')
    .description('Set default editor')
    .action(async () => {
      try {
        const configService = new ConfigService();
        const currentEditor = await configService.get('editor') || process.env.EDITOR || 'vi';
        
        const { editor } = await inquirer.prompt([
          {
            type: 'input',
            name: 'editor',
            message: 'Default editor:',
            default: currentEditor
          }
        ]);

        await configService.set('editor', editor);
        console.log(chalk.green(`✓ Default editor set to '${editor}'`));
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  config
    .command('defaults')
    .description('Configure default values')
    .action(async () => {
      try {
        const configService = new ConfigService();
        
        const answers = await inquirer.prompt([
          {
            type: 'list',
            name: 'outputFormat',
            message: 'Default output format:',
            choices: ['table', 'json', 'yaml'],
            default: await configService.get('defaults.outputFormat') || 'table'
          },
          {
            type: 'confirm',
            name: 'activateOnDeploy',
            message: 'Activate workflows on deploy by default?',
            default: await configService.get('defaults.activateOnDeploy') || false
          },
          {
            type: 'input',
            name: 'workflowsDir',
            message: 'Default workflows directory:',
            default: await configService.get('defaults.workflowsDir') || './workflows'
          },
          {
            type: 'list',
            name: 'logLevel',
            message: 'Default log level:',
            choices: ['error', 'warn', 'info', 'debug'],
            default: await configService.get('defaults.logLevel') || 'info'
          }
        ]);

        for (const [key, value] of Object.entries(answers)) {
          await configService.set(`defaults.${key}`, value);
        }

        console.log(chalk.green('✓ Default values configured'));
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });
}