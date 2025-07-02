import { useState, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { n8nAPI, makeAPI, zapierAPI, vapiAPI } from '../services/mcp-api';

interface Platform {
  id: string;
  name: string;
  initialized: boolean;
  capabilities?: {
    supportsWebhooks: boolean;
    supportsScheduling: boolean;
    supportsManualExecution: boolean;
    supportsVersioning: boolean;
    supportsSharing: boolean;
  };
}

interface PlatformSelectorProps {
  value: string;
  onChange: (platform: string) => void;
  disabled?: boolean;
}

export default function PlatformSelector({ value, onChange, disabled }: PlatformSelectorProps) {
  const [platforms, setPlatforms] = useState<Platform[]>([
    {
      id: 'n8n',
      name: 'n8n',
      initialized: true,
      capabilities: {
        supportsWebhooks: true,
        supportsScheduling: true,
        supportsManualExecution: true,
        supportsVersioning: false,
        supportsSharing: true
      }
    },
    {
      id: 'make',
      name: 'Make.com',
      initialized: false,
      capabilities: {
        supportsWebhooks: true,
        supportsScheduling: true,
        supportsManualExecution: true,
        supportsVersioning: false,
        supportsSharing: true
      }
    },
    {
      id: 'zapier',
      name: 'Zapier',
      initialized: false,
      capabilities: {
        supportsWebhooks: true,
        supportsScheduling: true,
        supportsManualExecution: false,
        supportsVersioning: false,
        supportsSharing: true
      }
    },
    {
      id: 'vapi',
      name: 'VAPI',
      initialized: false,
      capabilities: {
        supportsWebhooks: false,
        supportsScheduling: false,
        supportsManualExecution: true,
        supportsVersioning: false,
        supportsSharing: false
      }
    }
  ]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check platform connectivity on mount
  useEffect(() => {
    checkPlatformStatus();
  }, []);

  const checkPlatformStatus = async () => {
    const statusChecks = [
      { id: 'n8n', check: () => n8nAPI.health() },
      { id: 'make', check: () => makeAPI.health() },
      { id: 'zapier', check: () => zapierAPI.health() },
      { id: 'vapi', check: () => vapiAPI.health() }
    ];

    const updatedPlatforms = [...platforms];
    
    for (const { id, check } of statusChecks) {
      try {
        await check();
        const platformIndex = updatedPlatforms.findIndex(p => p.id === id);
        if (platformIndex !== -1) {
          updatedPlatforms[platformIndex].initialized = true;
        }
      } catch (error) {
        // Platform is not connected
        const platformIndex = updatedPlatforms.findIndex(p => p.id === id);
        if (platformIndex !== -1) {
          updatedPlatforms[platformIndex].initialized = false;
        }
      }
    }
    
    setPlatforms(updatedPlatforms);
  };

  const selectedPlatform = platforms.find(p => p.id === value) || platforms[0] || null;

  const platformIcons: Record<string, string> = {
    n8n: '🔧',
    make: '⚡',
    zapier: '⚡',
    vapi: '📞'
  };

  const platformColors: Record<string, string> = {
    n8n: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20',
    make: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
    zapier: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
    vapi: 'text-green-600 bg-green-50 dark:bg-green-900/20'
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-4 py-2.5 
          bg-white dark:bg-gray-800 
          border border-gray-300 dark:border-gray-600 
          rounded-lg shadow-sm 
          hover:bg-gray-50 dark:hover:bg-gray-700 
          focus:outline-none focus:ring-2 focus:ring-blue-500
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{platformIcons[selectedPlatform?.id] || '🔧'}</span>
          <div className="text-left">
            <div className="font-medium text-gray-900 dark:text-white">
              {selectedPlatform?.name}
            </div>
            {selectedPlatform?.initialized ? (
              <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <Check className="h-3 w-3" />
                Connected
              </div>
            ) : (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Not connected
              </div>
            )}
          </div>
        </div>
        <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-2 w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          {platforms.map((platform) => (
            <button
              key={platform.id}
              onClick={() => {
                onChange(platform.id);
                setIsOpen(false);
              }}
              disabled={!platform.initialized}
              className={`
                w-full flex items-center justify-between px-4 py-3
                hover:bg-gray-50 dark:hover:bg-gray-700
                ${!platform.initialized ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${platform.id === value ? 'bg-gray-50 dark:bg-gray-700' : ''}
                ${platform.id === platforms[platforms.length - 1].id ? '' : 'border-b border-gray-200 dark:border-gray-700'}
              `}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{platformIcons[platform.id] || '🔧'}</span>
                <div className="text-left">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {platform.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {platform.initialized ? (
                      <span className="text-green-600 dark:text-green-400">Connected</span>
                    ) : (
                      <span>Not connected</span>
                    )}
                  </div>
                </div>
              </div>
              {platform.id === value && (
                <Check className="h-5 w-5 text-blue-600" />
              )}
            </button>
          ))}
          
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {selectedPlatform?.capabilities && (
                <div className="space-y-1">
                  {selectedPlatform.capabilities.supportsWebhooks && (
                    <div className="flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Webhooks
                    </div>
                  )}
                  {selectedPlatform.capabilities.supportsScheduling && (
                    <div className="flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Scheduling
                    </div>
                  )}
                  {selectedPlatform.capabilities.supportsVersioning && (
                    <div className="flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Version Control
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}