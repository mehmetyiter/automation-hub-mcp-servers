import React from 'react';
import { Edit, Trash2, CheckCircle, XCircle, RefreshCw, Shield, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Credential {
  id: string;
  name: string;
  templateId: string;
  platform?: string;
  isValid?: boolean;
  lastVerified?: string;
  createdAt: string;
  updatedAt: string;
  values?: Record<string, any>;
}

interface CredentialListProps {
  credentials: Credential[];
  onEdit: (credential: Credential) => void;
  onDelete: (id: string) => void;
  onVerify: (id: string) => void;
  refreshing: string | null;
}

export const CredentialList: React.FC<CredentialListProps> = ({
  credentials,
  onEdit,
  onDelete,
  onVerify,
  refreshing
}) => {
  const getPlatformIcon = (platform: string) => {
    const platformIcons: Record<string, string> = {
      'n8n': '🔧',
      'make': '⚡',
      'zapier': '⚡',
      'slack': '💬',
      'google': '🔍',
      'github': '🐙',
      'openai': '🤖',
      'telegram': '📱',
      'discord': '🎮',
      'email': '📧',
      'api': '🔌',
      'database': '🗄️'
    };
    return platformIcons[platform.toLowerCase()] || '🔑';
  };

  const getTemplateDisplayName = (templateId: string) => {
    // Convert template IDs to user-friendly names
    const displayNames: Record<string, string> = {
      'api-key': 'API Key',
      'api-key-auth': 'API Key Authentication',
      'bearer-token': 'Bearer Token',
      'basic-auth': 'Basic Authentication',
      'oauth2': 'OAuth2',
      'smtp': 'SMTP Email',
      'database': 'Database Connection',
      'webhook-signature': 'Webhook Signature',
      'custom': 'Custom Credential'
    };
    return displayNames[templateId] || templateId;
  };

  return (
    <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {credentials.map((credential) => (
        <div
          key={credential.id}
          className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                <span className="text-2xl" role="img" aria-label={credential.platform || credential.templateId}>
                  {getPlatformIcon(credential.platform || credential.templateId)}
                </span>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">
                    {credential.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    {getTemplateDisplayName(credential.templateId)}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                {credential.isValid ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
              <div className="flex items-center space-x-1">
                <Shield className="h-3 w-3" />
                <span>Encrypted</span>
              </div>
              {credential.lastVerified && (
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>
                    Verified {formatDistanceToNow(new Date(credential.lastVerified), { addSuffix: true })}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onEdit(credential)}
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1"
                >
                  <Edit className="h-3 w-3" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => onVerify(credential.id)}
                  disabled={refreshing === credential.id}
                  className="text-sm text-gray-600 hover:text-gray-900 flex items-center space-x-1 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${refreshing === credential.id ? 'animate-spin' : ''}`} />
                  <span>Verify</span>
                </button>
              </div>
              <button
                onClick={() => onDelete(credential.id)}
                className="text-sm text-red-600 hover:text-red-800 flex items-center space-x-1"
              >
                <Trash2 className="h-3 w-3" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};