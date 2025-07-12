import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../ui/Button';
import { Card, CardHeader, CardBody, CardFooter } from '../../ui/Card';
import { 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  AlertCircle, 
  Shield, 
  Key,
  Settings,
  CheckCircle
} from 'lucide-react';

export interface CredentialFormData {
  provider?: string;
  credentials?: Record<string, string>;
  permissions?: string[];
  connectionTest?: boolean;
  name?: string;
}

interface WizardStep {
  id: number;
  title: string;
  description: string;
  component: React.ComponentType<StepProps>;
  optional?: boolean;
}

interface StepProps {
  data: CredentialFormData;
  onUpdate: (data: CredentialFormData) => void;
  onNext: () => void;
  onBack: () => void;
  isValid?: boolean;
}

const steps: WizardStep[] = [
  {
    id: 1,
    title: 'Select Provider',
    description: 'Choose your AI provider',
    component: ProviderSelection
  },
  {
    id: 2,
    title: 'Enter Credentials',
    description: 'Provide API keys and configuration',
    component: CredentialForm
  },
  {
    id: 3,
    title: 'Test Connection',
    description: 'Verify your credentials work',
    component: ConnectionTest
  },
  {
    id: 4,
    title: 'Set Permissions',
    description: 'Configure access and limits',
    component: PermissionSettings,
    optional: true
  },
  {
    id: 5,
    title: 'Review & Create',
    description: 'Confirm and save your configuration',
    component: ReviewStep
  }
];

export const CredentialWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<CredentialFormData>({});
  const [isValid, setIsValid] = useState(false);

  const currentStepData = steps.find(s => s.id === currentStep);
  const progress = (currentStep / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepClick = (stepId: number) => {
    // Allow going back to previous steps
    if (stepId <= currentStep) {
      setCurrentStep(stepId);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Credential Setup Wizard</h1>
          <span className="text-sm text-gray-500">
            Step {currentStep} of {steps.length}
          </span>
        </div>
        
        <div className="relative">
          <div className="h-2 bg-gray-200 rounded-full">
            <motion.div
              className="h-2 bg-blue-600 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          
          {/* Step Indicators */}
          <div className="absolute -top-1 left-0 right-0 flex justify-between">
            {steps.map((step) => (
              <button
                key={step.id}
                onClick={() => handleStepClick(step.id)}
                className={`w-4 h-4 rounded-full border-2 transition-colors ${
                  step.id < currentStep
                    ? 'bg-green-500 border-green-500 text-white'
                    : step.id === currentStep
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-gray-300'
                } ${step.id <= currentStep ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
              >
                {step.id < currentStep && (
                  <Check className="w-2 h-2 text-white" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Step Names */}
        <div className="flex justify-between mt-4">
          {steps.map((step) => (
            <div
              key={step.id}
              className="text-center flex-1"
              style={{ maxWidth: `${100 / steps.length}%` }}
            >
              <div className={`text-xs font-medium ${
                step.id <= currentStep ? 'text-gray-900' : 'text-gray-500'
              }`}>
                {step.title}
              </div>
              {step.optional && (
                <div className="text-xs text-gray-400">(Optional)</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader
          title={currentStepData?.title}
          subtitle={currentStepData?.description}
        />
        
        <CardBody>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {currentStepData && React.createElement(currentStepData.component, {
                data: formData,
                onUpdate: setFormData,
                onNext: handleNext,
                onBack: handleBack,
                isValid
              })}
            </motion.div>
          </AnimatePresence>
        </CardBody>

        <CardFooter justify="between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
            leftIcon={ChevronLeft}
          >
            Back
          </Button>
          
          <div className="flex items-center space-x-3">
            {currentStepData?.optional && (
              <Button
                variant="ghost"
                onClick={handleNext}
              >
                Skip
              </Button>
            )}
            
            <Button
              onClick={handleNext}
              disabled={!isValid && currentStep < steps.length}
              rightIcon={currentStep === steps.length ? CheckCircle : ChevronRight}
            >
              {currentStep === steps.length ? 'Create Credential' : 'Next'}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

// Step Components
function ProviderSelection({ data, onUpdate, onNext, isValid }: StepProps) {
  const [selectedProvider, setSelectedProvider] = useState(data.provider || '');

  const providers = [
    { id: 'openai', name: 'OpenAI', description: 'GPT-3.5, GPT-4, DALL-E' },
    { id: 'anthropic', name: 'Anthropic', description: 'Claude 3 models' },
    { id: 'google', name: 'Google', description: 'Gemini Pro' },
    { id: 'azure', name: 'Azure OpenAI', description: 'Enterprise OpenAI' }
  ];

  useEffect(() => {
    onUpdate({ ...data, provider: selectedProvider });
  }, [selectedProvider, data, onUpdate]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {providers.map((provider) => (
          <button
            key={provider.id}
            onClick={() => setSelectedProvider(provider.id)}
            className={`p-4 border rounded-lg text-left transition-colors ${
              selectedProvider === provider.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <h3 className="font-medium text-gray-900">{provider.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{provider.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function CredentialForm({ data, onUpdate }: StepProps) {
  const [credentials, setCredentials] = useState(data.credentials || {});

  const fields = [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'baseUrl', label: 'Base URL (Optional)', type: 'url', required: false },
    { key: 'organization', label: 'Organization ID (Optional)', type: 'text', required: false }
  ];

  useEffect(() => {
    onUpdate({ ...data, credentials });
  }, [credentials, data, onUpdate]);

  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.key}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type={field.type}
            value={credentials[field.key] || ''}
            onChange={(e) => setCredentials(prev => ({
              ...prev,
              [field.key]: e.target.value
            }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={`Enter ${field.label.toLowerCase()}`}
          />
        </div>
      ))}
      
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
        <div className="flex items-start">
          <Shield className="w-5 h-5 text-yellow-600 mt-0.5 mr-2" />
          <div>
            <h4 className="text-sm font-medium text-yellow-800">Security Notice</h4>
            <p className="text-sm text-yellow-700 mt-1">
              Your credentials are encrypted and stored securely. They are never logged or shared.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConnectionTest({ data }: StepProps) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<'success' | 'error' | null>(null);

  useEffect(() => {
    if (data.credentials?.apiKey) {
      setTesting(true);
      // Simulate API test
      setTimeout(() => {
        setResult('success');
        setTesting(false);
      }, 2000);
    }
  }, [data.credentials]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        {testing ? (
          <div className="space-y-4">
            <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-600">Testing connection...</p>
          </div>
        ) : result === 'success' ? (
          <div className="space-y-4">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto" />
            <p className="text-green-600 font-medium">Connection successful!</p>
          </div>
        ) : result === 'error' ? (
          <div className="space-y-4">
            <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
            <p className="text-red-600 font-medium">Connection failed</p>
          </div>
        ) : (
          <p className="text-gray-500">Ready to test connection</p>
        )}
      </div>
    </div>
  );
}

function PermissionSettings({ data, onUpdate }: StepProps) {
  const [permissions, setPermissions] = useState(data.permissions || []);

  const availablePermissions = [
    { id: 'read', label: 'Read Access', description: 'View and list resources' },
    { id: 'write', label: 'Write Access', description: 'Create and modify resources' },
    { id: 'admin', label: 'Admin Access', description: 'Full administrative control' }
  ];

  useEffect(() => {
    onUpdate({ ...data, permissions });
  }, [permissions, data, onUpdate]);

  return (
    <div className="space-y-4">
      {availablePermissions.map((permission) => (
        <label key={permission.id} className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={permissions.includes(permission.id)}
            onChange={(e) => {
              if (e.target.checked) {
                setPermissions(prev => [...prev, permission.id]);
              } else {
                setPermissions(prev => prev.filter(p => p !== permission.id));
              }
            }}
            className="mt-1"
          />
          <div>
            <div className="font-medium text-gray-900">{permission.label}</div>
            <div className="text-sm text-gray-500">{permission.description}</div>
          </div>
        </label>
      ))}
    </div>
  );
}

function ReviewStep({ data }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="font-medium text-gray-900 mb-2">Provider</h3>
          <p className="text-gray-600 capitalize">{data.provider}</p>
        </div>
        
        <div>
          <h3 className="font-medium text-gray-900 mb-2">Credentials</h3>
          <p className="text-gray-600">
            API Key: •••••••••{data.credentials?.apiKey?.slice(-4)}
          </p>
        </div>
        
        <div>
          <h3 className="font-medium text-gray-900 mb-2">Permissions</h3>
          <p className="text-gray-600">
            {data.permissions?.join(', ') || 'Default permissions'}
          </p>
        </div>
        
        <div>
          <h3 className="font-medium text-gray-900 mb-2">Status</h3>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-green-600">Ready to create</span>
          </div>
        </div>
      </div>
    </div>
  );
}