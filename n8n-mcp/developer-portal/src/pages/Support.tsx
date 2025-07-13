import React from 'react';
import './Support.css';

export const Support: React.FC = () => {
  return (
    <div className="support-page">
      <div className="support-header">
        <h1>Support & Resources</h1>
        <p>Get help and connect with the n8n-MCP community</p>
      </div>

      <div className="support-content">
        <div className="support-section">
          <h2>📚 Documentation</h2>
          <div className="support-cards">
            <a href="/api-docs" className="support-card">
              <h3>API Reference</h3>
              <p>Complete API documentation with examples</p>
            </a>
            <a href="/tutorials" className="support-card">
              <h3>Tutorials</h3>
              <p>Step-by-step guides and walkthroughs</p>
            </a>
            <a href="https://github.com/n8n-mcp/examples" className="support-card">
              <h3>Code Examples</h3>
              <p>Real-world implementation examples</p>
            </a>
          </div>
        </div>

        <div className="support-section">
          <h2>💬 Community</h2>
          <div className="support-cards">
            <a href="https://discord.gg/n8n-mcp" className="support-card">
              <h3>Discord Server</h3>
              <p>Chat with developers and get instant help</p>
            </a>
            <a href="https://github.com/n8n-mcp/sdk/discussions" className="support-card">
              <h3>GitHub Discussions</h3>
              <p>Ask questions and share ideas</p>
            </a>
            <a href="https://stackoverflow.com/questions/tagged/n8n-mcp" className="support-card">
              <h3>Stack Overflow</h3>
              <p>Find answers to common questions</p>
            </a>
          </div>
        </div>

        <div className="support-section">
          <h2>🐛 Report Issues</h2>
          <div className="support-cards">
            <a href="https://github.com/n8n-mcp/sdk/issues" className="support-card">
              <h3>GitHub Issues</h3>
              <p>Report bugs and request features</p>
            </a>
            <a href="/status" className="support-card">
              <h3>API Status</h3>
              <p>Check current service status</p>
            </a>
          </div>
        </div>

        <div className="support-section">
          <h2>📧 Direct Support</h2>
          <div className="contact-info">
            <p>For enterprise support or urgent issues:</p>
            <a href="mailto:support@n8n-mcp.com" className="contact-email">
              support@n8n-mcp.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};