import React from 'react';
import { ValidationResult } from './TutorialEngine';
import './ValidationFeedback.css';

interface ValidationFeedbackProps {
  result: ValidationResult;
  onDismiss?: () => void;
}

export const ValidationFeedback: React.FC<ValidationFeedbackProps> = ({
  result,
  onDismiss
}) => {
  const getIcon = () => {
    if (result.success) return '✅';
    return '❌';
  };

  const getClassName = () => {
    return `validation-feedback ${result.success ? 'success' : 'error'}`;
  };

  return (
    <div className={getClassName()}>
      <div className="feedback-header">
        <span className="feedback-icon">{getIcon()}</span>
        <span className="feedback-message">{result.message}</span>
        {onDismiss && (
          <button 
            className="dismiss-button"
            onClick={onDismiss}
            aria-label="Dismiss"
          >
            ✕
          </button>
        )}
      </div>
      
      {result.hint && (
        <div className="feedback-hint">
          <span className="hint-icon">💡</span>
          <span className="hint-text">{result.hint}</span>
        </div>
      )}
      
      {result.details && (
        <div className="feedback-details">
          {typeof result.details === 'string' ? (
            <p>{result.details}</p>
          ) : Array.isArray(result.details) ? (
            <ul>
              {result.details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          ) : (
            <pre>{JSON.stringify(result.details, null, 2)}</pre>
          )}
        </div>
      )}
      
      {result.score !== undefined && result.success && (
        <div className="feedback-score">
          <span className="score-label">Score:</span>
          <span className="score-value">{result.score}%</span>
        </div>
      )}
    </div>
  );
};