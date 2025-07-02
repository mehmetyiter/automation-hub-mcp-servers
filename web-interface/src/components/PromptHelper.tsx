import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Info, Copy, Check } from 'lucide-react'

interface PromptTemplate {
  name: string
  description: string
  template: string
  category: string
}

const promptTemplates: PromptTemplate[] = [
  {
    name: 'Complex Notification System',
    category: 'notifications',
    description: 'Multi-channel notification with validation',
    template: `Create a complex notification workflow with:
TRIGGER: Webhook endpoint "/sendNotification"
INPUTS: patient_id, event_type, message_body, subject, priority
STEPS:
1. Validate webhook data
2. Fetch patient preferences from API
3. Smart channel selection based on preferences
4. Send via Email (SendGrid), SMS (Twilio), Push (HTTP)
5. Analyze delivery results
6. Return webhook response`
  },
  {
    name: 'Data Processing Pipeline',
    category: 'data',
    description: 'ETL workflow with transformations',
    template: `Create a data processing workflow:
TRIGGER: Schedule daily at 9 AM
DATA SOURCE: CSV file or API endpoint
PROCESSING:
1. Fetch/read data
2. Clean and validate data
3. Transform with JavaScript code
4. Apply business rules
5. Export to database/file
ERROR HANDLING: Log errors and send alerts`
  },
  {
    name: 'API Integration Workflow',
    category: 'integration',
    description: 'Connect multiple APIs with authentication',
    template: `Create API integration workflow:
APIS TO CONNECT:
- Source API: [URL] with [auth type]
- Target API: [URL] with [auth type]
FLOW:
1. Authenticate with both APIs
2. Fetch data from source
3. Transform data format
4. Handle pagination
5. Post to target API
6. Log results`
  },
  {
    name: 'Approval Workflow',
    category: 'business',
    description: 'Multi-step approval process',
    template: `Create approval workflow:
TRIGGER: Form submission or API call
STEPS:
1. Validate submission data
2. Check approval rules
3. Send notification to approver
4. Wait for approval (with timeout)
5. If approved: proceed with action
6. If rejected: notify submitter
7. Log all decisions`
  }
]

export const PromptHelper: React.FC<{ onUseTemplate: (template: string) => void }> = ({ onUseTemplate }) => {
  const [expanded, setExpanded] = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const handleCopy = (template: string, index: number) => {
    navigator.clipboard.writeText(template)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span className="font-medium text-blue-900 dark:text-blue-300">Prompt Writing Guide</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <h4 className="font-semibold mb-2">Tips for Better Results:</h4>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Be specific about trigger types (webhook, schedule, manual)</li>
              <li>List all required inputs and their types</li>
              <li>Describe each workflow step clearly</li>
              <li>Specify which services to use (SendGrid, Twilio, etc.)</li>
              <li>Mention error handling requirements</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-3">Example Templates:</h4>
            <div className="space-y-3">
              {promptTemplates.map((template, index) => (
                <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-100 dark:border-blue-900">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h5 className="font-medium text-gray-900 dark:text-gray-100">{template.name}</h5>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{template.description}</p>
                    </div>
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-1 rounded">
                      {template.category}
                    </span>
                  </div>
                  <pre className="text-xs bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                    {template.template}
                  </pre>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => onUseTemplate(template.template)}
                      className="text-xs bg-blue-600 dark:bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-700 dark:hover:bg-blue-600"
                    >
                      Use Template
                    </button>
                    <button
                      onClick={() => handleCopy(template.template, index)}
                      className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 flex items-center gap-1"
                    >
                      {copiedIndex === index ? (
                        <>
                          <Check className="w-3 h-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}