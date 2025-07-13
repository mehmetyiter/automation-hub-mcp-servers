import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

export async function initCommand(options: any) {
  try {
    console.log(chalk.bold('\n🚀 Initialize n8n-MCP Project\n'));

    // Get project details
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Project name:',
        default: options.name || path.basename(process.cwd()),
        validate: (input) => {
          if (!input.trim()) return 'Project name is required';
          if (!/^[a-z0-9-_]+$/i.test(input)) {
            return 'Project name can only contain letters, numbers, hyphens, and underscores';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'description',
        message: 'Project description:',
        default: 'My n8n-MCP automation project'
      },
      {
        type: 'list',
        name: 'template',
        message: 'Project template:',
        choices: [
          { name: 'Basic - Simple workflow structure', value: 'basic' },
          { name: 'Advanced - Full project with testing', value: 'advanced' },
          { name: 'Integration - Custom node development', value: 'integration' },
          { name: 'SDK - SDK-based application', value: 'sdk' }
        ],
        default: options.template || 'basic'
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Additional features:',
        choices: [
          { name: 'TypeScript support', value: 'typescript', checked: true },
          { name: 'ESLint configuration', value: 'eslint', checked: true },
          { name: 'Git repository', value: 'git', checked: true },
          { name: 'Docker support', value: 'docker' },
          { name: 'CI/CD workflows', value: 'cicd' },
          { name: 'Testing setup', value: 'testing' }
        ]
      }
    ]);

    const projectDir = path.join(process.cwd(), answers.name);

    // Check if directory exists
    try {
      await fs.access(projectDir);
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: `Directory '${answers.name}' already exists. Overwrite?`,
          default: false
        }
      ]);

      if (!overwrite) {
        console.log(chalk.yellow('Initialization cancelled'));
        return;
      }
    } catch {
      // Directory doesn't exist, proceed
    }

    const spinner = ora('Creating project structure...').start();

    try {
      // Create project directory
      await fs.mkdir(projectDir, { recursive: true });

      // Create base structure based on template
      await createProjectStructure(projectDir, answers);

      spinner.text = 'Generating configuration files...';

      // Generate configuration files
      await generateConfigFiles(projectDir, answers);

      // Initialize git if requested
      if (answers.features.includes('git')) {
        spinner.text = 'Initializing git repository...';
        execSync('git init', { cwd: projectDir });
        await createGitignore(projectDir);
      }

      spinner.succeed(chalk.green('Project created successfully!'));

      // Install dependencies if not skipped
      if (!options.skipInstall && answers.template !== 'basic') {
        const installSpinner = ora('Installing dependencies...').start();
        try {
          execSync('npm install', { cwd: projectDir, stdio: 'pipe' });
          installSpinner.succeed(chalk.green('Dependencies installed'));
        } catch (error) {
          installSpinner.fail(chalk.yellow('Failed to install dependencies'));
          console.log(chalk.gray('Run "npm install" manually'));
        }
      }

      // Display next steps
      console.log(chalk.bold('\n✨ Project initialized!\n'));
      console.log(chalk.cyan('Next steps:'));
      console.log(chalk.gray(`  cd ${answers.name}`));
      
      if (options.skipInstall && answers.template !== 'basic') {
        console.log(chalk.gray('  npm install'));
      }
      
      console.log(chalk.gray('  n8n-mcp auth login'));
      console.log(chalk.gray('  n8n-mcp workflow create workflows/example.json'));
      
      console.log(chalk.bold('\n📚 Resources:'));
      console.log(chalk.gray('  Documentation: https://docs.n8n-mcp.com'));
      console.log(chalk.gray('  Examples: https://github.com/n8n-mcp/examples'));
      console.log(chalk.gray('  Support: https://community.n8n-mcp.com'));

    } catch (error: any) {
      spinner.fail(chalk.red('Failed to create project'));
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  } catch (error: any) {
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

async function createProjectStructure(projectDir: string, options: any) {
  const dirs = ['workflows'];

  if (options.template === 'advanced' || options.template === 'sdk') {
    dirs.push('src', 'dist', 'tests', 'docs');
  }

  if (options.template === 'integration') {
    dirs.push('nodes', 'credentials', 'src', 'dist');
  }

  if (options.features.includes('docker')) {
    dirs.push('docker');
  }

  // Create directories
  for (const dir of dirs) {
    await fs.mkdir(path.join(projectDir, dir), { recursive: true });
  }

  // Create example workflow
  const exampleWorkflow = {
    name: 'Example Workflow',
    nodes: [
      {
        id: 'webhook',
        type: 'webhook',
        position: [100, 100],
        parameters: {
          path: '/webhook',
          method: 'POST'
        }
      },
      {
        id: 'transform',
        type: 'transform',
        position: [300, 100],
        parameters: {
          expression: 'return { message: "Hello from n8n-MCP!", data: item }'
        }
      }
    ],
    connections: {
      webhook: [
        {
          node: 'transform',
          type: 'main',
          index: 0
        }
      ]
    }
  };

  await fs.writeFile(
    path.join(projectDir, 'workflows', 'example.json'),
    JSON.stringify(exampleWorkflow, null, 2)
  );

  // Create README
  const readme = `# ${options.name}

${options.description}

## Getting Started

1. Authenticate with n8n-MCP:
   \`\`\`bash
   n8n-mcp auth login
   \`\`\`

2. Deploy the example workflow:
   \`\`\`bash
   n8n-mcp deploy workflow workflows/example.json
   \`\`\`

3. List your workflows:
   \`\`\`bash
   n8n-mcp workflow list
   \`\`\`

## Project Structure

- \`workflows/\` - Workflow JSON files
${options.template !== 'basic' ? '- `src/` - Source code\n- `dist/` - Compiled code' : ''}
${options.features.includes('testing') ? '- `tests/` - Test files' : ''}
${options.features.includes('docker') ? '- `docker/` - Docker configuration' : ''}

## Commands

- \`n8n-mcp workflow list\` - List all workflows
- \`n8n-mcp workflow create <file>\` - Create workflow from file
- \`n8n-mcp workflow execute <id>\` - Execute a workflow
- \`n8n-mcp logs workflow <id> -f\` - Follow workflow logs

## Resources

- [Documentation](https://docs.n8n-mcp.com)
- [API Reference](https://api.n8n-mcp.com/docs)
- [Examples](https://github.com/n8n-mcp/examples)
`;

  await fs.writeFile(path.join(projectDir, 'README.md'), readme);
}

async function generateConfigFiles(projectDir: string, options: any) {
  // Package.json
  const packageJson = {
    name: options.name,
    version: '1.0.0',
    description: options.description,
    scripts: {
      deploy: 'n8n-mcp deploy directory workflows',
      'deploy:watch': 'n8n-mcp deploy directory workflows --watch',
      sync: 'n8n-mcp deploy sync --pull',
      logs: 'n8n-mcp logs system -f'
    },
    keywords: ['n8n-mcp', 'automation', 'workflow'],
    author: '',
    license: 'MIT'
  };

  if (options.template !== 'basic') {
    packageJson.scripts = {
      ...packageJson.scripts,
      build: 'tsc',
      dev: 'tsc --watch',
      lint: 'eslint src --ext .ts',
      test: 'jest'
    };

    packageJson['devDependencies'] = {
      '@types/node': '^20.10.0',
      'typescript': '^5.3.2',
      '@typescript-eslint/eslint-plugin': '^6.13.0',
      '@typescript-eslint/parser': '^6.13.0',
      'eslint': '^8.55.0'
    };

    if (options.features.includes('testing')) {
      packageJson['devDependencies']['jest'] = '^29.7.0';
      packageJson['devDependencies']['ts-jest'] = '^29.1.1';
      packageJson['devDependencies']['@types/jest'] = '^29.5.11';
    }

    packageJson['dependencies'] = {
      '@n8n-mcp/sdk': '^1.0.0'
    };
  }

  await fs.writeFile(
    path.join(projectDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // TypeScript config
  if (options.features.includes('typescript')) {
    const tsConfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'commonjs',
        lib: ['ES2020'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist']
    };

    await fs.writeFile(
      path.join(projectDir, 'tsconfig.json'),
      JSON.stringify(tsConfig, null, 2)
    );
  }

  // ESLint config
  if (options.features.includes('eslint')) {
    const eslintConfig = {
      parser: '@typescript-eslint/parser',
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended'
      ],
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
      },
      rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'warn'
      }
    };

    await fs.writeFile(
      path.join(projectDir, '.eslintrc.json'),
      JSON.stringify(eslintConfig, null, 2)
    );
  }

  // n8n-mcp config
  const n8nConfig = {
    version: '1.0',
    project: {
      name: options.name,
      description: options.description
    },
    workflows: {
      directory: './workflows',
      naming: 'kebab-case'
    },
    deploy: {
      activateOnDeploy: false,
      validateBeforeDeploy: true
    }
  };

  await fs.writeFile(
    path.join(projectDir, 'n8n-mcp.json'),
    JSON.stringify(n8nConfig, null, 2)
  );

  // Docker files
  if (options.features.includes('docker')) {
    const dockerfile = `FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

CMD ["n8n-mcp", "deploy", "sync", "--watch"]
`;

    await fs.writeFile(path.join(projectDir, 'Dockerfile'), dockerfile);

    const dockerCompose = `version: '3.8'

services:
  n8n-mcp:
    build: .
    environment:
      - N8N_MCP_API_KEY=\${N8N_MCP_API_KEY}
      - N8N_MCP_API_URL=\${N8N_MCP_API_URL:-https://api.n8n-mcp.com}
    volumes:
      - ./workflows:/app/workflows
    restart: unless-stopped
`;

    await fs.writeFile(
      path.join(projectDir, 'docker-compose.yml'),
      dockerCompose
    );
  }

  // CI/CD workflows
  if (options.features.includes('cicd')) {
    await fs.mkdir(path.join(projectDir, '.github', 'workflows'), { recursive: true });

    const githubWorkflow = `name: Deploy Workflows

on:
  push:
    branches: [main]
    paths:
      - 'workflows/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install n8n-MCP CLI
      run: npm install -g @n8n-mcp/cli
      
    - name: Deploy workflows
      env:
        N8N_MCP_API_KEY: \${{ secrets.N8N_MCP_API_KEY }}
      run: |
        n8n-mcp auth login --api-key "$N8N_MCP_API_KEY"
        n8n-mcp deploy directory workflows --activate
`;

    await fs.writeFile(
      path.join(projectDir, '.github', 'workflows', 'deploy.yml'),
      githubWorkflow
    );
  }

  // Test setup
  if (options.features.includes('testing')) {
    const jestConfig = {
      preset: 'ts-jest',
      testEnvironment: 'node',
      roots: ['<rootDir>/tests'],
      testMatch: ['**/*.test.ts'],
      collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts'
      ]
    };

    await fs.writeFile(
      path.join(projectDir, 'jest.config.js'),
      `module.exports = ${JSON.stringify(jestConfig, null, 2)}`
    );

    // Example test
    const exampleTest = `import { N8nMcpClient } from '@n8n-mcp/sdk';

describe('Workflow Tests', () => {
  let client: N8nMcpClient;

  beforeAll(() => {
    client = new N8nMcpClient({
      apiKey: process.env.N8N_MCP_API_KEY || 'test-key'
    });
  });

  test('should list workflows', async () => {
    const workflows = await client.workflows.list();
    expect(workflows).toBeDefined();
    expect(workflows.data).toBeInstanceOf(Array);
  });
});
`;

    await fs.writeFile(
      path.join(projectDir, 'tests', 'workflow.test.ts'),
      exampleTest
    );
  }
}

async function createGitignore(projectDir: string) {
  const gitignore = `# Dependencies
node_modules/

# Build output
dist/
*.tsbuildinfo

# Environment files
.env
.env.local
.env.*.local

# Logs
logs/
*.log
npm-debug.log*

# Editor directories
.vscode/
.idea/
*.swp
*.swo
*~

# OS files
.DS_Store
Thumbs.db

# Test coverage
coverage/
.nyc_output/

# Temporary files
tmp/
temp/
`;

  await fs.writeFile(path.join(projectDir, '.gitignore'), gitignore);
}