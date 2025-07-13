import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: '📊',
      description: 'Overview and quick start'
    },
    {
      name: 'API Documentation',
      path: '/api-docs',
      icon: '📚',
      description: 'Interactive API reference'
    },
    {
      name: 'Tutorials',
      path: '/tutorials',
      icon: '🎓',
      description: 'Learn with guided examples'
    },
    {
      name: 'SDK Generator',
      path: '/sdk-generator',
      icon: '🛠️',
      description: 'Generate client libraries'
    },
    {
      name: 'Playground',
      path: '/playground',
      icon: '🎮',
      description: 'Test API calls live'
    },
    {
      name: 'Support',
      path: '/support',
      icon: '💬',
      description: 'Get help and resources'
    }
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className={`layout theme-${theme}`}>
      {/* Header */}
      <header className="layout-header">
        <div className="header-content">
          <div className="header-left">
            <button
              className="menu-toggle desktop-only"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label="Toggle sidebar"
            >
              ☰
            </button>
            
            <button
              className="menu-toggle mobile-only"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle mobile menu"
            >
              ☰
            </button>

            <Link to="/" className="logo">
              <span className="logo-icon">🚀</span>
              <span className="logo-text">n8n-MCP Developer Portal</span>
            </Link>
          </div>

          <div className="header-right">
            <nav className="header-nav">
              <a
                href="https://github.com/n8n-mcp/sdk"
                target="_blank"
                rel="noopener noreferrer"
                className="header-link"
              >
                <span className="link-icon">📦</span>
                <span className="link-text">GitHub</span>
              </a>
              
              <a
                href="https://discord.gg/n8n-mcp"
                target="_blank"
                rel="noopener noreferrer"
                className="header-link"
              >
                <span className="link-icon">💬</span>
                <span className="link-text">Discord</span>
              </a>

              <button
                className="theme-toggle"
                onClick={toggleTheme}
                aria-label="Toggle theme"
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </button>

              {user ? (
                <div className="user-menu">
                  <span className="user-avatar">
                    {user.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                  <span className="user-name">{user.name || user.email}</span>
                  <button onClick={logout} className="logout-btn">
                    Logout
                  </button>
                </div>
              ) : (
                <Link to="/login" className="login-btn">
                  Sign In
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      <div className="layout-body">
        {/* Sidebar */}
        <aside className={`layout-sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
          <nav className="sidebar-nav">
            {navigation.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className="nav-icon">{item.icon}</span>
                <div className="nav-content">
                  <span className="nav-text">{item.name}</span>
                  <span className="nav-description">{item.description}</span>
                </div>
              </Link>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="version-info">
              <span className="version-label">API Version</span>
              <span className="version-value">v1.0.0</span>
            </div>
            
            <div className="status-info">
              <span className="status-indicator online"></span>
              <span className="status-text">All systems operational</span>
            </div>
          </div>
        </aside>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div
            className="mobile-menu-overlay"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
              <div className="mobile-menu-header">
                <h3>Menu</h3>
                <button
                  className="close-btn"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  ✕
                </button>
              </div>
              
              <nav className="mobile-nav">
                {navigation.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`mobile-nav-item ${isActive(item.path) ? 'active' : ''}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-text">{item.name}</span>
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="layout-main">
          {children}
        </main>
      </div>

      {/* Footer */}
      <footer className="layout-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>Resources</h4>
            <ul>
              <li><a href="/api-docs">API Reference</a></li>
              <li><a href="/tutorials">Tutorials</a></li>
              <li><a href="/sdk-generator">SDK Generator</a></li>
              <li><a href="https://github.com/n8n-mcp/examples">Examples</a></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h4>Community</h4>
            <ul>
              <li><a href="https://discord.gg/n8n-mcp">Discord</a></li>
              <li><a href="https://github.com/n8n-mcp">GitHub</a></li>
              <li><a href="https://twitter.com/n8n_mcp">Twitter</a></li>
              <li><a href="/blog">Blog</a></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h4>Support</h4>
            <ul>
              <li><a href="/support">Help Center</a></li>
              <li><a href="/support/faq">FAQ</a></li>
              <li><a href="/support/contact">Contact Us</a></li>
              <li><a href="/status">API Status</a></li>
            </ul>
          </div>
          
          <div className="footer-section">
            <h4>Legal</h4>
            <ul>
              <li><a href="/terms">Terms of Service</a></li>
              <li><a href="/privacy">Privacy Policy</a></li>
              <li><a href="/security">Security</a></li>
              <li><a href="/sla">SLA</a></li>
            </ul>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>&copy; 2024 n8n-MCP. All rights reserved.</p>
          <p>Built with ❤️ by the n8n-MCP team</p>
        </div>
      </footer>
    </div>
  );
};