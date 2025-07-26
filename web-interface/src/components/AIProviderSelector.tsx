import { useState, useEffect } from 'react';
import { Brain, Check, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'llama' | 'deepseek' | 'perplexity' | 'groq' | 'mistral' | 'cohere' | 'together';

interface AIProviderInfo {
  provider: AIProvider;
  name: string;
  icon: string;
  isActive?: boolean;
  hasCredentials?: boolean;
}

interface AIProviderSelectorProps {
  value?: AIProvider;
  onChange: (provider: AIProvider | undefined) => void;
  showUseSettings?: boolean;
  useUserSettings?: boolean;
  onUseSettingsChange?: (use: boolean) => void;
}

const providerInfo: Record<AIProvider, { name: string; icon: string }> = {
  openai: { name: 'OpenAI', icon: '🤖' },
  anthropic: { name: 'Anthropic', icon: '🧠' },
  gemini: { name: 'Google Gemini', icon: '✨' },
  llama: { name: 'Meta Llama', icon: '🦙' },
  deepseek: { name: 'DeepSeek', icon: '🔍' },
  perplexity: { name: 'Perplexity', icon: '🔮' },
  groq: { name: 'Groq', icon: '⚡' },
  mistral: { name: 'Mistral AI', icon: '🌊' },
  cohere: { name: 'Cohere', icon: '🎯' },
  together: { name: 'Together AI', icon: '🤝' }
};

export default function AIProviderSelector({ 
  value, 
  onChange, 
  showUseSettings = true,
  useUserSettings = true,
  onUseSettingsChange 
}: AIProviderSelectorProps) {
  const [providers, setProviders] = useState<AIProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProvider, setActiveProvider] = useState<AIProvider | null>(null);

  useEffect(() => {
    fetchProviderInfo();
  }, []);

  const fetchProviderInfo = async () => {
    try {
      // Get user's saved AI credentials from credentials API
      const credentialsResponse = await api.get('/api/auth/credentials');
      const allCredentials = credentialsResponse.data || [];
      
      // Filter AI category credentials
      const aiCredentials = allCredentials.filter((cred: any) => 
        ['openai', 'anthropic', 'google_ai', 'huggingface', 'replicate'].includes(cred.templateId)
      );

      // Map to our provider format
      const providerMap: Record<string, string> = {
        'openai': 'openai',
        'anthropic': 'anthropic', 
        'google_ai': 'gemini',
        'huggingface': 'huggingface',
        'replicate': 'replicate'
      };

      const availableProviders: AIProvider[] = ['openai', 'anthropic', 'gemini'];
      
      const combinedProviders = availableProviders.map((p: AIProvider) => {
        const credentialKey = Object.keys(providerMap).find(key => providerMap[key] === p);
        const userCredential = aiCredentials.find((cred: any) => cred.templateId === credentialKey);
        
        return {
          provider: p,
          name: providerInfo[p].name,
          icon: providerInfo[p].icon,
          isActive: false, // We'll determine this from selection
          hasCredentials: !!userCredential,
          credentialId: userCredential?.id
        };
      });

      setProviders(combinedProviders);
      
      // Set active provider to first available credential
      const firstWithCredentials = combinedProviders.find(p => p.hasCredentials);
      if (firstWithCredentials) {
        setActiveProvider(firstWithCredentials.provider);
      }
    } catch (error) {
      console.error('Failed to fetch provider info:', error);
      // Fallback to default providers
      setProviders([
        { provider: 'openai', name: 'OpenAI', icon: '🤖' },
        { provider: 'anthropic', name: 'Anthropic', icon: '🧠' },
        { provider: 'gemini', name: 'Google Gemini', icon: '✨' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showUseSettings && activeProvider && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <input
            type="checkbox"
            id="use-saved-settings"
            checked={useUserSettings}
            onChange={(e) => onUseSettingsChange?.(e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="use-saved-settings" className="flex-1 flex items-center gap-2 cursor-pointer">
            <Brain className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Use saved AI settings ({providerInfo[activeProvider].icon} {providerInfo[activeProvider].name})
            </span>
          </label>
        </div>
      )}

      {(!showUseSettings || !useUserSettings) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            AI Provider
          </label>
          <div className="grid grid-cols-3 gap-3">
            {providers.map((provider) => (
              <button
                key={provider.provider}
                onClick={() => onChange(provider.provider)}
                className={`relative p-4 rounded-lg border-2 transition-all ${
                  value === provider.provider
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="text-center">
                  <span className="text-2xl">{provider.icon}</span>
                  <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {provider.name}
                  </p>
                </div>
                
                {provider.hasCredentials && (
                  <div className="absolute top-2 right-2">
                    {provider.isActive ? (
                      <div className="p-1 bg-blue-100 dark:bg-blue-900 rounded-full">
                        <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                      </div>
                    ) : (
                      <div className="p-1 bg-gray-100 dark:bg-gray-700 rounded-full">
                        <Check className="h-3 w-3 text-gray-400" />
                      </div>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
          
          {value && !providers.find(p => p.provider === value)?.hasCredentials && (
            <div className="mt-2 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-4 w-4" />
              <span>You'll need to provide an API key for {providerInfo[value].name}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}