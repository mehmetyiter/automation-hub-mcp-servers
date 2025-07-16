import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.API_GATEWAY_PORT || 8080;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

const proxyOptions = {
  changeOrigin: true,
  ws: true,
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy error occurred' });
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} -> ${proxyReq.path}`);
  }
};

app.use('/api/auth', createProxyMiddleware({
  target: process.env.AUTH_MCP_URL || 'http://localhost:3005',
  ...proxyOptions,
  pathRewrite: {
    '^/api/auth': '/auth'
  }
}));

// Add AI provider routes
app.use('/api/ai-providers', createProxyMiddleware({
  target: process.env.AUTH_MCP_URL || 'http://localhost:3005',
  ...proxyOptions,
  pathRewrite: {
    '^/api/ai-providers': '/api/ai-providers'
  }
}));

// Handle n8n routes with different path patterns
// AI providers routes need /api prefix
app.use('/api/n8n/ai-providers', createProxyMiddleware({
  target: process.env.N8N_MCP_URL || 'http://localhost:3006',
  ...proxyOptions,
  pathRewrite: {
    '^/api/n8n/ai-providers': '/api/ai-providers'
  }
}));

// Tools routes don't need /api prefix
app.use('/api/n8n/tools', createProxyMiddleware({
  target: process.env.N8N_MCP_URL || 'http://localhost:3006',
  ...proxyOptions,
  pathRewrite: {
    '^/api/n8n/tools': '/tools'
  }
}));

// Other n8n routes
app.use('/api/n8n', createProxyMiddleware({
  target: process.env.N8N_MCP_URL || 'http://localhost:3006',
  ...proxyOptions,
  pathRewrite: {
    '^/api/n8n': ''
  }
}));

app.use('/api/template', createProxyMiddleware({
  target: process.env.TEMPLATE_MCP_URL || 'http://localhost:3007',
  ...proxyOptions,
  pathRewrite: {
    '^/api/template': ''
  }
}));

app.use('/api/community', createProxyMiddleware({
  target: process.env.COMMUNITY_MCP_URL || 'http://localhost:3008',
  ...proxyOptions,
  pathRewrite: {
    '^/api/community': ''
  }
}));

// Add AI analysis routes (route to n8n service)
app.use('/api/ai-analysis', createProxyMiddleware({
  target: process.env.N8N_MCP_URL || 'http://localhost:3006',
  ...proxyOptions,
  pathRewrite: {
    '^/api/ai-analysis': '/api/ai-analysis'
  }
}));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`API Gateway running on http://localhost:${PORT}`);
  console.log('Proxying routes:');
  console.log(`  /api/auth/* -> ${process.env.AUTH_MCP_URL || 'http://localhost:3005'}`);
  console.log(`  /api/ai-providers/* -> ${process.env.AUTH_MCP_URL || 'http://localhost:3005'}`);
  console.log(`  /api/n8n/* -> ${process.env.N8N_MCP_URL || 'http://localhost:3006'}`);
  console.log(`  /api/template/* -> ${process.env.TEMPLATE_MCP_URL || 'http://localhost:3007'}`);
  console.log(`  /api/community/* -> ${process.env.COMMUNITY_MCP_URL || 'http://localhost:3008'}`);
});