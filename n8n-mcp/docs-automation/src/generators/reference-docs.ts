import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import ora from 'ora';
import { marked } from 'marked';
import * as cheerio from 'cheerio';

export interface ReferenceDocsOptions {
  config?: string;
  output?: string;
  include?: string[];
  exclude?: string[];
}

interface DocSection {
  title: string;
  content: string;
  subsections?: DocSection[];
  order?: number;
}

export class ReferenceDocsGenerator {
  async generate(options: ReferenceDocsOptions): Promise<void> {
    const spinner = ora('Generating reference documentation...').start();
    
    try {
      let config: any = {};
      
      if (options.config) {
        config = JSON.parse(await fs.readFile(options.config, 'utf-8'));
      }
      
      const outputDir = options.output || config.output || './docs';
      const include = options.include || config.reference?.include || ['**/*.md', 'README.md'];
      const exclude = options.exclude || config.reference?.exclude || ['node_modules/**', 'dist/**'];
      
      // Create output directory
      await fs.mkdir(outputDir, { recursive: true });
      
      // Collect all documentation files
      spinner.text = 'Collecting documentation files...';
      const files = await this.collectFiles(include, exclude);
      
      // Parse and organize documentation
      spinner.text = 'Organizing documentation...';
      const sections = await this.organizeDocumentation(files);
      
      // Generate table of contents
      spinner.text = 'Generating table of contents...';
      const toc = this.generateTableOfContents(sections);
      
      // Generate reference documentation
      spinner.text = 'Generating reference documentation...';
      await this.generateReferenceDocs(sections, toc, outputDir);
      
      // Generate search index
      spinner.text = 'Generating search index...';
      await this.generateSearchIndex(sections, outputDir);
      
      // Generate navigation
      await this.generateNavigation(sections, outputDir);
      
      spinner.succeed('Reference documentation generated');
    } catch (error) {
      spinner.fail('Failed to generate reference documentation');
      throw error;
    }
  }

  private async collectFiles(include: string[], exclude: string[]): Promise<string[]> {
    const files: string[] = [];
    
    for (const pattern of include) {
      const matches = await glob(pattern, {
        ignore: exclude
      });
      files.push(...matches);
    }
    
    return [...new Set(files)]; // Remove duplicates
  }

  private async organizeDocumentation(files: string[]): Promise<DocSection[]> {
    const sections: DocSection[] = [];
    const sectionMap: Map<string, DocSection> = new Map();
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const parsed = this.parseMarkdown(content);
      
      // Determine section based on file path
      const category = this.categorizeFile(file);
      
      if (!sectionMap.has(category)) {
        const section: DocSection = {
          title: this.formatTitle(category),
          content: '',
          subsections: [],
          order: this.getCategoryOrder(category)
        };
        sectionMap.set(category, section);
        sections.push(section);
      }
      
      const section = sectionMap.get(category)!;
      
      // Add as subsection
      section.subsections!.push({
        title: parsed.title || this.formatTitle(path.basename(file, '.md')),
        content: parsed.content
      });
    }
    
    // Sort sections by order
    sections.sort((a, b) => (a.order || 999) - (b.order || 999));
    
    return sections;
  }

  private parseMarkdown(content: string): { title?: string; content: string } {
    const lines = content.split('\n');
    let title: string | undefined;
    let contentStart = 0;
    
    // Extract title from first heading
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('# ')) {
        title = line.substring(2).trim();
        contentStart = i + 1;
        break;
      }
    }
    
    return {
      title,
      content: lines.slice(contentStart).join('\n').trim()
    };
  }

  private categorizeFile(filePath: string): string {
    const normalized = filePath.toLowerCase();
    
    if (normalized.includes('api')) return 'api-reference';
    if (normalized.includes('guide')) return 'guides';
    if (normalized.includes('tutorial')) return 'tutorials';
    if (normalized.includes('example')) return 'examples';
    if (normalized.includes('sdk')) return 'sdk';
    if (normalized.includes('cli')) return 'cli';
    if (normalized.includes('integration')) return 'integrations';
    if (normalized.includes('security')) return 'security';
    if (normalized.includes('changelog')) return 'changelog';
    if (normalized.includes('readme')) return 'overview';
    
    return 'reference';
  }

  private getCategoryOrder(category: string): number {
    const order: Record<string, number> = {
      'overview': 1,
      'guides': 2,
      'tutorials': 3,
      'api-reference': 4,
      'sdk': 5,
      'cli': 6,
      'integrations': 7,
      'examples': 8,
      'security': 9,
      'reference': 10,
      'changelog': 11
    };
    
    return order[category] || 999;
  }

  private formatTitle(str: string): string {
    return str
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private generateTableOfContents(sections: DocSection[]): string {
    const lines: string[] = ['# Table of Contents\n'];
    
    sections.forEach(section => {
      lines.push(`## ${section.title}`);
      lines.push('');
      
      if (section.subsections) {
        section.subsections.forEach(subsection => {
          const anchor = this.generateAnchor(subsection.title);
          lines.push(`- [${subsection.title}](#${anchor})`);
        });
        lines.push('');
      }
    });
    
    return lines.join('\n');
  }

  private generateAnchor(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
  }

  private async generateReferenceDocs(
    sections: DocSection[],
    toc: string,
    outputDir: string
  ): Promise<void> {
    // Generate main reference file
    const mainContent: string[] = [
      '# n8n-MCP Reference Documentation',
      '',
      'Complete reference documentation for the n8n-MCP platform.',
      '',
      toc,
      ''
    ];
    
    // Add all sections
    sections.forEach(section => {
      mainContent.push(`# ${section.title}`);
      mainContent.push('');
      
      if (section.content) {
        mainContent.push(section.content);
        mainContent.push('');
      }
      
      if (section.subsections) {
        section.subsections.forEach(subsection => {
          mainContent.push(`## ${subsection.title}`);
          mainContent.push('');
          mainContent.push(subsection.content);
          mainContent.push('');
        });
      }
    });
    
    await fs.writeFile(
      path.join(outputDir, 'reference.md'),
      mainContent.join('\n')
    );
    
    // Generate individual section files
    for (const section of sections) {
      const sectionDir = path.join(outputDir, this.slugify(section.title));
      await fs.mkdir(sectionDir, { recursive: true });
      
      // Generate section index
      const sectionContent: string[] = [
        `# ${section.title}`,
        '',
        section.content || '',
        '',
        '## Contents',
        ''
      ];
      
      if (section.subsections) {
        section.subsections.forEach(subsection => {
          const filename = this.slugify(subsection.title) + '.md';
          sectionContent.push(`- [${subsection.title}](./${filename})`);
          
          // Write subsection file
          const subsectionContent = [
            `# ${subsection.title}`,
            '',
            `[← Back to ${section.title}](./index.md)`,
            '',
            subsection.content
          ].join('\n');
          
          fs.writeFile(
            path.join(sectionDir, filename),
            subsectionContent
          );
        });
      }
      
      await fs.writeFile(
        path.join(sectionDir, 'index.md'),
        sectionContent.join('\n')
      );
    }
  }

  private async generateSearchIndex(sections: DocSection[], outputDir: string): Promise<void> {
    const searchIndex: any[] = [];
    let id = 0;
    
    // Index all content
    sections.forEach(section => {
      // Index section
      searchIndex.push({
        id: id++,
        title: section.title,
        content: this.extractText(section.content),
        type: 'section',
        url: `#${this.generateAnchor(section.title)}`
      });
      
      // Index subsections
      if (section.subsections) {
        section.subsections.forEach(subsection => {
          searchIndex.push({
            id: id++,
            title: subsection.title,
            content: this.extractText(subsection.content),
            type: 'subsection',
            section: section.title,
            url: `#${this.generateAnchor(subsection.title)}`
          });
        });
      }
    });
    
    // Generate search index file
    const searchIndexContent = `// Auto-generated search index
export const searchIndex = ${JSON.stringify(searchIndex, null, 2)};

export function search(query) {
  const terms = query.toLowerCase().split(/\\s+/);
  
  return searchIndex
    .map(item => {
      let score = 0;
      const titleLower = item.title.toLowerCase();
      const contentLower = item.content.toLowerCase();
      
      terms.forEach(term => {
        // Title matches are weighted higher
        if (titleLower.includes(term)) {
          score += 10;
        }
        // Content matches
        if (contentLower.includes(term)) {
          score += 1;
        }
      });
      
      return { ...item, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}`;
    
    await fs.writeFile(
      path.join(outputDir, 'search-index.js'),
      searchIndexContent
    );
    
    // Generate search UI component
    const searchUIContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Search Documentation</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .search-box {
      width: 100%;
      padding: 12px;
      font-size: 16px;
      border: 1px solid #ddd;
      border-radius: 4px;
      margin-bottom: 20px;
    }
    .search-results {
      list-style: none;
      padding: 0;
    }
    .search-result {
      padding: 15px;
      border-bottom: 1px solid #eee;
    }
    .search-result:hover {
      background: #f5f5f5;
    }
    .result-title {
      font-size: 18px;
      color: #0066cc;
      text-decoration: none;
      display: block;
      margin-bottom: 5px;
    }
    .result-section {
      font-size: 14px;
      color: #666;
      margin-bottom: 5px;
    }
    .result-content {
      font-size: 14px;
      color: #333;
      line-height: 1.5;
    }
    .highlight {
      background: #ffeb3b;
      padding: 2px;
    }
  </style>
</head>
<body>
  <h1>Search Documentation</h1>
  <input 
    type="text" 
    class="search-box" 
    placeholder="Search documentation..."
    id="searchBox"
  >
  <ul class="search-results" id="searchResults"></ul>
  
  <script type="module">
    import { search } from './search-index.js';
    
    const searchBox = document.getElementById('searchBox');
    const searchResults = document.getElementById('searchResults');
    let debounceTimer;
    
    searchBox.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        performSearch(e.target.value);
      }, 300);
    });
    
    function performSearch(query) {
      if (!query.trim()) {
        searchResults.innerHTML = '';
        return;
      }
      
      const results = search(query);
      
      if (results.length === 0) {
        searchResults.innerHTML = '<li class="search-result">No results found</li>';
        return;
      }
      
      searchResults.innerHTML = results.map(result => \`
        <li class="search-result">
          <a href="\${result.url}" class="result-title">\${highlightText(result.title, query)}</a>
          \${result.section ? \`<div class="result-section">\${result.section}</div>\` : ''}
          <div class="result-content">\${highlightText(result.content.substring(0, 200) + '...', query)}</div>
        </li>
      \`).join('');
    }
    
    function highlightText(text, query) {
      const terms = query.split(/\\s+/);
      let highlighted = text;
      
      terms.forEach(term => {
        const regex = new RegExp(\`(\${term})\`, 'gi');
        highlighted = highlighted.replace(regex, '<span class="highlight">$1</span>');
      });
      
      return highlighted;
    }
  </script>
</body>
</html>`;
    
    await fs.writeFile(
      path.join(outputDir, 'search.html'),
      searchUIContent
    );
  }

  private extractText(markdown: string): string {
    // Convert markdown to plain text for search
    const html = marked(markdown);
    const $ = cheerio.load(html);
    return $('body').text().replace(/\s+/g, ' ').trim();
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async generateNavigation(sections: DocSection[], outputDir: string): Promise<void> {
    const nav = {
      sections: sections.map(section => ({
        title: section.title,
        slug: this.slugify(section.title),
        items: section.subsections?.map(subsection => ({
          title: subsection.title,
          slug: this.slugify(subsection.title)
        })) || []
      }))
    };
    
    await fs.writeFile(
      path.join(outputDir, 'navigation.json'),
      JSON.stringify(nav, null, 2)
    );
  }
}