import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Info, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { credentialAPI } from '../../services/api';

interface Credential {
  id: string;
  name: string;
  templateId: string;
  platform: string;
  isValid: boolean;
  lastVerified?: string;
  createdAt: string;
  updatedAt: string;
}

interface CredentialTemplate {
  id: string;
  name: string;
  platform: string;
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'password' | 'textarea' | 'select';
    required: boolean;
    placeholder?: string;
    description?: string;
    options?: Array<{ value: string; label: string }>;
  }>;
}

interface CredentialFormProps {
  credential?: Credential | null;
  onClose: () => void;
  onSuccess: () => void;
  preselectedTemplateId?: string;
}

export const CredentialForm: React.FC<CredentialFormProps> = ({
  credential,
  onClose,
  onSuccess,
  preselectedTemplateId
}) => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<CredentialTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<CredentialTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({
    name: '',
    templateId: preselectedTemplateId || '',
    data: {}
  });
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    if (credential) {
      setFormData({
        name: credential.name,
        templateId: credential.templateId,
        data: {}
      });
      // Find and set the template
      const template = templates.find(t => t.id === credential.templateId);
      if (template) {
        setSelectedTemplate(template);
      }
    } else if (preselectedTemplateId && templates.length > 0) {
      // Handle preselected template for new credentials
      const template = templates.find(t => t.id === preselectedTemplateId);
      if (template) {
        setSelectedTemplate(template);
        setFormData(prev => ({
          ...prev,
          templateId: preselectedTemplateId
        }));
      }
    }
  }, [credential, templates, preselectedTemplateId]);

  const loadTemplates = async () => {
    try {
      const response = await credentialAPI.getTemplates();
      setTemplates(response.data);
    } catch (error) {
      toast.error('Failed to load credential templates');
      console.error('Error loading templates:', error);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    setSelectedTemplate(template || null);
    setFormData({
      ...formData,
      templateId,
      data: {}
    });
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormData({
      ...formData,
      data: {
        ...formData.data,
        [key]: value
      }
    });
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPasswords({
      ...showPasswords,
      [key]: !showPasswords[key]
    });
  };

  const handleValidate = async () => {
    if (!selectedTemplate) return;

    // Check required fields
    const missingFields = selectedTemplate.fields
      .filter(field => field.required && !formData.data[field.key])
      .map(field => field.label);

    if (missingFields.length > 0) {
      toast.error(`Missing required fields: ${missingFields.join(', ')}`);
      return;
    }

    try {
      setValidating(true);
      const response = await credentialAPI.validate({
        templateId: formData.templateId,
        data: formData.data
      });

      if (response.data.valid) {
        toast.success('Credential validation successful');
      } else {
        toast.error(`Validation failed: ${response.data.error || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error('Failed to validate credential');
      console.error('Error validating credential:', error);
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTemplate) {
      toast.error('Please select a credential type');
      return;
    }

    // Check required fields
    const missingFields = selectedTemplate.fields
      .filter(field => field.required && !formData.data[field.key])
      .map(field => field.label);

    if (missingFields.length > 0) {
      toast.error(`Missing required fields: ${missingFields.join(', ')}`);
      return;
    }

    try {
      setLoading(true);
      if (credential) {
        await credentialAPI.update(credential.id, {
          values: formData.data
        });
        toast.success('Credential updated successfully');
      } else {
        await credentialAPI.create({
          name: formData.name,
          templateId: formData.templateId,
          values: formData.data
        });
        toast.success('Credential created successfully');
      }
      onSuccess();
    } catch (error) {
      toast.error(credential ? 'Failed to update credential' : 'Failed to create credential');
      console.error('Error saving credential:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {credential ? 'Edit Credential' : 'Add New Credential'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
          <div className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Credential Name
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="My API Credential"
                required
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                A friendly name to identify this credential
              </p>
            </div>

            <div>
              <label htmlFor="template" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Credential Type
              </label>
              <select
                id="template"
                value={formData.templateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
                disabled={!!credential}
              >
                <option value="">Select a credential type</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.platform})
                  </option>
                ))}
              </select>
            </div>

            {selectedTemplate && (
              <div className="space-y-4 border-t dark:border-gray-700 pt-4">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedTemplate.name} Configuration
                </h4>
                
                {selectedTemplate.fields.map((field) => (
                  <div key={field.key}>
                    <label htmlFor={field.key} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {field.label}
                      {field.required && <span className="text-red-500 dark:text-red-400 ml-1">*</span>}
                    </label>
                    
                    {field.type === 'select' ? (
                      <select
                        id={field.key}
                        value={formData.data[field.key] || ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        required={field.required}
                      >
                        <option value="">Select {field.label}</option>
                        {field.options?.map((option) => {
                          if (typeof option === 'string') {
                            return (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            );
                          } else {
                            return (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            );
                          }
                        })}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        id={field.key}
                        value={formData.data[field.key] || ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        rows={3}
                        placeholder={field.placeholder}
                        required={field.required}
                      />
                    ) : field.type === 'password' ? (
                      <div className="mt-1 relative">
                        <input
                          type={showPasswords[field.key] ? 'text' : 'password'}
                          id={field.key}
                          value={formData.data[field.key] || ''}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                          className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 sm:text-sm pr-10 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder={field.placeholder}
                          required={field.required}
                        />
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(field.key)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          {showPasswords[field.key] ? (
                            <EyeOff className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                          ) : (
                            <Eye className="h-4 w-4 text-gray-400 dark:text-gray-500" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <input
                        type="text"
                        id={field.key}
                        value={formData.data[field.key] || ''}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        className="mt-1 block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder={field.placeholder}
                        required={field.required}
                      />
                    )}
                    
                    {field.description && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 flex items-start space-x-1">
                        <Info className="h-4 w-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
                        <span>{field.description}</span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={handleValidate}
              disabled={!selectedTemplate || validating}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
            >
              {validating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                'Test Connection'
              )}
            </button>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {credential ? 'Update' : 'Create'} Credential
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};