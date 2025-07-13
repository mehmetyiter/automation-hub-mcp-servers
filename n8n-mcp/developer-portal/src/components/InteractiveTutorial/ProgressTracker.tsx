import React from 'react';
import { TutorialStep, Progress } from './TutorialEngine';
import './ProgressTracker.css';

interface ProgressTrackerProps {
  steps: TutorialStep[];
  currentStep: number;
  progress: Progress;
  onStepClick?: (index: number) => void;
}

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  steps,
  currentStep,
  progress,
  onStepClick
}) => {
  const calculateOverallProgress = (): number => {
    const completedSteps = steps.filter(step => progress[step.id]?.completed).length;
    return Math.round((completedSteps / steps.length) * 100);
  };

  const getStepStatus = (step: TutorialStep, index: number): string => {
    if (progress[step.id]?.completed) return 'completed';
    if (index === currentStep) return 'current';
    if (index < currentStep) return 'visited';
    return 'locked';
  };

  const overallProgress = calculateOverallProgress();

  return (
    <div className="progress-tracker">
      <div className="progress-header">
        <h3>Progress</h3>
        <span className="progress-percentage">{overallProgress}%</span>
      </div>
      
      <div className="progress-bar">
        <div 
          className="progress-fill"
          style={{ width: `${overallProgress}%` }}
        />
      </div>
      
      <div className="steps-list">
        {steps.map((step, index) => {
          const status = getStepStatus(step, index);
          const stepProgress = progress[step.id];
          const isClickable = onStepClick && (status === 'completed' || status === 'visited' || status === 'current');
          
          return (
            <div
              key={step.id}
              className={`step-item ${status} ${isClickable ? 'clickable' : ''}`}
              onClick={() => isClickable && onStepClick(index)}
            >
              <div className="step-indicator">
                {status === 'completed' ? (
                  <span className="checkmark">✓</span>
                ) : (
                  <span className="step-number">{index + 1}</span>
                )}
              </div>
              
              <div className="step-info">
                <div className="step-title">{step.title}</div>
                <div className="step-meta">
                  <span className={`step-type ${step.type}`}>{step.type}</span>
                  {stepProgress && (
                    <>
                      {stepProgress.score !== undefined && (
                        <span className="step-score">
                          {stepProgress.score}%
                        </span>
                      )}
                      {stepProgress.attempts > 1 && (
                        <span className="step-attempts">
                          {stepProgress.attempts} attempts
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              {index < steps.length - 1 && (
                <div className={`step-connector ${status === 'completed' ? 'completed' : ''}`} />
              )}
            </div>
          );
        })}
      </div>
      
      <div className="progress-stats">
        <div className="stat">
          <span className="stat-label">Completed</span>
          <span className="stat-value">
            {steps.filter(s => progress[s.id]?.completed).length} / {steps.length}
          </span>
        </div>
        
        <div className="stat">
          <span className="stat-label">Time Spent</span>
          <span className="stat-value">
            {formatTime(
              Object.values(progress).reduce((total, p) => total + (p.timeSpent || 0), 0)
            )}
          </span>
        </div>
        
        <div className="stat">
          <span className="stat-label">Average Score</span>
          <span className="stat-value">
            {calculateAverageScore(progress)}%
          </span>
        </div>
      </div>
    </div>
  );
};

function formatTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function calculateAverageScore(progress: Progress): number {
  const scores = Object.values(progress)
    .filter(p => p.completed && p.score !== undefined)
    .map(p => p.score!);
  
  if (scores.length === 0) return 0;
  
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return Math.round(average);
}