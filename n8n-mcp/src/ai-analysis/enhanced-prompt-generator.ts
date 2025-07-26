export class EnhancedPromptGenerator {
  /**
   * Generates a dynamic prompt based on user's specific request
   * NO TEMPLATES - purely based on analysis of the actual request
   */
  static generateNodePlanningPrompt(userRequest: string, features: Map<string, string[]>): string {
    // Start with the user's exact request - no template headers
    let prompt = `To create this n8n workflow: "${userRequest}"\n\n`;
    
    // Add context based on what was actually detected
    if (features.size > 0) {
      prompt += `Based on your request, here are the key aspects to consider:\n\n`;
      
      features.forEach((capabilities, feature) => {
        prompt += `${feature}: This workflow will need ${capabilities.join(', ')}\n`;
      });
      prompt += '\n';
    }
    
    // Add specific guidance based on the request content
    const lowerRequest = userRequest.toLowerCase();
    
    // Only add relevant guidance based on what's actually in the request
    if (lowerRequest.includes('trigger') || lowerRequest.includes('when') || lowerRequest.includes('schedule')) {
      prompt += `Consider how this workflow should be triggered based on your specific needs.\n`;
    }
    
    if (lowerRequest.includes('api') || lowerRequest.includes('webhook') || lowerRequest.includes('http')) {
      prompt += `Make sure to handle API responses and potential errors appropriately.\n`;
    }
    
    if (lowerRequest.includes('email') || lowerRequest.includes('notify') || lowerRequest.includes('alert')) {
      prompt += `Include appropriate notification mechanisms as requested.\n`;
    }
    
    if (lowerRequest.includes('data') || lowerRequest.includes('transform') || lowerRequest.includes('format')) {
      prompt += `Consider data transformation needs between different steps.\n`;
    }
    
    if (lowerRequest.includes('switch') || lowerRequest.includes('route') || lowerRequest.includes('routing') || 
        lowerRequest.includes('case') || lowerRequest.includes('type') || lowerRequest.includes('category')) {
      prompt += `\nIMPORTANT: Switch/routing nodes require explicit output definitions for each case:\n`;
      prompt += `- Define all possible cases/routes clearly\n`;
      prompt += `- Connect each case to appropriate processing nodes\n`;
      prompt += `- Ensure no case is left unconnected\n`;
      prompt += `- Each route must lead to meaningful processing\n`;
    }
    
    // End with focus on the user's goal
    prompt += `\nFocus on creating a workflow that directly addresses the specific requirements mentioned above.`;
    
    return prompt;
  }
  
  /**
   * Generates connection guidance dynamically based on detected nodes
   * NO TEMPLATES - only contextual suggestions
   */
  static generateConnectionPlan(nodes: string[]): string {
    if (!nodes || nodes.length === 0) {
      return '';
    }
    
    // Only provide connection guidance if there are multiple nodes
    if (nodes.length > 1) {
      return `\nConsider the logical flow between your workflow components for optimal execution.\n`;
    }
    
    return '';
  }
  
  /**
   * Generates conditional flow suggestions based on actual request content
   * NO TEMPLATES - only relevant suggestions
   */
  static generateConditionalFlowSuggestions(prompt: string): string[] {
    const suggestions = [];
    const lowerPrompt = prompt.toLowerCase();
    
    // Only suggest what's actually relevant to the user's request
    if (lowerPrompt.includes('if') || lowerPrompt.includes('when') || lowerPrompt.includes('condition')) {
      suggestions.push('Your workflow requires conditional logic as specified');
    }
    
    if (lowerPrompt.includes('branch') || lowerPrompt.includes('split') || lowerPrompt.includes('parallel')) {
      suggestions.push('Implement branching logic for parallel processing');
    }
    
    // Return empty if no conditional logic is needed
    return suggestions;
  }
}