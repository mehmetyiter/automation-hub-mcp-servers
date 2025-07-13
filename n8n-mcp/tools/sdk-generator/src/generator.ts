import { OpenAPIV3 } from 'openapi-types';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import { ESLint } from 'eslint';
import { format as prettierFormat } from 'prettier';

export interface SDKOptions {
  outputDir: string;
  packageName?: string;
  packageVersion?: string;
  author?: string;
  license?: string;
  includeExamples?: boolean;
  includeTests?: boolean;
  includeTypes?: boolean;
  customHeaders?: Record<string, string>;
  baseUrl?: string;
  clientName?: string;
}

export interface Template {
  name: string;
  files: TemplateFile[];
  helpers?: Record<string, Handlebars.HelperDelegate>;
}

export interface TemplateFile {
  path: string;
  template: string;
  condition?: (options: SDKOptions) => boolean;
}

export class SDKGenerator {
  private spec: OpenAPIV3.Document;
  private templates: Map<string, Template>;
  
  constructor(spec: OpenAPIV3.Document | string) {
    // Load spec if string path provided
    if (typeof spec === 'string') {
      this.spec = this.loadSpec(spec);
    } else {
      this.spec = spec;
    }
    
    this.templates = new Map();
    this.loadTemplates();
    this.registerHelpers();
  }

  private loadSpec(specPath: string): OpenAPIV3.Document {
    const content = fs.readFileSync(specPath, 'utf8');
    
    if (specPath.endsWith('.yaml') || specPath.endsWith('.yml')) {
      const yaml = require('js-yaml');
      return yaml.load(content) as OpenAPIV3.Document;
    }
    
    return JSON.parse(content) as OpenAPIV3.Document;
  }

  private loadTemplates(): void {
    const templatesDir = path.join(__dirname, '../templates');
    const languages = fs.readdirSync(templatesDir);
    
    for (const lang of languages) {
      const langDir = path.join(templatesDir, lang);
      if (fs.statSync(langDir).isDirectory()) {
        const template = this.loadLanguageTemplate(lang, langDir);
        this.templates.set(lang, template);
      }
    }
  }

  private loadLanguageTemplate(language: string, dir: string): Template {
    const configPath = path.join(dir, 'template.json');
    const config = fs.readJsonSync(configPath);
    
    const files: TemplateFile[] = [];
    
    for (const fileConfig of config.files) {
      const templateContent = fs.readFileSync(
        path.join(dir, fileConfig.template),
        'utf8'
      );
      
      files.push({
        path: fileConfig.output,
        template: templateContent,
        condition: fileConfig.condition
      });
    }
    
    return {
      name: language,
      files,
      helpers: config.helpers
    };
  }

  private registerHelpers(): void {
    // Register common Handlebars helpers
    Handlebars.registerHelper('camelCase', (str: string) => {
      return str.replace(/-([a-z])/g, g => g[1].toUpperCase());
    });
    
    Handlebars.registerHelper('pascalCase', (str: string) => {
      const camel = str.replace(/-([a-z])/g, g => g[1].toUpperCase());
      return camel.charAt(0).toUpperCase() + camel.slice(1);
    });
    
    Handlebars.registerHelper('snakeCase', (str: string) => {
      return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`).slice(1);
    });
    
    Handlebars.registerHelper('upperCase', (str: string) => {
      return str.toUpperCase();
    });
    
    Handlebars.registerHelper('lowerCase', (str: string) => {
      return str.toLowerCase();
    });
    
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);
    Handlebars.registerHelper('ne', (a: any, b: any) => a !== b);
    Handlebars.registerHelper('lt', (a: any, b: any) => a < b);
    Handlebars.registerHelper('gt', (a: any, b: any) => a > b);
    Handlebars.registerHelper('and', (a: any, b: any) => a && b);
    Handlebars.registerHelper('or', (a: any, b: any) => a || b);
    
    Handlebars.registerHelper('json', (obj: any) => {
      return JSON.stringify(obj, null, 2);
    });
    
    Handlebars.registerHelper('httpMethod', (method: string) => {
      return method.toUpperCase();
    });
    
    Handlebars.registerHelper('getType', (schema: any, language: string) => {
      return this.getTypeForLanguage(schema, language);
    });
  }

  async generateSDK(language: string, options: SDKOptions): Promise<void> {
    const template = this.templates.get(language);
    
    if (!template) {
      throw new Error(`Unsupported language: ${language}`);
    }
    
    // Prepare output directory
    await fs.ensureDir(options.outputDir);
    
    // Prepare template data
    const templateData = this.prepareTemplateData(language, options);
    
    // Generate files
    for (const file of template.files) {
      // Check condition if exists
      if (file.condition && !file.condition(options)) {
        continue;
      }
      
      // Compile template
      const compiledTemplate = Handlebars.compile(file.template);
      const content = compiledTemplate(templateData);
      
      // Determine output path
      const outputPath = path.join(
        options.outputDir,
        this.resolveTemplatePath(file.path, templateData)
      );
      
      // Ensure directory exists
      await fs.ensureDir(path.dirname(outputPath));
      
      // Format code based on file extension
      const formattedContent = await this.formatCode(content, outputPath, language);
      
      // Write file
      await fs.writeFile(outputPath, formattedContent);
      
      console.log(`Generated: ${outputPath}`);
    }
    
    // Generate additional files based on options
    if (options.includeTests) {
      await this.generateTests(language, options, templateData);
    }
    
    if (options.includeExamples) {
      await this.generateExamples(language, options, templateData);
    }
    
    // Run post-generation tasks
    await this.runPostGeneration(language, options);
  }

  private prepareTemplateData(language: string, options: SDKOptions): any {
    const endpoints = this.extractEndpoints();
    const models = this.extractModels();
    
    return {
      spec: this.spec,
      info: {
        ...this.spec.info,
        packageName: options.packageName || this.getDefaultPackageName(language),
        packageVersion: options.packageVersion || this.spec.info.version,
        clientName: options.clientName || this.getDefaultClientName(),
        author: options.author || 'n8n-MCP SDK Generator',
        license: options.license || 'MIT'
      },
      servers: this.spec.servers || [{
        url: options.baseUrl || 'https://api.n8n-mcp.com',
        description: 'Default server'
      }],
      endpoints,
      models,
      options,
      language,
      generatedAt: new Date().toISOString(),
      hasAuth: !!this.spec.components?.securitySchemes,
      authSchemes: this.spec.components?.securitySchemes || {}
    };
  }

  private extractEndpoints(): any[] {
    const endpoints: any[] = [];
    
    for (const [path, pathItem of Object.entries(this.spec.paths || {})] {
      for (const [method, operation] of Object.entries(pathItem as any)) {
        if (typeof operation === 'object' && operation.operationId) {
          endpoints.push({
            path,
            method: method.toUpperCase(),
            operationId: operation.operationId,
            summary: operation.summary,
            description: operation.description,
            tags: operation.tags || [],
            parameters: [
              ...(pathItem.parameters || []),
              ...(operation.parameters || [])
            ],
            requestBody: operation.requestBody,
            responses: operation.responses,
            security: operation.security || this.spec.security,
            // Custom properties for templates
            functionName: this.generateFunctionName(operation.operationId),
            resourceName: this.getResourceName(operation.tags?.[0] || 'default'),
            hasPathParams: path.includes('{'),
            hasQueryParams: operation.parameters?.some(
              (p: any) => p.in === 'query'
            ),
            hasRequestBody: !!operation.requestBody,
            successResponse: this.getSuccessResponse(operation.responses)
          });
        }
      }
    }
    
    return endpoints;
  }

  private extractModels(): any[] {
    const models: any[] = [];
    const schemas = this.spec.components?.schemas || {};
    
    for (const [name, schema] of Object.entries(schemas)) {
      models.push({
        name,
        schema,
        // Custom properties for templates
        className: this.generateClassName(name),
        properties: this.extractProperties(schema as any),
        hasRequired: !!(schema as any).required?.length,
        isEnum: !!(schema as any).enum
      });
    }
    
    return models;
  }

  private extractProperties(schema: OpenAPIV3.SchemaObject): any[] {
    const properties: any[] = [];
    
    if (schema.properties) {
      for (const [name, propSchema] of Object.entries(schema.properties)) {
        properties.push({
          name,
          schema: propSchema,
          required: schema.required?.includes(name) || false,
          description: (propSchema as any).description,
          type: this.getSchemaType(propSchema as any),
          // Language-specific type will be determined by template
        });
      }
    }
    
    return properties;
  }

  private getSchemaType(schema: OpenAPIV3.SchemaObject): string {
    if (schema.type === 'array') {
      return `array<${this.getSchemaType((schema.items || {}) as any)}>`;
    }
    
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop() || 'unknown';
      return refName;
    }
    
    if (schema.allOf || schema.oneOf || schema.anyOf) {
      return 'object';
    }
    
    return schema.type || 'any';
  }

  private getTypeForLanguage(schema: any, language: string): string {
    const baseType = this.getSchemaType(schema);
    
    // Language-specific type mappings
    const typeMappings: Record<string, Record<string, string>> = {
      typescript: {
        'integer': 'number',
        'float': 'number',
        'double': 'number',
        'int32': 'number',
        'int64': 'number',
        'string': 'string',
        'boolean': 'boolean',
        'object': 'Record<string, any>',
        'any': 'any'
      },
      python: {
        'integer': 'int',
        'float': 'float',
        'double': 'float',
        'int32': 'int',
        'int64': 'int',
        'string': 'str',
        'boolean': 'bool',
        'object': 'Dict[str, Any]',
        'any': 'Any'
      },
      go: {
        'integer': 'int',
        'float': 'float64',
        'double': 'float64',
        'int32': 'int32',
        'int64': 'int64',
        'string': 'string',
        'boolean': 'bool',
        'object': 'map[string]interface{}',
        'any': 'interface{}'
      },
      java: {
        'integer': 'Integer',
        'float': 'Float',
        'double': 'Double',
        'int32': 'Integer',
        'int64': 'Long',
        'string': 'String',
        'boolean': 'Boolean',
        'object': 'Map<String, Object>',
        'any': 'Object'
      }
    };
    
    const mapping = typeMappings[language] || typeMappings.typescript;
    
    if (baseType.startsWith('array<')) {
      const itemType = baseType.slice(6, -1);
      const mappedItemType = mapping[itemType] || itemType;
      
      switch (language) {
        case 'typescript':
          return `${mappedItemType}[]`;
        case 'python':
          return `List[${mappedItemType}]`;
        case 'go':
          return `[]${mappedItemType}`;
        case 'java':
          return `List<${mappedItemType}>`;
        default:
          return `${mappedItemType}[]`;
      }
    }
    
    return mapping[baseType] || baseType;
  }

  private generateFunctionName(operationId: string): string {
    // Convert operationId to camelCase function name
    return operationId.replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  private generateClassName(name: string): string {
    // Convert schema name to PascalCase class name
    const camel = name.replace(/[-_]([a-z])/g, (_, letter) => letter.toUpperCase());
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  }

  private getResourceName(tag: string): string {
    // Convert tag to resource name (e.g., "API Keys" -> "apiKeys")
    const words = tag.split(/\s+/);
    return words.map((word, index) => {
      if (index === 0) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join('');
  }

  private getSuccessResponse(responses: any): any {
    // Find the success response (2xx)
    for (const [status, response] of Object.entries(responses || {})) {
      if (status.startsWith('2')) {
        return {
          status,
          response,
          hasContent: !!(response as any).content,
          contentType: Object.keys((response as any).content || {})[0],
          schema: (response as any).content?.['application/json']?.schema
        };
      }
    }
    
    return null;
  }

  private getDefaultPackageName(language: string): string {
    const baseName = 'n8n-mcp';
    
    switch (language) {
      case 'python':
        return baseName.replace(/-/g, '_');
      case 'java':
        return `com.n8nmcp.sdk`;
      case 'csharp':
        return 'N8nMcp.Sdk';
      case 'go':
        return 'n8nmcp';
      default:
        return `${baseName}-sdk`;
    }
  }

  private getDefaultClientName(): string {
    return 'N8nMcpClient';
  }

  private resolveTemplatePath(templatePath: string, data: any): string {
    // Replace template variables in path
    const compiled = Handlebars.compile(templatePath);
    return compiled(data);
  }

  private async formatCode(content: string, filePath: string, language: string): Promise<string> {
    const ext = path.extname(filePath).toLowerCase();
    
    try {
      switch (ext) {
        case '.ts':
        case '.tsx':
        case '.js':
        case '.jsx':
          return await prettierFormat(content, {
            parser: ext.includes('ts') ? 'typescript' : 'babel',
            semi: true,
            singleQuote: true,
            tabWidth: 2,
            trailingComma: 'es5'
          });
          
        case '.py':
          // Use black for Python formatting
          const { execSync } = require('child_process');
          const tempFile = path.join(require('os').tmpdir(), 'temp.py');
          await fs.writeFile(tempFile, content);
          
          try {
            execSync(`black --quiet ${tempFile}`);
            const formatted = await fs.readFile(tempFile, 'utf8');
            await fs.unlink(tempFile);
            return formatted;
          } catch {
            // Black not installed, return as-is
            return content;
          }
          
        case '.go':
          // Use gofmt for Go formatting
          const { execSync: goExecSync } = require('child_process');
          try {
            return goExecSync('gofmt', {
              input: content,
              encoding: 'utf8'
            });
          } catch {
            return content;
          }
          
        case '.java':
        case '.cs':
          // Basic formatting for Java/C#
          return content
            .replace(/\s*{\s*/g, ' {\n')
            .replace(/\s*}\s*/g, '\n}\n')
            .replace(/;\s*/g, ';\n')
            .replace(/\n\s*\n\s*\n/g, '\n\n');
          
        default:
          return content;
      }
    } catch (error) {
      console.warn(`Failed to format ${filePath}:`, error);
      return content;
    }
  }

  private async generateTests(language: string, options: SDKOptions, templateData: any): Promise<void> {
    const testTemplatesDir = path.join(__dirname, '../templates', language, 'tests');
    
    if (!await fs.pathExists(testTemplatesDir)) {
      console.warn(`No test templates found for ${language}`);
      return;
    }
    
    const testFiles = await fs.readdir(testTemplatesDir);
    
    for (const file of testFiles) {
      const templateContent = await fs.readFile(
        path.join(testTemplatesDir, file),
        'utf8'
      );
      
      const compiled = Handlebars.compile(templateContent);
      const content = compiled(templateData);
      
      const outputPath = path.join(
        options.outputDir,
        'tests',
        file.replace('.hbs', '')
      );
      
      await fs.ensureDir(path.dirname(outputPath));
      const formattedContent = await this.formatCode(content, outputPath, language);
      await fs.writeFile(outputPath, formattedContent);
      
      console.log(`Generated test: ${outputPath}`);
    }
  }

  private async generateExamples(language: string, options: SDKOptions, templateData: any): Promise<void> {
    const examplesTemplatesDir = path.join(__dirname, '../templates', language, 'examples');
    
    if (!await fs.pathExists(examplesTemplatesDir)) {
      console.warn(`No example templates found for ${language}`);
      return;
    }
    
    const exampleFiles = await fs.readdir(examplesTemplatesDir);
    
    for (const file of exampleFiles) {
      const templateContent = await fs.readFile(
        path.join(examplesTemplatesDir, file),
        'utf8'
      );
      
      const compiled = Handlebars.compile(templateContent);
      const content = compiled(templateData);
      
      const outputPath = path.join(
        options.outputDir,
        'examples',
        file.replace('.hbs', '')
      );
      
      await fs.ensureDir(path.dirname(outputPath));
      const formattedContent = await this.formatCode(content, outputPath, language);
      await fs.writeFile(outputPath, formattedContent);
      
      console.log(`Generated example: ${outputPath}`);
    }
  }

  private async runPostGeneration(language: string, options: SDKOptions): Promise<void> {
    const outputDir = options.outputDir;
    
    switch (language) {
      case 'typescript':
      case 'javascript':
        // Run npm install if package.json exists
        if (await fs.pathExists(path.join(outputDir, 'package.json'))) {
          console.log('Running npm install...');
          const { execSync } = require('child_process');
          execSync('npm install', { cwd: outputDir, stdio: 'inherit' });
        }
        
        // Run ESLint
        if (await fs.pathExists(path.join(outputDir, '.eslintrc.json'))) {
          console.log('Running ESLint...');
          const eslint = new ESLint({ cwd: outputDir });
          const results = await eslint.lintFiles(['src/**/*.{ts,js}']);
          
          const formatter = await eslint.loadFormatter('stylish');
          const resultText = formatter.format(results);
          
          if (resultText) {
            console.log(resultText);
          }
        }
        break;
        
      case 'python':
        // Create virtual environment and install dependencies
        if (await fs.pathExists(path.join(outputDir, 'requirements.txt'))) {
          console.log('Setting up Python environment...');
          const { execSync } = require('child_process');
          
          try {
            execSync('python -m venv venv', { cwd: outputDir, stdio: 'inherit' });
            const pip = process.platform === 'win32' 
              ? 'venv\\Scripts\\pip' 
              : 'venv/bin/pip';
            execSync(`${pip} install -r requirements.txt`, { 
              cwd: outputDir, 
              stdio: 'inherit' 
            });
          } catch (error) {
            console.warn('Failed to setup Python environment:', error);
          }
        }
        break;
        
      case 'go':
        // Run go mod init and go mod tidy
        if (await fs.pathExists(path.join(outputDir, 'go.mod'))) {
          console.log('Running go mod tidy...');
          const { execSync } = require('child_process');
          
          try {
            execSync('go mod tidy', { cwd: outputDir, stdio: 'inherit' });
          } catch (error) {
            console.warn('Failed to run go mod tidy:', error);
          }
        }
        break;
    }
    
    console.log(`\n✅ SDK generated successfully in: ${outputDir}`);
    console.log(`📚 Check the README.md file for usage instructions`);
  }

  getTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  getSupportedLanguages(): string[] {
    return this.getTemplates();
  }
}