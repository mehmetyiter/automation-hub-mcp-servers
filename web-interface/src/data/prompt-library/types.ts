export interface PromptTemplate {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  useCase: string;
  prompt: string;
  example?: string;
  targetPlatforms: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime?: string;
  requiredCredentials?: string[];
}

export interface PromptSearchFilters {
  category?: string;
  tags?: string[];
  platforms?: string[];
  difficulty?: string;
  searchQuery?: string;
}