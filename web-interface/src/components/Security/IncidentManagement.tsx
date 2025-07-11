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
import { Textarea } from '../ui/textarea';
import { Progress } from '../ui/progress';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '../ui/tabs';
import {
  AlertTriangle,
  Shield,
  Clock,
  User,
  FileText,
  ChevronRight,
  Plus,
  Edit,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Users,
  Activity,
  MessageSquare,
  Zap,
  Flag
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
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { securityAPIService, SecurityIncident, ResponseAction } from '../../services/security-api-service';

interface IncidentStats {
  total: number;
  open: number;
  investigating: number;
  resolved: number;
  avgMTTR: number;
  criticalCount: number;
}

interface IncidentDetails extends SecurityIncident {
  timeline: TimelineEntry[];
  responseActions: ResponseAction[];
  relatedEvents: any[];
}

interface TimelineEntry {
  timestamp: string;
  action: string;
  actor: string;
  description: string;
}

export const IncidentManagement: React.FC = () => {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<IncidentDetails | null>(null);
  const [stats, setStats] = useState<IncidentStats>({
    total: 0,
    open: 0,
    investigating: 0,
    resolved: 0,
    avgMTTR: 0,
    criticalCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');

  // New incident form
  const [newIncident, setNewIncident] = useState({
    title: '',
    description: '',
    incidentType: 'security_breach',
    severity: 'medium',
    priority: 'medium'
  });

  // Response action form
  const [newAction, setNewAction] = useState({
    action: '',
    assignedTo: ''
  });

  useEffect(() => {
    loadIncidents();
  }, []);

  const loadIncidents = async () => {
    setLoading(true);
    try {
      const [incidentsData, metricsData] = await Promise.all([
        securityAPIService.getIncidents(),
        securityAPIService.getIncidentMetrics('30d')
      ]);

      setIncidents(incidentsData);
      
      // Calculate stats
      const openIncidents = incidentsData.filter(i => 
        ['new', 'assigned', 'investigating'].includes(i.status)
      );
      const investigatingIncidents = incidentsData.filter(i => i.status === 'investigating');
      const resolvedIncidents = incidentsData.filter(i => 
        ['resolved', 'closed'].includes(i.status)
      );
      const criticalIncidents = incidentsData.filter(i => i.severity === 'critical');

      setStats({
        total: incidentsData.length,
        open: openIncidents.length,
        investigating: investigatingIncidents.length,
        resolved: resolvedIncidents.length,
        avgMTTR: metricsData.summary.avg_mttr || 0,
        criticalCount: criticalIncidents.length
      });
    } catch (error) {
      console.error('Failed to load incidents:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadIncidentDetails = async (incidentId: string) => {
    try {
      const details = await securityAPIService.getIncidentDetails(incidentId);
      setSelectedIncident(details);
    } catch (error) {
      console.error('Failed to load incident details:', error);
    }
  };

  const handleCreateIncident = async () => {
    try {
      await securityAPIService.createIncident(newIncident);
      setIsCreateOpen(false);
      loadIncidents();
      
      // Reset form
      setNewIncident({
        title: '',
        description: '',
        incidentType: 'security_breach',
        severity: 'medium',
        priority: 'medium'
      });
    } catch (error) {
      console.error('Failed to create incident:', error);
    }
  };

  const handleUpdateStatus = async (incidentId: string, status: string) => {
    try {
      await securityAPIService.updateIncident(incidentId, { status });
      loadIncidents();
      if (selectedIncident?.id === incidentId) {
        loadIncidentDetails(incidentId);
      }
    } catch (error) {
      console.error('Failed to update incident status:', error);
    }
  };

  const handleAssignIncident = async (incidentId: string, userId: string) => {
    try {
      await securityAPIService.assignIncident(incidentId, userId);
      loadIncidents();
      if (selectedIncident?.id === incidentId) {
        loadIncidentDetails(incidentId);
      }
    } catch (error) {
      console.error('Failed to assign incident:', error);
    }
  };

  const handleEscalateIncident = async (incidentId: string, reason: string) => {
    try {
      await securityAPIService.escalateIncident(incidentId, reason);
      loadIncidents();
      if (selectedIncident?.id === incidentId) {
        loadIncidentDetails(incidentId);
      }
    } catch (error) {
      console.error('Failed to escalate incident:', error);
    }
  };

  const handleAddResponseAction = async () => {
    if (!selectedIncident) return;

    try {
      await securityAPIService.addResponseAction(selectedIncident.id, newAction);
      loadIncidentDetails(selectedIncident.id);
      
      // Reset form
      setNewAction({
        action: '',
        assignedTo: ''
      });
    } catch (error) {
      console.error('Failed to add response action:', error);
    }
  };

  const handleUpdateAction = async (actionId: string, updates: Partial<ResponseAction>) => {
    if (!selectedIncident) return;

    try {
      await securityAPIService.updateResponseAction(selectedIncident.id, actionId, updates);
      loadIncidentDetails(selectedIncident.id);
    } catch (error) {
      console.error('Failed to update action:', error);
    }
  };

  const filteredIncidents = incidents.filter(incident => {
    const matchesStatus = statusFilter === 'all' || incident.status === statusFilter;
    const matchesSeverity = severityFilter === 'all' || incident.severity === severityFilter;
    
    if (activeTab === 'active') {
      return matchesStatus && matchesSeverity && 
        ['new', 'assigned', 'investigating'].includes(incident.status);
    } else if (activeTab === 'resolved') {
      return matchesStatus && matchesSeverity && 
        ['resolved', 'closed'].includes(incident.status);
    }
    
    return matchesStatus && matchesSeverity;
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-100 text-blue-800',
      assigned: 'bg-yellow-100 text-yellow-800',
      investigating: 'bg-orange-100 text-orange-800',
      contained: 'bg-purple-100 text-purple-800',
      eradicated: 'bg-indigo-100 text-indigo-800',
      recovered: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'high': return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case 'medium': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'low': return <CheckCircle className="h-4 w-4 text-green-600" />;
      default: return null;
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
  };

  // Prepare chart data
  const statusDistribution = [
    { name: 'New', value: incidents.filter(i => i.status === 'new').length, color: '#3B82F6' },
    { name: 'Assigned', value: incidents.filter(i => i.status === 'assigned').length, color: '#F59E0B' },
    { name: 'Investigating', value: incidents.filter(i => i.status === 'investigating').length, color: '#F97316' },
    { name: 'Resolved', value: incidents.filter(i => i.status === 'resolved').length, color: '#10B981' },
    { name: 'Closed', value: incidents.filter(i => i.status === 'closed').length, color: '#6B7280' }
  ].filter(item => item.value > 0);

  const severityTrend = incidents
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .reduce((acc, incident) => {
      const date = new Date(incident.createdAt).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = { date, critical: 0, high: 0, medium: 0, low: 0 };
      }
      acc[date][incident.severity]++;
      return acc;
    }, {} as Record<string, any>);

  const trendData = Object.values(severityTrend).slice(-7);

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
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Incidents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Open
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600">{stats.open}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Investigating
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{stats.investigating}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Resolved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Critical
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{stats.criticalCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Avg MTTR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatDuration(stats.avgMTTR)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Incident Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Severity Trend (7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="critical" stroke="#DC2626" name="Critical" />
                <Line type="monotone" dataKey="high" stroke="#F97316" name="High" />
                <Line type="monotone" dataKey="medium" stroke="#F59E0B" name="Medium" />
                <Line type="monotone" dataKey="low" stroke="#10B981" name="Low" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incidents List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Security Incidents</CardTitle>
                  <CardDescription>Manage and track security incidents</CardDescription>
                </div>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      New Incident
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Security Incident</DialogTitle>
                      <DialogDescription>
                        Report a new security incident for investigation
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="title">Title</Label>
                        <Input
                          id="title"
                          value={newIncident.title}
                          onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })}
                          placeholder="Brief description of the incident"
                        />
                      </div>

                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={newIncident.description}
                          onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })}
                          placeholder="Detailed description of what happened..."
                          rows={4}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Incident Type</Label>
                          <Select
                            value={newIncident.incidentType}
                            onValueChange={(value) => setNewIncident({ ...newIncident, incidentType: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="data_breach">Data Breach</SelectItem>
                              <SelectItem value="malware">Malware</SelectItem>
                              <SelectItem value="ddos">DDoS Attack</SelectItem>
                              <SelectItem value="account_compromise">Account Compromise</SelectItem>
                              <SelectItem value="unauthorized_access">Unauthorized Access</SelectItem>
                              <SelectItem value="security_breach">Security Breach</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Severity</Label>
                          <Select
                            value={newIncident.severity}
                            onValueChange={(value) => setNewIncident({ ...newIncident, severity: value as any })}
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
                      </div>

                      <div>
                        <Label>Priority</Label>
                        <Select
                          value={newIncident.priority}
                          onValueChange={(value) => setNewIncident({ ...newIncident, priority: value as any })}
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
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateIncident}>
                        Create Incident
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="active">Active</TabsTrigger>
                  <TabsTrigger value="resolved">Resolved</TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>

                {/* Filters */}
                <div className="flex items-center space-x-4 mb-4">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="investigating">Investigating</SelectItem>
                      <SelectItem value="contained">Contained</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>

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

                {/* Incidents List */}
                <div className="space-y-3">
                  {filteredIncidents.map((incident) => (
                    <div
                      key={incident.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => loadIncidentDetails(incident.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            {getSeverityIcon(incident.severity)}
                            <span className="font-medium">{incident.incidentNumber}</span>
                            <Badge className={getStatusColor(incident.status)}>
                              {incident.status}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium mt-1">{incident.title}</p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center">
                              <User className="h-3 w-3 mr-1" />
                              {incident.assignedToEmail || 'Unassigned'}
                            </span>
                            <span className="flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {new Date(incident.createdAt).toLocaleDateString()}
                            </span>
                            <span className="flex items-center">
                              <Activity className="h-3 w-3 mr-1" />
                              {incident.eventCount} events
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  ))}

                  {filteredIncidents.length === 0 && (
                    <div className="text-center py-12 text-gray-500">
                      <Shield className="h-12 w-12 mx-auto mb-3" />
                      <p>No incidents found</p>
                    </div>
                  )}
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Incident Details */}
        <div>
          {selectedIncident ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{selectedIncident.incidentNumber}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIncident(null)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Status and Actions */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge className={getStatusColor(selectedIncident.status)}>
                      {selectedIncident.status}
                    </Badge>
                    <div className="flex items-center space-x-2">
                      {getSeverityIcon(selectedIncident.severity)}
                      <span className="text-sm font-medium">{selectedIncident.severity}</span>
                    </div>
                  </div>

                  <Select
                    value={selectedIncident.status}
                    onValueChange={(value) => handleUpdateStatus(selectedIncident.id, value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="investigating">Investigating</SelectItem>
                      <SelectItem value="contained">Contained</SelectItem>
                      <SelectItem value="eradicated">Eradicated</SelectItem>
                      <SelectItem value="recovered">Recovered</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Details */}
                <div>
                  <h4 className="font-medium mb-2">{selectedIncident.title}</h4>
                  <p className="text-sm text-gray-600">{selectedIncident.description}</p>
                </div>

                {/* Assignment */}
                <div>
                  <Label>Assigned To</Label>
                  <Input
                    placeholder="Enter user ID to assign"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleAssignIncident(selectedIncident.id, (e.target as HTMLInputElement).value);
                      }
                    }}
                  />
                </div>

                {/* Response Actions */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Response Actions</Label>
                    <Badge variant="outline">{selectedIncident.responseActions?.length || 0}</Badge>
                  </div>
                  <div className="space-y-2">
                    {selectedIncident.responseActions?.map((action) => (
                      <div key={action.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{action.action}</p>
                          {action.assignedTo && (
                            <p className="text-xs text-gray-500">Assigned to: {action.assignedTo}</p>
                          )}
                        </div>
                        <Select
                          value={action.status}
                          onValueChange={(value) => 
                            handleUpdateAction(action.id, { status: value as any })
                          }
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex items-center space-x-2 mt-2">
                    <Input
                      placeholder="Add response action..."
                      value={newAction.action}
                      onChange={(e) => setNewAction({ ...newAction, action: e.target.value })}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && newAction.action) {
                          handleAddResponseAction();
                        }
                      }}
                    />
                    <Button size="sm" onClick={handleAddResponseAction}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <Label>Timeline</Label>
                  <div className="space-y-2 mt-2">
                    {selectedIncident.timeline?.map((entry, index) => (
                      <div key={index} className="flex items-start space-x-2 text-sm">
                        <div className="w-2 h-2 bg-blue-600 rounded-full mt-1.5" />
                        <div className="flex-1">
                          <p className="font-medium">{entry.action}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(entry.timestamp).toLocaleString()} - {entry.actor}
                          </p>
                          {entry.description && (
                            <p className="text-xs text-gray-600 mt-1">{entry.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2 pt-4">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleEscalateIncident(selectedIncident.id, 'Manual escalation')}
                  >
                    <Flag className="h-4 w-4 mr-2" />
                    Escalate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadIncidentDetails(selectedIncident.id)}
                  >
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p className="text-gray-500">Select an incident to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default IncidentManagement;