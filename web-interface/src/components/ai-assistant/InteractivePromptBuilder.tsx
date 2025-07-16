import React, { useState } from 'react';
import { Send, Info, Database, Cloud, Mail, MessageSquare } from 'lucide-react';

interface PromptQuestion {
  id: string;
  question: string;
  type: 'text' | 'select' | 'multiselect' | 'credentials';
  options?: string[];
  category: 'database' | 'integration' | 'notification' | 'general';
  icon?: React.ReactNode;
}

interface InteractivePromptBuilderProps {
  onPromptComplete: (enrichedPrompt: string, metadata: any) => void;
  initialPrompt: string;
}

export const InteractivePromptBuilder: React.FC<InteractivePromptBuilderProps> = ({
  onPromptComplete,
  initialPrompt
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(true);

  // Analyze prompt and generate relevant questions
  const analyzePromptAndGenerateQuestions = (prompt: string): PromptQuestion[] => {
    const questions: PromptQuestion[] = [];
    const lowerPrompt = prompt.toLowerCase();

    // Database questions
    if (lowerPrompt.includes('database') || lowerPrompt.includes('data') || lowerPrompt.includes('store')) {
      questions.push({
        id: 'database_type',
        question: 'What type of database are you using?',
        type: 'select',
        options: ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'SQLite', 'Other'],
        category: 'database',
        icon: <Database className="w-4 h-4" />
      });

      questions.push({
        id: 'database_details',
        question: 'Would you like to provide database connection details now?',
        type: 'credentials',
        category: 'database',
        icon: <Database className="w-4 h-4" />
      });
    }

    // API/Integration questions
    if (lowerPrompt.includes('api') || lowerPrompt.includes('external') || lowerPrompt.includes('integrate')) {
      questions.push({
        id: 'api_services',
        question: 'Which external services will you integrate with?',
        type: 'multiselect',
        options: ['REST API', 'GraphQL', 'Webhook', 'Custom Service'],
        category: 'integration',
        icon: <Cloud className="w-4 h-4" />
      });

      questions.push({
        id: 'api_endpoints',
        question: 'Do you have specific API endpoints to share?',
        type: 'text',
        category: 'integration',
        icon: <Cloud className="w-4 h-4" />
      });
    }

    // Notification questions
    if (lowerPrompt.includes('email') || lowerPrompt.includes('sms') || lowerPrompt.includes('notify')) {
      questions.push({
        id: 'notification_channels',
        question: 'Which notification channels will you use?',
        type: 'multiselect',
        options: ['Email', 'SMS', 'Slack', 'Discord', 'WhatsApp', 'Push Notification'],
        category: 'notification',
        icon: <Mail className="w-4 h-4" />
      });

      if (lowerPrompt.includes('email')) {
        questions.push({
          id: 'email_service',
          question: 'Which email service provider?',
          type: 'select',
          options: ['Gmail', 'SendGrid', 'AWS SES', 'Mailgun', 'SMTP Server'],
          category: 'notification',
          icon: <Mail className="w-4 h-4" />
        });
      }

      if (lowerPrompt.includes('sms')) {
        questions.push({
          id: 'sms_service',
          question: 'Which SMS service provider?',
          type: 'select',
          options: ['Twilio', 'Vonage', 'AWS SNS', 'MessageBird'],
          category: 'notification',
          icon: <MessageSquare className="w-4 h-4" />
        });
      }
    }

    // Error handling questions
    questions.push({
      id: 'error_handling',
      question: 'How should errors be handled?',
      type: 'multiselect',
      options: ['Retry automatically', 'Send notifications', 'Log to file', 'Fallback process'],
      category: 'general',
      icon: <Info className="w-4 h-4" />
    });

    // Schedule questions
    if (lowerPrompt.includes('schedule') || lowerPrompt.includes('cron') || lowerPrompt.includes('daily')) {
      questions.push({
        id: 'schedule_frequency',
        question: 'How often should this workflow run?',
        type: 'select',
        options: ['Every minute', 'Every hour', 'Daily', 'Weekly', 'Monthly', 'Custom'],
        category: 'general',
        icon: <Info className="w-4 h-4" />
      });
    }

    return questions;
  };

  const [questions] = useState<PromptQuestion[]>(() => {
    const q = analyzePromptAndGenerateQuestions(initialPrompt);
    setIsAnalyzing(false);
    return q;
  });

  const handleAnswer = (questionId: string, answer: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Build enriched prompt
      const enrichedPrompt = buildEnrichedPrompt();
      onPromptComplete(enrichedPrompt, answers);
    }
  };

  const buildEnrichedPrompt = (): string => {
    let enriched = initialPrompt + '\n\n### Additional Context:\n';

    Object.entries(answers).forEach(([questionId, answer]) => {
      const question = questions.find(q => q.id === questionId);
      if (question && answer) {
        enriched += `\n**${question.question}**\n${
          Array.isArray(answer) ? answer.join(', ') : answer
        }\n`;
      }
    });

    return enriched;
  };

  if (isAnalyzing) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Analyzing your request...</span>
      </div>
    );
  }

  if (questions.length === 0) {
    // No additional questions needed
    onPromptComplete(initialPrompt, {});
    return null;
  }

  const currentQuestion = questions[currentStep];
  const progress = ((currentStep + 1) / questions.length) * 100;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Gathering details</span>
          <span>{currentStep + 1} of {questions.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Current Question */}
      <div className="mb-6">
        <div className="flex items-center mb-3">
          {currentQuestion.icon}
          <h3 className="text-lg font-medium ml-2">{currentQuestion.question}</h3>
        </div>

        {/* Answer Input */}
        {currentQuestion.type === 'text' && (
          <input
            type="text"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Type your answer..."
            value={answers[currentQuestion.id] || ''}
            onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleNext()}
          />
        )}

        {currentQuestion.type === 'select' && (
          <select
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={answers[currentQuestion.id] || ''}
            onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
          >
            <option value="">Select an option...</option>
            {currentQuestion.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        )}

        {currentQuestion.type === 'multiselect' && (
          <div className="space-y-2">
            {currentQuestion.options?.map(option => (
              <label key={option} className="flex items-center">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={(answers[currentQuestion.id] || []).includes(option)}
                  onChange={(e) => {
                    const current = answers[currentQuestion.id] || [];
                    if (e.target.checked) {
                      handleAnswer(currentQuestion.id, [...current, option]);
                    } else {
                      handleAnswer(currentQuestion.id, current.filter((o: string) => o !== option));
                    }
                  }}
                />
                {option}
              </label>
            ))}
          </div>
        )}

        {currentQuestion.type === 'credentials' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              You can provide credentials now for a ready-to-use workflow, or configure them later.
            </p>
            <textarea
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={4}
              placeholder="Paste your connection details (optional)..."
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
          disabled={currentStep === 0}
        >
          Back
        </button>
        
        <div className="flex space-x-3">
          <button
            onClick={() => onPromptComplete(initialPrompt, answers)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Skip all
          </button>
          
          <button
            onClick={handleNext}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
          >
            {currentStep === questions.length - 1 ? 'Complete' : 'Next'}
            <Send className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );
};