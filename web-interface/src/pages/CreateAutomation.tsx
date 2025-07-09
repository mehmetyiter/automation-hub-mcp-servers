import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Wand2, Loader2, Sparkles, Mic, Type, Key, Eye, EyeOff, Shield, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import { createAutomation, credentialAPI } from '../services/api'
import { PromptHelper } from '../components/PromptHelper'
import PlatformSelector from '../components/PlatformSelector'
import AIProviderSelector from '../components/AIProviderSelector'
import AIPromptAssistant from '../components/AIPromptAssistant'
import { feedbackCollector } from '../ai-analysis/feedback-collector'

const platformLogos = {
  n8n: '🟧',
  make: '🟪',
  zapier: '⚡',
  vapi: '🎙️',
}

export default function CreateAutomation() {
  const navigate = useNavigate()
  const location = useLocation()
  const [description, setDescription] = useState('')
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState<string>('n8n')
  const [isCreating, setIsCreating] = useState(false)
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text')
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [useStoredCredentials, setUseStoredCredentials] = useState(true)
  const [storedCredentials, setStoredCredentials] = useState<any[]>([])
  const [selectedCredentials, setSelectedCredentials] = useState<string[]>([])
  const [aiProvider, setAiProvider] = useState<string | undefined>(undefined)
  const [useUserAISettings, setUseUserAISettings] = useState(true)
  const [showAIAssistant, setShowAIAssistant] = useState(false)

  // Handle incoming prompt from PromptLibrary
  useEffect(() => {
    if (location.state?.prompt) {
      setDescription(location.state.prompt)
      if (location.state.title) {
        setName(location.state.title)
      }
    }
  }, [location.state])

  // Load stored credentials
  useEffect(() => {
    loadCredentials()
  }, [])

  const loadCredentials = async () => {
    try {
      const response = await credentialAPI.list()
      if (response.data) {
        setStoredCredentials(response.data)
        console.log('Loaded credentials:', response.data)
      }
    } catch (error) {
      console.error('Failed to load credentials:', error)
    }
  }

  const handleCreate = async () => {
    if (!description.trim()) {
      toast.error('Please describe your automation')
      return
    }

    if (!name.trim()) {
      toast.error('Please provide a name for your automation')
      return
    }

    setIsCreating(true)
    try {
      const payload: any = {
        description,
        name,
        platform: platform,
        useUserSettings: useUserAISettings
      }
      
      // Include AI provider settings
      if (!useUserAISettings) {
        if (aiProvider) {
          payload.provider = aiProvider
        }
        if (apiKey.trim()) {
          payload.apiKey = apiKey
        }
      } else {
        // Use user's saved credentials
        payload.useCredentials = true
      }
      
      // Include selected credentials
      if (useStoredCredentials && selectedCredentials.length > 0) {
        payload.credentialIds = selectedCredentials
        console.log('Including credentials in request:', selectedCredentials)
      }
      
      console.log('Creating automation with payload:', payload)
      
      // Start tracking the workflow creation
      const workflowId = `${platform}_${Date.now()}`;
      feedbackCollector.startTracking(workflowId, platform, 0);
      
      const result = await createAutomation(payload)

      // Check if result has the expected structure
      if (result && (result.success || result.result)) {
        // Record success
        const nodeCount = result.result?.nodeCount || result.nodeCount || 0;
        feedbackCollector.recordSuccess(workflowId, {
          nodeCount,
          workflowName: name,
          platform,
          promptLength: description.length
        });
        
        toast.success('Automation created successfully!')
        navigate('/automations')
      } else {
        // Record failure
        feedbackCollector.recordFailure(workflowId, {
          message: result?.error || 'Failed to create automation',
          payload
        });
        
        toast.error(result?.error || 'Failed to create automation')
      }
    } catch (error: any) {
      // Record failure
      const workflowId = `${platform}_${Date.now()}`;
      feedbackCollector.recordFailure(workflowId, error);
      
      const errorMessage = error.response?.data?.error || error.message || 'Something went wrong. Please try again.'
      toast.error(errorMessage)
    } finally {
      setIsCreating(false)
    }
  }

  const examples = [
    "When someone fills out my contact form, send them a welcome email and add them to my CRM",
    "Every morning at 9 AM, check for new orders and create invoices automatically",
    "Call leads from my spreadsheet and qualify them based on a script",
    "When a support ticket is created, analyze sentiment and route to the right team",
  ]

  const handlePromptGenerated = (prompt: string) => {
    setDescription(prompt);
    // Optionally close the assistant after prompt is used
    // setShowAIAssistant(false);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-foreground">Create New Automation</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Describe what you want to automate in plain language, and AI will create it for you
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Main Form */}
        <div className="bg-white dark:bg-card rounded-lg shadow-sm dark:shadow-none dark:border dark:border-border p-8">
        {/* Input Mode Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-1">
            <button
              onClick={() => setInputMode('text')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                inputMode === 'text'
                  ? 'bg-primary-100 dark:bg-primary/20 text-primary-700 dark:text-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Type className="w-4 h-4 inline mr-2" />
              Text Input
            </button>
            <button
              onClick={() => setInputMode('voice')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                inputMode === 'voice'
                  ? 'bg-primary-100 dark:bg-primary/20 text-primary-700 dark:text-primary'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Mic className="w-4 h-4 inline mr-2" />
              Voice Input
            </button>
          </div>
        </div>

        {/* Platform Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Platform
          </label>
          <PlatformSelector 
            value={platform} 
            onChange={setPlatform}
            disabled={isCreating}
          />
        </div>

        {/* Name Input */}
        <div className="mb-6">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Automation Name
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Customer Welcome Flow"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-foreground placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* Prompt Helper */}
        <PromptHelper onUseTemplate={(template) => setDescription(template)} />

        {/* Description Input */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Describe Your Automation
            </label>
            <button
              onClick={() => setShowAIAssistant(!showAIAssistant)}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              {showAIAssistant ? 'Hide' : 'Show'} AI Assistant
            </button>
          </div>
          {inputMode === 'text' ? (
            <textarea
              id="description"
              rows={6}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you want to automate in plain language..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-foreground placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary focus:border-transparent resize-none"
            />
          ) : (
            <div className="relative">
              <div className="w-full h-40 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center">
                <button className="p-4 bg-primary-100 dark:bg-primary/20 rounded-full hover:bg-primary-200 dark:hover:bg-primary/30 transition-colors">
                  <Mic className="w-8 h-8 text-primary-600 dark:text-primary" />
                </button>
              </div>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                Click the microphone to start recording
              </p>
            </div>
          )}
        </div>

        {/* AI Provider Selection - Only for n8n platform */}
        {platform === 'n8n' && (
          <div className="mb-6">
            <AIProviderSelector
              value={aiProvider as any}
              onChange={setAiProvider as any}
              useUserSettings={useUserAISettings}
              onUseSettingsChange={setUseUserAISettings}
            />
          </div>
        )}

        {/* API Key (Optional) - Only for n8n platform and when not using user settings */}
        {platform === 'n8n' && !useUserAISettings && aiProvider && (
          <div className="mb-6">
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              AI API Key (Optional)
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                OpenAI or Anthropic key for AI-powered generation
              </span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type={showApiKey ? 'text' : 'password'}
                id="apiKey"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-foreground placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showApiKey ? (
                  <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              If not provided, the system will use pattern matching instead of AI generation
            </p>
          </div>
        )}

        {/* Stored Credentials Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              <Shield className="w-4 h-4 inline mr-1" />
              Use Stored Credentials
            </label>
            <button
              type="button"
              onClick={() => setUseStoredCredentials(!useStoredCredentials)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                useStoredCredentials ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  useStoredCredentials ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          
          {useStoredCredentials && storedCredentials.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select credentials to include in the automation:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {storedCredentials.map((credential) => (
                  <label
                    key={credential.id}
                    className="flex items-center p-2 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      value={credential.id}
                      checked={selectedCredentials.includes(credential.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCredentials([...selectedCredentials, credential.id])
                        } else {
                          setSelectedCredentials(selectedCredentials.filter(id => id !== credential.id))
                        }
                      }}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      {credential.name}
                    </span>
                    <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                      {credential.templateId}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          
          {useStoredCredentials && storedCredentials.length === 0 && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              No stored credentials found.{' '}
              <button
                type="button"
                onClick={() => navigate('/credentials')}
                className="text-primary-600 hover:text-primary-500"
              >
                Add credentials
              </button>
            </p>
          )}
        </div>

        {/* Platform Selection (Optional) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Preferred Platform (Optional)
          </label>
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(platformLogos).map(([key, logo]) => (
              <button
                key={key}
                onClick={() => setPlatform(platform === key ? '' : key)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  platform === key
                    ? 'border-primary-500 dark:border-primary bg-primary-50 dark:bg-primary/10'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                }`}
              >
                <div className="text-2xl mb-1">{logo}</div>
                <div className="text-sm font-medium capitalize text-gray-900 dark:text-gray-100">{key}</div>
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Leave unselected to let AI choose the best platform
          </p>
        </div>

        {/* Examples */}
        <div className="mb-8">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            <Sparkles className="w-4 h-4 inline mr-1" />
            Example Automations
          </h3>
          <div className="space-y-2">
            {examples.map((example, index) => (
              <button
                key={index}
                onClick={() => setDescription(example)}
                className="w-full text-left px-4 py-3 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                "{example}"
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <button
            onClick={() => navigate('/automations')}
            className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !description.trim() || !name.trim()}
            className="px-6 py-2 bg-primary-600 dark:bg-primary text-white dark:text-primary-foreground rounded-lg hover:bg-primary-700 dark:hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium inline-flex items-center"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Create Automation
              </>
            )}
          </button>
        </div>
      </div>
        
        {/* AI Assistant */}
        {showAIAssistant && (
          <div className="lg:sticky lg:top-4">
            <AIPromptAssistant onPromptGenerated={handlePromptGenerated} />
          </div>
        )}
      </div>
    </div>
  )
}