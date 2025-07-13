import React, { useState } from 'react';
import './Playground.css';

export const Playground: React.FC = () => {
  const [selectedEndpoint, setSelectedEndpoint] = useState('/workflows');
  const [method, setMethod] = useState('GET');
  const [requestBody, setRequestBody] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const endpoints = [
    { path: '/health', method: 'GET', description: 'Check API health' },
    { path: '/workflows', method: 'GET', description: 'List workflows' },
    { path: '/workflows', method: 'POST', description: 'Create workflow' },
    { path: '/workflows/{id}', method: 'GET', description: 'Get workflow' },
    { path: '/workflows/{id}/execute', method: 'POST', description: 'Execute workflow' },
    { path: '/executions/{id}', method: 'GET', description: 'Get execution' }
  ];

  const handleExecute = async () => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setResponse(JSON.stringify({
        status: 200,
        data: {
          message: 'Success',
          timestamp: new Date().toISOString()
        }
      }, null, 2));
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="playground-page">
      <div className="playground-header">
        <h1>API Playground</h1>
        <p>Test API endpoints live with instant feedback</p>
      </div>

      <div className="playground-content">
        <div className="request-section">
          <h2>Request</h2>
          
          <div className="endpoint-selector">
            <select
              value={`${method} ${selectedEndpoint}`}
              onChange={(e) => {
                const [m, ...pathParts] = e.target.value.split(' ');
                setMethod(m);
                setSelectedEndpoint(pathParts.join(' '));
              }}
            >
              {endpoints.map((ep, idx) => (
                <option key={idx} value={`${ep.method} ${ep.path}`}>
                  {ep.method} {ep.path} - {ep.description}
                </option>
              ))}
            </select>
          </div>

          {method !== 'GET' && (
            <div className="request-body">
              <label>Request Body (JSON)</label>
              <textarea
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                placeholder='{"name": "My Workflow", "prompt": "Send email when form submitted"}'
                rows={10}
              />
            </div>
          )}

          <button 
            className="execute-btn" 
            onClick={handleExecute}
            disabled={isLoading}
          >
            {isLoading ? 'Executing...' : 'Execute Request'}
          </button>
        </div>

        <div className="response-section">
          <h2>Response</h2>
          <div className="response-content">
            {response ? (
              <pre>{response}</pre>
            ) : (
              <div className="empty-response">
                Execute a request to see the response
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};