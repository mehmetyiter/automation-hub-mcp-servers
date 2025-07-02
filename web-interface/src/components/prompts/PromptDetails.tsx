import { useState } from 'react';
import { X, Copy, Check, Clock, Tag, Zap, Play, Key } from 'lucide-react';
import { PromptTemplate } from '../../data/prompt-library/types';
import { getCategoryById } from '../../data/prompt-library/categories';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface PromptDetailsProps {
  prompt: PromptTemplate;
  onClose: () => void;
}

export default function PromptDetails({ prompt, onClose }: PromptDetailsProps) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const category = getCategoryById(prompt.category);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt.prompt);
    setCopied(true);
    toast.success('Prompt copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUsePrompt = () => {
    // Navigate to create automation page with pre-filled prompt
    navigate('/create', { 
      state: { 
        prompt: prompt.prompt,
        title: prompt.title 
      } 
    });
  };

  const difficultyColors = {
    beginner: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    intermediate: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    advanced: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{category?.icon}</div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {prompt.title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {category?.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Description */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Description
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              {prompt.description}
            </p>
          </div>

          {/* Use Case */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Use Case Scenario
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {prompt.useCase}
            </p>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Difficulty:
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${difficultyColors[prompt.difficulty]}`}>
                {prompt.difficulty}
              </span>
            </div>
            {prompt.estimatedTime && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Estimated Time:
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {prompt.estimatedTime}
                </span>
              </div>
            )}
            {prompt.requiredCredentials && prompt.requiredCredentials.length > 0 && (
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Credentials Required
                </span>
              </div>
            )}
          </div>

          {/* Prompt */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Automation Prompt
              </h3>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4">
              <pre className="text-sm text-gray-100 whitespace-pre-wrap font-mono">
                {prompt.prompt}
              </pre>
            </div>
          </div>

          {/* Tags */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {prompt.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  <Tag className="h-3 w-3" />
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Target Platforms */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Compatible Platforms
            </h3>
            <div className="flex flex-wrap gap-2">
              {prompt.targetPlatforms.map(platform => (
                <span
                  key={platform}
                  className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-md text-sm font-medium"
                >
                  {platform}
                </span>
              ))}
            </div>
          </div>

          {/* Required Credentials */}
          {prompt.requiredCredentials && prompt.requiredCredentials.length > 0 && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                Required Credentials
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-2">
                You'll need the following credentials to implement this automation:
              </p>
              <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-300">
                {prompt.requiredCredentials.map(cred => (
                  <li key={cred}>{cred}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Example Implementation */}
          {prompt.example && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Example Implementation
              </h3>
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
                <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {prompt.example}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleUsePrompt}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            <Play className="h-4 w-4" />
            Use This Prompt
          </button>
        </div>
      </div>
    </div>
  );
}