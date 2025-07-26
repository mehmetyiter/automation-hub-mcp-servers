import React, { useState } from 'react';
import { X, Copy, Edit2, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface EnhancedPromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  originalPrompt: string;
  enhancedPrompt: string;
  mode: 'advanced' | 'expert';
  onConfirm: (editedPrompt?: string) => void;
}

export function EnhancedPromptDialog({
  isOpen,
  onClose,
  originalPrompt,
  enhancedPrompt,
  mode,
  onConfirm
}: EnhancedPromptDialogProps) {
  const [editedPrompt, setEditedPrompt] = useState(enhancedPrompt);
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Update editedPrompt when enhancedPrompt changes
  React.useEffect(() => {
    if (enhancedPrompt) {
      setEditedPrompt(enhancedPrompt);
    }
  }, [enhancedPrompt]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(editedPrompt);
    setCopied(true);
    toast.success('Prompt copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfirm = () => {
    if (mode === 'expert' && isEditing) {
      onConfirm(editedPrompt);
    } else {
      onConfirm();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold">
            {mode === 'advanced' ? 'Enhanced Prompt Preview' : 'Edit Enhanced Prompt'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Original Prompt */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Your Original Request:
            </h3>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-sm">{originalPrompt}</p>
            </div>
          </div>

          {/* Enhanced Prompt */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                AI-Enhanced Prompt:
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopy}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  title="Copy prompt"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
                {mode === 'expert' && (
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`p-2 rounded-lg transition-colors ${
                      isEditing 
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                    title="Edit prompt"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            {isEditing && mode === 'expert' ? (
              <textarea
                value={editedPrompt}
                onChange={(e) => setEditedPrompt(e.target.value)}
                className="w-full h-96 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Edit the enhanced prompt..."
              />
            ) : (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <pre className="text-sm whitespace-pre-wrap font-mono">{editedPrompt}</pre>
              </div>
            )}
          </div>

          {mode === 'expert' && isEditing && (
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Expert Mode:</strong> You can edit the enhanced prompt above. Your changes will be used for workflow generation.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-3 p-6 border-t dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors"
          >
            {mode === 'advanced' ? 'Generate Workflow' : 'Use This Prompt'}
          </button>
        </div>
      </div>
    </div>
  );
}