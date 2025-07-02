import { Clock, Tag, Zap, ChevronRight } from 'lucide-react';
import { PromptTemplate } from '../../data/prompt-library/types';
import { getCategoryById } from '../../data/prompt-library/categories';

interface PromptCardProps {
  prompt: PromptTemplate;
  onClick: () => void;
}

export default function PromptCard({ prompt, onClick }: PromptCardProps) {
  const category = getCategoryById(prompt.category);
  
  const difficultyColors = {
    beginner: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
    intermediate: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
    advanced: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
  };

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-all cursor-pointer group border border-gray-200 dark:border-gray-700"
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{category?.icon}</div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                {prompt.title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {category?.name}
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transform group-hover:translate-x-1 transition-transform" />
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
          {prompt.description}
        </p>

        {/* Use Case */}
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md">
          <p className="text-xs text-gray-600 dark:text-gray-300">
            <span className="font-medium">Use Case:</span> {prompt.useCase}
          </p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {prompt.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
            >
              <Tag className="h-3 w-3" />
              {tag}
            </span>
          ))}
          {prompt.tags.length > 3 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              +{prompt.tags.length - 3} more
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${difficultyColors[prompt.difficulty]}`}>
              <Zap className="h-3 w-3" />
              {prompt.difficulty}
            </span>
            {prompt.estimatedTime && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Clock className="h-3 w-3" />
                {prompt.estimatedTime}
              </span>
            )}
          </div>
        </div>

        {/* Target Platforms */}
        <div className="mt-3 flex flex-wrap gap-1">
          {prompt.targetPlatforms.slice(0, 3).map(platform => (
            <span
              key={platform}
              className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded"
            >
              {platform}
            </span>
          ))}
          {prompt.targetPlatforms.length > 3 && (
            <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
              +{prompt.targetPlatforms.length - 3}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}