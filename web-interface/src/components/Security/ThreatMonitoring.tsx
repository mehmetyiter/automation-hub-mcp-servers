import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import {
  Shield,
  AlertTriangle,
  Zap,
  Search,
  Plus,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Activity,
  TrendingUp,
  Eye,
  Flag,
  RefreshCw
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { securityAPIService, ThreatRule, SecurityEvent } from '../../services/security-api-service';

interface ThreatStats {
  totalRules: number;
  activeRules: number;
  triggeredToday: number;
  falsePositiveRate: number;
}

export const ThreatMonitoring: React.FC = () => {
  const [rules, setRules] = useState<ThreatRule[]>([]);
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [stats, setStats] = useState<ThreatStats>({
    totalRules: 0,
    activeRules: 0,
    triggeredToday: 0,
    falsePositiveRate: 0
  });
  const [selectedRule, setSelectedRule] = useState<ThreatRule | null>(null);
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  // New rule form state
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    ruleType: 'pattern',
    severity: 'medium',
    conditions: {},
    actions: {
      alert: true,
      block_ip: false,
      require_mfa: false,
      escalate: false,
      audit_log: true
    },
    enabled: true
  });

  useEffect(() => {
    loadThreatData();
  }, []);

  const loadThreatData = async () => {
    if (!loading) setRefreshing(true);
    
    try {
      const [rulesData, eventsData] = await Promise.all([
        securityAPIService.getThreatRules(),
        securityAPIService.getSecurityEvents({ severity: 'high,critical', limit: 100 })
      ]);

      setRules(rulesData);
      setEvents(eventsData.data);

      // Calculate stats
      const activeRules = rulesData.filter(r => r.enabled).length;
      const todayTriggered = rulesData.filter(r => {
        if (!r.lastTriggered) return false;
        const lastTriggered = new Date(r.lastTriggered);
        const today = new Date();
        return lastTriggered.toDateString() === today.toDateString();
      }).length;

      const totalTriggers = rulesData.reduce((sum, r) => sum + r.triggerCount, 0);
      const falsePositives = rulesData.reduce((sum, r) => sum + r.falsePositiveCount, 0);
      const falsePositiveRate = totalTriggers > 0 ? (falsePositives / totalTriggers) * 100 : 0;

      setStats({
        totalRules: rulesData.length,
        activeRules,
        triggeredToday: todayTriggered,
        falsePositiveRate
      });
    } catch (error) {
      console.error('Failed to load threat data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAddRule = async () => {
    try {
      // Build conditions based on rule type
      let conditions = {};
      switch (newRule.ruleType) {
        case 'pattern':
          conditions = {
            eventType: 'authentication_failed',
            patterns: [{
              field: 'sourceIp',
              operator: 'equals',
              value: ''
            }],
            requireAll: true
          };
          break;
        case 'threshold':
          conditions = {
            eventType: 'authentication_failed',
            threshold: 5,
            timeWindow: '5m',
            groupBy: 'sourceIp'
          };
          break;
        case 'geolocation':
          conditions = {
            checkUserLocationHistory: true,
            distanceThresholdKm: 1000,
            timeThresholdHours: 2
          };
          break;
        // Add other rule type conditions
      }

      await securityAPIService.addThreatRule({
        ...newRule,
        conditions
      });

      setIsAddRuleOpen(false);
      loadThreatData();
      
      // Reset form
      setNewRule({
        name: '',
        description: '',
        ruleType: 'pattern',
        severity: 'medium',
        conditions: {},
        actions: {
          alert: true,
          block_ip: false,
          require_mfa: false,
          escalate: false,
          audit_log: true
        },
        enabled: true
      });
    } catch (error) {
      console.error('Failed to add rule:', error);
    }
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      await securityAPIService.updateThreatRule(ruleId, { enabled });
      loadThreatData();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const handleFalsePositive = async (ruleId: string, eventId: string) => {
    try {
      await securityAPIService.reportFalsePositive(ruleId, eventId);
      loadThreatData();
    } catch (error) {
      console.error('Failed to report false positive:', error);
    }
  };

  const filteredRules = rules.filter(rule => {
    const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rule.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = severityFilter === 'all' || rule.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  const getRuleTypeIcon = (type: string) => {
    switch (type) {
      case 'pattern': return <Search className="h-4 w-4" />;
      case 'threshold': return <Activity className="h-4 w-4" />;
      case 'anomaly': return <Zap className="h-4 w-4" />;
      case 'geolocation': return <Eye className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  // Prepare chart data
  const ruleEffectivenessData = rules
    .filter(r => r.triggerCount > 0)
    .sort((a, b) => b.effectivenessScore - a.effectivenessScore)
    .slice(0, 10)
    .map(rule => ({
      name: rule.name.length > 20 ? rule.name.substring(0, 20) + '...' : rule.name,
      effectiveness: (rule.effectivenessScore * 100).toFixed(1),
      triggers: rule.triggerCount,
      falsePositives: rule.falsePositiveCount
    }));

  const severityDistribution = [
    { severity: 'Critical', count: rules.filter(r => r.severity === 'critical').length },
    { severity: 'High', count: rules.filter(r => r.severity === 'high').length },
    { severity: 'Medium', count: rules.filter(r => r.severity === 'medium').length },
    { severity: 'Low', count: rules.filter(r => r.severity === 'low').length }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.totalRules}</p>
            <p className="text-xs text-gray-500 mt-1">Threat detection rules</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Active Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats.activeRules}</p>
            <p className="text-xs text-gray-500 mt-1">Currently enabled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Triggered Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{stats.triggeredToday}</p>
            <p className="text-xs text-gray-500 mt-1">Rules activated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              False Positive Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{stats.falsePositiveRate.toFixed(1)}%</p>
            <p className="text-xs text-gray-500 mt-1">Accuracy metric</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Rule Effectiveness</CardTitle>
            <CardDescription>Top 10 rules by effectiveness score</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={ruleEffectivenessData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="effectiveness" fill="#3B82F6" name="Effectiveness %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Severity Distribution</CardTitle>
            <CardDescription>Rules by severity level</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={severityDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="severity" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8B5CF6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Rules Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Threat Detection Rules</CardTitle>
              <CardDescription>Configure and manage threat detection patterns</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadThreatData}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Dialog open={isAddRuleOpen} onOpenChange={setIsAddRuleOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Rule
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add Threat Detection Rule</DialogTitle>
                    <DialogDescription>
                      Create a new rule to detect security threats
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Rule Name</Label>
                        <Input
                          id="name"
                          value={newRule.name}
                          onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                          placeholder="e.g., Brute Force Detection"
                        />
                      </div>
                      <div>
                        <Label htmlFor="type">Rule Type</Label>
                        <Select
                          value={newRule.ruleType}
                          onValueChange={(value) => setNewRule({ ...newRule, ruleType: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pattern">Pattern Matching</SelectItem>
                            <SelectItem value="threshold">Threshold Based</SelectItem>
                            <SelectItem value="anomaly">Anomaly Detection</SelectItem>
                            <SelectItem value="geolocation">Geographic</SelectItem>
                            <SelectItem value="time_based">Time Based</SelectItem>
                            <SelectItem value="behavioral">Behavioral</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={newRule.description}
                        onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                        placeholder="Describe what this rule detects..."
                        rows={3}
                      />
                    </div>

                    <div>
                      <Label htmlFor="severity">Severity Level</Label>
                      <Select
                        value={newRule.severity}
                        onValueChange={(value) => setNewRule({ ...newRule, severity: value as any })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Actions</Label>
                      <div className="space-y-2 mt-2">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={newRule.actions.alert}
                            onCheckedChange={(checked) => 
                              setNewRule({ ...newRule, actions: { ...newRule.actions, alert: checked }})
                            }
                          />
                          <Label className="font-normal">Send Alert</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={newRule.actions.block_ip}
                            onCheckedChange={(checked) => 
                              setNewRule({ ...newRule, actions: { ...newRule.actions, block_ip: checked }})
                            }
                          />
                          <Label className="font-normal">Block IP Address</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={newRule.actions.require_mfa}
                            onCheckedChange={(checked) => 
                              setNewRule({ ...newRule, actions: { ...newRule.actions, require_mfa: checked }})
                            }
                          />
                          <Label className="font-normal">Require MFA</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={newRule.actions.escalate}
                            onCheckedChange={(checked) => 
                              setNewRule({ ...newRule, actions: { ...newRule.actions, escalate: checked }})
                            }
                          />
                          <Label className="font-normal">Escalate to Security Team</Label>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={newRule.enabled}
                        onCheckedChange={(checked) => setNewRule({ ...newRule, enabled: checked })}
                      />
                      <Label className="font-normal">Enable rule immediately</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddRuleOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddRule}>
                      Create Rule
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Search rules..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Rules Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Triggers</TableHead>
                  <TableHead>Effectiveness</TableHead>
                  <TableHead>Last Triggered</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{rule.name}</p>
                        <p className="text-xs text-gray-500">{rule.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getRuleTypeIcon(rule.ruleType)}
                        <span className="text-sm">{rule.ruleType}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getSeverityColor(rule.severity)}>
                        {rule.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{rule.triggerCount} total</p>
                        {rule.falsePositiveCount > 0 && (
                          <p className="text-xs text-red-500">
                            {rule.falsePositiveCount} false
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${rule.effectivenessScore * 100}%` }}
                          />
                        </div>
                        <span className="text-sm">
                          {(rule.effectivenessScore * 100).toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {rule.lastTriggered ? (
                        <span className="text-sm">
                          {new Date(rule.lastTriggered).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRule(rule)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Threat Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent High-Risk Events</CardTitle>
          <CardDescription>Security events triggered by threat detection rules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {events.slice(0, 5).map((event) => (
              <div key={event.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <Badge variant={getSeverityColor(event.severity)}>
                        {event.severity}
                      </Badge>
                      <p className="font-medium">{event.title}</p>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                    <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                      <span>{event.userEmail || 'System'}</span>
                      <span>{new Date(event.createdAt).toLocaleString()}</span>
                      <span>Risk Score: {event.riskScore}</span>
                    </div>
                  </div>
                  {event.ruleId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleFalsePositive(event.ruleId!, event.id)}
                    >
                      <Flag className="h-4 w-4 mr-2" />
                      False Positive
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {events.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p>No high-risk events detected recently</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ThreatMonitoring;