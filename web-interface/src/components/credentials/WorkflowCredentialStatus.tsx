import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { CredentialRequirements } from './CredentialRequirements';

interface WorkflowCredentialStatusProps {
  workflowId: string;
  credentialMappings?: Array<{
    nodeId: string;
    credentialType: string;
    credentialId?: string;
  }>;
  requiredCredentials?: Array<{
    service: string;
    templateId: string;
    available: boolean;
  }>;
  onCredentialUpdate?: () => void;
}

export const WorkflowCredentialStatus: React.FC<WorkflowCredentialStatusProps> = ({
  credentialMappings = [],
  requiredCredentials = [],
  onCredentialUpdate
}) => {
  const [expanded, setExpanded] = useState(false);
  const [hasIssues, setHasIssues] = useState(false);

  useEffect(() => {
    // Check if any required credentials are missing
    const missingCredentials = requiredCredentials.filter(req => !req.available);
    setHasIssues(missingCredentials.length > 0);
  }, [requiredCredentials]);

  const handleCredentialAdded = () => {
    if (onCredentialUpdate) {
      onCredentialUpdate();
    }
  };

  // Don't show anything if there are no credential requirements
  if (requiredCredentials.length === 0 && credentialMappings.length === 0) {
    return null;
  }

  const statusColor = hasIssues ? 'amber' : 'green';
  const StatusIcon = hasIssues ? AlertTriangle : CheckCircle;
  const statusText = hasIssues ? 'Missing credentials' : 'All credentials configured';

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-3">
          <Shield className="h-5 w-5 text-gray-400" />
          <h3 className="text-sm font-medium text-gray-900">Workflow Credentials</h3>
          <StatusIcon className={`h-4 w-4 text-${statusColor}-500`} />
          <span className={`text-sm text-${statusColor}-700`}>{statusText}</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-200 mt-2 pt-4">
          <CredentialRequirements
            requiredCredentials={requiredCredentials}
            credentialMappings={credentialMappings}
            onCredentialAdded={handleCredentialAdded}
          />
        </div>
      )}
    </div>
  );
};