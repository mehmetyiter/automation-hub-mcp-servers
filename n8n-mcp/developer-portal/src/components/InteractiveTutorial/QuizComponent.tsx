import React, { useState } from 'react';
import './QuizComponent.css';

export interface Quiz {
  questions: QuizQuestion[];
  passingScore: number;
}

export interface QuizQuestion {
  id: string;
  question: string;
  type: 'multiple-choice' | 'multiple-select' | 'true-false' | 'code';
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  points?: number;
}

interface QuizComponentProps {
  quiz: Quiz;
  onComplete: (result: { passed: boolean; score: number }) => void;
}

export const QuizComponent: React.FC<QuizComponentProps> = ({
  quiz,
  onComplete
}) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [showResults, setShowResults] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const question = quiz.questions[currentQuestion];
  const userAnswer = answers[question.id];

  const handleAnswer = (answer: any) => {
    setAnswers({
      ...answers,
      [question.id]: answer
    });
  };

  const handleNext = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setShowExplanation(false);
    } else {
      // Calculate score and show results
      const results = calculateResults();
      setShowResults(true);
      onComplete(results);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      setShowExplanation(false);
    }
  };

  const isAnswerCorrect = (questionId: string): boolean => {
    const q = quiz.questions.find(q => q.id === questionId);
    if (!q) return false;

    const userAns = answers[questionId];
    const correctAns = q.correctAnswer;

    if (Array.isArray(correctAns)) {
      return Array.isArray(userAns) && 
        userAns.length === correctAns.length &&
        userAns.every(ans => correctAns.includes(ans));
    }

    return userAns === correctAns;
  };

  const calculateResults = (): { passed: boolean; score: number } => {
    let totalPoints = 0;
    let earnedPoints = 0;

    quiz.questions.forEach(q => {
      const points = q.points || 1;
      totalPoints += points;
      
      if (isAnswerCorrect(q.id)) {
        earnedPoints += points;
      }
    });

    const score = Math.round((earnedPoints / totalPoints) * 100);
    const passed = score >= quiz.passingScore;

    return { passed, score };
  };

  const renderQuestion = () => {
    switch (question.type) {
      case 'multiple-choice':
        return (
          <div className="options-list">
            {question.options?.map((option, index) => (
              <label key={index} className="option-item">
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={userAnswer === option}
                  onChange={() => handleAnswer(option)}
                />
                <span className="option-text">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'multiple-select':
        return (
          <div className="options-list">
            <p className="instruction">Select all that apply:</p>
            {question.options?.map((option, index) => (
              <label key={index} className="option-item">
                <input
                  type="checkbox"
                  value={option}
                  checked={userAnswer?.includes(option) || false}
                  onChange={(e) => {
                    const currentAnswers = userAnswer || [];
                    if (e.target.checked) {
                      handleAnswer([...currentAnswers, option]);
                    } else {
                      handleAnswer(currentAnswers.filter((a: string) => a !== option));
                    }
                  }}
                />
                <span className="option-text">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'true-false':
        return (
          <div className="options-list">
            <label className="option-item">
              <input
                type="radio"
                name={question.id}
                value="true"
                checked={userAnswer === 'true'}
                onChange={() => handleAnswer('true')}
              />
              <span className="option-text">True</span>
            </label>
            <label className="option-item">
              <input
                type="radio"
                name={question.id}
                value="false"
                checked={userAnswer === 'false'}
                onChange={() => handleAnswer('false')}
              />
              <span className="option-text">False</span>
            </label>
          </div>
        );

      case 'code':
        return (
          <div className="code-answer">
            <textarea
              className="code-input"
              value={userAnswer || ''}
              onChange={(e) => handleAnswer(e.target.value)}
              placeholder="Enter your code here..."
              rows={10}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const renderExplanation = () => {
    if (!showExplanation || !question.explanation) return null;

    const isCorrect = isAnswerCorrect(question.id);

    return (
      <div className={`explanation ${isCorrect ? 'correct' : 'incorrect'}`}>
        <div className="explanation-header">
          {isCorrect ? '✅ Correct!' : '❌ Incorrect'}
        </div>
        <div className="explanation-content">
          {question.explanation}
        </div>
        {!isCorrect && (
          <div className="correct-answer">
            <strong>Correct answer:</strong> {
              Array.isArray(question.correctAnswer)
                ? question.correctAnswer.join(', ')
                : question.correctAnswer
            }
          </div>
        )}
      </div>
    );
  };

  const renderResults = () => {
    const results = calculateResults();
    
    return (
      <div className="quiz-results">
        <h2>Quiz Results</h2>
        <div className={`score-display ${results.passed ? 'passed' : 'failed'}`}>
          <div className="score-value">{results.score}%</div>
          <div className="score-label">
            {results.passed ? 'Passed!' : 'Not Passed'}
          </div>
        </div>
        
        <div className="results-summary">
          <p>
            You answered {
              quiz.questions.filter(q => isAnswerCorrect(q.id)).length
            } out of {quiz.questions.length} questions correctly.
          </p>
          <p>
            Passing score: {quiz.passingScore}%
          </p>
        </div>
        
        <div className="results-details">
          <h3>Question Review</h3>
          {quiz.questions.map((q, index) => (
            <div 
              key={q.id} 
              className={`result-item ${isAnswerCorrect(q.id) ? 'correct' : 'incorrect'}`}
            >
              <span className="result-icon">
                {isAnswerCorrect(q.id) ? '✅' : '❌'}
              </span>
              <span className="result-question">
                Question {index + 1}: {q.question}
              </span>
            </div>
          ))}
        </div>
        
        <button 
          className="retake-button"
          onClick={() => {
            setAnswers({});
            setCurrentQuestion(0);
            setShowResults(false);
            setShowExplanation(false);
          }}
        >
          Retake Quiz
        </button>
      </div>
    );
  };

  if (showResults) {
    return renderResults();
  }

  return (
    <div className="quiz-component">
      <div className="quiz-header">
        <h3>Quiz</h3>
        <div className="quiz-progress">
          Question {currentQuestion + 1} of {quiz.questions.length}
        </div>
      </div>
      
      <div className="quiz-content">
        <div className="question-text">
          {question.question}
        </div>
        
        {renderQuestion()}
        
        {renderExplanation()}
      </div>
      
      <div className="quiz-navigation">
        <button
          className="nav-button previous"
          onClick={handlePrevious}
          disabled={currentQuestion === 0}
        >
          ← Previous
        </button>
        
        {userAnswer !== undefined && !showExplanation && question.explanation && (
          <button
            className="check-button"
            onClick={() => setShowExplanation(true)}
          >
            Check Answer
          </button>
        )}
        
        <button
          className="nav-button next"
          onClick={handleNext}
          disabled={userAnswer === undefined}
        >
          {currentQuestion === quiz.questions.length - 1 ? 'Finish' : 'Next'} →
        </button>
      </div>
    </div>
  );
};