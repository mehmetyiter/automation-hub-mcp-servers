import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import ora from 'ora';
import { marked } from 'marked';
import * as cheerio from 'cheerio';

export interface ValidateOptions {
  directory: string;
  fix?: boolean;
  strict?: boolean;
}

export interface ValidationError {
  file: string;
  line?: number;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  fixed: number;
}

export class DocsValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationError[] = [];
  private fixed = 0;

  async validate(options: ValidateOptions): Promise<ValidationResult> {
    const spinner = ora('Validating documentation...').start();
    
    try {
      // Reset state
      this.errors = [];
      this.warnings = [];
      this.fixed = 0;
      
      // Find all markdown files
      const files = await glob('**/*.md', {
        cwd: options.directory,
        ignore: ['node_modules/**', 'dist/**']
      });
      
      spinner.text = `Validating ${files.length} files...`;
      
      for (const file of files) {
        const filePath = path.join(options.directory, file);
        await this.validateFile(filePath, options);
      }
      
      // Additional validations
      await this.validateStructure(options.directory, options);
      await this.validateLinks(options.directory, options);
      await this.validateCodeExamples(options.directory, options);
      
      if (options.strict) {
        await this.validateStrictRules(options.directory, options);
      }
      
      const valid = this.errors.length === 0;
      
      if (valid && this.warnings.length === 0) {
        spinner.succeed('Documentation is valid');
      } else if (valid) {
        spinner.warn(`Documentation has ${this.warnings.length} warnings`);
      } else {
        spinner.fail(`Documentation has ${this.errors.length} errors`);
      }
      
      return {
        valid,
        errors: this.errors,
        warnings: this.warnings,
        fixed: this.fixed
      };
    } catch (error) {
      spinner.fail('Validation failed');
      throw error;
    }
  }

  private async validateFile(filePath: string, options: ValidateOptions): Promise<void> {
    let content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativePath = path.relative(process.cwd(), filePath);
    
    // Check for required sections
    if (path.basename(filePath) === 'README.md') {
      if (!content.includes('# ')) {
        this.addError(relativePath, 'README.md must have a main heading');
      }
      
      if (!content.includes('## Installation') && !content.includes('## Getting Started')) {
        this.addWarning(relativePath, 'README.md should include Installation or Getting Started section');
      }
    }
    
    // Validate markdown syntax
    try {
      marked.parse(content);
    } catch (error: any) {
      this.addError(relativePath, `Invalid markdown syntax: ${error.message}`);
    }
    
    // Check for common issues
    let fixed = false;
    
    // Check for trailing whitespace
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].endsWith(' ') || lines[i].endsWith('\t')) {
        if (options.fix) {
          lines[i] = lines[i].trimEnd();
          fixed = true;
        } else {
          this.addWarning(relativePath, `Trailing whitespace on line ${i + 1}`, i + 1);
        }
      }
    }
    
    // Check for inconsistent heading levels
    const headings = lines.filter(line => line.match(/^#+\s/));
    let lastLevel = 0;
    
    for (const heading of headings) {
      const level = heading.match(/^#+/)![0].length;
      if (level > lastLevel + 1) {
        this.addWarning(relativePath, `Skipped heading level: ${heading.trim()}`);
      }
      lastLevel = level;
    }
    
    // Check for missing alt text in images
    const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
    let match;
    
    while ((match = imageRegex.exec(content)) !== null) {
      if (!match[1]) {
        const line = content.substring(0, match.index).split('\n').length;
        this.addWarning(relativePath, `Image missing alt text on line ${line}`, line);
      }
    }
    
    // Check for broken relative links
    const linkRegex = /\[.*?\]\((?!http|#)(.*?)\)/g;
    
    while ((match = linkRegex.exec(content)) !== null) {
      const linkPath = match[1];
      if (linkPath && !linkPath.startsWith('#')) {
        const resolvedPath = path.resolve(path.dirname(filePath), linkPath);
        try {
          await fs.access(resolvedPath);
        } catch {
          const line = content.substring(0, match.index).split('\n').length;
          this.addError(relativePath, `Broken link: ${linkPath} on line ${line}`, line);
        }
      }
    }
    
    // Save fixed content
    if (fixed && options.fix) {
      await fs.writeFile(filePath, lines.join('\n'));
      this.fixed++;
    }
  }

  private async validateStructure(directory: string, options: ValidateOptions): Promise<void> {
    // Check for required files
    const requiredFiles = ['README.md'];
    
    for (const file of requiredFiles) {
      const filePath = path.join(directory, file);
      try {
        await fs.access(filePath);
      } catch {
        this.addError(directory, `Missing required file: ${file}`);
      }
    }
    
    // Check for recommended structure
    const recommendedDirs = ['api', 'guides', 'examples'];
    
    for (const dir of recommendedDirs) {
      const dirPath = path.join(directory, dir);
      try {
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) {
          this.addWarning(directory, `${dir} should be a directory`);
        }
      } catch {
        this.addWarning(directory, `Missing recommended directory: ${dir}`);
      }
    }
  }

  private async validateLinks(directory: string, options: ValidateOptions): Promise<void> {
    // Collect all links
    const files = await glob('**/*.md', {
      cwd: directory,
      ignore: ['node_modules/**', 'dist/**']
    });
    
    const allLinks: Map<string, string[]> = new Map();
    const allAnchors: Set<string> = new Set();
    
    for (const file of files) {
      const filePath = path.join(directory, file);
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Extract links
      const linkRegex = /\[.*?\]\((.*?)\)/g;
      let match;
      const links: string[] = [];
      
      while ((match = linkRegex.exec(content)) !== null) {
        if (match[1]) {
          links.push(match[1]);
        }
      }
      
      allLinks.set(file, links);
      
      // Extract anchors
      const html = marked.parse(content);
      const $ = cheerio.load(html);
      
      $('[id]').each((_, elem) => {
        const id = $(elem).attr('id');
        if (id) {
          allAnchors.add(`${file}#${id}`);
        }
      });
      
      // Auto-generated heading anchors
      $('h1, h2, h3, h4, h5, h6').each((_, elem) => {
        const text = $(elem).text();
        const id = text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
        allAnchors.add(`${file}#${id}`);
      });
    }
    
    // Validate internal links
    for (const [file, links] of allLinks) {
      for (const link of links) {
        if (!link.startsWith('http') && !link.startsWith('mailto:')) {
          if (link.includes('#')) {
            // Anchor link
            const [filePath, anchor] = link.split('#');
            const targetFile = filePath || file;
            const fullAnchor = `${targetFile}#${anchor}`;
            
            if (!allAnchors.has(fullAnchor)) {
              this.addWarning(file, `Broken anchor link: ${link}`);
            }
          }
        }
      }
    }
  }

  private async validateCodeExamples(directory: string, options: ValidateOptions): Promise<void> {
    const files = await glob('**/*.md', {
      cwd: directory,
      ignore: ['node_modules/**', 'dist/**']
    });
    
    for (const file of files) {
      const filePath = path.join(directory, file);
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Extract code blocks
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      let match;
      
      while ((match = codeBlockRegex.exec(content)) !== null) {
        const language = match[1];
        const code = match[2];
        
        if (language) {
          // Basic syntax validation for common languages
          switch (language.toLowerCase()) {
            case 'json':
              try {
                JSON.parse(code);
              } catch {
                const line = content.substring(0, match.index).split('\n').length;
                this.addWarning(file, `Invalid JSON in code block on line ${line}`, line);
              }
              break;
              
            case 'javascript':
            case 'js':
            case 'typescript':
            case 'ts':
              // Check for common syntax errors
              const openBraces = (code.match(/\{/g) || []).length;
              const closeBraces = (code.match(/\}/g) || []).length;
              if (openBraces !== closeBraces) {
                const line = content.substring(0, match.index).split('\n').length;
                this.addWarning(file, `Unbalanced braces in code block on line ${line}`, line);
              }
              break;
          }
        } else {
          // No language specified
          const line = content.substring(0, match.index).split('\n').length;
          this.addWarning(file, `Code block without language specification on line ${line}`, line);
        }
      }
    }
  }

  private async validateStrictRules(directory: string, options: ValidateOptions): Promise<void> {
    const files = await glob('**/*.md', {
      cwd: directory,
      ignore: ['node_modules/**', 'dist/**']
    });
    
    for (const file of files) {
      const filePath = path.join(directory, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      
      // Strict: Check line length
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].length > 120) {
          this.addWarning(file, `Line ${i + 1} exceeds 120 characters`, i + 1);
        }
      }
      
      // Strict: Check for TODO/FIXME comments
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/TODO|FIXME/i)) {
          this.addWarning(file, `TODO/FIXME comment on line ${i + 1}`, i + 1);
        }
      }
      
      // Strict: Ensure consistent list markers
      const listMarkers = lines.filter(line => line.match(/^[\s]*[-*+]\s/));
      if (listMarkers.length > 0) {
        const firstMarker = listMarkers[0].match(/[-*+]/)![0];
        const inconsistent = listMarkers.find(line => !line.includes(firstMarker));
        if (inconsistent) {
          this.addWarning(file, 'Inconsistent list markers');
        }
      }
    }
  }

  private addError(file: string, message: string, line?: number): void {
    this.errors.push({
      file,
      line,
      message,
      severity: 'error'
    });
  }

  private addWarning(file: string, message: string, line?: number): void {
    this.warnings.push({
      file,
      line,
      message,
      severity: 'warning'
    });
  }
}