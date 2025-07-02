import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Info, Eye, EyeOff, TestTube2, CheckCircle, AlertCircle, ExternalLink, Copy, Key } from 'lucide-react';
import toast from 'react-hot-toast';
import { credentialAPI } from '../../services/api';

interface CredentialTemplate {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category: string;
  fields: CredentialField[];
  documentation?: string;
  testConnection?: boolean;
}

interface CredentialField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'url' | 'email' | 'number';
  required: boolean;
  placeholder?: string;
  description?: string;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
  };
  options?: Array<{ label: string; value: string }>;
  default?: any;
}

interface Credential {
  id: string;
  name: string;
  templateId: string;
  values?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  isValid?: boolean;
}

interface CredentialFormEnhancedProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  credential?: Credential | null;
  preselectedTemplate?: string;
}

export default function CredentialFormEnhanced({
  isOpen,
  onClose,
  onSuccess,
  credential,
  preselectedTemplate
}: CredentialFormEnhancedProps) {
  const [name, setName] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(preselectedTemplate || '');
  const [templates, setTemplates] = useState<CredentialTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<CredentialTemplate | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
      if (credential) {
        setName(credential.name);
        setSelectedTemplateId(credential.templateId);
        setValues(credential.values || {});
      }
    }
  }, [isOpen, credential]);

  useEffect(() => {
    if (selectedTemplateId && templates.length > 0) {
      const template = templates.find(t => t.id === selectedTemplateId);
      setSelectedTemplate(template || null);
      
      // Initialize default values
      if (template && !credential) {
        const defaultValues: Record<string, any> = {};
        template.fields.forEach(field => {
          if (field.default !== undefined) {
            defaultValues[field.name] = field.default;
          }
        });
        setValues(defaultValues);
      }
    }
  }, [selectedTemplateId, templates, credential]);

  const loadTemplates = async () => {
    try {
      const response = await credentialAPI.getTemplates();
      setTemplates(response.data);
    } catch (error) {
      toast.error('Failed to load credential templates');
    }
  };

  const validateField = (field: CredentialField, value: any): string | null => {
    if (field.required && !value) {
      return `${field.label} is required`;
    }

    if (field.validation) {
      if (field.type === 'text' || field.type === 'password' || field.type === 'email' || field.type === 'url') {
        const strValue = String(value);
        
        if (field.validation.minLength && strValue.length < field.validation.minLength) {
          return `${field.label} must be at least ${field.validation.minLength} characters`;
        }
        
        if (field.validation.maxLength && strValue.length > field.validation.maxLength) {
          return `${field.label} must be at most ${field.validation.maxLength} characters`;
        }
        
        if (field.validation.pattern) {
          const regex = new RegExp(field.validation.pattern);
          if (!regex.test(strValue)) {
            return `${field.label} format is invalid`;
          }
        }
      }
      
      if (field.type === 'number') {
        const numValue = Number(value);
        
        if (field.validation.min !== undefined && numValue < field.validation.min) {
          return `${field.label} must be at least ${field.validation.min}`;
        }
        
        if (field.validation.max !== undefined && numValue > field.validation.max) {
          return `${field.label} must be at most ${field.validation.max}`;
        }
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTemplate) {
      toast.error('Please select a credential template');
      return;
    }

    // Validate all fields
    const newErrors: Record<string, string> = {};
    selectedTemplate.fields.forEach(field => {
      const error = validateField(field, values[field.name]);
      if (error) {
        newErrors[field.name] = error;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Please fix the validation errors');
      return;
    }

    setLoading(true);
    try {
      if (credential) {
        await credentialAPI.update(credential.id, { values });
        toast.success('Credential updated successfully');
      } else {
        await credentialAPI.create({
          templateId: selectedTemplateId,
          name,
          values
        });
        toast.success('Credential created successfully');
      }
      
      onSuccess();
      handleClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save credential');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    if (!credential && !values) {
      toast.error('Please fill in the credential values first');
      return;
    }

    setTesting(true);
    setTestResult(null);
    
    try {
      let credentialId = credential?.id;
      
      // If new credential, save it first
      if (!credentialId) {
        const response = await credentialAPI.create({
          templateId: selectedTemplateId,
          name: name || 'Test Credential',
          values
        });
        credentialId = response.data.id;
      }
      
      const result = await credentialAPI.test(credentialId!);
      setTestResult({
        success: result.data.valid,
        message: result.data.message
      });
      
      if (result.data.valid) {
        toast.success('Connection test successful!');
      } else {
        toast.error('Connection test failed');
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Connection test failed'
      });
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setSelectedTemplateId('');
    setSelectedTemplate(null);
    setValues({});
    setShowPassword({});
    setErrors({});
    setTestResult(null);
    setSearchQuery('');
    onClose();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    if (!acc[template.category]) {
      acc[template.category] = [];
    }
    acc[template.category].push(template);
    return acc;
  }, {} as Record<string, CredentialTemplate[]>);

  const categoryIcons: Record<string, React.ReactNode> = {
    communication: '💬',
    crm: '📊',
    database: '🗄️',
    payment: '💳',
    storage: '☁️',
    analytics: '📈',
    other: '🔧'
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            {credential ? 'Edit Credential' : 'Add New Credential'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Template Selection */}
          {!credential && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Service
              </label>
              
              {/* Search */}
              <input
                type="text"
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded-lg mb-4"
              />
              
              {/* Template Grid */}
              <div className="space-y-6">
                {Object.entries(groupedTemplates).map(([category, templates]) => (
                  <div key={category}>
                    <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                      <span>{categoryIcons[category]}</span>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {templates.map(template => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => setSelectedTemplateId(template.id)}
                          className={`p-4 rounded-lg border transition-all text-left ${
                            selectedTemplateId === template.id
                              ? 'border-purple-500 bg-purple-500/10'
                              : 'border-gray-700 hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">{template.icon}</span>
                            <div>
                              <h4 className="font-medium">{template.name}</h4>
                              <p className="text-xs text-gray-400 mt-1">{template.description}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Template Details */}
          {selectedTemplate && (
            <>
              {/* Template Info */}
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{selectedTemplate.icon}</span>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      {selectedTemplate.name}
                      {selectedTemplate.documentation && (
                        <a
                          href={selectedTemplate.documentation}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </h3>
                    <p className="text-sm text-gray-400 mt-1">{selectedTemplate.description}</p>
                  </div>
                </div>
              </div>

              {/* Credential Name */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Credential Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={`My ${selectedTemplate.name} Credentials`}
                  className="w-full px-4 py-2 bg-gray-700 rounded-lg"
                  required
                />
              </div>

              {/* Dynamic Fields */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Authentication Details
                </h3>
                
                {selectedTemplate.fields.map(field => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium mb-2">
                      {field.label}
                      {field.required && <span className="text-red-400 ml-1">*</span>}
                      {field.description && (
                        <span className="ml-2 text-gray-400 text-xs">
                          <Info className="w-3 h-3 inline mr-1" />
                          {field.description}
                        </span>
                      )}
                    </label>
                    
                    {field.type === 'select' ? (
                      <select
                        value={values[field.name] || ''}
                        onChange={(e) => {
                          setValues({ ...values, [field.name]: e.target.value });
                          setErrors({ ...errors, [field.name]: '' });
                        }}
                        className="w-full px-4 py-2 bg-gray-700 rounded-lg"
                        required={field.required}
                      >
                        <option value="">Select {field.label}</option>
                        {field.options?.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'password' ? (
                      <div className="relative">
                        <input
                          type={showPassword[field.name] ? 'text' : 'password'}
                          value={values[field.name] || ''}
                          onChange={(e) => {
                            setValues({ ...values, [field.name]: e.target.value });
                            setErrors({ ...errors, [field.name]: '' });
                          }}
                          placeholder={field.placeholder}
                          className={`w-full px-4 py-2 bg-gray-700 rounded-lg pr-20 ${
                            errors[field.name] ? 'border border-red-500' : ''
                          }`}
                          required={field.required}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                          <button
                            type="button"
                            onClick={() => setShowPassword({
                              ...showPassword,
                              [field.name]: !showPassword[field.name]
                            })}
                            className="p-2 hover:bg-gray-600 rounded transition-colors"
                          >
                            {showPassword[field.name] ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                          {values[field.name] && (
                            <button
                              type="button"
                              onClick={() => copyToClipboard(values[field.name])}
                              className="p-2 hover:bg-gray-600 rounded transition-colors"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <input
                        type={field.type}
                        value={values[field.name] || ''}
                        onChange={(e) => {
                          const value = field.type === 'number' ? Number(e.target.value) : e.target.value;
                          setValues({ ...values, [field.name]: value });
                          setErrors({ ...errors, [field.name]: '' });
                        }}
                        placeholder={field.placeholder}
                        className={`w-full px-4 py-2 bg-gray-700 rounded-lg ${
                          errors[field.name] ? 'border border-red-500' : ''
                        }`}
                        required={field.required}
                      />
                    )}
                    
                    {errors[field.name] && (
                      <p className="text-red-400 text-sm mt-1">{errors[field.name]}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Test Connection */}
              {selectedTemplate.testConnection && (
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Test Connection</h4>
                      <p className="text-sm text-gray-400 mt-1">
                        Verify that your credentials are working correctly
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleTest}
                      disabled={testing}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {testing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <TestTube2 className="w-4 h-4" />
                          Test Connection
                        </>
                      )}
                    </button>
                  </div>
                  
                  {testResult && (
                    <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
                      testResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {testResult.success ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        <AlertCircle className="w-5 h-5" />
                      )}
                      <span>{testResult.message}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedTemplate || !name}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {credential ? 'Update' : 'Create'} Credential
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}