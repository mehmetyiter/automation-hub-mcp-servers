import { analyticsPatterns } from './patterns/analytics-patterns.js';
import { crmPatterns } from './patterns/crm-patterns.js';

export interface WorkflowPattern {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  category: string;
  difficulty: 'simple' | 'intermediate' | 'complex';
  platforms: {
    n8n?: any;
    make?: any;
    zapier?: any;
    vapi?: any;
  };
  requiredServices?: string[];
  examples?: string[];
  tags?: string[];
}

// Combine all patterns
const allPatterns: WorkflowPattern[] = [
  ...analyticsPatterns,
  ...crmPatterns
];

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
    if (pattern.description && descLower.includes(pattern.description.toLowerCase())) {
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