import { useState, useEffect } from 'react';
import { Plus, Key } from 'lucide-react';
import toast from 'react-hot-toast';
import { credentialAPI } from '../services/api';
import { CredentialList } from '../components/credentials/CredentialList';
import CredentialFormEnhanced from '../components/credentials/CredentialFormEnhanced';

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

export default function Credentials() {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      setLoading(true);
      const response = await credentialAPI.list();
      setCredentials(response.data);
    } catch (error) {
      toast.error('Failed to load credentials');
      console.error('Error loading credentials:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this credential?')) {
      return;
    }

    try {
      await credentialAPI.delete(id);
      toast.success('Credential deleted successfully');
      loadCredentials();
    } catch (error) {
      toast.error('Failed to delete credential');
      console.error('Error deleting credential:', error);
    }
  };

  const handleEdit = (credential: Credential) => {
    setEditingCredential(credential);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditingCredential(null);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingCredential(null);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingCredential(null);
    loadCredentials();
  };

  const handleVerify = async (id: string) => {
    try {
      setRefreshing(id);
      const response = await credentialAPI.verify(id);
      if (response.data.valid) {
        toast.success('Credential is valid');
      } else {
        toast.error(`Credential validation failed: ${response.data.error || 'Unknown error'}`);
      }
      loadCredentials();
    } catch (error) {
      toast.error('Failed to verify credential');
      console.error('Error verifying credential:', error);
    } finally {
      setRefreshing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Key className="h-6 w-6 text-gray-600" />
              <h2 className="text-lg font-medium text-gray-900">Credentials</h2>
              <span className="text-sm text-gray-500">
                ({credentials.length} total)
              </span>
            </div>
            <button
              onClick={handleAdd}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Credential
            </button>
          </div>
        </div>

        <div className="px-6 py-4">
          <p className="text-sm text-gray-600 mb-4">
            Manage credentials for connecting to external services. These credentials are securely encrypted and can be used across your workflows.
          </p>

          {credentials.length === 0 ? (
            <div className="text-center py-12">
              <Key className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No credentials</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by adding your first credential.
              </p>
              <div className="mt-6">
                <button
                  onClick={handleAdd}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Credential
                </button>
              </div>
            </div>
          ) : (
            <CredentialList
              credentials={credentials}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onVerify={handleVerify}
              refreshing={refreshing}
            />
          )}
        </div>
      </div>

      <CredentialFormEnhanced
        isOpen={showForm}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        credential={editingCredential}
      />
    </div>
  );
}