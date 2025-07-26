export type WorkflowGenerationMode = 'quick' | 'advanced' | 'expert';

export interface WorkflowGenerationOptions {
  mode: WorkflowGenerationMode;
  showPrompt: boolean;
  allowPromptEdit: boolean;
  enhancePrompt: boolean;
}

export const GENERATION_MODE_CONFIG: Record<WorkflowGenerationMode, WorkflowGenerationOptions> = {
  quick: {
    mode: 'quick',
    showPrompt: false,
    allowPromptEdit: false,
    enhancePrompt: true
  },
  advanced: {
    mode: 'advanced',
    showPrompt: true,
    allowPromptEdit: false,
    enhancePrompt: true
  },
  expert: {
    mode: 'expert',
    showPrompt: true,
    allowPromptEdit: true,
    enhancePrompt: true
  }
};

export const GENERATION_MODE_INFO = {
  quick: {
    title: 'Quick Mode',
    description: 'Generate workflow instantly with AI optimization',
    icon: '⚡',
    features: [
      'One-click generation',
      'AI handles all complexity',
      'Best for simple workflows'
    ]
  },
  advanced: {
    title: 'Advanced Mode',
    description: 'See the enhanced prompt before generation',
    icon: '🔧',
    features: [
      'Review AI-enhanced prompt',
      'Understand workflow structure',
      'Good for complex workflows'
    ]
  },
  expert: {
    title: 'Expert Mode',
    description: 'Full control over prompt and generation',
    icon: '🎯',
    features: [
      'Edit and customize prompt',
      'Fine-tune every detail',
      'Maximum flexibility'
    ]
  }
};