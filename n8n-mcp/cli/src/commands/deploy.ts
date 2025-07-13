import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { DeployService } from '../services/deploy';
import { ConfigService } from '../services/config';

export function deployCommands(program: Command) {
  const deploy = program
    .command('deploy')
    .description('Deploy workflows and resources');

  deploy
    .command('workflow <file>')
    .description('Deploy workflow from file')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .option('-n, --name <name>', 'Override workflow name')
    .option('--activate', 'Activate workflow after deployment')
    .option('--update <id>', 'Update existing workflow')
    .action(async (file, options) => {
      try {
        const configService = new ConfigService();
        const auth = await configService.getAuth(options.profile);
        
        if (!auth) {
          console.error(chalk.red('Not authenticated. Run "n8n-mcp auth login" first.'));
          process.exit(1);
        }

        const deployService = new DeployService(auth);
        
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

        const spinner = ora('Deploying workflow...').start();

        try {
          let result;
          if (options.update) {
            result = await deployService.updateWorkflow(options.update, workflowData);
            spinner.succeed(chalk.green('Workflow updated successfully!'));
          } else {
            result = await deployService.createWorkflow(workflowData);
            spinner.succeed(chalk.green('Workflow deployed successfully!'));
          }
          
          console.log(chalk.gray(`ID: ${result.id}`));
          console.log(chalk.gray(`Name: ${result.name}`));
          console.log(chalk.gray(`Status: ${result.active ? 'Active' : 'Inactive'}`));
        } catch (error: any) {
          spinner.fail(chalk.red('Failed to deploy workflow'));
          console.error(chalk.red(error.message));
          process.exit(1);
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  deploy
    .command('directory <dir>')
    .description('Deploy all workflows in a directory')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .option('--pattern <pattern>', 'File pattern', '**/*.json')
    .option('--activate', 'Activate workflows after deployment')
    .option('--dry-run', 'Show what would be deployed')
    .action(async (dir, options) => {
      try {
        const configService = new ConfigService();
        const auth = await configService.getAuth(options.profile);
        
        if (!auth) {
          console.error(chalk.red('Not authenticated. Run "n8n-mcp auth login" first.'));
          process.exit(1);
        }

        const deployService = new DeployService(auth);
        
        // Find workflow files
        const pattern = path.join(dir, options.pattern);
        const files = await glob(pattern);
        
        if (files.length === 0) {
          console.log(chalk.yellow('No workflow files found'));
          return;
        }

        console.log(chalk.cyan(`Found ${files.length} workflow file(s)`));
        
        if (options.dryRun) {
          console.log(chalk.bold('\nFiles to deploy:'));
          files.forEach(file => console.log(chalk.gray(`  • ${file}`)));
          return;
        }

        // Confirm deployment
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Deploy ${files.length} workflow(s)?`,
            default: true
          }
        ]);

        if (!confirm) {
          console.log(chalk.yellow('Deployment cancelled'));
          return;
        }

        // Deploy workflows
        const results = {
          succeeded: 0,
          failed: 0,
          errors: [] as { file: string; error: string }[]
        };

        for (const file of files) {
          try {
            const content = await fs.readFile(file, 'utf-8');
            const workflowData = JSON.parse(content);
            
            if (options.activate) {
              workflowData.active = true;
            }

            const spinner = ora(`Deploying ${path.basename(file)}...`).start();
            
            try {
              await deployService.createWorkflow(workflowData);
              spinner.succeed(chalk.green(`✓ ${path.basename(file)}`));
              results.succeeded++;
            } catch (error: any) {
              spinner.fail(chalk.red(`✖ ${path.basename(file)}`));
              results.failed++;
              results.errors.push({
                file: path.basename(file),
                error: error.message
              });
            }
          } catch (error: any) {
            console.error(chalk.red(`✖ ${path.basename(file)} - Invalid JSON`));
            results.failed++;
            results.errors.push({
              file: path.basename(file),
              error: 'Invalid JSON'
            });
          }
        }

        // Summary
        console.log(chalk.bold('\nDeployment Summary:'));
        console.log(chalk.green(`  ✓ Succeeded: ${results.succeeded}`));
        console.log(chalk.red(`  ✖ Failed: ${results.failed}`));
        
        if (results.errors.length > 0) {
          console.log(chalk.bold('\nErrors:'));
          results.errors.forEach(({ file, error }) => {
            console.log(chalk.red(`  • ${file}: ${error}`));
          });
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });

  deploy
    .command('sync')
    .description('Sync local workflows with remote')
    .option('-p, --profile <profile>', 'Profile name', 'default')
    .option('-d, --directory <dir>', 'Local directory', './workflows')
    .option('--pull', 'Pull remote workflows to local')
    .option('--push', 'Push local workflows to remote')
    .option('--force', 'Force overwrite conflicts')
    .action(async (options) => {
      try {
        const configService = new ConfigService();
        const auth = await configService.getAuth(options.profile);
        
        if (!auth) {
          console.error(chalk.red('Not authenticated. Run "n8n-mcp auth login" first.'));
          process.exit(1);
        }

        const deployService = new DeployService(auth);
        
        if (!options.pull && !options.push) {
          console.error(chalk.red('Specify --pull or --push'));
          process.exit(1);
        }

        if (options.pull) {
          const spinner = ora('Fetching remote workflows...').start();
          
          try {
            const workflows = await deployService.listAllWorkflows();
            spinner.succeed(chalk.green(`Found ${workflows.length} remote workflow(s)`));
            
            // Ensure directory exists
            await fs.mkdir(options.directory, { recursive: true });
            
            // Save workflows
            for (const workflow of workflows) {
              const filename = `${workflow.name.toLowerCase().replace(/\s+/g, '-')}-${workflow.id}.json`;
              const filepath = path.join(options.directory, filename);
              
              if (!options.force) {
                // Check if file exists
                try {
                  await fs.access(filepath);
                  const { overwrite } = await inquirer.prompt([
                    {
                      type: 'confirm',
                      name: 'overwrite',
                      message: `Overwrite ${filename}?`,
                      default: false
                    }
                  ]);
                  
                  if (!overwrite) {
                    console.log(chalk.yellow(`Skipped ${filename}`));
                    continue;
                  }
                } catch {
                  // File doesn't exist, proceed
                }
              }
              
              await fs.writeFile(filepath, JSON.stringify(workflow, null, 2));
              console.log(chalk.green(`✓ Saved ${filename}`));
            }
            
            console.log(chalk.bold(`\n✓ Synced ${workflows.length} workflow(s) to ${options.directory}`));
          } catch (error: any) {
            spinner.fail(chalk.red('Failed to pull workflows'));
            console.error(chalk.red(error.message));
            process.exit(1);
          }
        }

        if (options.push) {
          const pattern = path.join(options.directory, '**/*.json');
          const files = await glob(pattern);
          
          if (files.length === 0) {
            console.log(chalk.yellow('No local workflows found'));
            return;
          }

          console.log(chalk.cyan(`Found ${files.length} local workflow(s)`));
          
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Push ${files.length} workflow(s) to remote?`,
              default: true
            }
          ]);

          if (!confirm) {
            console.log(chalk.yellow('Push cancelled'));
            return;
          }

          const results = {
            created: 0,
            updated: 0,
            failed: 0
          };

          for (const file of files) {
            try {
              const content = await fs.readFile(file, 'utf-8');
              const workflowData = JSON.parse(content);
              
              const spinner = ora(`Pushing ${path.basename(file)}...`).start();
              
              try {
                // Check if workflow exists
                if (workflowData.id) {
                  try {
                    await deployService.updateWorkflow(workflowData.id, workflowData);
                    spinner.succeed(chalk.green(`✓ Updated ${path.basename(file)}`));
                    results.updated++;
                  } catch {
                    // Workflow doesn't exist, create it
                    delete workflowData.id;
                    await deployService.createWorkflow(workflowData);
                    spinner.succeed(chalk.green(`✓ Created ${path.basename(file)}`));
                    results.created++;
                  }
                } else {
                  await deployService.createWorkflow(workflowData);
                  spinner.succeed(chalk.green(`✓ Created ${path.basename(file)}`));
                  results.created++;
                }
              } catch (error: any) {
                spinner.fail(chalk.red(`✖ Failed ${path.basename(file)}`));
                results.failed++;
              }
            } catch {
              console.error(chalk.red(`✖ ${path.basename(file)} - Invalid JSON`));
              results.failed++;
            }
          }

          console.log(chalk.bold('\nPush Summary:'));
          console.log(chalk.green(`  ✓ Created: ${results.created}`));
          console.log(chalk.green(`  ✓ Updated: ${results.updated}`));
          console.log(chalk.red(`  ✖ Failed: ${results.failed}`));
        }
      } catch (error: any) {
        console.error(chalk.red(error.message));
        process.exit(1);
      }
    });
}