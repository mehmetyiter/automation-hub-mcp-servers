import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Plus, Shield } from 'lucide-react';
import { credentialAPI } from '../../services/api';
import { CredentialForm } from './CredentialForm';

interface RequiredCredential {
  service: string;
  templateId: string;
  available: boolean;
  credentialId?: string;
}

interface CredentialMapping {
  nodeId: string;
  credentialType: string;
  credentialId?: string;
}

interface CredentialRequirementsProps {
  requiredCredentials: RequiredCredential[];
  credentialMappings: CredentialMapping[];
  onCredentialAdded?: () => void;
  compact?: boolean;
}

export const CredentialRequirements: React.FC<CredentialRequirementsProps> = ({
  requiredCredentials,
  credentialMappings,
  onCredentialAdded,
  compact = false
}) => {
  const [showForm, setShowForm] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [availableCredentials, setAvailableCredentials] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAvailableCredentials();
  }, []);

  const loadAvailableCredentials = async () => {
    try {
      setLoading(true);
      const response = await credentialAPI.list();
      
      // Group credentials by templateId
      const grouped = response.data.reduce((acc: Record<string, any[]>, cred: any) => {
        if (!acc[cred.templateId]) {
          acc[cred.templateId] = [];
        }
        acc[cred.templateId].push(cred);
        return acc;
      }, {});
      
      setAvailableCredentials(grouped);
    } catch (error) {
      console.error('Error loading credentials:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCredential = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedTemplateId(null);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setSelectedTemplateId(null);
    loadAvailableCredentials();
    if (onCredentialAdded) {
      onCredentialAdded();
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="mt-2 h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  const missingCredentials = requiredCredentials.filter(req => !req.available);
  const hasAllCredentials = missingCredentials.length === 0;

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        <Shield className="h-4 w-4 text-gray-400" />
        {hasAllCredentials ? (
          <>
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-700">All credentials configured</span>
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <span className="text-sm text-amber-700">
              {missingCredentials.length} credential{missingCredentials.length > 1 ? 's' : ''} required
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Shield className="h-5 w-5 text-gray-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900">Required Credentials</h3>
            <p className="mt-1 text-sm text-gray-500">
              This workflow requires the following credentials to function properly:
            </p>

            <div className="mt-4 space-y-3">
              {requiredCredentials.map((requirement) => {
                const available = availableCredentials[requirement.templateId] || [];
                const isConfigured = requirement.available || available.length > 0;

                return (
                  <div
                    key={requirement.templateId}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isConfigured
                        ? 'bg-green-50 border-green-200'
                        : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      {isConfigured ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-amber-500" />
                      )}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          {requirement.service}
                        </h4>
                        {isConfigured && available.length > 0 && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {available.length} credential{available.length > 1 ? 's' : ''} available
                          </p>
                        )}
                      </div>
                    </div>

                    {!isConfigured && (
                      <button
                        onClick={() => handleAddCredential(requirement.templateId)}
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-amber-700 bg-amber-100 hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Credential
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {!hasAllCredentials && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex">
                  <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5" />
                  <div className="ml-3 text-sm">
                    <p className="text-amber-800">
                      <strong>Important:</strong> This workflow will not function correctly without all required credentials.
                    </p>
                    <p className="mt-1 text-amber-700">
                      Please add the missing credentials before using this workflow in production.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {hasAllCredentials && credentialMappings.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Credential Assignments
                </h4>
                <div className="mt-2 space-y-1">
                  {credentialMappings
                    .filter(mapping => mapping.credentialId)
                    .map((mapping, index) => (
                      <div key={index} className="flex items-center text-xs text-gray-600">
                        <CheckCircle className="h-3 w-3 text-green-500 mr-1.5" />
                        <span>
                          Node "{mapping.nodeId}" will use credential "{mapping.credentialId}"
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showForm && selectedTemplateId && (
        <CredentialForm
          credential={null}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
          preselectedTemplateId={selectedTemplateId}
        />
      )}
    </>
  );
};