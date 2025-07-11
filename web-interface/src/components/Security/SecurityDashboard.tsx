import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  Shield,
  AlertTriangle,
  Activity,
  Users,
  Lock,
  Eye,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { securityAPIService } from '../../services/security-api-service';
import ThreatMonitoring from './ThreatMonitoring';
import IncidentManagement from './IncidentManagement';
import SecurityMetrics from './SecurityMetrics';
import ComplianceReports from './ComplianceReports';

interface SecuritySummary {
  criticalEventsCount: number;
  openIncidentsCount: number;
  alertsLast24h: number;
  overallRiskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface SecurityEvent {
  id: string;
  userId?: string;
  userEmail?: string;
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  createdAt: string;
  status: string;
  riskScore: number;
}

interface SecurityIncident {
  id: string;
  incidentNumber: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  assignedToEmail?: string;
  eventCount: number;
  avgRiskScore: number;
  createdAt: string;
}

interface ThreatInfo {
  ruleId: string;
  ruleName: string;
  triggerCount: number;
  avgRiskScore: number;
}

interface UserRisk {
  id: string;
  email: string;
  eventCount: number;
  avgRiskScore: number;
  maxRiskScore: number;
}

export const SecurityDashboard: React.FC = () => {
  const [summary, setSummary] = useState<SecuritySummary>({
    criticalEventsCount: 0,
    openIncidentsCount: 0,
    alertsLast24h: 0,
    overallRiskLevel: 'low'
  });
  const [criticalEvents, setCriticalEvents] = useState<SecurityEvent[]>([]);
  const [openIncidents, setOpenIncidents] = useState<SecurityIncident[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [topThreats, setTopThreats] = useState<ThreatInfo[]>([]);
  const [userRiskScores, setUserRiskScores] = useState<UserRisk[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    if (!loading) setRefreshing(true);
    
    try {
      const dashboard = await securityAPIService.getSecurityDashboard();
      
      setSummary(dashboard.summary);
      setCriticalEvents(dashboard.criticalEvents);
      setOpenIncidents(dashboard.openIncidents);
      setRecentAlerts(dashboard.recentAlerts);
      setTopThreats(dashboard.topThreats);
      setUserRiskScores(dashboard.userRiskScores);
      setMetrics(dashboard.metrics);
    } catch (error) {
      console.error('Failed to load security dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4" />;
      case 'high': return <AlertCircle className="h-4 w-4" />;
      case 'medium': return <AlertTriangle className="h-4 w-4" />;
      case 'low': return <CheckCircle className="h-4 w-4" />;
      default: return null;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${minutes}m ago`;
  };

  // Prepare chart data
  const severityDistribution = [
    { name: 'Critical', value: criticalEvents.filter(e => e.severity === 'critical').length, color: '#DC2626' },
    { name: 'High', value: criticalEvents.filter(e => e.severity === 'high').length, color: '#EA580C' },
    { name: 'Medium', value: criticalEvents.filter(e => e.severity === 'medium').length, color: '#F59E0B' },
    { name: 'Low', value: criticalEvents.filter(e => e.severity === 'low').length, color: '#10B981' }
  ];

  const incidentTrend = openIncidents.reduce((acc, incident) => {
    const date = new Date(incident.createdAt).toLocaleDateString();
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const trendData = Object.entries(incidentTrend).map(([date, count]) => ({
    date,
    incidents: count
  })).slice(-7); // Last 7 days

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Security Monitoring</h1>
          <p className="text-gray-600 mt-1">Real-time security insights and threat detection</p>
        </div>
        <Button
          onClick={loadDashboardData}
          disabled={refreshing}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Risk Level Alert */}
      {summary.overallRiskLevel !== 'low' && (
        <Alert className={`border-2 ${
          summary.overallRiskLevel === 'critical' ? 'border-red-500 bg-red-50' :
          summary.overallRiskLevel === 'high' ? 'border-orange-500 bg-orange-50' :
          'border-yellow-500 bg-yellow-50'
        }`}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Overall Risk Level: {summary.overallRiskLevel.toUpperCase()}</strong>
            <p className="mt-1">
              {summary.criticalEventsCount} critical events and {summary.openIncidentsCount} open incidents require immediate attention.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Critical Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-600">
                  {summary.criticalEventsCount}
                </p>
                <p className="text-xs text-gray-500">Active threats</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Open Incidents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-orange-600">
                  {summary.openIncidentsCount}
                </p>
                <p className="text-xs text-gray-500">Being investigated</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Activity className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              24h Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {summary.alertsLast24h}
                </p>
                <p className="text-xs text-gray-500">Security alerts</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Shield className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Risk Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-2xl font-bold ${getRiskLevelColor(summary.overallRiskLevel).split(' ')[0]}`}>
                  {summary.overallRiskLevel.toUpperCase()}
                </p>
                <p className="text-xs text-gray-500">Overall status</p>
              </div>
              <div className={`p-3 rounded-lg ${getRiskLevelColor(summary.overallRiskLevel).split(' ')[1]}`}>
                <Eye className={`h-6 w-6 ${getRiskLevelColor(summary.overallRiskLevel).split(' ')[0]}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="threats">Threat Monitoring</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Critical Events */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Critical Security Events</span>
                  <Badge variant="destructive">{criticalEvents.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {criticalEvents.slice(0, 5).map((event) => (
                    <div key={event.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`p-2 rounded-lg ${getRiskLevelColor(event.severity).split(' ')[1]}`}>
                        {getSeverityIcon(event.severity)}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{event.title}</p>
                        <p className="text-xs text-gray-600 mt-1">{event.description}</p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <span>{event.userEmail || 'System'}</span>
                          <span>{formatTimeAgo(event.createdAt)}</span>
                          <Badge variant="outline" className="text-xs">
                            Risk: {event.riskScore}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {criticalEvents.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                      <p>No critical events detected</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Open Incidents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Active Incidents</span>
                  <Badge variant="secondary">{openIncidents.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {openIncidents.slice(0, 5).map((incident) => (
                    <div key={incident.id} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{incident.incidentNumber}</p>
                          <p className="text-xs text-gray-600 mt-1">{incident.title}</p>
                        </div>
                        <Badge variant={incident.priority === 'critical' ? 'destructive' : 'secondary'}>
                          {incident.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>{incident.assignedToEmail || 'Unassigned'}</span>
                          <span>{incident.eventCount} events</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {incident.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  
                  {openIncidents.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Shield className="h-12 w-12 mx-auto mb-3 text-green-500" />
                      <p>No active incidents</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Severity Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Event Severity Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={severityDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {severityDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Incident Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Incident Trend (7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="incidents" 
                      stroke="#8884d8" 
                      fill="#8884d8" 
                      fillOpacity={0.6}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Additional Information */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Threats */}
            <Card>
              <CardHeader>
                <CardTitle>Top Threat Patterns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topThreats.map((threat, index) => (
                    <div key={threat.ruleId} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                        <div>
                          <p className="font-medium text-sm">{threat.ruleName}</p>
                          <p className="text-xs text-gray-500">Triggered {threat.triggerCount} times</p>
                        </div>
                      </div>
                      <Badge variant="outline">
                        Risk: {threat.avgRiskScore.toFixed(0)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* High Risk Users */}
            <Card>
              <CardHeader>
                <CardTitle>High Risk Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {userRiskScores.map((user) => (
                    <div key={user.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{user.email}</p>
                        <p className="text-xs text-gray-500">{user.eventCount} security events</p>
                      </div>
                      <div className="text-right">
                        <Progress 
                          value={user.avgRiskScore} 
                          className="w-20 h-2"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Risk: {user.avgRiskScore.toFixed(0)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="threats">
          <ThreatMonitoring />
        </TabsContent>

        <TabsContent value="incidents">
          <IncidentManagement />
        </TabsContent>

        <TabsContent value="metrics">
          <SecurityMetrics />
        </TabsContent>

        <TabsContent value="compliance">
          <ComplianceReports />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SecurityDashboard;