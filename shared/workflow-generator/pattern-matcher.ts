import { WorkflowPattern } from '../patterns';

export interface PatternMatch {
  pattern: WorkflowPattern;
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
}

export class PatternMatcher {
  constructor(private patterns: WorkflowPattern[]) {}

  findMatches(
    description: string,
    platform?: string,
    intent?: any
  ): PatternMatch[] {
    const descriptionLower = description.toLowerCase();
    const words = this.tokenize(descriptionLower);
    
    const matches: PatternMatch[] = [];

    for (const pattern of this.patterns) {
      // Skip if platform doesn't match
      if (platform && !pattern.platforms[platform]) {
        continue;
      }

      let score = 0;
      const matchedKeywords: string[] = [];
      const missingKeywords: string[] = [];

      // Keyword matching
      for (const keyword of pattern.keywords) {
        const keywordLower = keyword.toLowerCase();
        
        if (descriptionLower.includes(keywordLower)) {
          score += 10; // Full phrase match
          matchedKeywords.push(keyword);
        } else if (words.some(word => word.includes(keywordLower) || keywordLower.includes(word))) {
          score += 5; // Partial match
          matchedKeywords.push(keyword);
        } else {
          missingKeywords.push(keyword);
        }
      }

      // Category bonus
      if (intent?.category && pattern.category === intent.category) {
        score += 20;
      }

      // Example matching
      if (pattern.examples) {
        for (const example of pattern.examples) {
          const similarity = this.calculateSimilarity(description, example);
          if (similarity > 0.7) {
            score += 15;
            break;
          } else if (similarity > 0.5) {
            score += 10;
            break;
          }
        }
      }

      // Tag matching
      if (pattern.tags && intent?.tags) {
        const commonTags = pattern.tags.filter(tag => 
          intent.tags.includes(tag)
        );
        score += commonTags.length * 5;
      }

      // Services matching
      if (pattern.requiredServices && intent?.services) {
        const commonServices = pattern.requiredServices.filter(service =>
          intent.services.includes(service)
        );
        score += commonServices.length * 8;
      }

      // Difficulty preference
      if (intent?.complexity) {
        if (pattern.difficulty === intent.complexity) {
          score += 10;
        }
      }

      // Only include patterns with some match
      if (score > 0) {
        matches.push({
          pattern,
          score,
          matchedKeywords,
          missingKeywords
        });
      }
    }

    // Sort by score descending
    return matches.sort((a, b) => b.score - a.score);
  }

  findBestMatch(
    description: string,
    platform?: string,
    intent?: any
  ): PatternMatch | null {
    const matches = this.findMatches(description, platform, intent);
    return matches.length > 0 ? matches[0] : null;
  }

  searchByCategory(category: string, platform?: string): WorkflowPattern[] {
    return this.patterns.filter(pattern => {
      const categoryMatch = pattern.category === category;
      const platformMatch = !platform || !!pattern.platforms[platform];
      return categoryMatch && platformMatch;
    });
  }

  searchByTags(tags: string[], platform?: string): WorkflowPattern[] {
    return this.patterns.filter(pattern => {
      const hasMatchingTag = pattern.tags?.some(tag => tags.includes(tag));
      const platformMatch = !platform || !!pattern.platforms[platform];
      return hasMatchingTag && platformMatch;
    });
  }

  private tokenize(text: string): string[] {
    // Simple tokenization - can be enhanced with NLP
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);
  }

  private calculateSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity - can be enhanced with better algorithms
    const words1 = new Set(this.tokenize(text1));
    const words2 = new Set(this.tokenize(text2));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  getRelatedPatterns(pattern: WorkflowPattern, limit: number = 5): WorkflowPattern[] {
    const related: Array<{ pattern: WorkflowPattern; score: number }> = [];

    for (const candidate of this.patterns) {
      if (candidate.id === pattern.id) continue;

      let score = 0;

      // Same category
      if (candidate.category === pattern.category) {
        score += 30;
      }

      // Common keywords
      const commonKeywords = pattern.keywords.filter(k =>
        candidate.keywords.includes(k)
      );
      score += commonKeywords.length * 10;

      // Common tags
      if (pattern.tags && candidate.tags) {
        const commonTags = pattern.tags.filter(t =>
          candidate.tags!.includes(t)
        );
        score += commonTags.length * 5;
      }

      // Common required services
      if (pattern.requiredServices && candidate.requiredServices) {
        const commonServices = pattern.requiredServices.filter(s =>
          candidate.requiredServices!.includes(s)
        );
        score += commonServices.length * 8;
      }

      if (score > 0) {
        related.push({ pattern: candidate, score });
      }
    }

    return related
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(r => r.pattern);
  }
}