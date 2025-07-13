import Prism from 'prismjs';

// Load additional language components
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-markdown';

export interface HighlightOptions {
  language: string;
  lineNumbers?: boolean;
  theme?: string;
}

export class SyntaxHighlighter {
  private static languageMap: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'cs': 'csharp',
    'c#': 'csharp',
    'rb': 'ruby',
    'sh': 'bash',
    'shell': 'bash',
    'yml': 'yaml',
    'md': 'markdown'
  };

  static highlight(code: string, options: HighlightOptions): string {
    const language = this.normalizeLanguage(options.language);
    
    try {
      if (Prism.languages[language]) {
        const highlighted = Prism.highlight(code, Prism.languages[language], language);
        
        if (options.lineNumbers) {
          return this.addLineNumbers(highlighted);
        }
        
        return highlighted;
      } else {
        console.warn(`Language "${language}" not supported, returning plain text`);
        return this.escapeHtml(code);
      }
    } catch (error) {
      console.error(`Error highlighting code: ${error}`);
      return this.escapeHtml(code);
    }
  }

  static highlightBlock(element: HTMLElement): void {
    Prism.highlightElement(element);
  }

  static highlightAll(): void {
    Prism.highlightAll();
  }

  private static normalizeLanguage(language: string): string {
    const normalized = language.toLowerCase();
    return this.languageMap[normalized] || normalized;
  }

  private static addLineNumbers(highlightedCode: string): string {
    const lines = highlightedCode.split('\n');
    const numberedLines = lines.map((line, index) => {
      const lineNumber = (index + 1).toString().padStart(3, ' ');
      return `<span class="line-number">${lineNumber}</span>${line}`;
    });
    
    return numberedLines.join('\n');
  }

  private static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  static getSupportedLanguages(): string[] {
    return Object.keys(Prism.languages).filter(lang => lang !== 'extend');
  }

  static isLanguageSupported(language: string): boolean {
    const normalized = this.normalizeLanguage(language);
    return normalized in Prism.languages;
  }

  static getLineNumbers(code: string): number {
    return code.split('\n').length;
  }

  static extractCodeBlocks(markdown: string): Array<{ language: string; code: string; startLine: number }> {
    const codeBlocks: Array<{ language: string; code: string; startLine: number }> = [];
    const lines = markdown.split('\n');
    let inCodeBlock = false;
    let currentBlock: { language: string; code: string[]; startLine: number } | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          // Start of code block
          const language = line.slice(3).trim() || 'text';
          currentBlock = {
            language,
            code: [],
            startLine: i + 1
          };
          inCodeBlock = true;
        } else {
          // End of code block
          if (currentBlock) {
            codeBlocks.push({
              language: currentBlock.language,
              code: currentBlock.code.join('\n'),
              startLine: currentBlock.startLine
            });
          }
          currentBlock = null;
          inCodeBlock = false;
        }
      } else if (inCodeBlock && currentBlock) {
        currentBlock.code.push(line);
      }
    }
    
    return codeBlocks;
  }

  static generateHighlightedMarkdown(markdown: string, options?: Partial<HighlightOptions>): string {
    const codeBlocks = this.extractCodeBlocks(markdown);
    let result = markdown;
    
    // Process in reverse order to maintain correct indices
    for (let i = codeBlocks.length - 1; i >= 0; i--) {
      const block = codeBlocks[i];
      const highlighted = this.highlight(block.code, {
        language: block.language,
        ...options
      });
      
      // Replace the code block in the markdown
      const blockRegex = new RegExp(
        `\`\`\`${block.language}\\n[\\s\\S]*?\`\`\``,
        'g'
      );
      
      result = result.replace(blockRegex, `\`\`\`html\n<pre class="language-${block.language}"><code class="language-${block.language}">${highlighted}</code></pre>\n\`\`\``);
    }
    
    return result;
  }

  static getThemeCSS(theme: string = 'default'): string {
    const themes: Record<string, string> = {
      'default': `
        .token.comment,
        .token.prolog,
        .token.doctype,
        .token.cdata {
          color: #708090;
        }
        
        .token.punctuation {
          color: #999;
        }
        
        .token.property,
        .token.tag,
        .token.boolean,
        .token.number,
        .token.constant,
        .token.symbol,
        .token.deleted {
          color: #905;
        }
        
        .token.selector,
        .token.attr-name,
        .token.string,
        .token.char,
        .token.builtin,
        .token.inserted {
          color: #690;
        }
        
        .token.operator,
        .token.entity,
        .token.url,
        .language-css .token.string,
        .style .token.string {
          color: #9a6e3a;
        }
        
        .token.atrule,
        .token.attr-value,
        .token.keyword {
          color: #07a;
        }
        
        .token.function,
        .token.class-name {
          color: #DD4A68;
        }
        
        .token.regex,
        .token.important,
        .token.variable {
          color: #e90;
        }
      `,
      'dark': `
        .token.comment,
        .token.prolog,
        .token.doctype,
        .token.cdata {
          color: #6272a4;
        }
        
        .token.punctuation {
          color: #f8f8f2;
        }
        
        .token.property,
        .token.tag,
        .token.constant,
        .token.symbol,
        .token.deleted {
          color: #ff79c6;
        }
        
        .token.boolean,
        .token.number {
          color: #bd93f9;
        }
        
        .token.selector,
        .token.attr-name,
        .token.string,
        .token.char,
        .token.builtin,
        .token.inserted {
          color: #50fa7b;
        }
        
        .token.operator,
        .token.entity,
        .token.url,
        .language-css .token.string,
        .style .token.string,
        .token.variable {
          color: #f8f8f2;
        }
        
        .token.atrule,
        .token.attr-value,
        .token.function,
        .token.class-name {
          color: #f1fa8c;
        }
        
        .token.keyword {
          color: #8be9fd;
        }
        
        .token.regex,
        .token.important {
          color: #ffb86c;
        }
      `
    };
    
    return themes[theme] || themes.default;
  }

  static getBaseCSS(): string {
    return `
      pre[class*="language-"] {
        position: relative;
        background: #f5f5f5;
        border: 1px solid #e1e1e1;
        border-radius: 4px;
        padding: 1em;
        margin: 1em 0;
        overflow: auto;
        direction: ltr;
        text-align: left;
        white-space: pre;
        word-spacing: normal;
        word-break: normal;
        word-wrap: normal;
        line-height: 1.5;
        tab-size: 4;
        hyphens: none;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
        font-size: 14px;
      }
      
      code[class*="language-"] {
        background: none;
        padding: 0;
        border: none;
        border-radius: 0;
        font-family: inherit;
        font-size: inherit;
        color: #000;
      }
      
      .line-number {
        display: inline-block;
        width: 3em;
        text-align: right;
        padding-right: 1em;
        margin-right: 1em;
        color: #999;
        border-right: 1px solid #ddd;
        user-select: none;
      }
      
      .language-label {
        position: absolute;
        top: 0;
        right: 0;
        background: #666;
        color: white;
        padding: 2px 8px;
        font-size: 12px;
        border-bottom-left-radius: 4px;
      }
    `;
  }
}

export function highlightCode(code: string, language: string, options?: Partial<HighlightOptions>): string {
  return SyntaxHighlighter.highlight(code, {
    language,
    ...options
  });
}

export function highlightMarkdown(markdown: string, options?: Partial<HighlightOptions>): string {
  return SyntaxHighlighter.generateHighlightedMarkdown(markdown, options);
}

export function getSupportedLanguages(): string[] {
  return SyntaxHighlighter.getSupportedLanguages();
}

export function isLanguageSupported(language: string): boolean {
  return SyntaxHighlighter.isLanguageSupported(language);
}