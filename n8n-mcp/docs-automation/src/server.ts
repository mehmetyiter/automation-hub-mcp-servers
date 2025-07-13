import express from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import open from 'open';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import compression from 'compression';
import cors from 'cors';

export interface ServerOptions {
  port: number;
  docsDir: string;
  watch?: boolean;
  open?: boolean;
  theme?: string;
}

export class DocsServer {
  private app: express.Application;
  private server: any;
  private io?: SocketIOServer;
  private options: ServerOptions;

  constructor(options: ServerOptions) {
    this.options = options;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Enable compression
    this.app.use(compression());
    
    // Enable CORS
    this.app.use(cors());
    
    // Parse JSON bodies
    this.app.use(express.json());
    
    // Serve static files from docs directory
    this.app.use(express.static(this.options.docsDir));
    
    // Security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });
  }

  private setupRoutes(): void {
    // API routes
    this.app.get('/api/search', this.handleSearch.bind(this));
    this.app.get('/api/navigation', this.handleNavigation.bind(this));
    this.app.get('/api/files', this.handleFiles.bind(this));
    this.app.get('/api/file/:path', this.handleFileContent.bind(this));
    
    // Documentation routes
    this.app.get('/', this.handleIndex.bind(this));
    this.app.get('/docs/*', this.handleDocs.bind(this));
    
    // Catch-all for SPA
    this.app.get('*', this.handleCatchAll.bind(this));
  }

  private async handleSearch(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { q } = req.query as { q: string };
      
      if (!q || q.trim().length < 2) {
        res.json({ results: [] });
        return;
      }
      
      // Load search index
      const indexPath = path.join(this.options.docsDir, 'search-index.js');
      
      try {
        const indexContent = await fs.readFile(indexPath, 'utf-8');
        // Extract search index from the file
        const match = indexContent.match(/export const searchIndex = (\[[\s\S]*?\]);/);
        
        if (match) {
          const searchIndex = JSON.parse(match[1]);
          const results = this.performSearch(searchIndex, q);
          res.json({ results });
        } else {
          res.json({ results: [] });
        }
      } catch {
        res.json({ results: [] });
      }
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  }

  private performSearch(searchIndex: any[], query: string): any[] {
    const terms = query.toLowerCase().split(/\s+/);
    
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
  }

  private async handleNavigation(req: express.Request, res: express.Response): Promise<void> {
    try {
      const navPath = path.join(this.options.docsDir, 'navigation.json');
      
      try {
        const content = await fs.readFile(navPath, 'utf-8');
        const navigation = JSON.parse(content);
        res.json(navigation);
      } catch {
        // Generate basic navigation from file structure
        const navigation = await this.generateNavigation();
        res.json(navigation);
      }
    } catch (error) {
      console.error('Navigation error:', error);
      res.status(500).json({ error: 'Failed to load navigation' });
    }
  }

  private async generateNavigation(): Promise<any> {
    const sections = [];
    
    try {
      const entries = await fs.readdir(this.options.docsDir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const sectionPath = path.join(this.options.docsDir, entry.name);
          const items = [];
          
          try {
            const files = await fs.readdir(sectionPath);
            for (const file of files) {
              if (file.endsWith('.md')) {
                items.push({
                  title: this.formatTitle(path.basename(file, '.md')),
                  slug: path.basename(file, '.md')
                });
              }
            }
          } catch {
            // Ignore errors reading subdirectories
          }
          
          sections.push({
            title: this.formatTitle(entry.name),
            slug: entry.name,
            items
          });
        }
      }
      
      return { sections };
    } catch {
      return { sections: [] };
    }
  }

  private formatTitle(str: string): string {
    return str
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private async handleFiles(req: express.Request, res: express.Response): Promise<void> {
    try {
      const files = await this.getFileList();
      res.json({ files });
    } catch (error) {
      console.error('Files error:', error);
      res.status(500).json({ error: 'Failed to list files' });
    }
  }

  private async getFileList(dir: string = this.options.docsDir, basePath: string = ''): Promise<any[]> {
    const files = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        
        const relativePath = path.join(basePath, entry.name);
        
        if (entry.isDirectory()) {
          const children = await this.getFileList(
            path.join(dir, entry.name),
            relativePath
          );
          
          files.push({
            name: entry.name,
            type: 'directory',
            path: relativePath,
            children
          });
        } else if (entry.name.endsWith('.md')) {
          files.push({
            name: entry.name,
            type: 'file',
            path: relativePath
          });
        }
      }
      
      return files.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    } catch {
      return [];
    }
  }

  private async handleFileContent(req: express.Request, res: express.Response): Promise<void> {
    try {
      const filePath = decodeURIComponent(req.params.path);
      const fullPath = path.join(this.options.docsDir, filePath);
      
      // Security check - ensure file is within docs directory
      const resolvedPath = path.resolve(fullPath);
      const resolvedDocsDir = path.resolve(this.options.docsDir);
      
      if (!resolvedPath.startsWith(resolvedDocsDir)) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
      
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const stats = await fs.stat(fullPath);
        
        res.json({
          content,
          lastModified: stats.mtime,
          size: stats.size
        });
      } catch {
        res.status(404).json({ error: 'File not found' });
      }
    } catch (error) {
      console.error('File content error:', error);
      res.status(500).json({ error: 'Failed to read file' });
    }
  }

  private async handleIndex(req: express.Request, res: express.Response): Promise<void> {
    try {
      // Try to serve index.html if it exists
      const indexPath = path.join(this.options.docsDir, 'index.html');
      
      try {
        const content = await fs.readFile(indexPath, 'utf-8');
        res.setHeader('Content-Type', 'text/html');
        res.send(content);
      } catch {
        // Fallback to README.md
        await this.handleMarkdownFile(req, res, 'README.md');
      }
    } catch (error) {
      console.error('Index error:', error);
      res.status(500).send('Error loading documentation');
    }
  }

  private async handleDocs(req: express.Request, res: express.Response): Promise<void> {
    const docPath = req.path.replace('/docs/', '');
    
    if (docPath.endsWith('.md')) {
      await this.handleMarkdownFile(req, res, docPath);
    } else {
      // Try to find index.md in directory
      await this.handleMarkdownFile(req, res, path.join(docPath, 'index.md'));
    }
  }

  private async handleMarkdownFile(
    req: express.Request,
    res: express.Response,
    filePath: string
  ): Promise<void> {
    try {
      const fullPath = path.join(this.options.docsDir, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // Serve as HTML with viewer
      const html = this.generateDocumentationHTML(content, filePath);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch {
      res.status(404).send('Documentation not found');
    }
  }

  private generateDocumentationHTML(content: string, filePath: string): string {
    const { marked } = require('marked');
    const htmlContent = marked(content);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Documentation - ${path.basename(filePath, '.md')}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
        }
        
        .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            width: 250px;
            height: 100vh;
            background: white;
            border-right: 1px solid #e0e0e0;
            overflow-y: auto;
            z-index: 100;
        }
        
        .sidebar-header {
            padding: 20px;
            border-bottom: 1px solid #e0e0e0;
            background: #2c3e50;
            color: white;
        }
        
        .sidebar-content {
            padding: 20px;
        }
        
        .search-box {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-bottom: 15px;
            font-size: 14px;
        }
        
        .nav-section {
            margin-bottom: 20px;
        }
        
        .nav-title {
            font-weight: 600;
            margin-bottom: 8px;
            color: #2c3e50;
        }
        
        .nav-item {
            display: block;
            padding: 6px 12px;
            color: #666;
            text-decoration: none;
            border-radius: 3px;
            font-size: 14px;
        }
        
        .nav-item:hover {
            background: #f0f0f0;
            color: #2c3e50;
        }
        
        .main-content {
            margin-left: 250px;
            padding: 30px;
            min-height: 100vh;
        }
        
        .content-wrapper {
            max-width: 800px;
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        h1, h2, h3, h4, h5, h6 {
            color: #2c3e50;
            margin-top: 30px;
            margin-bottom: 15px;
        }
        
        h1 {
            margin-top: 0;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
        }
        
        p {
            margin-bottom: 15px;
        }
        
        code {
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.9em;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        }
        
        pre {
            background: #2d2d2d;
            color: #ccc;
            padding: 20px;
            border-radius: 5px;
            overflow-x: auto;
            margin: 20px 0;
        }
        
        pre code {
            background: none;
            padding: 0;
            color: inherit;
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
        
        .breadcrumb {
            background: #34495e;
            color: white;
            padding: 10px 20px;
            margin-left: 250px;
            font-size: 14px;
        }
        
        .breadcrumb a {
            color: #bdc3c7;
            text-decoration: none;
        }
        
        .breadcrumb a:hover {
            color: white;
        }
        
        @media (max-width: 768px) {
            .sidebar {
                transform: translateX(-100%);
                transition: transform 0.3s ease;
            }
            
            .sidebar.open {
                transform: translateX(0);
            }
            
            .main-content {
                margin-left: 0;
            }
            
            .breadcrumb {
                margin-left: 0;
            }
            
            .menu-toggle {
                display: block;
                position: fixed;
                top: 15px;
                left: 15px;
                z-index: 200;
                background: #2c3e50;
                color: white;
                border: none;
                padding: 10px;
                border-radius: 4px;
                cursor: pointer;
            }
        }
        
        .menu-toggle {
            display: none;
        }
        
        #search-results {
            max-height: 300px;
            overflow-y: auto;
            background: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            margin-top: 5px;
            display: none;
        }
        
        .search-result {
            padding: 10px;
            border-bottom: 1px solid #eee;
            cursor: pointer;
        }
        
        .search-result:hover {
            background: #f9f9f9;
        }
        
        .search-result:last-child {
            border-bottom: none;
        }
        
        .result-title {
            font-weight: 600;
            color: #2c3e50;
        }
        
        .result-excerpt {
            font-size: 12px;
            color: #666;
            margin-top: 4px;
        }
    </style>
</head>
<body>
    <button class="menu-toggle" onclick="toggleSidebar()">☰</button>
    
    <div class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <h3>Documentation</h3>
        </div>
        <div class="sidebar-content">
            <input type="text" class="search-box" id="searchBox" placeholder="Search documentation...">
            <div id="search-results"></div>
            <div id="navigation"></div>
        </div>
    </div>
    
    <div class="breadcrumb">
        <a href="/">Home</a> / ${filePath}
    </div>
    
    <div class="main-content">
        <div class="content-wrapper">
            ${htmlContent}
        </div>
    </div>
    
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
    
    <script>
        function toggleSidebar() {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('open');
        }
        
        // Load navigation
        fetch('/api/navigation')
            .then(response => response.json())
            .then(data => {
                const nav = document.getElementById('navigation');
                let html = '';
                
                data.sections.forEach(section => {
                    html += '<div class="nav-section">';
                    html += '<div class="nav-title">' + section.title + '</div>';
                    section.items.forEach(item => {
                        html += '<a href="/docs/' + section.slug + '/' + item.slug + '.md" class="nav-item">' + item.title + '</a>';
                    });
                    html += '</div>';
                });
                
                nav.innerHTML = html;
            })
            .catch(error => console.error('Failed to load navigation:', error));
        
        // Search functionality
        const searchBox = document.getElementById('searchBox');
        const searchResults = document.getElementById('search-results');
        let searchTimeout;
        
        searchBox.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performSearch(e.target.value);
            }, 300);
        });
        
        function performSearch(query) {
            if (!query.trim()) {
                searchResults.style.display = 'none';
                return;
            }
            
            fetch('/api/search?q=' + encodeURIComponent(query))
                .then(response => response.json())
                .then(data => {
                    if (data.results.length > 0) {
                        let html = '';
                        data.results.forEach(result => {
                            html += '<div class="search-result" onclick="navigateToResult(\\''+result.url+'\\')">\\n';
                            html += '  <div class="result-title">' + result.title + '</div>\\n';
                            html += '  <div class="result-excerpt">' + result.content.substring(0, 100) + '...</div>\\n';
                            html += '</div>';
                        });
                        searchResults.innerHTML = html;
                        searchResults.style.display = 'block';
                    } else {
                        searchResults.innerHTML = '<div class="search-result">No results found</div>';
                        searchResults.style.display = 'block';
                    }
                })
                .catch(error => {
                    console.error('Search failed:', error);
                    searchResults.style.display = 'none';
                });
        }
        
        function navigateToResult(url) {
            window.location.href = url;
        }
        
        // Hide search results when clicking outside
        document.addEventListener('click', (e) => {
            if (!searchBox.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.style.display = 'none';
            }
        });
        
        // Socket.io for live reload
        if (window.location.hostname === 'localhost') {
            const script = document.createElement('script');
            script.src = '/socket.io/socket.io.js';
            script.onload = () => {
                const socket = io();
                socket.on('reload', () => {
                    window.location.reload();
                });
            };
            document.head.appendChild(script);
        }
    </script>
</body>
</html>`;
  }

  private handleCatchAll(req: express.Request, res: express.Response): void {
    res.status(404).send('Page not found');
  }

  async start(): Promise<void> {
    this.server = createServer(this.app);
    
    // Setup Socket.io for live reload
    if (this.options.watch) {
      this.io = new SocketIOServer(this.server, {
        cors: {
          origin: "*",
          methods: ["GET", "POST"]
        }
      });
      
      this.io.on('connection', (socket) => {
        console.log(chalk.gray('Client connected for live reload'));
      });
    }
    
    return new Promise((resolve, reject) => {
      this.server.listen(this.options.port, (error: any) => {
        if (error) {
          reject(error);
        } else {
          console.log(chalk.green(`Documentation server started on port ${this.options.port}`));
          
          if (this.options.open) {
            open(`http://localhost:${this.options.port}`);
          }
          
          resolve();
        }
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log(chalk.gray('Documentation server stopped'));
          resolve();
        });
      });
    }
  }

  reload(): void {
    if (this.io) {
      this.io.emit('reload');
    }
  }
}