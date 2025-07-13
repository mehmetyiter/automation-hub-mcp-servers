import puppeteer from 'puppeteer';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface MermaidOptions {
  theme?: 'default' | 'forest' | 'dark' | 'neutral';
  backgroundColor?: string;
  width?: number;
  height?: number;
  scale?: number;
  format?: 'svg' | 'png' | 'pdf';
}

export class MermaidRenderer {
  private static browser: puppeteer.Browser | null = null;

  static async initialize(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  static async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  static async render(mermaidCode: string, options: MermaidOptions = {}): Promise<Buffer> {
    await this.initialize();
    
    const page = await this.browser!.newPage();
    
    try {
      const {
        theme = 'default',
        backgroundColor = 'white',
        width = 800,
        height = 600,
        scale = 1,
        format = 'svg'
      } = options;

      // Set viewport
      await page.setViewport({ width, height });

      // Create HTML content with Mermaid
      const html = this.generateHTML(mermaidCode, theme, backgroundColor);
      await page.setContent(html);

      // Wait for Mermaid to render
      await page.waitForSelector('#mermaid-diagram svg, #mermaid-diagram .error', {
        timeout: 10000
      });

      // Check for errors
      const errorElement = await page.$('#mermaid-diagram .error');
      if (errorElement) {
        const errorText = await page.evaluate(el => el.textContent, errorElement);
        throw new Error(`Mermaid rendering error: ${errorText}`);
      }

      let buffer: Buffer;

      if (format === 'svg') {
        // Get SVG content
        const svgElement = await page.$('#mermaid-diagram svg');
        if (!svgElement) {
          throw new Error('SVG element not found');
        }
        
        const svgContent = await page.evaluate(el => el.outerHTML, svgElement);
        buffer = Buffer.from(svgContent, 'utf-8');
      } else if (format === 'png') {
        // Take screenshot of the diagram
        const element = await page.$('#mermaid-diagram');
        if (!element) {
          throw new Error('Diagram element not found');
        }
        
        buffer = await element.screenshot({
          type: 'png',
          omitBackground: backgroundColor === 'transparent'
        });
      } else if (format === 'pdf') {
        // Generate PDF
        buffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20mm',
            right: '20mm',
            bottom: '20mm',
            left: '20mm'
          }
        });
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }

      return buffer;
    } finally {
      await page.close();
    }
  }

  private static generateHTML(mermaidCode: string, theme: string, backgroundColor: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            margin: 0;
            padding: 20px;
            background-color: ${backgroundColor};
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #mermaid-diagram {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 400px;
        }
        .error {
            color: red;
            font-weight: bold;
            text-align: center;
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"></script>
</head>
<body>
    <div id="mermaid-diagram">
        ${mermaidCode}
    </div>

    <script>
        mermaid.initialize({
            theme: '${theme}',
            startOnLoad: true,
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true
            },
            sequence: {
                useMaxWidth: true,
                wrap: true
            },
            gantt: {
                useMaxWidth: true
            },
            er: {
                useMaxWidth: true
            },
            journey: {
                useMaxWidth: true
            }
        });

        // Error handling
        window.addEventListener('error', function(e) {
            document.getElementById('mermaid-diagram').innerHTML = 
                '<div class="error">Error rendering diagram: ' + e.message + '</div>';
        });

        // Render the diagram
        try {
            mermaid.run();
        } catch (error) {
            document.getElementById('mermaid-diagram').innerHTML = 
                '<div class="error">Error rendering diagram: ' + error.message + '</div>';
        }
    </script>
</body>
</html>`;
  }

  static extractMermaidBlocks(markdown: string): Array<{ code: string; startLine: number; language: string }> {
    const blocks: Array<{ code: string; startLine: number; language: string }> = [];
    const lines = markdown.split('\n');
    let inCodeBlock = false;
    let currentBlock: { code: string[]; startLine: number; language: string } | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          const language = line.slice(3).trim();
          if (language === 'mermaid') {
            currentBlock = {
              code: [],
              startLine: i + 1,
              language
            };
            inCodeBlock = true;
          }
        } else {
          if (currentBlock) {
            blocks.push({
              code: currentBlock.code.join('\n'),
              startLine: currentBlock.startLine,
              language: currentBlock.language
            });
          }
          currentBlock = null;
          inCodeBlock = false;
        }
      } else if (inCodeBlock && currentBlock) {
        currentBlock.code.push(line);
      }
    }
    
    return blocks;
  }

  static async renderMarkdownMermaid(
    markdown: string, 
    outputDir: string,
    options: MermaidOptions = {}
  ): Promise<string> {
    const mermaidBlocks = this.extractMermaidBlocks(markdown);
    let processedMarkdown = markdown;
    
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    for (let i = 0; i < mermaidBlocks.length; i++) {
      const block = mermaidBlocks[i];
      const filename = `mermaid-diagram-${i + 1}.${options.format || 'svg'}`;
      const filepath = path.join(outputDir, filename);
      
      try {
        // Render the diagram
        const buffer = await this.render(block.code, options);
        await fs.writeFile(filepath, buffer);
        
        // Replace the mermaid code block with an image reference
        const codeBlockPattern = new RegExp(
          `\`\`\`mermaid\\n${block.code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n\`\`\``,
          'g'
        );
        
        const relativePath = path.relative(path.dirname(outputDir), filepath);
        const imageMarkdown = `![Mermaid Diagram ${i + 1}](${relativePath})`;
        
        processedMarkdown = processedMarkdown.replace(codeBlockPattern, imageMarkdown);
        
      } catch (error) {
        console.error(`Error rendering Mermaid diagram ${i + 1}:`, error);
        // Keep the original code block if rendering fails
      }
    }
    
    return processedMarkdown;
  }

  static validateMermaidSyntax(mermaidCode: string): { valid: boolean; error?: string } {
    try {
      // Basic syntax validation
      const trimmed = mermaidCode.trim();
      
      if (!trimmed) {
        return { valid: false, error: 'Empty diagram' };
      }
      
      // Check for supported diagram types
      const supportedTypes = [
        'graph', 'flowchart', 'sequenceDiagram', 'classDiagram',
        'stateDiagram', 'erDiagram', 'journey', 'gantt', 'pie',
        'gitgraph', 'mindmap', 'timeline'
      ];
      
      const firstLine = trimmed.split('\n')[0].trim();
      const hasValidType = supportedTypes.some(type => 
        firstLine.startsWith(type) || firstLine.includes(type)
      );
      
      if (!hasValidType) {
        return { 
          valid: false, 
          error: `Unknown diagram type. Supported types: ${supportedTypes.join(', ')}` 
        };
      }
      
      // Basic bracket matching for flowcharts
      if (firstLine.includes('graph') || firstLine.includes('flowchart')) {
        const openBrackets = (mermaidCode.match(/[\[\(]/g) || []).length;
        const closeBrackets = (mermaidCode.match(/[\]\)]/g) || []).length;
        
        if (openBrackets !== closeBrackets) {
          return { valid: false, error: 'Unmatched brackets in flowchart' };
        }
      }
      
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  static generateExampleDiagrams(): Record<string, string> {
    return {
      flowchart: `graph TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[End]`,
      
      sequence: `sequenceDiagram
    participant U as User
    participant A as API
    participant D as Database
    
    U->>A: Request data
    A->>D: Query
    D-->>A: Results
    A-->>U: Response`,
      
      class: `classDiagram
    class User {
        +String name
        +String email
        +login()
        +logout()
    }
    
    class Admin {
        +manageUsers()
        +viewLogs()
    }
    
    User <|-- Admin`,
      
      state: `stateDiagram-v2
    [*] --> Idle
    Idle --> Processing : start
    Processing --> Success : complete
    Processing --> Error : fail
    Success --> [*]
    Error --> Idle : retry`,
      
      gantt: `gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    
    section Planning
    Research       :done, des1, 2024-01-01, 2024-01-15
    Design         :active, des2, 2024-01-10, 2024-01-25
    
    section Development
    Backend        :dev1, 2024-01-20, 2024-02-15
    Frontend       :dev2, 2024-01-25, 2024-02-20
    
    section Testing
    Unit Tests     :test1, 2024-02-10, 2024-02-25
    Integration    :test2, 2024-02-20, 2024-03-05`
    };
  }
}

export async function renderMermaid(
  mermaidCode: string,
  options?: MermaidOptions
): Promise<Buffer> {
  return MermaidRenderer.render(mermaidCode, options);
}

export async function renderMarkdownWithMermaid(
  markdown: string,
  outputDir: string,
  options?: MermaidOptions
): Promise<string> {
  return MermaidRenderer.renderMarkdownMermaid(markdown, outputDir, options);
}

export function validateMermaid(mermaidCode: string): { valid: boolean; error?: string } {
  return MermaidRenderer.validateMermaidSyntax(mermaidCode);
}

export function getMermaidExamples(): Record<string, string> {
  return MermaidRenderer.generateExampleDiagrams();
}