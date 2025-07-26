import React from 'react';
import { Zap, Wrench, Target } from 'lucide-react';

interface GenerationModeSelectorProps {
  mode: 'quick' | 'advanced' | 'expert';
  onChange: (mode: 'quick' | 'advanced' | 'expert') => void;
}

const modes = [
  {
    id: 'quick',
    name: 'Quick Mode',
    description: 'Generate workflow instantly',
    icon: Zap,
    features: ['One-click generation', 'AI handles complexity', 'Best for simple workflows']
  },
  {
    id: 'advanced',
    name: 'Advanced Mode',
    description: 'Review enhanced prompt',
    icon: Wrench,
    features: ['See AI-enhanced prompt', 'Understand workflow structure', 'Good for complex workflows']
  },
  {
    id: 'expert',
    name: 'Expert Mode',
    description: 'Full control over generation',
    icon: Target,
    features: ['Edit and customize prompt', 'Fine-tune every detail', 'Maximum flexibility']
  }
];

export function GenerationModeSelector({ mode, onChange }: GenerationModeSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {modes.map((modeOption) => {
        const Icon = modeOption.icon;
        const isSelected = mode === modeOption.id;
        
        return (
          <button
            key={modeOption.id}
            onClick={() => onChange(modeOption.id as any)}
            className={`
              relative p-4 rounded-lg border-2 transition-all text-left
              ${isSelected 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' 
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }
            `}
          >
            <div className="flex items-start space-x-3">
              <div className={`
                p-2 rounded-lg 
                ${isSelected 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                }
              `}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className={`font-semibold mb-1 ${isSelected ? 'text-blue-900 dark:text-blue-100' : ''}`}>
                  {modeOption.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {modeOption.description}
                </p>
                <ul className="space-y-1">
                  {modeOption.features.map((feature, idx) => (
                    <li key={idx} className="text-xs text-gray-500 dark:text-gray-500 flex items-center">
                      <span className="w-1 h-1 bg-gray-400 rounded-full mr-2"></span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {isSelected && (
              <div className="absolute top-2 right-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}