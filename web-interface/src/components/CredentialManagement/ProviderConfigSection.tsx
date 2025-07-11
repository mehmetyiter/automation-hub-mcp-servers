import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ProviderConfigCard } from './ProviderConfigCard';
import { Button } from '../ui/button';
import { Plus, ExternalLink } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';

interface ProviderConfigSectionProps {
  credentialStatus: Record<string, any>;
  onCredentialUpdate: () => void;
}

interface Provider {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  documentationUrl: string;
  keyFormat: string;
  features: string[];
}

const SUPPORTED_PROVIDERS: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, GPT-3.5, and other OpenAI models',
    iconUrl: '/images/providers/openai.svg',
    documentationUrl: 'https://platform.openai.com/docs/quickstart',
    keyFormat: 'sk-...',
    features: ['Text Generation', 'Chat Completion', 'Code Generation']
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3 Opus, Sonnet, and Haiku models',
    iconUrl: '/images/providers/anthropic.svg',
    documentationUrl: 'https://docs.anthropic.com/claude/docs',
    keyFormat: 'sk-ant-...',
    features: ['Text Generation', 'Analysis', 'Reasoning']
  },
  {
    id: 'google',
    name: 'Google AI',
    description: 'Gemini Pro and other Google AI models',
    iconUrl: '/images/providers/google.svg',
    documentationUrl: 'https://ai.google.dev/docs',
    keyFormat: 'API Key',
    features: ['Text Generation', 'Multimodal', 'Code Generation']
  },
  {
    id: 'cohere',
    name: 'Cohere',
    description: 'Command, Generate, and Embed models',
    iconUrl: '/images/providers/cohere.svg',
    documentationUrl: 'https://docs.cohere.com/',
    keyFormat: 'API Key',
    features: ['Text Generation', 'Embeddings', 'Classification']
  },
  {
    id: 'azure',
    name: 'Azure OpenAI',
    description: 'OpenAI models through Azure',
    iconUrl: '/images/providers/azure.svg',
    documentationUrl: 'https://docs.microsoft.com/en-us/azure/cognitive-services/openai/',
    keyFormat: 'API Key + Endpoint',
    features: ['Enterprise GPT', 'Security', 'Compliance']
  },
  {
    id: 'aws',
    name: 'AWS Bedrock',
    description: 'Foundation models through AWS',
    iconUrl: '/images/providers/aws.svg',
    documentationUrl: 'https://docs.aws.amazon.com/bedrock/',
    keyFormat: 'Access Key + Secret',
    features: ['Multiple Models', 'Enterprise Scale', 'AWS Integration']
  }
];

export const ProviderConfigSection: React.FC<ProviderConfigSectionProps> = ({
  credentialStatus,
  onCredentialUpdate
}) => {
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

  const configuredProviders = Object.keys(credentialStatus);
  const availableProviders = SUPPORTED_PROVIDERS.filter(
    provider => !configuredProviders.includes(provider.id)
  );

  const handleAddProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    setShowAddProvider(true);
  };

  const handleProviderSaved = () => {
    setShowAddProvider(false);
    setSelectedProvider(null);
    onCredentialUpdate();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI Provider Configuration</h2>
          <p className="text-muted-foreground">
            Configure your AI provider API keys to enable intelligent automation
          </p>
        </div>
        <Button
          onClick={() => setShowAddProvider(!showAddProvider)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Provider
        </Button>
      </div>

      {/* Information Alert */}
      <Alert className="border-blue-200 bg-blue-50">
        <AlertDescription className="text-blue-800">
          <strong>Your keys, your control:</strong> All API keys are encrypted and stored securely. 
          You only pay for your actual AI usage - no platform markup or hidden fees.
        </AlertDescription>
      </Alert>

      {/* Configured Providers */}
      {configuredProviders.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Configured Providers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {configuredProviders.map(providerId => {
              const provider = SUPPORTED_PROVIDERS.find(p => p.id === providerId);
              if (!provider) return null;

              return (
                <ProviderConfigCard
                  key={providerId}
                  provider={provider}
                  status={credentialStatus[providerId]}
                  onSave={onCredentialUpdate}
                  onTest={onCredentialUpdate}
                  onDelete={onCredentialUpdate}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Available Providers */}
      {showAddProvider && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Available Providers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableProviders.map(provider => (
              <Card
                key={provider.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleAddProvider(provider)}
              >
                <CardHeader className="pb-3">
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
                    <div className="flex-1">
                      <CardTitle className="text-base">{provider.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {provider.description}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Key Format:</span>
                      <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                        {provider.keyFormat}
                      </span>
                    </div>
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
                    <a
                      href={provider.documentationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Documentation
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Add Provider Modal/Form */}
      {selectedProvider && (
        <Card className="border-2 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <img
                src={selectedProvider.iconUrl}
                alt={selectedProvider.name}
                className="w-6 h-6"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span>Configure {selectedProvider.name}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProviderConfigCard
              provider={selectedProvider}
              status={null}
              onSave={handleProviderSaved}
              onTest={() => {}}
              onDelete={() => setSelectedProvider(null)}
              isNew={true}
            />
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {configuredProviders.length === 0 && !showAddProvider && (
        <Card className="border-dashed border-2 border-gray-300">
          <CardContent className="py-12 text-center">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto flex items-center justify-center">
                <Settings className="h-8 w-8 text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">No AI Providers Configured</h3>
                <p className="text-muted-foreground">
                  Add your first AI provider to start using intelligent automation
                </p>
              </div>
              <Button onClick={() => setShowAddProvider(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Provider
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};