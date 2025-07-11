import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { 
  Eye, 
  EyeOff, 
  Check, 
  X, 
  Loader2, 
  AlertTriangle, 
  Trash2,
  RefreshCw,
  ExternalLink 
} from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';

interface Provider {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  documentationUrl: string;
  keyFormat: string;
  features: string[];
}

interface ProviderStatus {
  status: 'valid' | 'invalid' | 'pending' | 'expired';
  lastValidated?: Date;
  isActive: boolean;
}

interface ProviderConfigCardProps {
  provider: Provider;
  status: ProviderStatus | null;
  onSave: (providerId: string, apiKey: string) => Promise<void>;
  onTest: (providerId: string) => Promise<void>;
  onDelete: (providerId: string) => Promise<void>;
  isNew?: boolean;
}

export const ProviderConfigCard: React.FC<ProviderConfigCardProps> = ({
  provider,
  status,
  onSave,
  onTest,
  onDelete,
  isNew = false
}) => {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [validationStatus, setValidationStatus] = useState<{
    isValid: boolean;
    message: string;
    details?: any;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(provider.id, apiKey.trim());
      if (isNew) {
        setApiKey('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save API key');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!apiKey.trim() && !status) {
      setError('Please save the API key first');
      return;
    }

    setIsValidating(true);
    setError(null);
    setValidationStatus(null);

    try {
      // Call validation API
      const response = await fetch(`/api/credentials/validate/${provider.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: apiKey || undefined })
      });

      const result = await response.json();

      if (response.ok) {
        setValidationStatus({
          isValid: result.isValid,
          message: result.isValid ? 'API key is valid and working' : result.errorMessage || 'API key validation failed',
          details: result
        });
        
        if (result.isValid) {
          await onTest(provider.id);
        }
      } else {
        throw new Error(result.error || 'Validation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete the ${provider.name} API key?`)) {
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      await onDelete(provider.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete API key');
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusIcon = () => {
    if (!status) return null;

    switch (status.status) {
      case 'valid':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'invalid':
        return <X className="h-4 w-4 text-red-500" />;
      case 'expired':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'pending':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  const getStatusMessage = () => {
    if (!status) return 'Not configured';

    switch (status.status) {
      case 'valid':
        return `Valid • Last checked ${status.lastValidated ? new Date(status.lastValidated).toLocaleDateString() : 'recently'}`;
      case 'invalid':
        return 'Invalid • Please check your API key';
      case 'expired':
        return 'Expired • Please update your API key';
      case 'pending':
        return 'Validation pending...';
      default:
        return 'Unknown status';
    }
  };

  const getKeyFormatHelp = () => {
    const formats = {
      'openai': 'Format: sk-... (starts with "sk-" followed by alphanumeric characters)',
      'anthropic': 'Format: sk-ant-... (starts with "sk-ant-" followed by alphanumeric characters)',
      'google': 'Your Google AI Studio API key',
      'cohere': 'Your Cohere API key from the dashboard',
      'azure': 'Your Azure OpenAI API key and endpoint',
      'aws': 'Your AWS access key and secret access key'
    };

    return formats[provider.id as keyof typeof formats] || `Format: ${provider.keyFormat}`;
  };

  return (
    <Card className={`${status?.status === 'valid' ? 'border-green-200' : status?.status === 'invalid' ? 'border-red-200' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <img
                src={provider.iconUrl}
                alt={provider.name}
                className="w-6 h-6"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <div>
              <CardTitle className="text-base flex items-center space-x-2">
                <span>{provider.name}</span>
                {getStatusIcon()}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {getStatusMessage()}
              </p>
            </div>
          </div>
          {!isNew && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* API Key Input */}
        <div className="space-y-2">
          <Label htmlFor={`${provider.id}-api-key`}>
            API Key
          </Label>
          <div className="relative">
            <Input
              id={`${provider.id}-api-key`}
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={`Enter your ${provider.name} API key`}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showApiKey ? (
                <EyeOff className="h-4 w-4 text-gray-400" />
              ) : (
                <Eye className="h-4 w-4 text-gray-400" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {getKeyFormatHelp()}
            <a
              href={provider.documentationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-blue-600 hover:text-blue-800 inline-flex items-center"
            >
              Get API key
              <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          </p>
        </div>

        {/* Actions */}
        <div className="flex space-x-2">
          <Button
            onClick={handleSave}
            disabled={isSaving || !apiKey.trim()}
            className="flex-1"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={isValidating || (!apiKey.trim() && !status)}
          >
            {isValidating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Validation Status */}
        {validationStatus && (
          <Alert className={`border-${validationStatus.isValid ? 'green' : 'red'}-200 bg-${validationStatus.isValid ? 'green' : 'red'}-50`}>
            <div className="flex items-start space-x-2">
              {validationStatus.isValid ? (
                <Check className="h-4 w-4 text-green-600 mt-0.5" />
              ) : (
                <X className="h-4 w-4 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <AlertDescription className={`text-${validationStatus.isValid ? 'green' : 'red'}-800`}>
                  {validationStatus.message}
                </AlertDescription>
                {validationStatus.details && validationStatus.isValid && (
                  <div className="mt-2 text-xs space-y-1">
                    <div>Provider: {validationStatus.details.provider}</div>
                    <div>Key Type: {validationStatus.details.keyType}</div>
                    {validationStatus.details.quotaLimits && (
                      <div>
                        Rate Limit: {validationStatus.details.quotaLimits.requestsPerMinute}/min
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Alert>
        )}

        {/* Provider Features */}
        <div className="pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Available Features:
          </p>
          <div className="flex flex-wrap gap-1">
            {provider.features.map(feature => (
              <span
                key={feature}
                className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};