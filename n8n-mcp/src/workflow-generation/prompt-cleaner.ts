// workflow-generation/prompt-cleaner.ts

export class PromptCleaner {
  /**
   * Extracts only the user requirements from a full AI assistant prompt
   */
  static extractUserRequirements(prompt: string): string {
    // Simply return the original prompt without any modifications
    // We were able to handle long prompts before, so this is not the issue
    return prompt;
  }

  /**
   * Cleans AI-generated prompts to ensure only one workflow is present
   */
  static cleanPrompt(prompt: string): string {
    console.log('PromptCleaner: Analyzing prompt for multiple workflows...');
    
    // Patterns that indicate a second workflow is starting
    const secondWorkflowIndicators = [
      // Turkish system warning followed by new workflow
      /### ⚠️ Otomatik Sistem Uyarısı:[\s\S]*?\n\n\*\*Required Integrations:/,
      
      // Multiple newlines followed by Required Integrations (common pattern)
      /\n\n\n+\*\*Required Integrations:\*\*/,
      
      // End of validation checklist followed by new workflow
      /This comprehensive plan ensures[\s\S]*?\n\n\*\*Required Integrations:/,
      
      // Generic pattern: multiple branches after a complete workflow
      /\n\n### BRANCH \d+:.*?\n\n### BRANCH \d+:.*?\n\n### BRANCH \d+:/s,
      
      // Pattern where Additional Requirements is followed by another workflow
      /## Additional Requirements:[\s\S]*?\n\n+(?:### BRANCH|## [A-Z])/
    ];
    
    let cleanedPrompt = prompt;
    let foundSecondWorkflow = false;
    
    for (const pattern of secondWorkflowIndicators) {
      const match = prompt.match(pattern);
      if (match && match.index) {
        console.log(`Found secondary workflow indicator at position ${match.index}`);
        // Find the actual start of the second workflow
        const beforeMatch = prompt.substring(0, match.index);
        
        // Look for clear end markers of the first workflow
        const endMarkers = [
          /This comprehensive plan ensures[\s\S]*?workflow\./,
          /## Additional Requirements:[\s\S]*?\./,
          /### Validation Checklist[\s\S]*?☑[^\n]+\./
        ];
        
        let bestCutPoint = match.index;
        for (const endMarker of endMarkers) {
          const endMatch = beforeMatch.match(endMarker);
          if (endMatch && endMatch.index && endMatch[0]) {
            bestCutPoint = endMatch.index + endMatch[0].length;
            break;
          }
        }
        
        cleanedPrompt = prompt.substring(0, bestCutPoint).trim();
        foundSecondWorkflow = true;
        console.log(`Truncated prompt at position ${bestCutPoint}`);
        break;
      }
    }
    
    if (!foundSecondWorkflow) {
      // Try a more aggressive approach - look for duplicate workflow structures
      const workflowCount = (prompt.match(/### BRANCH 1:/g) || []).length;
      if (workflowCount > 1) {
        console.log(`Found ${workflowCount} workflow definitions`);
        const firstWorkflowEnd = prompt.indexOf('### BRANCH 1:', prompt.indexOf('### BRANCH 1:') + 1);
        if (firstWorkflowEnd > 0) {
          // Back up to find a good cut point
          let cutPoint = prompt.lastIndexOf('\n\n', firstWorkflowEnd);
          if (cutPoint < 0) cutPoint = firstWorkflowEnd;
          cleanedPrompt = prompt.substring(0, cutPoint).trim();
          foundSecondWorkflow = true;
        }
      }
    }
    
    if (foundSecondWorkflow) {
      console.log(`Cleaned prompt: removed ${prompt.length - cleanedPrompt.length} characters`);
    } else {
      console.log('No secondary workflow detected');
    }
    
    return cleanedPrompt;
  }
  
  /**
   * Validates that a prompt contains only one workflow
   */
  static validateSingleWorkflow(prompt: string): {
    isValid: boolean;
    workflowCount: number;
    issues: string[];
  } {
    const issues: string[] = [];
    
    // Count workflow indicators
    const branch1Count = (prompt.match(/### BRANCH 1:/g) || []).length;
    const workflowNameCount = (prompt.match(/## [A-Z][^#\n]+Workflow/g) || []).length;
    const requiredIntegrationsCount = (prompt.match(/\*\*Required Integrations:\*\*/g) || []).length;
    
    const estimatedWorkflowCount = Math.max(branch1Count, workflowNameCount, Math.floor(requiredIntegrationsCount / 2));
    
    if (branch1Count > 1) {
      issues.push(`Multiple "BRANCH 1" sections found (${branch1Count})`);
    }
    
    if (workflowNameCount > 1) {
      issues.push(`Multiple workflow titles found (${workflowNameCount})`);
    }
    
    if (requiredIntegrationsCount > 2) {
      issues.push(`Too many "Required Integrations" sections (${requiredIntegrationsCount})`);
    }
    
    // Check for system warnings that often precede second workflows
    if (prompt.includes('### ⚠️ Otomatik Sistem Uyarısı:')) {
      issues.push('Contains system warning that often precedes duplicate workflows');
    }
    
    return {
      isValid: estimatedWorkflowCount <= 1,
      workflowCount: estimatedWorkflowCount,
      issues
    };
  }
}