import React from 'react';
import './TutorialNavigation.css';

interface TutorialNavigationProps {
  onPrevious: () => void;
  onNext: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  isLastStep: boolean;
  isComplete: boolean;
}

export const TutorialNavigation: React.FC<TutorialNavigationProps> = ({
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
  isLastStep,
  isComplete
}) => {
  const getNextButtonText = () => {
    if (isLastStep && isComplete) return 'Complete Tutorial ✓';
    if (isLastStep) return 'Complete';
    if (isComplete) return 'Next Step →';
    return 'Next →';
  };

  const getNextButtonClass = () => {
    let className = 'nav-button next';
    if (isLastStep && isComplete) className += ' complete';
    else if (isComplete) className += ' ready';
    return className;
  };

  return (
    <div className="tutorial-navigation">
      <div className="nav-left">
        <button
          className="nav-button previous"
          onClick={onPrevious}
          disabled={!canGoPrevious}
        >
          ← Previous
        </button>
      </div>
      
      <div className="nav-center">
        {isComplete && !isLastStep && (
          <div className="step-complete-indicator">
            <span className="complete-icon">✅</span>
            <span className="complete-text">Step Complete!</span>
          </div>
        )}
      </div>
      
      <div className="nav-right">
        <button
          className={getNextButtonClass()}
          onClick={onNext}
          disabled={!canGoNext && !isComplete}
        >
          {getNextButtonText()}
        </button>
      </div>
    </div>
  );
};