import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Wand2, Loader2, Sparkles, Mic, Type } from 'lucide-react'
import toast from 'react-hot-toast'
import { createAutomation } from '../services/api'
import { PromptHelper } from '../components/PromptHelper'
import PlatformSelector from '../components/PlatformSelector'

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

  // Handle incoming prompt from PromptLibrary
  useEffect(() => {
    if (location.state?.prompt) {
      setDescription(location.state.prompt)
      if (location.state.title) {
        setName(location.state.title)
      }
    }
  }, [location.state])

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
      const result = await createAutomation({
        description,
        name,
        platform: platform,
      })

      // Check if result has the expected structure
      if (result && (result.success || result.result)) {
        toast.success('Automation created successfully!')
        navigate('/automations')
      } else {
        toast.error(result?.error || 'Failed to create automation')
      }
    } catch (error) {
      toast.error('Something went wrong. Please try again.')
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-foreground">Create New Automation</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Describe what you want to automate in plain language, and AI will create it for you
        </p>
      </div>

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
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Describe Your Automation
          </label>
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
    </div>
  )
}