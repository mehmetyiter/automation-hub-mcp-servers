import React, { useState } from 'react';
import './AuthTokenInput.css';

interface AuthTokenInputProps {
  value: string;
  onChange: (value: string) => void;
  onGenerate: () => Promise<void>;
  environment: string;
}

export const AuthTokenInput: React.FC<AuthTokenInputProps> = ({
  value,
  onChange,
  onGenerate,
  environment
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      await onGenerate();
    } catch (error) {
      console.error('Failed to generate token:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  const clearToken = () => {
    onChange('');
  };

  const maskToken = (token: string) => {
    if (!token) return '';
    if (token.length <= 8) return token;
    return `${token.substring(0, 4)}${'*'.repeat(token.length - 8)}${token.substring(token.length - 4)}`;
  };

  return (
    <div className="auth-token-input">
      <label htmlFor="auth-token">Authentication Token</label>
      
      <div className="token-input-wrapper">
        <input
          id="auth-token"
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter your API token or generate a sandbox token"
          className="token-input"
        />
        
        <div className="token-actions">
          {value && (
            <button
              type="button"
              onClick={toggleVisibility}
              className="toggle-visibility"
              title={isVisible ? 'Hide token' : 'Show token'}
            >
              {isVisible ? '👁️' : '👁️‍🗨️'}
            </button>
          )}
          
          {value && (
            <button
              type="button"
              onClick={clearToken}
              className="clear-token"
              title="Clear token"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="token-controls">
        {environment === 'sandbox' && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="generate-token-btn"
          >
            {isGenerating ? 'Generating...' : 'Generate Sandbox Token'}
          </button>
        )}
        
        {environment !== 'sandbox' && (
          <div className="token-help">
            <p>
              Get your API token from the{' '}
              <a href="/dashboard/api-keys" target="_blank" rel="noopener noreferrer">
                API Keys dashboard
              </a>
            </p>
          </div>
        )}
      </div>

      {value && (
        <div className="token-status">
          <div className="token-preview">
            <span className="token-label">Token:</span>
            <code className="token-value">
              {isVisible ? value : maskToken(value)}
            </code>
          </div>
          
          <div className="token-info">
            <span className={`token-indicator ${value ? 'valid' : 'invalid'}`}></span>
            <span className="token-status-text">
              {value ? 'Token configured' : 'No token'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};