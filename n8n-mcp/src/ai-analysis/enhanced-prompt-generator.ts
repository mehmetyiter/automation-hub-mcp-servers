export class EnhancedPromptGenerator {
  /**
   * Node planlama odaklı prompt oluşturur
   */
  static generateNodePlanningPrompt(userRequest: string, features: Map<string, string[]>): string {
    let prompt = `Create a comprehensive n8n workflow for: ${userRequest}\n\n`;
    
    // 1. Node Listesi ve Bağlantıları
    prompt += `### 1. WORKFLOW NODE PLANNING\n\n`;
    prompt += `Please plan the workflow with the following node structure:\n\n`;
    
    // Trigger node
    if (features.has('Scheduling')) {
      prompt += `**TRIGGER:**\n`;
      prompt += `- Cron Node (Daily Schedule) -> Main Process Start\n\n`;
    } else if (features.has('Real-time Processing')) {
      prompt += `**TRIGGER:**\n`;
      prompt += `- Webhook Node (API Endpoint) -> Data Validation\n\n`;
    }
    
    // Main process nodes
    prompt += `**MAIN PROCESS FLOW:**\n`;
    let nodeIndex = 1;
    
    // Stock Control
    if (userRequest.toLowerCase().includes('stock') || userRequest.toLowerCase().includes('inventory')) {
      prompt += `${nodeIndex++}. Stock Control (HTTP Request) -> Check availability\n`;
      prompt += `   - IF insufficient -> Cancel Order Branch\n`;
      prompt += `   - IF sufficient -> Continue to Payment\n\n`;
    }
    
    // Payment Processing
    if (features.has('Notifications') && userRequest.toLowerCase().includes('payment')) {
      prompt += `${nodeIndex++}. Payment Processing (Parallel):\n`;
      prompt += `   - Stripe Node -> Process credit card\n`;
      prompt += `   - PayPal Node -> Process PayPal\n`;
      prompt += `   - HTTP Request -> Process crypto (if applicable)\n`;
      prompt += `   - Merge Node -> Combine payment results\n\n`;
    }
    
    // Anti-fraud
    if (userRequest.toLowerCase().includes('fraud') || userRequest.toLowerCase().includes('risk')) {
      prompt += `${nodeIndex++}. Anti-Fraud Check (HTTP Request):\n`;
      prompt += `   - IF high risk -> Manual Review Branch\n`;
      prompt += `   - IF low risk -> Continue Processing\n\n`;
    }
    
    // Error Handling
    prompt += `**ERROR HANDLING NODES:**\n`;
    prompt += `- Error Trigger -> Capture any node failures\n`;
    prompt += `- Email/Slack Node -> Notify administrators\n`;
    prompt += `- HTTP Request -> Log errors to monitoring system\n\n`;
    
    // 2. Conditional Logic
    prompt += `### 2. CONDITIONAL LOGIC REQUIREMENTS\n\n`;
    prompt += `Implement the following conditional flows using IF/Switch nodes:\n\n`;
    
    if (userRequest.toLowerCase().includes('nps') || userRequest.toLowerCase().includes('feedback')) {
      prompt += `- NPS Score Check:\n`;
      prompt += `  - IF score < 7 -> Create customer service ticket\n`;
      prompt += `  - IF score >= 7 -> Send thank you message\n\n`;
    }
    
    // 3. Data Flow
    prompt += `### 3. DATA FLOW AND TRANSFORMATIONS\n\n`;
    prompt += `Use Set/Function nodes to:\n`;
    prompt += `- Format data between different API calls\n`;
    prompt += `- Calculate values (e.g., fees, discounts)\n`;
    prompt += `- Prepare notification content\n\n`;
    
    // 4. Timing and Delays
    prompt += `### 4. TIMING CONSIDERATIONS\n\n`;
    if (userRequest.toLowerCase().includes('feedback') || userRequest.toLowerCase().includes('follow')) {
      prompt += `- Add Wait node after delivery (e.g., 3 days) before sending feedback request\n`;
      prompt += `- Schedule follow-up campaigns with appropriate delays\n\n`;
    }
    
    // 5. Integration Points
    prompt += `### 5. INTEGRATION REQUIREMENTS\n\n`;
    prompt += `Ensure proper configuration for:\n`;
    features.forEach((capabilities, feature) => {
      prompt += `- ${feature}: ${capabilities.join(', ')}\n`;
    });
    
    prompt += `\n### 6. VALIDATION CHECKLIST\n\n`;
    prompt += `Ensure the workflow includes:\n`;
    prompt += `☐ All nodes are connected (no orphaned nodes)\n`;
    prompt += `☐ Error handling for critical operations\n`;
    prompt += `☐ Merge nodes for parallel branches\n`;
    prompt += `☐ Proper authentication for all APIs\n`;
    prompt += `☐ Data validation at entry points\n`;
    prompt += `☐ Success/failure notifications\n`;
    
    return prompt;
  }
  
  /**
   * Node bağlantı planı oluşturur
   */
  static generateConnectionPlan(nodes: string[]): string {
    let connectionPlan = '\n### NODE CONNECTION PLAN\n\n';
    connectionPlan += '```\n';
    
    for (let i = 0; i < nodes.length - 1; i++) {
      connectionPlan += `${nodes[i]} --> ${nodes[i + 1]}\n`;
    }
    
    connectionPlan += '```\n';
    return connectionPlan;
  }
  
  /**
   * Koşullu akış önerileri
   */
  static generateConditionalFlowSuggestions(prompt: string): string[] {
    const suggestions = [];
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes('stock') || lowerPrompt.includes('inventory')) {
      suggestions.push('IF node: Check if stock is sufficient before processing order');
    }
    
    if (lowerPrompt.includes('payment')) {
      suggestions.push('Switch node: Route to different payment processors based on method');
      suggestions.push('IF node: Check payment success before continuing');
    }
    
    if (lowerPrompt.includes('nps') || lowerPrompt.includes('score')) {
      suggestions.push('IF node: Route low scores to customer service');
    }
    
    if (lowerPrompt.includes('fraud') || lowerPrompt.includes('risk')) {
      suggestions.push('Switch node: Route based on risk score levels');
    }
    
    return suggestions;
  }
}