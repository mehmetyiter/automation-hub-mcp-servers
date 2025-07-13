import SwaggerParser from '@apidevtools/swagger-parser';
import { marked } from 'marked';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { renderMermaid } from '../utils/mermaid';
import { highlightCode } from '../utils/syntax-highlighter';

export interface ApiDocsOptions {
  input: string;
  output: string;
  format: 'markdown' | 'html' | 'pdf';
  theme?: string;
  includeExamples?: boolean;
  includeTryIt?: boolean;
}

export class ApiDocsGenerator {
  async generate(options: ApiDocsOptions): Promise<void> {
    const spinner = ora('Parsing OpenAPI specification...').start();
    
    try {
      // Parse OpenAPI spec
      const api = await SwaggerParser.parse(options.input);
      const spec = await SwaggerParser.dereference(api);
      
      spinner.text = 'Generating documentation...';
      
      // Create output directory
      await fs.mkdir(options.output, { recursive: true });
      
      // Generate documentation based on format
      switch (options.format) {
        case 'markdown':
          await this.generateMarkdown(spec, options);
          break;
        case 'html':
          await this.generateHTML(spec, options);
          break;
        case 'pdf':
          await this.generatePDF(spec, options);
          break;
      }
      
      spinner.succeed('API documentation generated');
    } catch (error) {
      spinner.fail('Failed to generate API documentation');
      throw error;
    }
  }

  async generateFromConfig(configFile: string): Promise<void> {
    const config = JSON.parse(await fs.readFile(configFile, 'utf-8'));
    await this.generate(config.api);
  }

  private async generateMarkdown(spec: any, options: ApiDocsOptions): Promise<void> {
    const content: string[] = [];
    
    // Title and description
    content.push(`# ${spec.info.title}\n`);
    content.push(`Version: ${spec.info.version}\n`);
    if (spec.info.description) {
      content.push(`\n${spec.info.description}\n`);
    }
    
    // Servers
    if (spec.servers && spec.servers.length > 0) {
      content.push('\n## Servers\n');
      spec.servers.forEach((server: any) => {
        content.push(`- ${server.description || 'Production'}: \`${server.url}\``);
      });
    }
    
    // Authentication
    if (spec.components?.securitySchemes) {
      content.push('\n## Authentication\n');
      for (const [name, scheme] of Object.entries(spec.components.securitySchemes)) {
        const s = scheme as any;
        content.push(`### ${name}\n`);
        content.push(`- **Type**: ${s.type}`);
        if (s.type === 'apiKey') {
          content.push(`- **In**: ${s.in}`);
          content.push(`- **Name**: ${s.name}`);
        } else if (s.type === 'oauth2') {
          content.push(`- **Flows**: ${Object.keys(s.flows).join(', ')}`);
        }
        content.push('');
      }
    }
    
    // Endpoints
    content.push('\n## Endpoints\n');
    
    // Group by tags
    const endpointsByTag: Record<string, any[]> = {};
    
    for (const [path, pathItem] of Object.entries(spec.paths || {})) {
      for (const [method, operation] of Object.entries(pathItem as any)) {
        if (['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(method)) {
          const op = operation as any;
          const tags = op.tags || ['Default'];
          
          tags.forEach((tag: string) => {
            if (!endpointsByTag[tag]) {
              endpointsByTag[tag] = [];
            }
            endpointsByTag[tag].push({ path, method, operation: op });
          });
        }
      }
    }
    
    // Generate documentation for each tag
    for (const [tag, endpoints] of Object.entries(endpointsByTag)) {
      content.push(`\n### ${tag}\n`);
      
      for (const { path, method, operation } of endpoints) {
        content.push(`\n#### ${operation.summary || `${method.toUpperCase()} ${path}`}\n`);
        
        content.push(`\`${method.toUpperCase()} ${path}\`\n`);
        
        if (operation.description) {
          content.push(`\n${operation.description}\n`);
        }
        
        // Parameters
        if (operation.parameters && operation.parameters.length > 0) {
          content.push('\n**Parameters:**\n');
          content.push('| Name | In | Type | Required | Description |');
          content.push('|------|-----|------|----------|-------------|');
          
          operation.parameters.forEach((param: any) => {
            const required = param.required ? 'Yes' : 'No';
            const type = param.schema?.type || 'string';
            content.push(`| ${param.name} | ${param.in} | ${type} | ${required} | ${param.description || '-'} |`);
          });
          content.push('');
        }
        
        // Request body
        if (operation.requestBody) {
          content.push('\n**Request Body:**\n');
          const rb = operation.requestBody;
          
          if (rb.content) {
            for (const [contentType, mediaType] of Object.entries(rb.content)) {
              content.push(`- **Content-Type**: ${contentType}`);
              
              if (mediaType.schema) {
                content.push('\n```json');
                content.push(JSON.stringify(this.generateSchemaExample(mediaType.schema), null, 2));
                content.push('```\n');
              }
            }
          }
        }
        
        // Responses
        content.push('\n**Responses:**\n');
        
        for (const [statusCode, response] of Object.entries(operation.responses || {})) {
          const res = response as any;
          content.push(`\n**${statusCode}** - ${res.description || 'Success'}\n`);
          
          if (res.content) {
            for (const [contentType, mediaType] of Object.entries(res.content)) {
              if (mediaType.schema) {
                content.push('```json');
                content.push(JSON.stringify(this.generateSchemaExample(mediaType.schema), null, 2));
                content.push('```\n');
              }
            }
          }
        }
        
        // Example
        if (options.includeExamples !== false) {
          content.push('\n**Example:**\n');
          content.push('```bash');
          content.push(this.generateCurlExample(spec, path, method, operation));
          content.push('```\n');
        }
      }
    }
    
    // Models/Schemas
    if (spec.components?.schemas) {
      content.push('\n## Models\n');
      
      for (const [name, schema] of Object.entries(spec.components.schemas)) {
        content.push(`\n### ${name}\n`);
        
        const s = schema as any;
        if (s.description) {
          content.push(`${s.description}\n`);
        }
        
        content.push('\n```json');
        content.push(JSON.stringify(this.generateSchemaExample(s), null, 2));
        content.push('```\n');
        
        if (s.properties) {
          content.push('\n**Properties:**\n');
          content.push('| Property | Type | Required | Description |');
          content.push('|----------|------|----------|-------------|');
          
          for (const [propName, prop] of Object.entries(s.properties)) {
            const p = prop as any;
            const required = s.required?.includes(propName) ? 'Yes' : 'No';
            const type = p.type || 'object';
            content.push(`| ${propName} | ${type} | ${required} | ${p.description || '-'} |`);
          }
          content.push('');
        }
      }
    }
    
    // Write main file
    await fs.writeFile(
      path.join(options.output, 'README.md'),
      content.join('\n')
    );
    
    // Generate individual endpoint files
    await this.generateEndpointFiles(spec, options);
  }

  private async generateEndpointFiles(spec: any, options: ApiDocsOptions): Promise<void> {
    const endpointsDir = path.join(options.output, 'endpoints');
    await fs.mkdir(endpointsDir, { recursive: true });
    
    for (const [path, pathItem] of Object.entries(spec.paths || {})) {
      for (const [method, operation] of Object.entries(pathItem as any)) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
          const op = operation as any;
          const filename = `${method}-${path.replace(/\//g, '-').replace(/[{}]/g, '')}.md`;
          
          const content = this.generateDetailedEndpointDoc(spec, path, method, op, options);
          await fs.writeFile(
            path.join(endpointsDir, filename),
            content
          );
        }
      }
    }
  }

  private generateDetailedEndpointDoc(
    spec: any,
    path: string,
    method: string,
    operation: any,
    options: ApiDocsOptions
  ): string {
    const content: string[] = [];
    
    content.push(`# ${operation.summary || `${method.toUpperCase()} ${path}`}\n`);
    content.push(`\`${method.toUpperCase()} ${path}\`\n`);
    
    if (operation.description) {
      content.push(`\n${operation.description}\n`);
    }
    
    // Try it out section
    if (options.includeTryIt !== false) {
      content.push('\n## Try it out\n');
      content.push('```html');
      content.push(`<div class="api-try-it" 
  data-method="${method}" 
  data-path="${path}"
  data-operation-id="${operation.operationId}">
</div>`);
      content.push('```\n');
    }
    
    // Detailed parameter documentation
    if (operation.parameters && operation.parameters.length > 0) {
      content.push('\n## Parameters\n');
      
      operation.parameters.forEach((param: any) => {
        content.push(`\n### ${param.name}\n`);
        content.push(`- **In**: ${param.in}`);
        content.push(`- **Type**: ${param.schema?.type || 'string'}`);
        content.push(`- **Required**: ${param.required ? 'Yes' : 'No'}`);
        
        if (param.description) {
          content.push(`\n${param.description}\n`);
        }
        
        if (param.schema?.enum) {
          content.push('\n**Allowed values:**');
          param.schema.enum.forEach((value: any) => {
            content.push(`- \`${value}\``);
          });
        }
        
        if (param.example !== undefined) {
          content.push(`\n**Example:** \`${param.example}\`\n`);
        }
      });
    }
    
    // Code examples in multiple languages
    content.push('\n## Code Examples\n');
    
    // JavaScript/Node.js
    content.push('\n### JavaScript\n');
    content.push('```javascript');
    content.push(this.generateJavaScriptExample(spec, path, method, operation));
    content.push('```\n');
    
    // Python
    content.push('\n### Python\n');
    content.push('```python');
    content.push(this.generatePythonExample(spec, path, method, operation));
    content.push('```\n');
    
    // cURL
    content.push('\n### cURL\n');
    content.push('```bash');
    content.push(this.generateCurlExample(spec, path, method, operation));
    content.push('```\n');
    
    return content.join('\n');
  }

  private generateSchemaExample(schema: any): any {
    if (!schema) return {};
    
    if (schema.$ref) {
      // Handle reference
      return { $ref: schema.$ref };
    }
    
    switch (schema.type) {
      case 'object':
        const obj: any = {};
        if (schema.properties) {
          for (const [key, prop] of Object.entries(schema.properties)) {
            obj[key] = this.generateSchemaExample(prop);
          }
        }
        return obj;
        
      case 'array':
        return [this.generateSchemaExample(schema.items)];
        
      case 'string':
        if (schema.example) return schema.example;
        if (schema.enum) return schema.enum[0];
        if (schema.format === 'date-time') return '2024-01-01T00:00:00Z';
        if (schema.format === 'email') return 'user@example.com';
        if (schema.format === 'uuid') return '123e4567-e89b-12d3-a456-426614174000';
        return 'string';
        
      case 'number':
      case 'integer':
        if (schema.example !== undefined) return schema.example;
        return 0;
        
      case 'boolean':
        if (schema.example !== undefined) return schema.example;
        return true;
        
      default:
        return null;
    }
  }

  private generateCurlExample(spec: any, path: string, method: string, operation: any): string {
    const server = spec.servers?.[0]?.url || 'https://api.example.com';
    const url = `${server}${path}`;
    
    const lines: string[] = [`curl -X ${method.toUpperCase()} '${url}' \\`];
    
    // Headers
    lines.push(`  -H 'Accept: application/json' \\`);
    
    if (['post', 'put', 'patch'].includes(method)) {
      lines.push(`  -H 'Content-Type: application/json' \\`);
    }
    
    // Authentication
    if (spec.components?.securitySchemes) {
      const scheme = Object.values(spec.components.securitySchemes)[0] as any;
      if (scheme.type === 'apiKey' && scheme.in === 'header') {
        lines.push(`  -H '${scheme.name}: YOUR_API_KEY' \\`);
      }
    }
    
    // Request body
    if (operation.requestBody?.content?.['application/json']?.schema) {
      const example = this.generateSchemaExample(
        operation.requestBody.content['application/json'].schema
      );
      lines.push(`  -d '${JSON.stringify(example, null, 2)}'`);
    } else {
      // Remove trailing backslash from last line
      lines[lines.length - 1] = lines[lines.length - 1].replace(' \\', '');
    }
    
    return lines.join('\n');
  }

  private generateJavaScriptExample(spec: any, path: string, method: string, operation: any): string {
    const lines: string[] = [];
    
    lines.push(`const response = await fetch('${path}', {`);
    lines.push(`  method: '${method.toUpperCase()}',`);
    lines.push(`  headers: {`);
    lines.push(`    'Accept': 'application/json',`);
    
    if (['post', 'put', 'patch'].includes(method)) {
      lines.push(`    'Content-Type': 'application/json',`);
    }
    
    lines.push(`    'Authorization': 'Bearer YOUR_API_KEY'`);
    lines.push(`  },`);
    
    if (operation.requestBody?.content?.['application/json']?.schema) {
      const example = this.generateSchemaExample(
        operation.requestBody.content['application/json'].schema
      );
      lines.push(`  body: JSON.stringify(${JSON.stringify(example, null, 2).split('\n').join('\n  ')})`);
    }
    
    lines.push(`});`);
    lines.push(``);
    lines.push(`const data = await response.json();`);
    lines.push(`console.log(data);`);
    
    return lines.join('\n');
  }

  private generatePythonExample(spec: any, path: string, method: string, operation: any): string {
    const lines: string[] = [];
    
    lines.push(`import requests`);
    lines.push(``);
    lines.push(`response = requests.${method}(`);
    lines.push(`    '${path}',`);
    lines.push(`    headers={`);
    lines.push(`        'Accept': 'application/json',`);
    
    if (['post', 'put', 'patch'].includes(method)) {
      lines.push(`        'Content-Type': 'application/json',`);
    }
    
    lines.push(`        'Authorization': 'Bearer YOUR_API_KEY'`);
    lines.push(`    },`);
    
    if (operation.requestBody?.content?.['application/json']?.schema) {
      const example = this.generateSchemaExample(
        operation.requestBody.content['application/json'].schema
      );
      lines.push(`    json=${JSON.stringify(example, null, 2).split('\n').join('\n    ')}`);
    }
    
    lines.push(`)`);
    lines.push(``);
    lines.push(`data = response.json()`);
    lines.push(`print(data)`);
    
    return lines.join('\n');
  }

  private async generateHTML(spec: any, options: ApiDocsOptions): Promise<void> {
    // Generate markdown first
    await this.generateMarkdown(spec, { ...options, format: 'markdown' });
    
    // Convert markdown to HTML
    const markdownContent = await fs.readFile(
      path.join(options.output, 'README.md'),
      'utf-8'
    );
    
    const htmlContent = marked(markdownContent);
    
    // Create HTML template
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${spec.info.title} - API Documentation</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1, h2, h3 {
            color: #2c3e50;
        }
        code {
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.9em;
        }
        pre {
            background: #2d2d2d;
            color: #ccc;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background: #f5f5f5;
            font-weight: 600;
        }
        .method {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            color: white;
        }
        .method-get { background: #61affe; }
        .method-post { background: #49cc90; }
        .method-put { background: #fca130; }
        .method-delete { background: #f93e3e; }
        .method-patch { background: #50e3c2; }
    </style>
</head>
<body>
    <div class="container">
        ${htmlContent}
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
</body>
</html>`;
    
    await fs.writeFile(
      path.join(options.output, 'index.html'),
      html
    );
  }

  private async generatePDF(spec: any, options: ApiDocsOptions): Promise<void> {
    // Generate HTML first
    await this.generateHTML(spec, { ...options, format: 'html' });
    
    // Use puppeteer to convert HTML to PDF
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    const htmlPath = path.join(options.output, 'index.html');
    await page.goto(`file://${path.resolve(htmlPath)}`, {
      waitUntil: 'networkidle2'
    });
    
    await page.pdf({
      path: path.join(options.output, 'api-documentation.pdf'),
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });
    
    await browser.close();
  }
}