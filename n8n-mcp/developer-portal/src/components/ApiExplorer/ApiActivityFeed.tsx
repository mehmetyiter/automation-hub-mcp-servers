import React, { useState } from 'react';
import './ApiActivityFeed.css';

interface ApiActivity {
  id: string;
  method: string;
  url: string;
  status?: number;
  timestamp: Date;
  duration?: number;
  request_id: string;
}

interface ApiActivityFeedProps {
  activities: ApiActivity[];
}

export const ApiActivityFeed: React.FC<ApiActivityFeedProps> = ({ activities }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');

  const getStatusClass = (status?: number): string => {
    if (!status) return 'pending';
    if (status >= 200 && status < 300) return 'success';
    if (status >= 400) return 'error';
    return 'warning';
  };

  const getStatusText = (status?: number): string => {
    if (!status) return 'Pending';
    if (status >= 200 && status < 300) return 'Success';
    if (status >= 400) return 'Error';
    return 'Warning';
  };

  const formatDuration = (duration?: number): string => {
    if (!duration) return '-';
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(1)}s`;
  };

  const formatTime = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getMethodClass = (method: string): string => {
    switch (method.toUpperCase()) {
      case 'GET': return 'method-get';
      case 'POST': return 'method-post';
      case 'PUT': return 'method-put';
      case 'DELETE': return 'method-delete';
      case 'PATCH': return 'method-patch';
      default: return 'method-other';
    }
  };

  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true;
    if (filter === 'success') return activity.status && activity.status >= 200 && activity.status < 300;
    if (filter === 'error') return activity.status && activity.status >= 400;
    return true;
  });

  const clearActivities = () => {
    // This would typically call a parent function to clear activities
    console.log('Clear activities requested');
  };

  return (
    <div className="api-activity-feed">
      <div className="activity-header">
        <div className="header-title">
          <h3>API Activity</h3>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="expand-toggle"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
        
        {isExpanded && (
          <div className="activity-controls">
            <div className="filter-controls">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              >
                All ({activities.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('success')}
                className={`filter-btn ${filter === 'success' ? 'active' : ''}`}
              >
                Success ({activities.filter(a => a.status && a.status >= 200 && a.status < 300).length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('error')}
                className={`filter-btn ${filter === 'error' ? 'active' : ''}`}
              >
                Errors ({activities.filter(a => a.status && a.status >= 400).length})
              </button>
            </div>
            
            {activities.length > 0 && (
              <button
                type="button"
                onClick={clearActivities}
                className="clear-btn"
                title="Clear activity log"
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="activity-content">
          {filteredActivities.length === 0 ? (
            <div className="no-activities">
              {activities.length === 0 
                ? 'No API calls made yet. Try making a request!' 
                : 'No activities match the current filter.'
              }
            </div>
          ) : (
            <div className="activity-list">
              {filteredActivities.map((activity) => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-main">
                    <div className="activity-method">
                      <span className={`method-badge ${getMethodClass(activity.method)}`}>
                        {activity.method}
                      </span>
                    </div>
                    
                    <div className="activity-details">
                      <div className="activity-url" title={activity.url}>
                        {activity.url.replace(/^https?:\/\/[^/]+/, '')}
                      </div>
                      <div className="activity-meta">
                        <span className="activity-time">{formatTime(activity.timestamp)}</span>
                        <span className="activity-duration">{formatDuration(activity.duration)}</span>
                        <span className={`activity-status status-${getStatusClass(activity.status)}`}>
                          {activity.status || 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="activity-actions">
                    <button
                      type="button"
                      className="copy-request-id"
                      onClick={() => navigator.clipboard.writeText(activity.request_id)}
                      title="Copy Request ID"
                    >
                      📋
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};