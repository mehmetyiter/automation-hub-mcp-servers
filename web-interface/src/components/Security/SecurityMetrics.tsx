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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../ui/select';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Shield,
  AlertTriangle,
  Lock,
  Users,
  Clock,
  BarChart3,
  Download,
  RefreshCw,
  Zap,
  Target,
  CheckCircle
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart
} from 'recharts';
import { securityAPIService } from '../../services/security-api-service';

interface MetricCard {
  title: string;
  value: number;
  unit?: string;
  change: number;
  trend: 'up' | 'down' | 'stable';
  icon: React.ElementType;
  color: string;
}

interface SecurityScore {
  overall: number;
  categories: {
    threatDetection: number;
    incidentResponse: number;
    accessControl: number;
    dataProtection: number;
    compliance: number;
  };
}

export const SecurityMetrics: React.FC = () => {
  const [period, setPeriod] = useState('24h');
  const [metrics, setMetrics] = useState<any[]>([]);
  const [kpiMetrics, setKpiMetrics] = useState<MetricCard[]>([]);
  const [securityScore, setSecurityScore] = useState<SecurityScore>({
    overall: 0,
    categories: {
      threatDetection: 0,
      incidentResponse: 0,
      accessControl: 0,
      dataProtection: 0,
      compliance: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMetrics();
  }, [period]);

  const loadMetrics = async () => {
    if (!loading) setRefreshing(true);
    
    try {
      const metricsData = await securityAPIService.getSecurityMetrics(period);
      processMetrics(metricsData);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const processMetrics = (data: any[]) => {
    // Calculate KPIs
    const eventCount = data.find(m => m.metric_name === 'events_total')?.total_value || 0;
    const prevEventCount = data.find(m => m.metric_name === 'events_total_prev')?.total_value || 1;
    const eventChange = ((eventCount - prevEventCount) / prevEventCount) * 100;

    const mttr = data.find(m => m.metric_name === 'avg_mttr')?.avg_value || 0;
    const prevMttr = data.find(m => m.metric_name === 'avg_mttr_prev')?.avg_value || 1;
    const mttrChange = ((mttr - prevMttr) / prevMttr) * 100;

    const falsePositiveRate = data.find(m => m.metric_name === 'false_positive_rate')?.avg_value || 0;
    const prevFalsePositiveRate = data.find(m => m.metric_name === 'false_positive_rate_prev')?.avg_value || 1;
    const falsePositiveChange = ((falsePositiveRate - prevFalsePositiveRate) / prevFalsePositiveRate) * 100;

    const threatsCaught = data.find(m => m.metric_name === 'threats_caught')?.total_value || 0;
    const prevThreatsCaught = data.find(m => m.metric_name === 'threats_caught_prev')?.total_value || 1;
    const threatsChange = ((threatsCaught - prevThreatsCaught) / prevThreatsCaught) * 100;

    setKpiMetrics([
      {
        title: 'Security Events',
        value: eventCount,
        change: eventChange,
        trend: eventChange > 0 ? 'up' : eventChange < 0 ? 'down' : 'stable',
        icon: Activity,
        color: 'blue'
      },
      {
        title: 'Avg Response Time',
        value: mttr,
        unit: 'min',
        change: mttrChange,
        trend: mttrChange < 0 ? 'up' : mttrChange > 0 ? 'down' : 'stable', // Lower is better
        icon: Clock,
        color: 'green'
      },
      {
        title: 'False Positive Rate',
        value: falsePositiveRate,
        unit: '%',
        change: falsePositiveChange,
        trend: falsePositiveChange < 0 ? 'up' : falsePositiveChange > 0 ? 'down' : 'stable', // Lower is better
        icon: Target,
        color: 'yellow'
      },
      {
        title: 'Threats Blocked',
        value: threatsCaught,
        change: threatsChange,
        trend: threatsChange > 0 ? 'up' : threatsChange < 0 ? 'down' : 'stable',
        icon: Shield,
        color: 'purple'
      }
    ]);

    // Calculate security score
    const threatScore = Math.min(100, (threatsCaught / eventCount) * 100);
    const responseScore = Math.max(0, 100 - (mttr / 60) * 10); // Penalty for slow response
    const accuracyScore = Math.max(0, 100 - falsePositiveRate);

    setSecurityScore({
      overall: Math.round((threatScore + responseScore + accuracyScore) / 3),
      categories: {
        threatDetection: Math.round(threatScore),
        incidentResponse: Math.round(responseScore),
        accessControl: 85, // Mock data
        dataProtection: 90, // Mock data
        compliance: 88 // Mock data
      }
    });

    setMetrics(data);
  };

  const exportMetrics = async () => {
    try {
      const blob = await securityAPIService.exportSecurityMetrics(period);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `security-metrics-${period}-${new Date().toISOString()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export metrics:', error);
    }
  };

  // Prepare chart data
  const timeSeriesData = metrics
    .filter(m => m.metric_type === 'security_events')
    .map(m => ({
      time: new Date(m.period_start).toLocaleTimeString(),
      events: m.total_value,
      critical: m.tags?.severity === 'critical' ? m.total_value : 0,
      high: m.tags?.severity === 'high' ? m.total_value : 0
    }));

  const eventTypeDistribution = metrics
    .filter(m => m.metric_name.startsWith('events_'))
    .map(m => ({
      name: m.metric_name.replace('events_', '').replace(/_/g, ' '),
      value: m.total_value
    }))
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const securityScoreData = Object.entries(securityScore.categories).map(([key, value]) => ({
    category: key.replace(/([A-Z])/g, ' $1').trim(),
    score: value,
    fullMark: 100
  }));

  const performanceTrend = [
    { name: 'Mon', mttr: 45, falsePositives: 5, threats: 12 },
    { name: 'Tue', mttr: 38, falsePositives: 3, threats: 15 },
    { name: 'Wed', mttr: 42, falsePositives: 4, threats: 18 },
    { name: 'Thu', mttr: 35, falsePositives: 2, threats: 22 },
    { name: 'Fri', mttr: 40, falsePositives: 3, threats: 20 },
    { name: 'Sat', mttr: 32, falsePositives: 2, threats: 8 },
    { name: 'Sun', mttr: 30, falsePositives: 1, threats: 5 }
  ];

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4" />;
      case 'down': return <TrendingDown className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getColorClass = (color: string) => {
    const colors: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-600',
      green: 'bg-green-100 text-green-600',
      yellow: 'bg-yellow-100 text-yellow-600',
      purple: 'bg-purple-100 text-purple-600'
    };
    return colors[color] || 'bg-gray-100 text-gray-600';
  };

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
          <h3 className="text-lg font-semibold">Security Metrics & Analytics</h3>
          <p className="text-sm text-gray-600">Monitor security performance and trends</p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={loadMetrics}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportMetrics}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Security Score */}
      <Card>
        <CardHeader>
          <CardTitle>Security Posture Score</CardTitle>
          <CardDescription>Overall security health assessment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Overall Score */}
            <div className="flex items-center justify-center">
              <div className="relative">
                <div className="w-48 h-48 rounded-full border-8 border-gray-200 flex items-center justify-center">
                  <div>
                    <p className="text-5xl font-bold text-center">{securityScore.overall}</p>
                    <p className="text-gray-500 text-center">Overall Score</p>
                  </div>
                </div>
                <div
                  className="absolute inset-0 w-48 h-48 rounded-full border-8 border-blue-600"
                  style={{
                    clipPath: `polygon(0 0, 100% 0, 100% ${100 - securityScore.overall}%, 0 ${100 - securityScore.overall}%)`,
                    transform: 'rotate(-90deg)'
                  }}
                />
              </div>
            </div>

            {/* Category Scores */}
            <div>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={securityScoreData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="category" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.6}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {kpiMetrics.map((metric, index) => (
          <Card key={index}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                {metric.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">
                    {metric.value}
                    {metric.unit && <span className="text-lg font-normal text-gray-500">{metric.unit}</span>}
                  </p>
                  <div className="flex items-center space-x-1 mt-1">
                    {getTrendIcon(metric.trend)}
                    <span className={`text-sm ${
                      metric.trend === 'up' && metric.title !== 'Avg Response Time' && metric.title !== 'False Positive Rate' 
                        ? 'text-green-600' 
                        : metric.trend === 'down' && (metric.title === 'Avg Response Time' || metric.title === 'False Positive Rate')
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {Math.abs(metric.change).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${getColorClass(metric.color)}`}>
                  <metric.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Event Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Security Events Timeline</CardTitle>
            <CardDescription>Event frequency over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="events"
                  stackId="1"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.6}
                  name="Total Events"
                />
                <Area
                  type="monotone"
                  dataKey="critical"
                  stackId="2"
                  stroke="#DC2626"
                  fill="#DC2626"
                  fillOpacity={0.6}
                  name="Critical"
                />
                <Area
                  type="monotone"
                  dataKey="high"
                  stackId="2"
                  stroke="#F97316"
                  fill="#F97316"
                  fillOpacity={0.6}
                  name="High"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Event Type Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Event Type Distribution</CardTitle>
            <CardDescription>Most common security event types</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={eventTypeDistribution} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="value" fill="#8B5CF6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Trends</CardTitle>
          <CardDescription>Key performance indicators over the past week</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={performanceTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="threats" fill="#10B981" name="Threats Blocked" />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="mttr"
                stroke="#3B82F6"
                name="Avg Response Time (min)"
                strokeWidth={2}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="falsePositives"
                stroke="#F59E0B"
                name="False Positives"
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Metric Details */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Metrics</CardTitle>
          <CardDescription>Comprehensive security metrics breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Detection Rate</span>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-2xl font-bold">96.5%</p>
                <Progress value={96.5} className="mt-2" />
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Alert Accuracy</span>
                  <Target className="h-4 w-4 text-blue-600" />
                </div>
                <p className="text-2xl font-bold">88.2%</p>
                <Progress value={88.2} className="mt-2" />
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">System Uptime</span>
                  <Zap className="h-4 w-4 text-purple-600" />
                </div>
                <p className="text-2xl font-bold">99.9%</p>
                <Progress value={99.9} className="mt-2" />
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600">Rule Coverage</span>
                  <Shield className="h-4 w-4 text-orange-600" />
                </div>
                <p className="text-2xl font-bold">82.7%</p>
                <Progress value={82.7} className="mt-2" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Top Attack Vectors</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Brute Force</span>
                    <Badge variant="outline">142</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>SQL Injection</span>
                    <Badge variant="outline">87</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>XSS Attempts</span>
                    <Badge variant="outline">63</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Privilege Escalation</span>
                    <Badge variant="outline">31</Badge>
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Affected Assets</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>API Endpoints</span>
                    <Badge variant="outline">45%</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>User Accounts</span>
                    <Badge variant="outline">28%</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Database</span>
                    <Badge variant="outline">15%</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>File System</span>
                    <Badge variant="outline">12%</Badge>
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Response Effectiveness</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Auto-Blocked</span>
                    <Badge variant="outline" className="bg-green-50">78%</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Manual Review</span>
                    <Badge variant="outline" className="bg-yellow-50">18%</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Escalated</span>
                    <Badge variant="outline" className="bg-orange-50">3%</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>False Positive</span>
                    <Badge variant="outline" className="bg-gray-50">1%</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SecurityMetrics;