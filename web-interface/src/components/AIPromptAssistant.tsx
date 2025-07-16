import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, ChevronDown, Sparkles, Copy, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { getTemplateForDomain, generatePromptFromTemplate } from '../utils/domain-templates';
import { DynamicPromptGenerator } from '../ai-analysis/dynamic-prompt-generator';
import { LearningEngine } from '../ai-analysis/learning-engine';
import { FeedbackData } from '../ai-analysis/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  prompt?: string; // Generated workflow prompt
}

interface AIProvider {
  provider: string;
  name: string;
  icon: string;
}

interface AIPromptAssistantProps {
  onPromptGenerated: (prompt: string) => void;
}

const providerOptions: AIProvider[] = [
  { provider: 'openai', name: 'OpenAI', icon: '🤖' },
  { provider: 'anthropic', name: 'Anthropic Claude', icon: '🧠' },
  { provider: 'gemini', name: 'Google Gemini', icon: '✨' }
];

export default function AIPromptAssistant({ onPromptGenerated }: AIPromptAssistantProps) {
  const dynamicPromptGenerator = useRef(new DynamicPromptGenerator());
  const learningEngine = useRef(new LearningEngine());
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m here to help you create workflow automation prompts. Tell me what kind of system or automation you want to build, and I\'ll help you create a detailed prompt for it.',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(providerOptions[0]);
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [userProviders, setUserProviders] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchUserProviders();
  }, []);

  const fetchUserProviders = async () => {
    try {
      const response = await api.get('/n8n/ai-providers/settings');
      setUserProviders(response.data || []);
    } catch (error) {
      console.error('Failed to fetch user providers:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const generateWorkflowPrompt = async (userRequest: string, aiResponse: string): Promise<string> => {
    try {
      // Use the new AI-driven dynamic prompt generation
      const dynamicPrompt = await dynamicPromptGenerator.current.generateDynamicPrompt(userRequest);
      
      // Combine with AI response for enhanced context
      let finalPrompt = `## AI Assistant Analysis:
${aiResponse}

`;
      finalPrompt += `## AI-Generated Workflow Design:
${dynamicPrompt.systemPrompt}

`;
      finalPrompt += `## User Requirements:
${dynamicPrompt.userPrompt}

`;
      
      // Add contextual guidelines
      if (dynamicPrompt.contextualGuidelines.length > 0) {
        finalPrompt += `## Optimization Guidelines:
`;
        dynamicPrompt.contextualGuidelines.forEach(guideline => {
          finalPrompt += `- ${guideline}
`;
        });
        finalPrompt += '\n';
      }
      
      // Add quality checklist
      if (dynamicPrompt.qualityChecklist.length > 0) {
        finalPrompt += `## Quality Checklist:
`;
        dynamicPrompt.qualityChecklist.forEach(item => {
          finalPrompt += `- [ ] ${item}
`;
        });
        finalPrompt += '\n';
      }
      
      return finalPrompt;
    } catch (error) {
      console.error('Error generating dynamic prompt:', error);
      // Fallback to original template-based approach
      return generateTemplateBasedPrompt(userRequest, aiResponse);
    }
  };
  
  const generateTemplateBasedPrompt = (userRequest: string, aiResponse: string): string => {
    // Enhanced structured prompt generation based on the conversation
    const lowerRequest = userRequest.toLowerCase();
    
    // Analyze request type and domain
    const domain = detectDomain(lowerRequest);
    const triggers = extractTriggers(lowerRequest);
    const integrations = extractIntegrations(lowerRequest);
    const hasErrorHandling = lowerRequest.includes('error') || lowerRequest.includes('retry') || lowerRequest.includes('fallback');
    
    // Check if we have a domain template
    if (domain) {
      const template = getTemplateForDomain(domain);
      if (template) {
        // Use the domain template as base
        let templatePrompt = generatePromptFromTemplate(template);
        
        // Enhance with AI response insights
        templatePrompt = `## AI Assistant Analysis:\n${aiResponse}\n\n${templatePrompt}`;
        
        // Add any additional user-specific requirements
        if (hasErrorHandling) {
          templatePrompt += `\n## Enhanced Error Handling (User Requested):\n`;
          templatePrompt += `- Implement advanced retry logic with exponential backoff\n`;
          templatePrompt += `- Add circuit breaker patterns for external services\n`;
          templatePrompt += `- Include detailed error logging and alerting\n`;
        }
        
        return templatePrompt;
      }
    }
    
    // Fallback to custom structured prompt if no template
    let structuredPrompt = `${aiResponse}\n\n`;
    
    // Add domain-specific requirements
    if (domain) {
      structuredPrompt += `## Domain: ${domain}\n\n`;
    }
    
    // Add trigger section
    if (triggers.length > 0) {
      structuredPrompt += `## Trigger Events:\n`;
      triggers.forEach(trigger => {
        structuredPrompt += `- ${trigger}\n`;
      });
      structuredPrompt += '\n';
    }
    
    // Add integration requirements
    if (integrations.length > 0) {
      structuredPrompt += `## Integrations:\n`;
      integrations.forEach(integration => {
        structuredPrompt += `- ${integration}\n`;
      });
      structuredPrompt += '\n';
    }
    
    // Add error handling section
    structuredPrompt += `## Error Handling:\n`;
    if (hasErrorHandling) {
      structuredPrompt += `- Implement retry logic for external API calls\n`;
      structuredPrompt += `- Add fallback mechanisms for critical paths\n`;
      structuredPrompt += `- Include error notification systems\n`;
    } else {
      structuredPrompt += `- Basic error handling for all external integrations\n`;
      structuredPrompt += `- Logging of all errors\n`;
    }
    structuredPrompt += '\n';
    
    // Add expected outcomes
    structuredPrompt += `## Expected Outcomes:\n`;
    structuredPrompt += `- Automated workflow that handles the described process\n`;
    structuredPrompt += `- Proper data validation and processing\n`;
    structuredPrompt += `- Reliable execution with error recovery\n`;
    structuredPrompt += `- Clear logging and monitoring\n\n`;
    
    // Add production requirements
    structuredPrompt += `## Production Requirements:\n`;
    structuredPrompt += `- All nodes must be properly connected\n`;
    structuredPrompt += `- Include data validation at entry points\n`;
    structuredPrompt += `- Add success/failure notifications\n`;
    structuredPrompt += `- Implement proper logging throughout\n`;
    structuredPrompt += `- Ensure scalability and performance\n`;
    
    return structuredPrompt;
  };
  
  const detectDomain = (text: string): string => {
    const domainPatterns = {
      'Healthcare': ['hospital', 'patient', 'doctor', 'appointment', 'medical', 'health', 'clinic'],
      'E-commerce': ['order', 'payment', 'product', 'inventory', 'shipping', 'customer', 'cart'],
      'HR': ['employee', 'onboarding', 'leave', 'payroll', 'recruitment', 'hr', 'staff'],
      'Finance': ['invoice', 'payment', 'accounting', 'budget', 'expense', 'financial'],
      'Marketing': ['campaign', 'email', 'lead', 'crm', 'marketing', 'social'],
      'IT Operations': ['server', 'monitoring', 'alert', 'deployment', 'backup', 'system']
    };
    
    for (const [domain, keywords] of Object.entries(domainPatterns)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return domain;
      }
    }
    return '';
  };
  
  const extractTriggers = (text: string): string[] => {
    const triggers = [];
    const triggerPatterns = {
      'Webhook trigger': ['webhook', 'api call', 'http request', 'incoming request'],
      'Schedule trigger': ['daily', 'hourly', 'scheduled', 'cron', 'every day', 'every hour'],
      'Manual trigger': ['manual', 'on-demand', 'when needed'],
      'Database trigger': ['database change', 'new record', 'data update'],
      'Email trigger': ['email received', 'incoming email', 'email trigger']
    };
    
    for (const [triggerName, patterns] of Object.entries(triggerPatterns)) {
      if (patterns.some(pattern => text.includes(pattern))) {
        triggers.push(triggerName);
      }
    }
    
    return triggers.length > 0 ? triggers : ['Manual trigger'];
  };
  
  const extractIntegrations = (text: string): string[] => {
    const integrations = [];
    const integrationPatterns = {
      'Database (PostgreSQL/MySQL)': ['database', 'mysql', 'postgresql', 'postgres', 'sql'],
      'Email (SMTP/SendGrid)': ['email', 'smtp', 'sendgrid', 'mail'],
      'SMS (Twilio)': ['sms', 'twilio', 'text message'],
      'Slack': ['slack', 'slack notification'],
      'Calendar (Google/Outlook)': ['calendar', 'appointment', 'schedule', 'booking'],
      'Payment (Stripe/PayPal)': ['payment', 'stripe', 'paypal', 'checkout'],
      'CRM (Salesforce/HubSpot)': ['crm', 'salesforce', 'hubspot', 'customer'],
      'API Integration': ['api', 'rest', 'webhook', 'external service']
    };
    
    for (const [integrationName, patterns] of Object.entries(integrationPatterns)) {
      if (patterns.some(pattern => text.includes(pattern))) {
        integrations.push(integrationName);
      }
    }
    
    return integrations;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Check if user has stored API key for selected provider
      const userProvider = userProviders.find(p => 
        p.provider === selectedProvider.provider
      );

      let response;
      
      // Always send the request, let backend handle API key retrieval
      response = await api.post('/n8n/ai-providers/chat/completion', {
          messages: [
            // System prompt is now handled by backend
            ...messages.slice(1).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: input }
          ],
          provider: selectedProvider.provider,
          useSpecificProvider: true,
          useUserSettings: false  // Use environment variables instead
        });

      const aiResponse = response.data.content || response.data.message;
      const generatedPrompt = await generateWorkflowPrompt(input, aiResponse);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
        prompt: generatedPrompt
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Chat error:', error);
      toast.error(error.message || 'Failed to get AI response');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt);
    toast.success('Prompt copied to clipboard!');
  };

  const usePrompt = (prompt: string) => {
    onPromptGenerated(prompt);
    toast.success('Prompt added to the form!');
    
    // Track successful usage for learning
    const feedback: FeedbackData = {
      workflowId: Date.now().toString(),
      workflowType: 'n8n',
      outcome: 'success',
      executionTime: 0,
      nodeCount: 0,
      errorDetails: [],
      timestamp: new Date().toISOString()
    };
    
    learningEngine.current.learn(feedback).catch(console.error);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-[600px] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Workflow Assistant</h3>
          </div>
          
          {/* Provider Selector */}
          <div className="relative">
            <button
              onClick={() => setShowProviderDropdown(!showProviderDropdown)}
              title="Toggle provider dropdown"
              aria-label="Toggle provider dropdown"
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <span>{selectedProvider.icon}</span>
              <span className="text-gray-700 dark:text-gray-300">{selectedProvider.name}</span>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </button>
            
            {showProviderDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                {providerOptions.map((provider) => {
                  const hasApiKey = userProviders.some(p => 
                    p.provider === provider.provider
                  );
                  
                  return (
                    <button
                      key={provider.provider}
                      onClick={() => {
                        setSelectedProvider(provider);
                        setShowProviderDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2">
                        <span>{provider.icon}</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{provider.name}</span>
                      </div>
                      {!hasApiKey && (
                        <span className="text-xs text-red-500">No API key</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex gap-3 max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                message.role === 'user' ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-700'
              }`}>
                {message.role === 'user' ? (
                  <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Bot className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                )}
              </div>
              
              <div className={`flex flex-col gap-2 ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`px-4 py-2 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
                
                {/* Generated Prompt Actions */}
                {message.prompt && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => copyPrompt(message.prompt!)}
                      title="Copy the generated prompt to clipboard"
                      className="flex items-center gap-1 px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <Copy className="h-3 w-3" />
                      Copy Prompt
                    </button>
                    <button
                      onClick={() => usePrompt(message.prompt!)}
                      className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      <ArrowRight className="h-3 w-3" />
                      Use This Prompt
                    </button>
                  </div>
                )}
                
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {message.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <Bot className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe the automation you want to build..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            title="Send message"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Tip: Be specific about triggers, data sources, and desired outcomes for better prompts.
        </p>
      </div>
    </div>
  );
}