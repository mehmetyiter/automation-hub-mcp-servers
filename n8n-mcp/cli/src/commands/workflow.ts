import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { table } from 'table';
import * as fs from 'fs/promises';
import * as path from 'path';
import { WorkflowService } from '../services/workflow';
import { ConfigService } from '../services/config';
import { formatDate, formatStatus } from '../utils/formatters';

export function workflowCommands(program: Command) {
  const workflow = program
    .command('workflow')
    .alias('wf')
    .description('Workflow management commands');

  workflow
    .command('list')
    .alias('ls')
    .description('List workflows')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .option('-l, --limit <limit>', 'Number of workflows to display', '20')
    .option('-s, --status <status>', 'Filter by status (active/inactive)')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const configService = new ConfigService();
        const auth = await configService.getAuth(options.profile);
        
        if (!auth) {
          console.error(chalk.red('Not authenticated. Run "n8n-mcp auth login" first.'));
          process.exit(1);
        }

        const workflowService = new WorkflowService(auth);
        const spinner = ora('Fetching workflows...').start();

        try {
          const workflows = await workflowService.list({
            limit: parseInt(options.limit),
            status: options.status
          });

          spinner.stop();

          if (options.json) {
            console.log(JSON.stringify(workflows, null, 2));
            return;
          }

          if (workflows.data.length === 0) {
            console.log(chalk.yellow('No workflows found'));
            return;
          }

          const tableData = [
            ['ID', 'Name', 'Status', 'Created', 'Updated']
          ];

          workflows.data.forEach(wf => {
            tableData.push([
              wf.id,
              wf.name.substring(0, 30) + (wf.name.length > 30 ? '...' : ''),
              formatStatus(wf.active),
              formatDate(wf.createdAt),
              formatDate(wf.updatedAt)
            ]);
          });

          console.log(table(tableData));
          console.log(chalk.gray(`\nTotal: ${workflows.pagination.total} workflows`));
        } catch (error: any) {
          spinner.fail(chalk.red('Failed to fetch workflows'));
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  workflow
    .command('get <id>')
    .description('Get workflow details')
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

        const workflowService = new WorkflowService(auth);
        const spinner = ora('Fetching workflow...').start();

        try {
          const workflow = await workflowService.get(id);
          spinner.stop();

          if (options.output) {
            await fs.writeFile(options.output, JSON.stringify(workflow, null, 2));
            console.log(chalk.green(`✓ Workflow saved to ${options.output}`));
            return;
          }

          if (options.json) {
            console.log(JSON.stringify(workflow, null, 2));
            return;
          }

          console.log(chalk.bold('\nWorkflow Details:\n'));
          console.log(chalk.cyan('ID:'), workflow.id);
          console.log(chalk.cyan('Name:'), workflow.name);
          console.log(chalk.cyan('Status:'), formatStatus(workflow.active));
          console.log(chalk.cyan('Created:'), formatDate(workflow.createdAt));
          console.log(chalk.cyan('Updated:'), formatDate(workflow.updatedAt));
          console.log(chalk.cyan('Nodes:'), workflow.nodes.length);
          
          if (workflow.nodes.length > 0) {
            console.log(chalk.bold('\nNodes:'));
            workflow.nodes.forEach(node => {
              console.log(`  • ${node.type} (${node.id})`);
            });
          }
        } catch (error: any) {
          spinner.fail(chalk.red('Failed to fetch workflow'));
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  workflow
    .command('create <file>')
    .description('Create workflow from file')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .option('-n, --name <name>', 'Override workflow name')
    .option('--activate', 'Activate workflow after creation')
    .action(async (file, options) => {
      try {
        const configService = new ConfigService();
        const auth = await configService.getAuth(options.profile);
        
        if (!auth) {
          console.error(chalk.red('Not authenticated. Run "n8n-mcp auth login" first.'));
          process.exit(1);
        }

        const workflowService = new WorkflowService(auth);
        
        // Read workflow file
        let workflowData;
        try {
          const content = await fs.readFile(file, 'utf-8');
          workflowData = JSON.parse(content);
        } catch (error) {
          console.error(chalk.red(`Failed to read file: ${file}`));
          process.exit(1);
        }

        if (options.name) {
          workflowData.name = options.name;
        }

        if (options.activate) {
          workflowData.active = true;
        }

        const spinner = ora('Creating workflow...').start();

        try {
          const workflow = await workflowService.create(workflowData);
          spinner.succeed(chalk.green('Workflow created successfully!'));
          console.log(chalk.gray(`ID: ${workflow.id}`));
          console.log(chalk.gray(`Name: ${workflow.name}`));
        } catch (error: any) {
          spinner.fail(chalk.red('Failed to create workflow'));
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  workflow
    .command('update <id> <file>')
    .description('Update workflow from file')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .action(async (id, file, options) => {
      try {
        const configService = new ConfigService();
        const auth = await configService.getAuth(options.profile);
        
        if (!auth) {
          console.error(chalk.red('Not authenticated. Run "n8n-mcp auth login" first.'));
          process.exit(1);
        }

        const workflowService = new WorkflowService(auth);
        
        // Read workflow file
        let workflowData;
        try {
          const content = await fs.readFile(file, 'utf-8');
          workflowData = JSON.parse(content);
        } catch (error) {
          console.error(chalk.red(`Failed to read file: ${file}`));
          process.exit(1);
        }

        const spinner = ora('Updating workflow...').start();

        try {
          const workflow = await workflowService.update(id, workflowData);
          spinner.succeed(chalk.green('Workflow updated successfully!'));
          console.log(chalk.gray(`ID: ${workflow.id}`));
          console.log(chalk.gray(`Name: ${workflow.name}`));
        } catch (error: any) {
          spinner.fail(chalk.red('Failed to update workflow'));
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  workflow
    .command('delete <id>')
    .alias('rm')
    .description('Delete workflow')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .option('-f, --force', 'Skip confirmation')
    .action(async (id, options) => {
      try {
        const configService = new ConfigService();
        const auth = await configService.getAuth(options.profile);
        
        if (!auth) {
          console.error(chalk.red('Not authenticated. Run "n8n-mcp auth login" first.'));
          process.exit(1);
        }

        const workflowService = new WorkflowService(auth);

        if (!options.force) {
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Are you sure you want to delete workflow ${id}?`,
              default: false
            }
          ]);

          if (!confirm) {
            console.log(chalk.yellow('Deletion cancelled'));
            return;
          }
        }

        const spinner = ora('Deleting workflow...').start();

        try {
          await workflowService.delete(id);
          spinner.succeed(chalk.green('Workflow deleted successfully!'));
        } catch (error: any) {
          spinner.fail(chalk.red('Failed to delete workflow'));
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  workflow
    .command('activate <id>')
    .description('Activate workflow')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .action(async (id, options) => {
      try {
        const configService = new ConfigService();
        const auth = await configService.getAuth(options.profile);
        
        if (!auth) {
          console.error(chalk.red('Not authenticated. Run "n8n-mcp auth login" first.'));
          process.exit(1);
        }

        const workflowService = new WorkflowService(auth);
        const spinner = ora('Activating workflow...').start();

        try {
          await workflowService.activate(id);
          spinner.succeed(chalk.green('Workflow activated successfully!'));
        } catch (error: any) {
          spinner.fail(chalk.red('Failed to activate workflow'));
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  workflow
    .command('deactivate <id>')
    .description('Deactivate workflow')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .action(async (id, options) => {
      try {
        const configService = new ConfigService();
        const auth = await configService.getAuth(options.profile);
        
        if (!auth) {
          console.error(chalk.red('Not authenticated. Run "n8n-mcp auth login" first.'));
          process.exit(1);
        }

        const workflowService = new WorkflowService(auth);
        const spinner = ora('Deactivating workflow...').start();

        try {
          await workflowService.deactivate(id);
          spinner.succeed(chalk.green('Workflow deactivated successfully!'));
        } catch (error: any) {
          spinner.fail(chalk.red('Failed to deactivate workflow'));
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  workflow
    .command('execute <id>')
    .alias('run')
    .description('Execute workflow')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .option('-d, --data <data>', 'Input data (JSON string)')
    .option('-f, --file <file>', 'Input data file')
    .option('--wait', 'Wait for execution to complete')
    .action(async (id, options) => {
      try {
        const configService = new ConfigService();
        const auth = await configService.getAuth(options.profile);
        
        if (!auth) {
          console.error(chalk.red('Not authenticated. Run "n8n-mcp auth login" first.'));
          process.exit(1);
        }

        const workflowService = new WorkflowService(auth);
        
        // Parse input data
        let inputData = {};
        if (options.data) {
          try {
            inputData = JSON.parse(options.data);
          } catch (error) {
            console.error(chalk.red('Invalid JSON data'));
            process.exit(1);
          }
        } else if (options.file) {
          try {
            const content = await fs.readFile(options.file, 'utf-8');
            inputData = JSON.parse(content);
          } catch (error) {
            console.error(chalk.red(`Failed to read file: ${options.file}`));
            process.exit(1);
          }
        }

        const spinner = ora('Executing workflow...').start();

        try {
          const execution = await workflowService.execute(id, inputData);
          
          if (options.wait) {
            spinner.text = 'Waiting for execution to complete...';
            const result = await workflowService.waitForExecution(execution.id);
            spinner.succeed(chalk.green('Workflow execution completed!'));
            console.log(chalk.gray(`Execution ID: ${result.id}`));
            console.log(chalk.gray(`Status: ${result.status}`));
            if (result.data) {
              console.log(chalk.bold('\nOutput:'));
              console.log(JSON.stringify(result.data, null, 2));
            }
          } else {
            spinner.succeed(chalk.green('Workflow execution started!'));
            console.log(chalk.gray(`Execution ID: ${execution.id}`));
            console.log(chalk.gray('Use "n8n-mcp execution get <id>" to check status'));
          }
        } catch (error: any) {
          spinner.fail(chalk.red('Failed to execute workflow'));
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });
}

// Import inquirer for delete confirmation
import inquirer from 'inquirer';