import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import * as fs from 'fs/promises';
import * as path from 'path';
import { GenerateService } from '../services/generate';
import { ConfigService } from '../services/config';

export function generateCommands(program: Command) {
  const generate = program
    .command('generate')
    .alias('g')
    .description('Generate code and resources');

  generate
    .command('workflow')
    .description('Generate workflow from prompt')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .option('-o, --output <file>', 'Output file')
    .option('--name <name>', 'Workflow name')
    .option('--deploy', 'Deploy after generation')
    .action(async (options) => {
      try {
        const configService = new ConfigService();
        const auth = await configService.getAuth(options.profile);
        
        if (!auth) {
          console.error(chalk.red('Not authenticated. Run "n8n-mcp auth login" first.'));
          process.exit(1);
        }

        const generateService = new GenerateService(auth);

        // Get workflow details
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Workflow name:',
            default: options.name || 'Generated Workflow',
            validate: (input) => input.length > 0 || 'Name is required'
          },
          {
            type: 'editor',
            name: 'prompt',
            message: 'Describe your workflow (press Enter to open editor):',
            validate: (input) => input.trim().length > 0 || 'Description is required'
          }
        ]);

        const spinner = ora('Generating workflow...').start();

        try {
          const workflow = await generateService.generateWorkflow({
            name: answers.name,
            prompt: answers.prompt
          });

          spinner.succeed(chalk.green('Workflow generated successfully!'));

          // Save to file
          const outputFile = options.output || `${answers.name.toLowerCase().replace(/\s+/g, '-')}.json`;
          await fs.writeFile(outputFile, JSON.stringify(workflow, null, 2));
          console.log(chalk.gray(`Saved to: ${outputFile}`));

          // Deploy if requested
          if (options.deploy) {
            const deploySpinner = ora('Deploying workflow...').start();
            try {
              const deployed = await generateService.deployWorkflow(workflow);
              deploySpinner.succeed(chalk.green('Workflow deployed!'));
              console.log(chalk.gray(`Workflow ID: ${deployed.id}`));
            } catch (error: any) {
              deploySpinner.fail(chalk.red('Failed to deploy workflow'));
              console.error(chalk.red(error.message));
            }
          }
        } catch (error: any) {
          spinner.fail(chalk.red('Failed to generate workflow'));
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  generate
    .command('sdk <language>')
    .description('Generate SDK for a language')
    .option('-o, --output <dir>', 'Output directory')
    .option('--openapi <file>', 'OpenAPI spec file')
    .option('--package-name <name>', 'Package name')
    .option('--namespace <namespace>', 'Namespace (for some languages)')
    .action(async (language, options) => {
      try {
        const supportedLanguages = ['typescript', 'python', 'go', 'java', 'csharp', 'ruby', 'php'];
        
        if (!supportedLanguages.includes(language)) {
          console.error(chalk.red(`Unsupported language: ${language}`));
          console.log(chalk.gray(`Supported languages: ${supportedLanguages.join(', ')}`));
          process.exit(1);
        }

        const generateService = new GenerateService();

        // Get SDK details
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'packageName',
            message: 'Package name:',
            default: options.packageName || `n8n-mcp-${language}`,
            validate: (input) => input.length > 0 || 'Package name is required'
          },
          {
            type: 'input',
            name: 'outputDir',
            message: 'Output directory:',
            default: options.output || `./${language}-sdk`
          }
        ]);

        if (language === 'java' || language === 'csharp') {
          answers.namespace = await inquirer.prompt([
            {
              type: 'input',
              name: 'namespace',
              message: 'Namespace:',
              default: options.namespace || 'com.n8nmcp.sdk',
              validate: (input) => input.length > 0 || 'Namespace is required'
            }
          ]).then(a => a.namespace);
        }

        const spinner = ora(`Generating ${language} SDK...`).start();

        try {
          // Read OpenAPI spec
          let openApiSpec;
          if (options.openapi) {
            const content = await fs.readFile(options.openapi, 'utf-8');
            openApiSpec = JSON.parse(content);
          } else {
            // Fetch from API
            openApiSpec = await generateService.fetchOpenApiSpec();
          }

          // Generate SDK
          await generateService.generateSDK({
            language,
            openApiSpec,
            outputDir: answers.outputDir,
            packageName: answers.packageName,
            namespace: answers.namespace
          });

          spinner.succeed(chalk.green(`${language} SDK generated successfully!`));
          console.log(chalk.gray(`Output directory: ${answers.outputDir}`));
          
          // Show language-specific instructions
          const instructions = generateService.getInstallInstructions(language, answers.packageName);
          if (instructions) {
            console.log(chalk.bold('\nInstallation:'));
            console.log(chalk.gray(instructions));
          }
        } catch (error: any) {
          spinner.fail(chalk.red(`Failed to generate ${language} SDK`));
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  generate
    .command('node <type>')
    .description('Generate custom node template')
    .option('-n, --name <name>', 'Node name')
    .option('-o, --output <dir>', 'Output directory', './nodes')
    .option('--category <category>', 'Node category')
    .action(async (type, options) => {
      try {
        const nodeTypes = ['trigger', 'action', 'transform', 'webhook'];
        
        if (!nodeTypes.includes(type)) {
          console.error(chalk.red(`Invalid node type: ${type}`));
          console.log(chalk.gray(`Valid types: ${nodeTypes.join(', ')}`));
          process.exit(1);
        }

        const generateService = new GenerateService();

        // Get node details
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Node name:',
            default: options.name,
            validate: (input) => input.length > 0 || 'Name is required'
          },
          {
            type: 'input',
            name: 'displayName',
            message: 'Display name:',
            default: (answers: any) => answers.name
          },
          {
            type: 'input',
            name: 'description',
            message: 'Node description:',
            validate: (input) => input.length > 0 || 'Description is required'
          },
          {
            type: 'input',
            name: 'category',
            message: 'Category:',
            default: options.category || 'Custom'
          }
        ]);

        const spinner = ora('Generating node template...').start();

        try {
          const outputDir = path.join(options.output, answers.name);
          await generateService.generateNode({
            type,
            name: answers.name,
            displayName: answers.displayName,
            description: answers.description,
            category: answers.category,
            outputDir
          });

          spinner.succeed(chalk.green('Node template generated!'));
          console.log(chalk.gray(`Output directory: ${outputDir}`));
          console.log(chalk.bold('\nNext steps:'));
          console.log(chalk.gray('1. cd ' + outputDir));
          console.log(chalk.gray('2. npm install'));
          console.log(chalk.gray('3. npm run build'));
          console.log(chalk.gray('4. npm link'));
        } catch (error: any) {
          spinner.fail(chalk.red('Failed to generate node template'));
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  generate
    .command('integration <service>')
    .description('Generate integration boilerplate')
    .option('-o, --output <dir>', 'Output directory', './integrations')
    .option('--auth <type>', 'Authentication type', 'apiKey')
    .action(async (service, options) => {
      try {
        const generateService = new GenerateService();

        // Get integration details
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'displayName',
            message: 'Service display name:',
            default: service.charAt(0).toUpperCase() + service.slice(1)
          },
          {
            type: 'input',
            name: 'baseUrl',
            message: 'API base URL:',
            validate: (input) => {
              try {
                new URL(input);
                return true;
              } catch {
                return 'Please enter a valid URL';
              }
            }
          },
          {
            type: 'list',
            name: 'authType',
            message: 'Authentication type:',
            choices: ['apiKey', 'oauth2', 'basic', 'none'],
            default: options.auth
          },
          {
            type: 'checkbox',
            name: 'operations',
            message: 'Select operations to generate:',
            choices: [
              'List Items',
              'Get Item',
              'Create Item',
              'Update Item',
              'Delete Item',
              'Search',
              'Custom Action'
            ],
            validate: (input) => input.length > 0 || 'Select at least one operation'
          }
        ]);

        const spinner = ora('Generating integration...').start();

        try {
          const outputDir = path.join(options.output, service);
          await generateService.generateIntegration({
            service,
            displayName: answers.displayName,
            baseUrl: answers.baseUrl,
            authType: answers.authType,
            operations: answers.operations,
            outputDir
          });

          spinner.succeed(chalk.green('Integration generated!'));
          console.log(chalk.gray(`Output directory: ${outputDir}`));
          console.log(chalk.bold('\nGenerated files:'));
          console.log(chalk.gray('- credentials.ts (Authentication)'));
          console.log(chalk.gray('- node.ts (Main node file)'));
          console.log(chalk.gray('- operations/ (Operation files)'));
          console.log(chalk.gray('- README.md (Documentation)'));
        } catch (error: any) {
          spinner.fail(chalk.red('Failed to generate integration'));
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });
}