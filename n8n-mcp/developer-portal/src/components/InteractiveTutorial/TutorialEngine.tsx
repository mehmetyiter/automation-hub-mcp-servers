import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CodeSandbox } from '../CodeSandbox/CodeSandbox';
import { ProgressTracker } from './ProgressTracker';
import { ValidationFeedback } from './ValidationFeedback';
import { HintSystem } from './HintSystem';
import { QuizComponent } from './QuizComponent';
import { TutorialNavigation } from './TutorialNavigation';
import { tutorialValidators } from './tutorialValidators';
import { executeInSandbox } from '../../services/sandbox-executor';
import './TutorialEngine.css';

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number;
  tags: string[];
  prerequisites?: string[];
  environment: TutorialEnvironment;
  dependencies?: Record<string, string>;
  steps: TutorialStep[];
}

export interface TutorialEnvironment {
  language: 'typescript' | 'javascript' | 'python' | 'go';
  runtime: string;
  setupCode?: string;
  cleanupCode?: string;
}

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  content: string;
  type: 'lesson' | 'exercise' | 'challenge' | 'quiz';
  code?: {
    initial: string;
    solution: string;
    language: string;
    hiddenTests?: string;
  };
  validation?: {
    type: 'code' | 'api' | 'quiz' | 'manual';
    validator: (input: any) => ValidationResult | Promise<ValidationResult>;
    successMessage?: string;
  };
  hints?: string[];
  resources?: Array<{
    title: string;
    url: string;
    type: 'documentation' | 'video' | 'article';
  }>;
}

export interface ValidationResult {
  success: boolean;
  message: string;
  details?: any;
  hint?: string;
  score?: number;
}

export interface Progress {
  [stepId: string]: {
    completed: boolean;
    attempts: number;
    score?: number;
    completedAt?: Date;
    timeSpent: number;
  };
}

interface TutorialEngineProps {
  tutorial: Tutorial;
  onComplete?: (progress: Progress) => void;
  onProgress?: (stepId: string, progress: Progress) => void;
}

export const TutorialEngine: React.FC<TutorialEngineProps> = ({
  tutorial,
  onComplete,
  onProgress
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState<Progress>({});
  const [code, setCode] = useState('');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<any>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [stepStartTime, setStepStartTime] = useState<number>(Date.now());
  const [hintsUsed, setHintsUsed] = useState<number>(0);
  
  const step = tutorial.steps[currentStep];
  const sandboxRef = useRef<any>(null);

  // Initialize step
  useEffect(() => {
    if (step?.code) {
      setCode(step.code.initial);
    }
    setValidationResult(null);
    setOutput(null);
    setShowSolution(false);
    setStepStartTime(Date.now());
    setHintsUsed(0);
  }, [currentStep, step]);

  // Save progress to localStorage
  useEffect(() => {
    const savedProgress = localStorage.getItem(`tutorial-progress-${tutorial.id}`);
    if (savedProgress) {
      setProgress(JSON.parse(savedProgress));
    }
  }, [tutorial.id]);

  const saveProgress = useCallback((newProgress: Progress) => {
    setProgress(newProgress);
    localStorage.setItem(`tutorial-progress-${tutorial.id}`, JSON.stringify(newProgress));
  }, [tutorial.id]);

  const handleCodeChange = useCallback((newCode: string) => {
    setCode(newCode);
    
    // Real-time validation for code exercises
    if (step.validation?.type === 'code' && step.validation.validator) {
      try {
        const result = step.validation.validator(newCode);
        if (result && typeof result.then !== 'function') {
          setValidationResult(result);
        }
      } catch (error) {
        console.error('Validation error:', error);
      }
    }
  }, [step]);

  const handleRunCode = async () => {
    if (!step.code) return;
    
    setIsRunning(true);
    setOutput(null);
    
    try {
      // Execute code in sandboxed environment
      const result = await executeInSandbox({
        code,
        language: step.code.language,
        environment: tutorial.environment,
        dependencies: tutorial.dependencies,
        setupCode: tutorial.environment.setupCode,
        hiddenTests: step.code.hiddenTests
      });
      
      setOutput(result);
      
      // Validate output if needed
      if (step.validation?.type === 'api' && step.validation.validator) {
        const validationResult = await step.validation.validator(result);
        setValidationResult(validationResult);
        
        if (validationResult.success) {
          markStepComplete(step.id, validationResult.score);
        }
      }
      
      return result;
    } catch (error: any) {
      console.error('Code execution failed:', error);
      setOutput({ 
        error: error.message || 'Code execution failed',
        type: 'error'
      });
    } finally {
      setIsRunning(false);
    }
  };

  const markStepComplete = useCallback((stepId: string, score?: number) => {
    const timeSpent = Date.now() - stepStartTime;
    const stepProgress = {
      completed: true,
      attempts: (progress[stepId]?.attempts || 0) + 1,
      score: score || 100,
      completedAt: new Date(),
      timeSpent: (progress[stepId]?.timeSpent || 0) + timeSpent
    };
    
    const newProgress = {
      ...progress,
      [stepId]: stepProgress
    };
    
    saveProgress(newProgress);
    
    if (onProgress) {
      onProgress(stepId, newProgress);
    }
    
    // Check if tutorial is complete
    const allStepsCompleted = tutorial.steps.every(
      s => newProgress[s.id]?.completed
    );
    
    if (allStepsCompleted && onComplete) {
      onComplete(newProgress);
    }
    
    // Auto-advance after a short delay
    setTimeout(() => {
      if (currentStep < tutorial.steps.length - 1) {
        setCurrentStep(currentStep + 1);
      }
    }, 1500);
  }, [currentStep, progress, stepStartTime, tutorial.steps, saveProgress, onProgress, onComplete]);

  const handleQuizComplete = useCallback((result: { passed: boolean; score: number }) => {
    if (result.passed) {
      markStepComplete(step.id, result.score);
    }
  }, [step.id, markStepComplete]);

  const handleShowHint = useCallback(() => {
    setHintsUsed(hintsUsed + 1);
  }, [hintsUsed]);

  const handleRevealSolution = useCallback(() => {
    setShowSolution(true);
    if (step.code) {
      setCode(step.code.solution);
    }
  }, [step]);

  const handleManualValidation = useCallback(async () => {
    if (step.validation?.validator) {
      const result = await step.validation.validator({ code, output });
      setValidationResult(result);
      
      if (result.success) {
        markStepComplete(step.id, result.score);
      }
    }
  }, [step, code, output, markStepComplete]);

  const canGoNext = progress[step.id]?.completed || showSolution;
  const canGoPrevious = currentStep > 0;

  return (
    <div className="tutorial-engine">
      <div className="tutorial-header">
        <h1>{tutorial.title}</h1>
        <div className="tutorial-meta">
          <span className={`difficulty ${tutorial.difficulty}`}>
            {tutorial.difficulty}
          </span>
          <span className="estimated-time">
            ⏱️ {tutorial.estimatedTime} min
          </span>
          <span className="progress-indicator">
            Step {currentStep + 1} of {tutorial.steps.length}
          </span>
        </div>
      </div>
      
      <ProgressTracker 
        steps={tutorial.steps}
        currentStep={currentStep}
        progress={progress}
        onStepClick={(index) => {
          if (index < currentStep || progress[tutorial.steps[index].id]?.completed) {
            setCurrentStep(index);
          }
        }}
      />
      
      <div className="tutorial-content">
        <div className="tutorial-main">
          <div className="step-header">
            <span className={`step-type ${step.type}`}>{step.type}</span>
            <h2>{step.title}</h2>
          </div>
          
          <div className="step-description">
            <div 
              className="markdown-content"
              dangerouslySetInnerHTML={{ __html: step.content }}
            />
          </div>
          
          {validationResult && (
            <ValidationFeedback 
              result={validationResult}
              onDismiss={() => setValidationResult(null)}
            />
          )}
          
          {step.hints && step.hints.length > 0 && (
            <HintSystem 
              hints={step.hints}
              hintsUsed={hintsUsed}
              onShowHint={handleShowHint}
            />
          )}
          
          {step.resources && step.resources.length > 0 && (
            <div className="step-resources">
              <h3>📚 Resources</h3>
              <ul>
                {step.resources.map((resource, index) => (
                  <li key={index}>
                    <a 
                      href={resource.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={`resource-link ${resource.type}`}
                    >
                      {resource.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        {step.code && (
          <div className="tutorial-code-section">
            <div className="code-editor-header">
              <h3>Code Editor</h3>
              <div className="code-actions">
                <button
                  onClick={handleRunCode}
                  disabled={isRunning}
                  className="run-button"
                >
                  {isRunning ? '⏳ Running...' : '▶️ Run Code'}
                </button>
                
                {step.validation?.type === 'manual' && (
                  <button
                    onClick={handleManualValidation}
                    className="validate-button"
                  >
                    ✓ Check Solution
                  </button>
                )}
                
                {process.env.NODE_ENV === 'development' && !showSolution && (
                  <button
                    onClick={handleRevealSolution}
                    className="solution-button"
                  >
                    👁️ Show Solution
                  </button>
                )}
              </div>
            </div>
            
            <CodeSandbox
              ref={sandboxRef}
              initialCode={step.code.initial}
              language={step.code.language}
              onChange={handleCodeChange}
              theme="vs-dark"
              height="400px"
              readOnly={showSolution}
            />
            
            {output && (
              <div className={`code-output ${output.type || 'success'}`}>
                <h4>Output:</h4>
                <pre>{
                  typeof output === 'object' 
                    ? JSON.stringify(output, null, 2)
                    : String(output)
                }</pre>
              </div>
            )}
          </div>
        )}
        
        {step.type === 'quiz' && step.validation && (
          <QuizComponent 
            quiz={step.validation as any}
            onComplete={handleQuizComplete}
          />
        )}
      </div>
      
      <TutorialNavigation
        onPrevious={() => setCurrentStep(Math.max(0, currentStep - 1))}
        onNext={() => setCurrentStep(Math.min(tutorial.steps.length - 1, currentStep + 1))}
        canGoPrevious={canGoPrevious}
        canGoNext={canGoNext}
        isLastStep={currentStep === tutorial.steps.length - 1}
        isComplete={progress[step.id]?.completed}
      />
    </div>
  );
};