import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { 
  Shield, 
  Lock, 
  Key, 
  AlertTriangle, 
  CheckCircle,
  RefreshCw,
  Eye,
  Clock,
  MapPin,
  Smartphone
} from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert';

interface SecuritySettingsSectionProps {
  onRefresh: () => void;
}

interface SecuritySettings {
  twoFactorEnabled: boolean;
  sessionTimeout: number;
  ipWhitelisting: boolean;
  auditLogging: boolean;
  encryptionStatus: 'active' | 'inactive';
  lastKeyRotation: Date;
}

interface SecurityEvent {
  id: string;
  type: 'login' | 'credential_access' | 'key_rotation' | 'suspicious_activity';
  description: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
}

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  result: 'success' | 'failure';
}

export const SecuritySettingsSection: React.FC<SecuritySettingsSectionProps> = ({
  onRefresh
}) => {
  const [settings, setSettings] = useState<SecuritySettings>({
    twoFactorEnabled: false,
    sessionTimeout: 60,
    ipWhitelisting: false,
    auditLogging: true,
    encryptionStatus: 'active',
    lastKeyRotation: new Date()
  });
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    setIsLoading(true);
    try {
      // Load security settings
      const settingsResponse = await fetch('/api/security/settings');
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        setSettings(settingsData);
      }

      // Load security events
      const eventsResponse = await fetch('/api/security/events?limit=10');
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        setSecurityEvents(eventsData);
      }

      // Load audit logs
      const logsResponse = await fetch('/api/security/audit-logs?limit=10');
      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        setAuditLogs(logsData);
      }
    } catch (error) {
      console.error('Failed to load security data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingChange = async (setting: keyof SecuritySettings, value: any) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/security/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [setting]: value })
      });

      if (response.ok) {
        setSettings(prev => ({ ...prev, [setting]: value }));
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to update security setting:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRotateKeys = async () => {
    if (!confirm('Are you sure you want to rotate encryption keys? This will require re-validation of all stored credentials.')) {
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/security/rotate-keys', {
        method: 'POST'
      });

      if (response.ok) {
        await loadSecurityData();
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to rotate keys:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'login': return <Lock className="h-4 w-4" />;
      case 'credential_access': return <Key className="h-4 w-4" />;
      case 'key_rotation': return <RefreshCw className="h-4 w-4" />;
      case 'suspicious_activity': return <AlertTriangle className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2">Loading security settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Security Settings</h2>
          <p className="text-muted-foreground">
            Configure security settings and monitor access to your credentials
          </p>
        </div>
        <Button onClick={loadSecurityData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Security Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className={`h-5 w-5 ${settings.encryptionStatus === 'active' ? 'text-green-500' : 'text-red-500'}`} />
              <div>
                <p className="text-sm font-medium">Encryption</p>
                <p className="text-xs text-muted-foreground">
                  {settings.encryptionStatus === 'active' ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Smartphone className={`h-5 w-5 ${settings.twoFactorEnabled ? 'text-green-500' : 'text-yellow-500'}`} />
              <div>
                <p className="text-sm font-medium">2FA</p>
                <p className="text-xs text-muted-foreground">
                  {settings.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Eye className={`h-5 w-5 ${settings.auditLogging ? 'text-green-500' : 'text-gray-500'}`} />
              <div>
                <p className="text-sm font-medium">Audit Logging</p>
                <p className="text-xs text-muted-foreground">
                  {settings.auditLogging ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Session Timeout</p>
                <p className="text-xs text-muted-foreground">
                  {settings.sessionTimeout} minutes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Access Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security to your account
                </p>
              </div>
              <Switch
                checked={settings.twoFactorEnabled}
                onCheckedChange={(checked) => handleSettingChange('twoFactorEnabled', checked)}
                disabled={isSaving}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">IP Whitelisting</Label>
                <p className="text-sm text-muted-foreground">
                  Restrict access to specific IP addresses
                </p>
              </div>
              <Switch
                checked={settings.ipWhitelisting}
                onCheckedChange={(checked) => handleSettingChange('ipWhitelisting', checked)}
                disabled={isSaving}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Audit Logging</Label>
                <p className="text-sm text-muted-foreground">
                  Log all credential access and modifications
                </p>
              </div>
              <Switch
                checked={settings.auditLogging}
                onCheckedChange={(checked) => handleSettingChange('auditLogging', checked)}
                disabled={isSaving}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Encryption Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Encryption Status</p>
                <p className="text-sm text-muted-foreground">
                  All credentials are encrypted with AES-256-GCM
                </p>
              </div>
              <CheckCircle className="h-6 w-6 text-green-500" />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Last Key Rotation</p>
                <p className="text-sm text-muted-foreground">
                  {settings.lastKeyRotation.toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRotateKeys}
                disabled={isSaving}
              >
                {isSaving ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  'Rotate Keys'
                )}
              </Button>
            </div>

            <Alert className="border-blue-200 bg-blue-50">
              <Shield className="h-4 w-4" />
              <AlertDescription className="text-blue-800">
                Key rotation should be performed regularly for optimal security. 
                We recommend rotating keys every 90 days.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      {/* Recent Security Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Security Events</CardTitle>
        </CardHeader>
        <CardContent>
          {securityEvents.length > 0 ? (
            <div className="space-y-3">
              {securityEvents.map((event) => (
                <div
                  key={event.id}
                  className={`flex items-start space-x-3 p-3 rounded-lg border ${getSeverityColor(event.severity)}`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{event.description}</p>
                      <span className={`text-xs px-2 py-1 rounded ${getSeverityColor(event.severity)}`}>
                        {event.severity}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <div className="flex items-center space-x-4">
                        <span className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {event.timestamp.toLocaleString()}
                        </span>
                        <span className="flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          {event.ipAddress}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No recent security events</p>
          )}
        </CardContent>
      </Card>

      {/* Audit Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Audit Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {auditLogs.length > 0 ? (
            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${log.result === 'success' ? 'bg-green-500' : 'bg-red-500'}`} />
                    <div>
                      <p className="text-sm font-medium">{log.action}</p>
                      <p className="text-xs text-muted-foreground">{log.resource}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {log.timestamp.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {log.ipAddress}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No recent audit logs</p>
          )}
        </CardContent>
      </Card>

      {/* Security Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Security Recommendations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!settings.twoFactorEnabled && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-yellow-800">
                <strong>Enable Two-Factor Authentication:</strong> Add an extra layer of security to protect your account and credentials.
              </AlertDescription>
            </Alert>
          )}

          <Alert className="border-blue-200 bg-blue-50">
            <Shield className="h-4 w-4" />
            <AlertDescription className="text-blue-800">
              <strong>Regular Security Review:</strong> Review your security settings and audit logs regularly to ensure optimal protection.
            </AlertDescription>
          </Alert>

          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="text-green-800">
              <strong>Secure by Default:</strong> Your credentials are automatically encrypted with industry-standard AES-256-GCM encryption.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};