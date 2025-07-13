import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tutorials } from '../tutorials';
import { TutorialEngine } from '../components/InteractiveTutorial/TutorialEngine';
import './Tutorials.css';

export const Tutorials: React.FC = () => {
  const [selectedTutorial, setSelectedTutorial] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleTutorialComplete = (tutorialId: string) => {
    console.log(`Tutorial ${tutorialId} completed!`);
    // Save completion status to localStorage or API
    localStorage.setItem(`tutorial_${tutorialId}_completed`, 'true');
    setSelectedTutorial(null);
  };

  const handleTutorialProgress = (tutorialId: string, stepId: string, progress: any) => {
    console.log(`Tutorial ${tutorialId} - Step ${stepId}:`, progress);
    // Save progress to localStorage or API
    localStorage.setItem(
      `tutorial_${tutorialId}_progress`,
      JSON.stringify({ stepId, progress })
    );
  };

  const getTutorialProgress = (tutorialId: string) => {
    const completed = localStorage.getItem(`tutorial_${tutorialId}_completed`);
    const progress = localStorage.getItem(`tutorial_${tutorialId}_progress`);
    
    if (completed === 'true') return 100;
    if (!progress) return 0;
    
    try {
      const { stepId } = JSON.parse(progress);
      const tutorial = tutorials.find(t => t.id === tutorialId);
      if (!tutorial) return 0;
      
      const stepIndex = tutorial.steps.findIndex(s => s.id === stepId);
      return Math.round((stepIndex / tutorial.steps.length) * 100);
    } catch {
      return 0;
    }
  };

  if (selectedTutorial) {
    const tutorial = tutorials.find(t => t.id === selectedTutorial);
    if (!tutorial) return null;

    return (
      <div className="tutorial-container">
        <div className="tutorial-header-bar">
          <button
            className="back-button"
            onClick={() => setSelectedTutorial(null)}
          >
            ← Back to Tutorials
          </button>
        </div>
        <TutorialEngine
          tutorial={tutorial}
          onComplete={() => handleTutorialComplete(tutorial.id)}
          onProgress={(stepId, progress) => 
            handleTutorialProgress(tutorial.id, stepId, progress)
          }
        />
      </div>
    );
  }

  return (
    <div className="tutorials-page">
      <div className="tutorials-header">
        <h1>Interactive Tutorials</h1>
        <p>Learn n8n-MCP with hands-on, interactive tutorials</p>
      </div>

      <div className="tutorials-grid">
        {tutorials.map(tutorial => {
          const progress = getTutorialProgress(tutorial.id);
          const isCompleted = progress === 100;

          return (
            <div key={tutorial.id} className="tutorial-card">
              <div className="tutorial-card-header">
                <span className={`difficulty-badge ${tutorial.difficulty}`}>
                  {tutorial.difficulty}
                </span>
                <span className="time-estimate">
                  ⏱️ {tutorial.estimatedTime} min
                </span>
              </div>

              <h3 className="tutorial-title">{tutorial.title}</h3>
              <p className="tutorial-description">{tutorial.description}</p>

              <div className="tutorial-tags">
                {tutorial.tags.map(tag => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>

              {tutorial.prerequisites.length > 0 && (
                <div className="prerequisites">
                  <strong>Prerequisites:</strong>
                  <ul>
                    {tutorial.prerequisites.map((prereq, index) => (
                      <li key={index}>{prereq}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="tutorial-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="progress-text">
                  {isCompleted ? '✅ Completed' : `${progress}% Complete`}
                </span>
              </div>

              <button
                className={`start-button ${isCompleted ? 'completed' : ''}`}
                onClick={() => setSelectedTutorial(tutorial.id)}
              >
                {isCompleted ? 'Review Tutorial' : 
                 progress > 0 ? 'Continue Tutorial' : 'Start Tutorial'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="tutorials-footer">
        <h2>More Resources</h2>
        <div className="resources-grid">
          <div className="resource-card">
            <h3>📚 Documentation</h3>
            <p>Comprehensive API reference and guides</p>
            <button onClick={() => navigate('/docs')}>
              View Docs
            </button>
          </div>
          <div className="resource-card">
            <h3>💻 Code Examples</h3>
            <p>Real-world examples and templates</p>
            <button onClick={() => navigate('/examples')}>
              Browse Examples
            </button>
          </div>
          <div className="resource-card">
            <h3>🎥 Video Tutorials</h3>
            <p>Watch step-by-step video guides</p>
            <button onClick={() => navigate('/videos')}>
              Watch Videos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};