import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../services/api-client';
import './Dashboard.css';

interface DashboardStats {
  totalWorkflows: number;
  activeWorkflows: number;
  totalExecutions: number;
  apiCalls24h: number;
  successRate: number;
  averageResponseTime: number;
}

interface QuickStartItem {
  title: string;
  description: string;
  icon: string;
  link: string;
  external?: boolean;
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState<any>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch health status
      const health = await apiClient.healthCheck();
      setHealthStatus(health);
      
      // Mock stats for demo - replace with actual API calls
      setStats({
        totalWorkflows: 42,
        activeWorkflows: 38,
        totalExecutions: 1250,
        apiCalls24h: 3847,
        successRate: 99.2,
        averageResponseTime: 127
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickStartItems: QuickStartItem[] = [
    {
      title: 'Read the Documentation',
      description: 'Explore our comprehensive API reference with interactive examples',
      icon: '📚',
      link: '/api-docs'
    },
    {
      title: 'Follow a Tutorial',
      description: 'Learn by building with our step-by-step guided tutorials',
      icon: '🎓',
      link: '/tutorials'
    },
    {
      title: 'Generate SDK',
      description: 'Create a custom SDK for your preferred programming language',
      icon: '🛠️',
      link: '/sdk-generator'
    },
    {
      title: 'Try the Playground',
      description: 'Test API endpoints live with our interactive playground',
      icon: '🎮',
      link: '/playground'
    },
    {
      title: 'Join Discord',
      description: 'Connect with other developers and get help from the community',
      icon: '💬',
      link: 'https://discord.gg/n8n-mcp',
      external: true
    },
    {
      title: 'View Examples',
      description: 'Browse real-world examples and implementation patterns',
      icon: '💡',
      link: 'https://github.com/n8n-mcp/examples',
      external: true
    }
  ];

  const recentAnnouncements = [
    {
      date: '2024-01-07',
      title: 'New SDK Version 2.0 Released',
      description: 'Major update with improved TypeScript support and new features',
      type: 'release'
    },
    {
      date: '2024-01-05',
      title: 'Scheduled Maintenance - Jan 10',
      description: 'API will be unavailable for 2 hours starting at 2 AM UTC',
      type: 'maintenance'
    },
    {
      date: '2024-01-03',
      title: 'New Tutorial: Building AI Workflows',
      description: 'Learn how to create AI-powered automation workflows',
      type: 'tutorial'
    }
  ];

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Welcome Section */}
      <section className="welcome-section">
        <div className="welcome-content">
          <h1>Welcome{user ? `, ${user.name || user.email}` : ''} to n8n-MCP</h1>
          <p className="welcome-subtitle">
            Build powerful automation workflows with our AI-powered API
          </p>
        </div>

        {/* System Status */}
        <div className="system-status">
          <div className="status-card">
            <div className="status-header">
              <h3>System Status</h3>
              <span className={`status-badge ${healthStatus?.status === 'healthy' ? 'healthy' : 'degraded'}`}>
                {healthStatus?.status === 'healthy' ? '✅ All Systems Operational' : '⚠️ Degraded Performance'}
              </span>
            </div>
            {healthStatus?.services && (
              <div className="status-services">
                {Object.entries(healthStatus.services).map(([service, status]) => (
                  <div key={service} className="service-status">
                    <span className="service-name">{service}</span>
                    <span className={`service-indicator ${status}`}></span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      {stats && (
        <section className="stats-section">
          <h2>Your API Usage</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalWorkflows}</div>
                <div className="stat-label">Total Workflows</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-content">
                <div className="stat-value">{stats.activeWorkflows}</div>
                <div className="stat-label">Active Workflows</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🚀</div>
              <div className="stat-content">
                <div className="stat-value">{stats.totalExecutions.toLocaleString()}</div>
                <div className="stat-label">Total Executions</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📈</div>
              <div className="stat-content">
                <div className="stat-value">{stats.apiCalls24h.toLocaleString()}</div>
                <div className="stat-label">API Calls (24h)</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🎯</div>
              <div className="stat-content">
                <div className="stat-value">{stats.successRate}%</div>
                <div className="stat-label">Success Rate</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">⚡</div>
              <div className="stat-content">
                <div className="stat-value">{stats.averageResponseTime}ms</div>
                <div className="stat-label">Avg Response Time</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Quick Start Section */}
      <section className="quickstart-section">
        <h2>Quick Start</h2>
        <div className="quickstart-grid">
          {quickStartItems.map((item, index) => (
            item.external ? (
              <a
                key={index}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="quickstart-card"
              >
                <div className="card-icon">{item.icon}</div>
                <div className="card-content">
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
                <div className="card-arrow">→</div>
              </a>
            ) : (
              <Link
                key={index}
                to={item.link}
                className="quickstart-card"
              >
                <div className="card-icon">{item.icon}</div>
                <div className="card-content">
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
                <div className="card-arrow">→</div>
              </Link>
            )
          ))}
        </div>
      </section>

      {/* Recent Announcements */}
      <section className="announcements-section">
        <h2>Recent Announcements</h2>
        <div className="announcements-list">
          {recentAnnouncements.map((announcement, index) => (
            <div key={index} className={`announcement-item ${announcement.type}`}>
              <div className="announcement-date">
                {new Date(announcement.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </div>
              <div className="announcement-content">
                <h3>{announcement.title}</h3>
                <p>{announcement.description}</p>
              </div>
              <div className="announcement-type">
                {announcement.type === 'release' && '🚀'}
                {announcement.type === 'maintenance' && '🔧'}
                {announcement.type === 'tutorial' && '📚'}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Resources Section */}
      <section className="resources-section">
        <h2>Popular Resources</h2>
        <div className="resources-grid">
          <div className="resource-card">
            <h3>📖 Getting Started Guide</h3>
            <p>Everything you need to know to start using the n8n-MCP API</p>
            <Link to="/tutorials/getting-started" className="resource-link">
              Read Guide →
            </Link>
          </div>

          <div className="resource-card">
            <h3>🔑 Authentication</h3>
            <p>Learn about API keys, tokens, and authentication methods</p>
            <Link to="/api-docs#authentication" className="resource-link">
              View Docs →
            </Link>
          </div>

          <div className="resource-card">
            <h3>📊 Rate Limits</h3>
            <p>Understand rate limiting and how to optimize your API usage</p>
            <Link to="/api-docs#rate-limits" className="resource-link">
              Learn More →
            </Link>
          </div>

          <div className="resource-card">
            <h3>🐛 Error Handling</h3>
            <p>Best practices for handling errors and debugging issues</p>
            <Link to="/api-docs#errors" className="resource-link">
              View Guide →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};