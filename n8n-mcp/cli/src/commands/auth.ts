import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { AuthService } from '../services/auth';
import { ConfigService } from '../services/config';

export function authCommands(program: Command) {
  const auth = program
    .command('auth')
    .description('Authentication commands');

  auth
    .command('login')
    .description('Login to n8n-MCP')
    .option('-k, --api-key <key>', 'API key')
    .option('-u, --url <url>', 'API base URL', 'https://api.n8n-mcp.com')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .action(async (options) => {
      try {
        const authService = new AuthService();
        const configService = new ConfigService();

        let apiKey = options.apiKey;
        let baseUrl = options.url;

        if (!apiKey) {
          const answers = await inquirer.prompt([
            {
              type: 'password',
              name: 'apiKey',
              message: 'Enter your API key:',
              validate: (input) => input.length > 0 || 'API key is required'
            },
            {
              type: 'input',
              name: 'baseUrl',
              message: 'API base URL:',
              default: baseUrl
            }
          ]);
          apiKey = answers.apiKey;
          baseUrl = answers.baseUrl;
        }

        const spinner = ora('Authenticating...').start();

        try {
          const isValid = await authService.validateApiKey(apiKey, baseUrl);
          
          if (isValid) {
            await configService.setAuth(options.profile, {
              apiKey,
              baseUrl
            });
            
            spinner.succeed(chalk.green('Authentication successful!'));
            console.log(chalk.gray(`Profile '${options.profile}' configured`));
          } else {
            spinner.fail(chalk.red('Invalid API key'));
            process.exit(1);
          }
        } catch (error: any) {
          spinner.fail(chalk.red('Authentication failed'));
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  auth
    .command('logout')
    .description('Logout from n8n-MCP')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .action(async (options) => {
      try {
        const configService = new ConfigService();
        await configService.removeAuth(options.profile);
        console.log(chalk.green(`✓ Logged out from profile '${options.profile}'`));
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  auth
    .command('status')
    .description('Check authentication status')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .action(async (options) => {
      try {
        const configService = new ConfigService();
        const authService = new AuthService();
        
        const auth = await configService.getAuth(options.profile);
        
        if (!auth) {
          console.log(chalk.yellow('Not authenticated'));
          console.log(chalk.gray('Run "n8n-mcp auth login" to authenticate'));
          return;
        }

        const spinner = ora('Checking authentication...').start();
        
        try {
          const isValid = await authService.validateApiKey(auth.apiKey, auth.baseUrl);
          
          if (isValid) {
            spinner.succeed(chalk.green('Authenticated'));
            console.log(chalk.gray(`Profile: ${options.profile}`));
            console.log(chalk.gray(`API URL: ${auth.baseUrl}`));
          } else {
            spinner.fail(chalk.red('Authentication expired or invalid'));
            process.exit(1);
          }
        } catch (error) {
          spinner.fail(chalk.red('Failed to check authentication'));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  auth
    .command('profiles')
    .description('List authentication profiles')
    .action(async () => {
      try {
        const configService = new ConfigService();
        const profiles = await configService.listProfiles();
        
        if (profiles.length === 0) {
          console.log(chalk.yellow('No profiles configured'));
          console.log(chalk.gray('Run "n8n-mcp auth login" to create a profile'));
          return;
        }

        console.log(chalk.bold('\nAuthentication Profiles:\n'));
        
        for (const profile of profiles) {
          const auth = await configService.getAuth(profile);
          const isDefault = profile === 'default';
          
          console.log(
            chalk.cyan(`• ${profile}`) + 
            (isDefault ? chalk.gray(' (default)') : '') +
            chalk.gray(` - ${auth?.baseUrl || 'Not configured'}`)
          );
        }
        
        console.log('\n' + chalk.gray('Use -p <profile> to switch profiles'));
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });
}