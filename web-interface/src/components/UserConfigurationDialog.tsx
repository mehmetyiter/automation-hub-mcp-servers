import React, { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'

interface UserConfigurationDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (values: Record<string, any>) => void
  onSkip: () => void
  configuration: {
    analysis: Array<{
      nodeId: string
      nodeName: string
      nodeType: string
      missingValues: Array<{
        parameter: string
        description: string
        example?: string
        type: 'credential' | 'endpoint' | 'identifier' | 'configuration'
        sensitive?: boolean
      }>
    }>
    report: string
  }
  workflowName: string
}

export const UserConfigurationDialog: React.FC<UserConfigurationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onSkip,
  configuration,
  workflowName
}) => {
  const [configValues, setConfigValues] = useState<Record<string, any>>({})
  const [showAllNodes, setShowAllNodes] = useState(false)

  if (!isOpen) return null

  const handleInputChange = (nodeId: string, parameter: string, value: string) => {
    setConfigValues(prev => ({
      ...prev,
      [`${nodeId}.${parameter}`]: value
    }))
  }

  const handleConfirm = () => {
    onConfirm(configValues)
  }

  const handleSkip = () => {
    onSkip()
  }

  // Group nodes by type and show all by default
  const displayedNodes = configuration.analysis

  // No need to limit display anymore
  const hasMoreNodes = false

  // Calculate if content needs scrolling
  const totalNodes = displayedNodes.reduce((total, node) => total + node.missingValues.length, 0)
  const needsScroll = totalNodes > 5

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] min-h-[400px] flex flex-col shadow-xl relative">
        {/* Header - Fixed */}
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-6 w-6 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Configuration Required
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Your workflow "{workflowName}" needs {totalNodes} user-specific values before it can be created
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scroll indicator */}
        {needsScroll && (
          <div className="absolute top-[120px] right-6 text-xs text-gray-500 bg-white px-2 py-1 rounded shadow-sm border border-gray-200">
            ↓ Scroll for more fields
          </div>
        )}

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4" style={{ scrollbarWidth: 'thin' }}>
          <div className="space-y-6">
            {displayedNodes.map((node) => (
              <div key={node.nodeId} className="border rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">
                  {node.nodeName}
                  <span className="text-sm text-gray-500 ml-2">({node.nodeType})</span>
                </h4>
                
                <div className="space-y-3">
                  {node.missingValues.map((missing) => (
                    <div key={missing.parameter}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {missing.description}
                        {missing.sensitive && (
                          <span className="ml-2 text-xs text-yellow-600">
                            ⚠️ Sensitive information
                          </span>
                        )}
                      </label>
                      <input
                        type={missing.sensitive ? 'password' : 'text'}
                        placeholder={missing.example || `Enter ${missing.parameter}`}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={configValues[`${node.nodeId}.${missing.parameter}`] || ''}
                        onChange={(e) => handleInputChange(node.nodeId, missing.parameter, e.target.value)}
                      />
                      {missing.type === 'endpoint' && (
                        <p className="text-xs text-gray-500 mt-1">
                          Enter the full URL including https://
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

          </div>

          {/* Information box */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h5 className="font-medium text-blue-900 mb-2">What happens next?</h5>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• If you provide values: AI will update your workflow with these specific configurations</li>
              <li>• If you skip: The workflow will be created with placeholder values that you'll need to update in n8n</li>
              <li>• Sensitive information (API keys, passwords) should be stored securely in n8n credentials</li>
            </ul>
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="border-t px-6 py-4 bg-gray-50 flex justify-between flex-shrink-0">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
          >
            Skip & Create with Placeholders
          </button>
          <div className="space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Update & Create Workflow
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}