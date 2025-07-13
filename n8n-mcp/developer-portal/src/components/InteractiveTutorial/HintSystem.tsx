import React, { useState } from 'react';
import './HintSystem.css';

interface HintSystemProps {
  hints: string[];
  hintsUsed: number;
  onShowHint: () => void;
}

export const HintSystem: React.FC<HintSystemProps> = ({
  hints,
  hintsUsed,
  onShowHint
}) => {
  const [expandedHints, setExpandedHints] = useState<number[]>([]);

  const toggleHint = (index: number) => {
    if (!expandedHints.includes(index)) {
      onShowHint();
      setExpandedHints([...expandedHints, index]);
    } else {
      setExpandedHints(expandedHints.filter(i => i !== index));
    }
  };

  const getHintButtonText = (index: number): string => {
    if (index > hintsUsed) {
      return `Hint ${index + 1} (locked)`;
    }
    if (expandedHints.includes(index)) {
      return `Hide Hint ${index + 1}`;
    }
    return `Show Hint ${index + 1}`;
  };

  const isHintAvailable = (index: number): boolean => {
    return index <= hintsUsed;
  };

  return (
    <div className="hint-system">
      <div className="hint-header">
        <span className="hint-icon">💡</span>
        <h3>Need Help?</h3>
        <span className="hints-count">
          {hintsUsed} of {hints.length} hints used
        </span>
      </div>
      
      <div className="hints-list">
        {hints.map((hint, index) => (
          <div 
            key={index} 
            className={`hint-item ${!isHintAvailable(index) ? 'locked' : ''}`}
          >
            <button
              className="hint-toggle"
              onClick={() => toggleHint(index)}
              disabled={!isHintAvailable(index)}
            >
              {getHintButtonText(index)}
              {!isHintAvailable(index) && (
                <span className="lock-icon">🔒</span>
              )}
            </button>
            
            {expandedHints.includes(index) && (
              <div className="hint-content">
                {hint}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {hintsUsed === 0 && hints.length > 0 && (
        <div className="hint-tip">
          <p>
            💡 Try to solve the problem on your own first! 
            Hints will become available as you make attempts.
          </p>
        </div>
      )}
      
      {hintsUsed === hints.length && hints.length > 0 && (
        <div className="all-hints-used">
          <p>
            You've used all available hints. 
            If you're still stuck, try reviewing the resources or asking for help in the community!
          </p>
        </div>
      )}
    </div>
  );
};