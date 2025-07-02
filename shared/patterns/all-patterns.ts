import { WorkflowPattern } from './index';
import { crmPatterns } from './crm-patterns';
import { analyticsPatterns } from './analytics-patterns';
import { ecommercePatterns } from './ecommerce-patterns';
import { socialMediaPatterns } from './social-media-patterns';
import { aiAssistantPatterns } from './ai-assistant-patterns';

// Combine all patterns into a single array
export const allPatterns: WorkflowPattern[] = [
  ...crmPatterns,
  ...analyticsPatterns,
  ...ecommercePatterns,
  ...socialMediaPatterns,
  ...aiAssistantPatterns
];

// Helper function to find patterns by keywords
export function findMatchingPatterns(description: string, platform?: string): WorkflowPattern[] {
  const descLower = description.toLowerCase();
  const matches: Array<{ pattern: WorkflowPattern; score: number }> = [];

  for (const pattern of allPatterns) {
    // Skip if platform specified and pattern doesn't support it
    if (platform && !pattern.platforms[platform as keyof typeof pattern.platforms]) {
      continue;
    }

    let score = 0;
    
    // Check keywords
    for (const keyword of pattern.keywords) {
      if (descLower.includes(keyword.toLowerCase())) {
        score += 2; // Higher weight for keyword matches
      }
    }

    // Check name and description
    if (descLower.includes(pattern.name.toLowerCase())) {
      score += 3;
    }
    if (descLower.includes(pattern.description.toLowerCase())) {
      score += 1;
    }

    // Check examples
    if (pattern.examples) {
      for (const example of pattern.examples) {
        if (example.toLowerCase().includes(descLower) || descLower.includes(example.toLowerCase())) {
          score += 1.5;
        }
      }
    }

    if (score > 0) {
      matches.push({ pattern, score });
    }
  }

  // Sort by score descending and return patterns
  return matches
    .sort((a, b) => b.score - a.score)
    .map(m => m.pattern);
}

// Export for backward compatibility
export { allPatterns as patterns };