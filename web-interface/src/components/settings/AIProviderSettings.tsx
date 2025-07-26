import { useState, useEffect } from 'react';
import { Brain, Plus, Trash2, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import toast from 'react-hot-toast';

type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'llama' | 'deepseek' | 'perplexity' | 'groq' | 'mistral' | 'cohere' | 'together';

interface AIProviderSetting {
  provider: AIProvider;
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  isActive: boolean;
}

const providerInfo: Record<AIProvider, { name: string; icon: string; models: string[] }> = {
  openai: {
    name: 'OpenAI',
    icon: '🤖',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini', 'o3', 'o4-mini']
  },
  anthropic: {
    name: 'Anthropic',
    icon: '🧠',
    models: ['claude-4-opus', 'claude-4-sonnet', 'claude-3.7-sonnet', 'claude-3.7-sonnet-thinking', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022']
  },
  gemini: {
    name: 'Google Gemini',
    icon: '✨',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro-deep-think', 'gemini-2.0-flash-thinking-exp', 'gemini-2.0-flash-exp', 'gemini-1.5-pro-002', 'gemini-1.5-flash-002']
  },
  llama: {
    name: 'Meta Llama',
    icon: '🦙',
    models: ['llama-3.3-70b-instruct', 'llama-3.2-90b-vision', 'llama-3.2-11b-vision', 'llama-3.2-3b', 'llama-3.2-1b', 'llama-3.1-405b', 'llama-3.1-70b', 'llama-3.1-8b']
  },
  deepseek: {
    name: 'DeepSeek',
    icon: '🔍',
    models: ['deepseek-v3-0324', 'deepseek-v3', 'deepseek-r1', 'deepseek-chat', 'deepseek-coder']
  },
  perplexity: {
    name: 'Perplexity',
    icon: '🔮',
    models: ['sonar-pro', 'sonar', 'sonar-reasoning', 'deepseek-r1', 'grok-3-beta', 'deep-research']
  },
  groq: {
    name: 'Groq',
    icon: '⚡',
    models: ['llama3-groq-70b-8192-tool-use-preview', 'llama3-groq-8b-8192-tool-use-preview', 'llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768']
  },
  mistral: {
    name: 'Mistral AI',
    icon: '🌊',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'open-mistral-7b', 'open-mixtral-8x7b']
  },
  cohere: {
    name: 'Cohere',
    icon: '🎯',
    models: ['command-r-plus', 'command-r', 'command', 'command-light']
  },
  together: {
    name: 'Together AI',
    icon: '🤝',
    models: ['meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1', 'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO']
  }
};

export default function AIProviderSettings() {
  const [providers, setProviders] = useState<AIProviderSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProvider, setNewProvider] = useState<Partial<AIProviderSetting>>({
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 8000
  });

  useEffect(() => {
    fetchProviderSettings();
  }, []);

  const fetchProviderSettings = async () => {
    try {
      const response = await api.get('/ai-providers/settings');
      setProviders(response.data || []);
    } catch (error) {
      console.error('Failed to fetch provider settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProvider = async (provider: Partial<AIProviderSetting>) => {
    if (!provider.provider || !provider.apiKey) {
      toast.error('Provider and API key are required');
      return;
    }

    setSaving(provider.provider);
    try {
      await api.post('/ai-providers/settings', provider);
      toast.success(`${providerInfo[provider.provider].name} settings saved successfully`);
      await fetchProviderSettings();
      setShowAddForm(false);
      setNewProvider({
        provider: 'openai',
        apiKey: '',
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 8000
      });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save provider settings');
    } finally {
      setSaving(null);
    }
  };

  const handleTestConnection = async (provider: AIProviderSetting) => {
    setTesting(provider.provider);
    try {
      const response = await api.post('/ai-providers/models', {
        provider: provider.provider,
        apiKey: provider.apiKey
      });
      
      if (response.data.models && response.data.models.length > 0) {
        toast.success(`Connection successful! Found ${response.data.models.length} models`);
      } else {
        toast.success('Connection successful!');
      }
    } catch (error) {
      toast.error('Connection failed. Please check your API key.');
    } finally {
      setTesting(null);
    }
  };

  const handleSetActive = async (provider: AIProvider) => {
    try {
      await api.post('/ai-providers/active', { provider });
      toast.success(`${providerInfo[provider].name} set as active provider`);
      await fetchProviderSettings();
    } catch (error) {
      toast.error('Failed to set active provider');
    }
  };

  const handleDelete = async (provider: AIProvider) => {
    if (!confirm(`Are you sure you want to delete ${providerInfo[provider].name} settings?`)) {
      return;
    }

    try {
      await api.delete(`/ai-providers/settings/${provider}`);
      toast.success('Provider settings deleted');
      await fetchProviderSettings();
    } catch (error) {
      toast.error('Failed to delete provider settings');
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Brain className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI Provider Settings</h2>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Provider
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Add New Provider Form */}
        {showAddForm && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6 space-y-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Add New AI Provider</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Provider
                </label>
                <select
                  value={newProvider.provider}
                  onChange={(e) => {
                    const provider = e.target.value as AIProvider;
                    setNewProvider({
                      ...newProvider,
                      provider,
                      model: providerInfo[provider].models[0]
                    });
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.entries(providerInfo).map(([key, info]) => (
                    <option key={key} value={key}>
                      {info.icon} {info.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={newProvider.apiKey}
                  onChange={(e) => setNewProvider({ ...newProvider, apiKey: e.target.value })}
                  placeholder="Enter your API key"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Default Model
                </label>
                <select
                  value={newProvider.model}
                  onChange={(e) => setNewProvider({ ...newProvider, model: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {newProvider.provider && providerInfo[newProvider.provider].models.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Temperature
                </label>
                <input
                  type="number"
                  value={newProvider.temperature}
                  onChange={(e) => setNewProvider({ ...newProvider, temperature: parseFloat(e.target.value) })}
                  min="0"
                  max="2"
                  step="0.1"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleSaveProvider(newProvider)}
                disabled={!newProvider.apiKey || saving !== null}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving === newProvider.provider ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Save Provider
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewProvider({
                    provider: 'openai',
                    apiKey: '',
                    model: 'gpt-4o',
                    temperature: 0.7,
                    maxTokens: 8000
                  });
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Provider List */}
        {providers.length === 0 ? (
          <div className="text-center py-8">
            <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">No AI providers configured yet.</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Add your first provider to start generating workflows with AI.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {providers.map((provider) => (
              <div
                key={provider.provider}
                className={`border rounded-lg p-4 transition-colors ${
                  provider.isActive
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{providerInfo[provider.provider].icon}</span>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {providerInfo[provider.provider].name}
                        </h3>
                        {provider.isActive && (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                            <Check className="h-3 w-3" />
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <div>
                        <span className="font-medium">Default Model:</span> {provider.model || providerInfo[provider.provider].models[0]}
                      </div>
                      <div>
                        <span className="font-medium">Temperature:</span> {provider.temperature || 0.7}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-medium">API Key:</span> ••••••••••••••••
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestConnection(provider)}
                      disabled={testing === provider.provider}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                      title="Test connection"
                    >
                      {testing === provider.provider ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                    </button>
                    
                    {!provider.isActive && (
                      <button
                        onClick={() => handleSetActive(provider.provider)}
                        className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
                        title="Set as active"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleDelete(provider.provider)}
                      className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}