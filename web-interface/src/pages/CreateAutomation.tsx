import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Wand2, Loader2, Sparkles, Mic, Type, MessageSquare, Bot, Zap, Wrench, Target } from 'lucide-react'
import AIProviderIcon from '../components/AIProviderIcon'
import toast from 'react-hot-toast'
import { createAutomation, createWorkflowWithConfiguration, credentialAPI, api } from '../services/api'
import { PromptHelper } from '../components/PromptHelper'
import PlatformSelector from '../components/PlatformSelector'
import AIPromptAssistant from '../components/AIPromptAssistant'
import { feedbackCollector } from '../ai-analysis/feedback-collector'
import { UserConfigurationDialog } from '../components/UserConfigurationDialog'
import { GenerationModeSelector } from '../components/GenerationModeSelector'
import { EnhancedPromptDialog } from '../components/EnhancedPromptDialog'

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
  const [progressMessage, setProgressMessage] = useState('')
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text')
  const [storedCredentials, setStoredCredentials] = useState<any[]>([])
  const [selectedCredentialId, setSelectedCredentialId] = useState<string | undefined>(undefined)
  const [useUserAISettings, setUseUserAISettings] = useState(true)
  const [showAIAssistant, setShowAIAssistant] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [maxTokens, setMaxTokens] = useState<number>(8000)
  const [temperature, setTemperature] = useState<number>(0.7)
  const [showConfigDialog, setShowConfigDialog] = useState(false)
  const [pendingWorkflow, setPendingWorkflow] = useState<any>(null)
  const [userConfiguration, setUserConfiguration] = useState<any>(null)
  const [generationMode, setGenerationMode] = useState<'quick' | 'advanced' | 'expert'>('quick')
  const [showEnhancedPrompt, setShowEnhancedPrompt] = useState(false)
  const [enhancedPrompt, setEnhancedPrompt] = useState('')
  const [userEditedPrompt, setUserEditedPrompt] = useState('')
  const [isAIGeneratedPrompt, setIsAIGeneratedPrompt] = useState(false)

  // Handle incoming prompt from PromptLibrary
  useEffect(() => {
    if (location.state?.prompt) {
      setDescription(location.state.prompt)
      if (location.state.title) {
        setName(location.state.title)
      }
      // Clear the state after using it to prevent re-applying
      window.history.replaceState({}, document.title)
    }
  }, [location.state])
  
  // Model options based on provider
  const getModelOptions = () => {
    if (!selectedCredentialId) return []
    
    const credential = storedCredentials.find(c => String(c.id) === String(selectedCredentialId))
    if (!credential) {
      console.log('No credential found for ID:', selectedCredentialId)
      return []
    }
    
    const platform = credential.platform || credential.templateId || ''
    console.log('Found credential:', credential, 'Platform:', platform)
    
    // Fallback to provider name if platform is not set
    const providerType = platform || (credential.name?.toLowerCase().includes('openai') ? 'openai' : 
                                      credential.name?.toLowerCase().includes('anthropic') ? 'anthropic' :
                                      credential.name?.toLowerCase().includes('claude') ? 'anthropic' :
                                      credential.name?.toLowerCase().includes('gemini') ? 'gemini' :
                                      credential.name?.toLowerCase().includes('google') ? 'gemini' : '')
    
    switch (providerType) {
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
        ]
      case 'anthropic':
        return [
          { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
          { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
          { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
          { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
          { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
          { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
          { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
        ]
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
        ]
      case 'deepseek':
        return [
          { value: 'deepseek-r1', label: 'DeepSeek R1 (Latest)' },
          { value: 'deepseek-r1-distill-qwen-32b', label: 'DeepSeek R1 Distill Qwen 32B' },
          { value: 'deepseek-r1-distill-llama-70b', label: 'DeepSeek R1 Distill Llama 70B' },
          { value: 'deepseek-chat', label: 'DeepSeek Chat' },
          { value: 'deepseek-coder', label: 'DeepSeek Coder' }
        ]
      case 'groq':
        return [
          { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B Versatile' },
          { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B Versatile' },
          { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant' },
          { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
          { value: 'gemma2-9b-it', label: 'Gemma2 9B IT' },
          { value: 'llama3-groq-70b-8192-tool-use-preview', label: 'Llama 3 70B Tool Use' },
          { value: 'llama3-groq-8b-8192-tool-use-preview', label: 'Llama 3 8B Tool Use' }
        ]
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
        ]
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
        ]
      case 'perplexity':
        return [
          { value: 'llama-3.1-sonar-large-128k-online', label: 'Llama 3.1 Sonar Large (Online)' },
          { value: 'llama-3.1-sonar-small-128k-online', label: 'Llama 3.1 Sonar Small (Online)' },
          { value: 'llama-3.1-sonar-huge-128k-online', label: 'Llama 3.1 Sonar Huge (Online)' },
          { value: 'llama-3.1-sonar-large-128k-chat', label: 'Llama 3.1 Sonar Large (Chat)' },
          { value: 'llama-3.1-sonar-small-128k-chat', label: 'Llama 3.1 Sonar Small (Chat)' }
        ]
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
        ]
      default:
        return []
    }
  }

  // Load stored credentials
  useEffect(() => {
    loadCredentials()
  }, [])

  const loadCredentials = async () => {
    try {
      const response = await credentialAPI.list()
      if (response.data) {
        // Filter only AI provider credentials
        const aiProviders = response.data.filter((cred: any) => {
          const platform = cred.platform || cred.templateId || '';
          // Check if it's an AI provider based on platform field
          return ['openai', 'anthropic', 'google_ai', 'gemini', 'deepseek', 'groq', 'mistral', 'cohere', 'perplexity', 'together'].includes(platform) ||
                 platform.includes('claude');
        });
        setStoredCredentials(aiProviders)
        console.log('Loaded AI provider credentials:', aiProviders)
      }
    } catch (error) {
      console.error('Failed to load credentials:', error)
    }
  }

  const handleCreate = async (confirmedPrompt?: string) => {
    if (!description.trim()) {
      toast.error('Please describe your automation')
      return
    }

    if (!name.trim()) {
      toast.error('Please provide a name for your automation')
      return
    }

    // Check if AI provider is selected when using user settings
    if (useUserAISettings && !selectedCredentialId) {
      toast.error('Please select an AI provider from your saved credentials')
      return
    }

    // Check if model is selected when AI provider is selected
    if (selectedCredentialId && !selectedModel) {
      toast.error('Please select a model for the AI provider')
      return
    }

    // For advanced/expert modes, show enhanced prompt first (unless it's already AI-generated)
    if ((generationMode === 'advanced' || generationMode === 'expert') && !showEnhancedPrompt && !confirmedPrompt && !isAIGeneratedPrompt) {
      // First, get the enhanced prompt from server
      setIsCreating(true)
      setProgressMessage('Generating enhanced prompt...')
      
      try {
        // Make a request to get enhanced prompt without generating workflow
        const response = await api.post('/n8n/tools/n8n_get_enhanced_prompt', {
          prompt: description,
          name: name,
          mode: generationMode
        })
        
        if (response.data.success && response.data.enhancedPrompt) {
          console.log('Enhanced prompt received:', response.data.enhancedPrompt)
          setEnhancedPrompt(response.data.enhancedPrompt)
          setShowEnhancedPrompt(true)
          setIsCreating(false)
          return
        } else {
          console.error('No enhanced prompt in response:', response.data)
        }
      } catch (error) {
        console.error('Failed to get enhanced prompt:', error)
        toast.error('Failed to generate enhanced prompt')
        setIsCreating(false)
        return
      }
    }

    // If we have a confirmed prompt from dialog, use it
    if (confirmedPrompt) {
      setUserEditedPrompt(confirmedPrompt)
    }

    setIsCreating(true)
    setProgressMessage('Analyzing your request...')
    try {
      const payload: any = {
        description,
        name,
        platform: platform,
        useUserSettings: useUserAISettings,
        mode: generationMode,
        userEditedPrompt: userEditedPrompt || undefined
      }
      
      // Include selected AI provider
      console.log('Selected credential ID in handleCreate:', selectedCredentialId);
      console.log('Stored credentials:', storedCredentials);
      
      if (selectedCredentialId) {
        // Convert to string for comparison if needed
        const selectedCredential = storedCredentials.find(c => String(c.id) === String(selectedCredentialId));
        console.log('Found credential:', selectedCredential);
        console.log('Type check - selectedCredentialId:', typeof selectedCredentialId, selectedCredentialId);
        console.log('Type check - storedCredentials ids:', storedCredentials.map(c => ({ id: c.id, type: typeof c.id })));
        
        if (selectedCredential) {
          // Use platform field to determine provider type
          let providerType = selectedCredential.platform || selectedCredential.templateId;
          
          // Normalize provider names
          if (providerType === 'google_ai') {
            providerType = 'gemini';
          } else if (providerType === 'anthropic' || providerType?.includes('claude')) {
            providerType = 'anthropic';
          }
          
          payload.provider = providerType;
          // Ensure credentialId is passed as the same type as stored in the database
          payload.credentialId = selectedCredential.id; // Use the ID from the credential object directly
          payload.credentialName = selectedCredential.name;
          // Add advanced settings
          if (selectedModel) payload.model = selectedModel;
          payload.temperature = temperature;
          payload.maxTokens = maxTokens;
        }
      }
      
      console.log('Creating automation with payload:', payload)
      
      // Start tracking the workflow creation
      const workflowId = `${platform}_${Date.now()}`;
      feedbackCollector.startTracking(workflowId, platform, 0);
      
      // Simulate progress updates
      setTimeout(() => setProgressMessage('Generating workflow structure...'), 1500)
      setTimeout(() => setProgressMessage('Adding nodes and connections...'), 3000)
      setTimeout(() => setProgressMessage('Validating workflow...'), 4500)
      setTimeout(() => setProgressMessage('Finalizing automation...'), 6000)
      
      const result = await createAutomation(payload)
      
      console.log('Create automation result:', result)

      // Check if the workflow requires user configuration
      if (result?.requiresConfiguration && result?.userConfiguration) {
        // Store the workflow and configuration for later use
        setPendingWorkflow(result.workflow)
        setUserConfiguration(result.userConfiguration)
        setShowConfigDialog(true)
        setIsCreating(false)
        return
      }

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
      setProgressMessage('')
    }
  }

  const examples = generationMode === 'quick' ? [
    "Send email when form submitted",
    "Monitor RSS feeds for keywords",
    "Sync data between two apps",
    "Send daily report at 9 AM",
  ] : generationMode === 'advanced' ? [
    "When someone fills out my contact form, send them a welcome email and add them to my CRM",
    "Every morning at 9 AM, check for new orders and create invoices automatically",
    "Monitor multiple RSS feeds for brand mentions and notify via Slack with sentiment analysis",
    "When a support ticket is created, analyze sentiment and route to the right team",
  ] : [
    "Build a complete customer onboarding workflow with form submission, data validation, CRM integration, email sequences, and task creation in project management tools",
    "Create an e-commerce order processing system with inventory checks, payment processing, invoice generation, shipping label creation, and customer notifications",
    "Implement a content moderation pipeline with AI analysis, keyword filtering, manual review queue, automated responses, and escalation procedures",
    "Design a multi-channel marketing automation with lead scoring, segmentation, personalized campaigns, A/B testing, and performance analytics",
  ]

  const handlePromptGenerated = (prompt: string) => {
    // Directly set the AI-generated prompt
    setDescription(prompt);
    // Clear any name that might have been set from Prompt Library
    if (name && name.includes('prompt')) {
      setName('');
    }
    // Mark this as an AI-generated prompt to skip enhancement
    setIsAIGeneratedPrompt(true);
    // Optionally close the assistant after prompt is used
    // setShowAIAssistant(false);
  };

  const handleConfigurationConfirm = async (configValues: Record<string, any>) => {
    if (!pendingWorkflow) return

    setShowConfigDialog(false)
    setIsCreating(true)

    try {
      const result = await createWorkflowWithConfiguration(pendingWorkflow, configValues)
      
      if (result.data?.success) {
        toast.success('Automation created with your configuration!')
        navigate('/automations')
      } else {
        toast.error(result.data?.error || 'Failed to create automation')
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create automation with configuration'
      toast.error(errorMessage)
    } finally {
      setIsCreating(false)
      setPendingWorkflow(null)
      setUserConfiguration(null)
    }
  }

  const handleConfigurationSkip = async () => {
    if (!pendingWorkflow) return

    setShowConfigDialog(false)
    setIsCreating(true)

    try {
      // Create the workflow without updating configuration
      const workflowData = {
        name: pendingWorkflow.name || name,
        nodes: pendingWorkflow.nodes,
        connections: pendingWorkflow.connections,
        settings: pendingWorkflow.settings || {},
        active: false
      }
      
      const response = await api.post('/n8n/tools/n8n_create_workflow', workflowData)
      
      if (response.data?.success) {
        toast.success('Automation created! Remember to update the placeholder values in n8n.')
        navigate('/automations')
      } else {
        toast.error(response.data?.error || 'Failed to create automation')
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create automation'
      toast.error(errorMessage)
    } finally {
      setIsCreating(false)
      setPendingWorkflow(null)
      setUserConfiguration(null)
    }
  }

  const handleConfigurationClose = () => {
    setShowConfigDialog(false)
    setIsCreating(false)
    setPendingWorkflow(null)
    setUserConfiguration(null)
  }

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

        {/* Generation Mode Selection - Only show for n8n */}
        {platform === 'n8n' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Generation Mode
            </label>
            <GenerationModeSelector 
              mode={generationMode}
              onChange={setGenerationMode}
            />
          </div>
        )}

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

        {/* Mode-specific helper text */}
        {platform === 'n8n' && (
          <div className={`mb-4 p-4 rounded-lg ${
            generationMode === 'quick' 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : generationMode === 'advanced'
                ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                : 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800'
          }`}>
            <div className="flex items-start space-x-3">
              <div className={`p-2 rounded-lg ${
                generationMode === 'quick'
                  ? 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300'
                  : generationMode === 'advanced'
                    ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300'
                    : 'bg-purple-100 dark:bg-purple-800 text-purple-700 dark:text-purple-300'
              }`}>
                {generationMode === 'quick' ? <Zap className="w-5 h-5" /> : 
                 generationMode === 'advanced' ? <Wrench className="w-5 h-5" /> : 
                 <Target className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <h4 className={`font-medium mb-1 ${
                  generationMode === 'quick'
                    ? 'text-green-900 dark:text-green-100'
                    : generationMode === 'advanced'
                      ? 'text-blue-900 dark:text-blue-100'
                      : 'text-purple-900 dark:text-purple-100'
                }`}>
                  {generationMode === 'quick' ? 'Quick Mode Active' :
                   generationMode === 'advanced' ? 'Advanced Mode Active' :
                   'Expert Mode Active'}
                </h4>
                <p className={`text-sm ${
                  generationMode === 'quick'
                    ? 'text-green-700 dark:text-green-300'
                    : generationMode === 'advanced'
                      ? 'text-blue-700 dark:text-blue-300'
                      : 'text-purple-700 dark:text-purple-300'
                }`}>
                  {generationMode === 'quick' 
                    ? 'Just describe what you need. AI will handle the complexity for you.'
                    : generationMode === 'advanced'
                      ? 'You\'ll see and review the AI-enhanced prompt before generation. Use AI Assistant for help.'
                      : 'Full control mode. You can edit the AI-generated prompt before workflow creation.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Prompt Helper - Only show in advanced/expert modes */}
        {generationMode !== 'quick' && (
          <PromptHelper onUseTemplate={(template) => setDescription(template)} />
        )}

        {/* Description Input */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {generationMode === 'quick' 
                ? 'What do you want to automate?' 
                : generationMode === 'advanced' 
                  ? 'Describe your workflow requirements'
                  : 'Provide detailed automation specifications'}
            </label>
            {generationMode !== 'quick' && (
              <button
                onClick={() => setShowAIAssistant(!showAIAssistant)}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                {showAIAssistant ? 'Hide' : 'Show'} AI Assistant
              </button>
            )}
          </div>
          {inputMode === 'text' ? (
            <textarea
              id="description"
              rows={6}
              value={description}
              onChange={(e) => {
            setDescription(e.target.value)
            // Reset AI-generated flag when user manually edits
            setIsAIGeneratedPrompt(false)
          }}
              placeholder={
                generationMode === 'quick' 
                  ? "Example: Send email when form submitted, monitor RSS feeds for keywords..."
                  : generationMode === 'advanced'
                    ? "Describe your workflow in detail. Include triggers, actions, conditions, and integrations needed..."
                    : "Provide comprehensive specifications including: data flow, error handling, edge cases, performance requirements..."
              }
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-foreground placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary focus:border-transparent resize-none"
            />
          ) : (
            <div className="relative">
              <div className="w-full h-40 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center">
                <button title="Start recording" className="p-4 bg-primary-100 dark:bg-primary/20 rounded-full hover:bg-primary-200 dark:hover:bg-primary/30 transition-colors">
                  <Mic className="w-8 h-8 text-primary-600 dark:text-primary" />
                </button>
              </div>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
                Click the microphone to start recording
              </p>
            </div>
          )}
        </div>



        {/* AI Provider Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Bot className="w-4 h-4 inline mr-1" />
            AI Provider
          </label>
          
          {storedCredentials.length > 0 ? (
            <div>
              <select
                value={selectedCredentialId || ''}
                onChange={(e) => {
                  console.log('Selected credential ID:', e.target.value);
                  setSelectedCredentialId(e.target.value);
                  setUseUserAISettings(true);
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-foreground rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary focus:border-transparent"
              >
                <option value="">Select an AI provider</option>
                {storedCredentials.map((credential) => {
                  return (
                    <option key={credential.id} value={credential.id}>
                      {credential.name}
                    </option>
                  );
                })}
              </select>
              {selectedCredentialId && (
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <AIProviderIcon 
                    platform={storedCredentials.find(c => c.id === selectedCredentialId)?.platform || storedCredentials.find(c => c.id === selectedCredentialId)?.templateId} 
                    className="w-4 h-4"
                  />
                  <span>{storedCredentials.find(c => c.id === selectedCredentialId)?.name}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No AI providers configured.{' '}
              <button
                type="button"
                onClick={() => navigate('/credentials')}
                className="text-primary-600 hover:text-primary-500"
              >
                Add AI provider credentials
              </button>
            </p>
          )}
        </div>

        {/* Advanced AI Settings - Only show when a credential is selected */}
        {selectedCredentialId && (
          <div className="mb-6 space-y-4 border-t dark:border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Advanced AI Settings
            </h4>
            
            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-foreground rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary focus:border-transparent"
              >
                <option value="">Select a model</option>
                {getModelOptions().map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
              {selectedCredentialId && !selectedModel && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  Please select a model to continue
                </p>
              )}
            </div>
            
            {/* Max Tokens */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Tokens: {maxTokens}
              </label>
              <input
                type="range"
                min="1000"
                max="32000"
                step="1000"
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>1,000</span>
                <span>32,000</span>
              </div>
            </div>
            
            {/* Temperature */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Temperature: {temperature}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>0 (Precise)</span>
                <span>1 (Creative)</span>
              </div>
            </div>
          </div>
        )}

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
            onClick={() => handleCreate()}
            disabled={isCreating || !description.trim() || !name.trim()}
            className="px-6 py-2 bg-primary-600 dark:bg-primary text-white dark:text-primary-foreground rounded-lg hover:bg-primary-700 dark:hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium inline-flex items-center"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {generationMode === 'quick' ? 'Creating...' : 'Generating Enhanced Prompt...'}
              </>
            ) : (
              <>
                {generationMode === 'quick' ? <Zap className="w-4 h-4 mr-2" /> :
                 generationMode === 'advanced' ? <Wrench className="w-4 h-4 mr-2" /> :
                 <Target className="w-4 h-4 mr-2" />}
                {generationMode === 'quick' ? 'Generate Instantly' :
                 generationMode === 'advanced' ? 'Review & Generate' :
                 'Customize & Generate'}
              </>
            )}
          </button>
        </div>
        
        {/* Progress Message */}
        {isCreating && progressMessage && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600 dark:text-blue-400" />
              <p className="text-sm text-blue-700 dark:text-blue-300">{progressMessage}</p>
            </div>
          </div>
        )}
        </div>
        
        {/* AI Assistant - only show for advanced/expert modes */}
        {showAIAssistant && generationMode !== 'quick' && (
          <div className="lg:sticky lg:top-4">
            <div className={`p-4 rounded-lg border-2 ${
              generationMode === 'advanced' 
                ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10'
                : 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10'
            }`}>
              <h3 className={`text-lg font-semibold mb-2 flex items-center ${
                generationMode === 'advanced'
                  ? 'text-blue-900 dark:text-blue-100'
                  : 'text-purple-900 dark:text-purple-100'
              }`}>
                <Bot className="w-5 h-5 mr-2" />
                {generationMode === 'advanced' ? 'AI Workflow Assistant' : 'Expert AI Assistant'}
              </h3>
              <p className={`text-sm mb-4 ${
                generationMode === 'advanced'
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-purple-700 dark:text-purple-300'
              }`}>
                {generationMode === 'advanced' 
                  ? 'Get help structuring your workflow description for better results.'
                  : 'Get expert guidance on complex workflow patterns and best practices.'}
              </p>
              <AIPromptAssistant onPromptGenerated={handlePromptGenerated} />
            </div>
          </div>
        )}
      </div>

      {userConfiguration && (
        <UserConfigurationDialog
          isOpen={showConfigDialog}
          onClose={handleConfigurationClose}
          onConfirm={handleConfigurationConfirm}
          onSkip={handleConfigurationSkip}
          configuration={userConfiguration}
          workflowName={pendingWorkflow?.name || name}
        />
      )}

      {/* Enhanced Prompt Dialog */}
      <EnhancedPromptDialog
        isOpen={showEnhancedPrompt}
        onClose={() => {
          setShowEnhancedPrompt(false)
          setEnhancedPrompt('')
          setUserEditedPrompt('')
        }}
        originalPrompt={description}
        enhancedPrompt={enhancedPrompt}
        mode={generationMode as 'advanced' | 'expert'}
        onConfirm={(editedPrompt) => {
          setShowEnhancedPrompt(false)
          handleCreate(editedPrompt)
        }}
      />
    </div>
  )
}