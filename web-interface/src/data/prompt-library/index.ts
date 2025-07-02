import { PromptTemplate, PromptSearchFilters } from './types';
import { promptCategories } from './categories';

export { promptCategories };
import { messagingChatOpsPrompts } from './prompts/messaging-chatops';
import { socialMediaPrompts } from './prompts/social-media';
import { emailMarketingPrompts } from './prompts/email-marketing';
import { crmSalesPrompts } from './prompts/crm-sales';
import { smsVoicePrompts } from './prompts/sms-voice';
import { projectManagementPrompts } from './prompts/project-management';
import { dataReportingPrompts } from './prompts/data-reporting';
import { ecommercePrompts } from './prompts/ecommerce';
import { paymentSystemsPrompts } from './prompts/payment-systems';

// Import all prompt collections here as they are created
const allPrompts: PromptTemplate[] = [
  ...messagingChatOpsPrompts,
  ...socialMediaPrompts,
  ...emailMarketingPrompts,
  ...crmSalesPrompts,
  ...smsVoicePrompts,
  ...projectManagementPrompts,
  ...dataReportingPrompts,
  ...ecommercePrompts,
  ...paymentSystemsPrompts,
  // Add more prompt collections as they are created
];

export * from './types';
export * from './categories';

export function getAllPrompts(): PromptTemplate[] {
  return allPrompts;
}

export function getPromptsByCategory(categoryId: string): PromptTemplate[] {
  return allPrompts.filter(prompt => prompt.category === categoryId);
}

export function getPromptById(id: string): PromptTemplate | undefined {
  return allPrompts.find(prompt => prompt.id === id);
}

export function searchPrompts(filters: PromptSearchFilters): PromptTemplate[] {
  let results = [...allPrompts];

  // Filter by category
  if (filters.category) {
    results = results.filter(prompt => prompt.category === filters.category);
  }

  // Filter by tags
  if (filters.tags && filters.tags.length > 0) {
    results = results.filter(prompt =>
      filters.tags!.some(tag => prompt.tags.includes(tag))
    );
  }

  // Filter by platforms
  if (filters.platforms && filters.platforms.length > 0) {
    results = results.filter(prompt =>
      filters.platforms!.some(platform =>
        prompt.targetPlatforms.some(target =>
          target.toLowerCase().includes(platform.toLowerCase())
        )
      )
    );
  }

  // Filter by difficulty
  if (filters.difficulty) {
    results = results.filter(prompt => prompt.difficulty === filters.difficulty);
  }

  // Search query
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    results = results.filter(prompt =>
      prompt.title.toLowerCase().includes(query) ||
      prompt.description.toLowerCase().includes(query) ||
      prompt.useCase.toLowerCase().includes(query) ||
      prompt.prompt.toLowerCase().includes(query) ||
      prompt.tags.some(tag => tag.toLowerCase().includes(query))
    );
  }

  return results;
}

export function getPopularTags(): string[] {
  const tagCounts = new Map<string, number>();
  
  allPrompts.forEach(prompt => {
    prompt.tags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });

  return Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag]) => tag);
}

export function getPromptsCount(): {
  total: number;
  byCategory: Record<string, number>;
  byDifficulty: Record<string, number>;
} {
  const byCategory: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {
    beginner: 0,
    intermediate: 0,
    advanced: 0
  };

  allPrompts.forEach(prompt => {
    // Count by category
    byCategory[prompt.category] = (byCategory[prompt.category] || 0) + 1;
    
    // Count by difficulty
    byDifficulty[prompt.difficulty]++;
  });

  return {
    total: allPrompts.length,
    byCategory,
    byDifficulty
  };
}