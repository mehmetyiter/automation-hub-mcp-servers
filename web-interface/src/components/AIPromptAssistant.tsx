import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, ChevronDown, Sparkles, Copy, ArrowRight } from 'lucide-react';
import AIProviderIcon from './AIProviderIcon';
import toast from 'react-hot-toast';
import { api } from '../services/api';
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
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>({ provider: '', name: 'Select AI Provider', icon: '' });
  const [showProviderDropdown, setShowProviderDropdown] = useState(false);
  const [userProviders, setUserProviders] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [maxTokens, setMaxTokens] = useState<number | undefined>(undefined);
  const [showTokensDropdown, setShowTokensDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchUserProviders();
  }, []);

  const fetchUserProviders = async () => {
    try {
      // Get user's credentials that are AI providers
      const response = await api.get('/auth/credentials');
      const credentials = response.data?.data || [];
      
      // Filter only AI provider credentials
      const aiProviders = credentials.filter((cred: any) => {
        const platform = cred.platform || cred.templateId || '';
        // Check if it's an AI provider based on platform field
        return ['openai', 'anthropic', 'google_ai', 'gemini', 'deepseek', 'groq', 'mistral', 'cohere', 'perplexity', 'together'].includes(platform) ||
               platform.includes('claude');
      });
      
      setUserProviders(aiProviders);
      
      // Set first provider as selected if available
      if (aiProviders.length > 0 && !selectedProvider.provider) {
        setSelectedProvider({
          provider: aiProviders[0].id,
          name: aiProviders[0].name,
          icon: ''
        });
      }
    } catch (error) {
      console.error('Failed to fetch user providers:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Get model options based on selected provider
  const getModelOptions = () => {
    if (!selectedProvider.provider) return [];
    
    const credential = userProviders.find(p => String(p.id) === String(selectedProvider.provider));
    if (!credential) return [];
    
    const platform = credential.platform || credential.templateId || '';
    
    switch (platform) {
      case 'openai':
        return [
          { value: 'o3', label: 'o3 (Most Intelligent)' },
          { value: 'o3-mini', label: 'o3-mini (Cost-Efficient)' },
          { value: 'o1', label: 'o1 (Reasoning)' },
          { value: 'o1-mini', label: 'o1-mini' },
          { value: 'gpt-4o', label: 'GPT-4o (Flagship)' },
          { value: 'gpt-4o-mini', label: 'GPT-4o-mini' },
          { value: 'gpt-4o-2024-11-20', label: 'GPT-4o (Nov 2024)' },
          { value: 'gpt-4o-2024-08-06', label: 'GPT-4o (Aug 2024)' },
          { value: 'gpt-4o-2024-05-13', label: 'GPT-4o (May 2024)' },
          { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
          { value: 'gpt-4-turbo-2024-04-09', label: 'GPT-4 Turbo (April 2024)' },
          { value: 'gpt-4-1106-preview', label: 'GPT-4 Turbo Preview' },
          { value: 'gpt-4', label: 'GPT-4' },
          { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
          { value: 'gpt-3.5-turbo-0125', label: 'GPT-3.5 Turbo (Latest)' }
        ];
      case 'anthropic':
        return [
          { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
          { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
          { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
          { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
          { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
          { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
          { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
        ];
      case 'google_ai':
      case 'gemini':
        return [
          { value: 'gemini-2.5-pro-preview-06-05', label: 'Gemini 2.5 Pro' },
          { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Experimental' },
          { value: 'gemini-2.0-flash-thinking-exp', label: 'Gemini 2.0 Flash Thinking' },
          { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
          { value: 'gemini-1.5-pro-002', label: 'Gemini 1.5 Pro 002' },
          { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
          { value: 'gemini-1.5-flash-002', label: 'Gemini 1.5 Flash 002' },
          { value: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash 8B' },
          { value: 'gemini-1.0-pro', label: 'Gemini 1.0 Pro' }
        ];
      case 'deepseek':
        return [
          { value: 'deepseek-r1', label: 'DeepSeek R1 (Latest)' },
          { value: 'deepseek-r1-distill-qwen-32b', label: 'DeepSeek R1 Distill Qwen 32B' },
          { value: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill Llama 70B' },
          { value: 'deepseek-chat', label: 'DeepSeek Chat' },
          { value: 'deepseek-coder', label: 'DeepSeek Coder' }
        ];
      case 'groq':
        return [
          { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
          { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B Versatile' },
          { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
          { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
          { value: 'gemma2-9b-it', label: 'Gemma2 9B IT' },
          { value: 'llama3-groq-70b-8192-tool-use-preview', label: 'Llama 3 70B Tool Use' },
          { value: 'llama3-groq-8b-8192-tool-use-preview', label: 'Llama 3 8B Tool Use' }
        ];
      case 'mistral':
        return [
          { value: 'mistral-large-latest', label: 'Mistral Large (Latest)' },
          { value: 'mistral-large-2411', label: 'Mistral Large 2411' },
          { value: 'mistral-small-latest', label: 'Mistral Small (Latest)' },
          { value: 'mistral-small-2409', label: 'Mistral Small 2409' },
          { value: 'ministral-8b-latest', label: 'Ministral 8B' },
          { value: 'ministral-3b-latest', label: 'Ministral 3B' },
          { value: 'pixtral-large-latest', label: 'Pixtral Large (Vision)' },
          { value: 'codestral-latest', label: 'Codestral (Code)' },
          { value: 'mistral-embed', label: 'Mistral Embed' }
        ];
      case 'cohere':
        return [
          { value: 'command-r-plus-08-2024', label: 'Command R+ (Aug 2024)' },
          { value: 'command-r-08-2024', label: 'Command R (Aug 2024)' },
          { value: 'command-r-plus', label: 'Command R+' },
          { value: 'command-r', label: 'Command R' },
          { value: 'command', label: 'Command' },
          { value: 'command-light', label: 'Command Light' },
          { value: 'c4ai-aya-expanse-8b', label: 'Aya Expanse 8B' },
          { value: 'c4ai-aya-expanse-32b', label: 'Aya Expanse 32B' }
        ];
      case 'perplexity':
        return [
          { value: 'llama-3.1-sonar-large-128k-online', label: 'Llama 3.1 Sonar Large (Online)' },
          { value: 'llama-3.1-sonar-small-128k-online', label: 'Llama 3.1 Sonar Small (Online)' },
          { value: 'llama-3.1-sonar-huge-128k-online', label: 'Llama 3.1 Sonar Huge (Online)' },
          { value: 'llama-3.1-sonar-large-128k-chat', label: 'Llama 3.1 Sonar Large (Chat)' },
          { value: 'llama-3.1-sonar-small-128k-chat', label: 'Llama 3.1 Sonar Small (Chat)' }
        ];
      case 'together':
        return [
          { value: 'Meta-Llama-3.3-70B-Instruct-Turbo', label: 'Llama 3.3 70B Instruct Turbo' },
          { value: 'Meta-Llama-3.1-405B-Instruct-Turbo', label: 'Llama 3.1 405B Instruct Turbo' },
          { value: 'Meta-Llama-3.1-70B-Instruct-Turbo', label: 'Llama 3.1 70B Instruct Turbo' },
          { value: 'Meta-Llama-3.1-8B-Instruct-Turbo', label: 'Llama 3.1 8B Instruct Turbo' },
          { value: 'Qwen/Qwen2.5-72B-Instruct-Turbo', label: 'Qwen 2.5 72B Instruct' },
          { value: 'Qwen/Qwen2.5-7B-Instruct-Turbo', label: 'Qwen 2.5 7B Instruct' },
          { value: 'mistralai/Mixtral-8x22B-Instruct-v0.1', label: 'Mixtral 8x22B' },
          { value: 'mistralai/Mixtral-8x7B-Instruct-v0.1', label: 'Mixtral 8x7B' },
          { value: 'google/gemma-2-27b-it', label: 'Gemma 2 27B IT' },
          { value: 'google/gemma-2-9b-it', label: 'Gemma 2 9B IT' }
        ];
      default:
        return [];
    }
  };

  const generateWorkflowPrompt = async (userRequest: string, aiResponse: string): Promise<string> => {
    // Return the full AI-generated workflow plan
    // This detailed structure is what our backend expects for proper workflow generation
    return aiResponse;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    // Check if a credential is selected
    if (!selectedProvider.provider) {
      toast.error('Please select an AI provider from the dropdown');
      return;
    }
    
    // Check if a model is selected
    if (!selectedModel) {
      toast.error('Please select a model');
      return;
    }

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
      // Get the selected credential ID
      const selectedCredentialId = selectedProvider.provider; // We store credential ID in provider field

      let response;
      
      // Send credential ID and model to backend
      response = await api.post('/n8n/ai-providers/chat/completion', {
          messages: [
            // System prompt is now handled by backend
            ...messages.slice(1).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: input }
          ],
          credentialId: selectedCredentialId,
          model: selectedModel,  // Add model selection
          maxTokens: maxTokens,  // Add maxTokens selection
          useUserSettings: true,
          useCredentialId: true  // Tell backend to use credential ID instead of provider name
        });

      const aiResponse = response.data.content || response.data.message;
      // Store the user's original request as the actual prompt
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
      
      // Extract user-friendly error message
      let errorMessage = 'Failed to get AI response';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message?.includes('max_tokens')) {
        // Parse token limit error
        const match = error.message.match(/max_tokens: (\d+) > (\d+)/);
        if (match) {
          errorMessage = `Token limit exceeded: You selected ${match[1]} tokens but this model supports maximum ${match[2]} tokens. Please reduce the token limit.`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
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
    // Clear any existing location state to prevent mixing with Prompt Library prompts
    if (window.history.state && window.history.state.usr) {
      window.history.replaceState({ ...window.history.state.usr, prompt: null }, '');
    }
    
    onPromptGenerated(prompt);
    toast.success('AI-generated prompt added to the form!');
    
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
          
          <div className="flex items-center gap-2">
            {/* Provider Selector */}
            <div className="relative">
              <button
                onClick={() => setShowProviderDropdown(!showProviderDropdown)}
                title="Toggle provider dropdown"
                aria-label="Toggle provider dropdown"
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
              <AIProviderIcon 
                platform={userProviders.find(p => p.id === selectedProvider.provider)?.platform || userProviders.find(p => p.id === selectedProvider.provider)?.templateId || ''} 
                className="w-4 h-4"
              />
              <span className="text-gray-700 dark:text-gray-300">{selectedProvider.name}</span>
              <ChevronDown className="h-4 w-4 text-gray-500" />
            </button>
            
            {showProviderDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                {userProviders.length > 0 ? (
                  userProviders.map((credential) => {
                    const platform = credential.platform || credential.templateId || '';
                    
                    return (
                      <button
                        key={credential.id}
                        onClick={() => {
                          setSelectedProvider({
                            provider: credential.id, // Store credential ID
                            name: credential.name,
                            icon: '' // Not needed anymore
                          });
                          setSelectedModel(''); // Reset model when provider changes
                          setMaxTokens(undefined); // Reset max tokens when provider changes
                          setShowProviderDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2">
                          <AIProviderIcon platform={platform} className="w-4 h-4" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{credential.name}</span>
                        </div>
                        <span className="text-xs text-green-500">✓ Active</span>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    No AI providers configured. Please add credentials in the Credentials page.
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Model Selector */}
          {selectedProvider.provider && getModelOptions().length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowModelDropdown(!showModelDropdown)}
                title="Select model"
                aria-label="Select model"
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="text-gray-700 dark:text-gray-300">
                  {selectedModel ? getModelOptions().find(m => m.value === selectedModel)?.label : 'Select Model'}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </button>
              
              {showModelDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                  {getModelOptions().map((model) => (
                    <button
                      key={model.value}
                      onClick={() => {
                        setSelectedModel(model.value);
                        setShowModelDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between group"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-300">{model.label}</span>
                      {selectedModel === model.value && (
                        <span className="text-xs text-green-500">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Max Tokens Selector */}
          {selectedProvider.provider && (
            <div className="relative">
              <button
                onClick={() => setShowTokensDropdown(!showTokensDropdown)}
                title="Set max tokens"
                aria-label="Set max tokens"
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="text-gray-700 dark:text-gray-300">
                  {maxTokens ? `${maxTokens} tokens` : 'Max Tokens'}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-500" />
              </button>
              
              {showTokensDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                  <button
                    onClick={() => {
                      setMaxTokens(undefined);
                      setShowTokensDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between group"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">Auto (Model Default)</span>
                    {!maxTokens && <span className="text-xs text-green-500">✓</span>}
                  </button>
                  {[1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000].map((tokens) => (
                    <button
                      key={tokens}
                      onClick={() => {
                        setMaxTokens(tokens);
                        setShowTokensDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between group"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-300">{tokens.toLocaleString()}</span>
                      {maxTokens === tokens && <span className="text-xs text-green-500">✓</span>}
                    </button>
                  ))}
                </div>
              )}
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