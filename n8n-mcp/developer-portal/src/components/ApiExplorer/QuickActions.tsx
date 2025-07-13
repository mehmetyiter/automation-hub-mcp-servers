import React from 'react';
import './QuickActions.css';

interface QuickActionsProps {
  onDownloadPostman: () => void;
  onGenerateSDK: () => void;
  onOpenPlayground: () => void;
  disabled?: boolean;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onDownloadPostman,
  onGenerateSDK,
  onOpenPlayground,
  disabled = false
}) => {
  return (
    <div className="quick-actions">
      <div className="actions-label">Quick Actions</div>
      
      <div className="actions-buttons">
        <button
          type="button"
          onClick={onDownloadPostman}
          className="action-btn postman-btn"
          title="Export collection for Postman"
        >
          <svg className="btn-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13.527.099C6.955-.744.942 3.9.099 10.473c-.843 6.572 3.8 12.584 10.373 13.428 6.573.843 12.587-3.801 13.428-10.374C24.744 6.955 20.101.943 13.527.099zM12 21.5c-5.247 0-9.5-4.253-9.5-9.5S6.753 2.5 12 2.5s9.5 4.253 9.5 9.5-4.253 9.5-9.5 9.5z"/>
            <path d="M12 7v10l7-5z"/>
          </svg>
          Export to Postman
        </button>
        
        <button
          type="button"
          onClick={onGenerateSDK}
          className="action-btn sdk-btn"
          title="Generate SDK for your preferred language"
        >
          <svg className="btn-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
          </svg>
          Generate SDK
        </button>
        
        <button
          type="button"
          onClick={onOpenPlayground}
          disabled={disabled}
          className="action-btn playground-btn"
          title={disabled ? "Configure authentication to use playground" : "Open in code playground"}
        >
          <svg className="btn-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 6v12l10-6z"/>
          </svg>
          Open in Playground
        </button>
      </div>
      
      {disabled && (
        <div className="actions-notice">
          <small>💡 Configure authentication to enable all features</small>
        </div>
      )}
    </div>
  );
};