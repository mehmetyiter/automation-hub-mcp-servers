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
  DialogTitle
} from '../ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '../ui/tabs';
import {
  Shield,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  RefreshCw,
  Calendar,
  Clock,
  TrendingUp,
  Award,
  Info,
  ChevronRight,
  FileSearch,
  ClipboardCheck
} from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { securityAPIService, ComplianceFramework, ComplianceReport } from '../../services/security-api-service';

interface FrameworkStatus {
  framework: string;
  score: number;
  compliantCount: number;
  totalCount: number;
  lastAssessment: string;
  trend: 'up' | 'down' | 'stable';
}

interface ComplianceRequirement {
  id: string;
  category: string;
  title: string;
  description: string;
  status: 'compliant' | 'partial' | 'non_compliant' | 'not_applicable';
  evidence: string[];
  lastReviewed?: string;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  objectType: string;
  objectId: string;
  actorId?: string;
  riskLevel?: string;
  complianceFrameworks: string[];
}

export const ComplianceReports: React.FC = () => {
  const [frameworks, setFrameworks] = useState<FrameworkStatus[]>([]);
  const [selectedFramework, setSelectedFramework] = useState<string>('SOC2');
  const [frameworkDetails, setFrameworkDetails] = useState<ComplianceFramework | null>(null);
  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadComplianceData();
  }, []);

  useEffect(() => {
    if (selectedFramework) {
      loadFrameworkDetails(selectedFramework);
    }
  }, [selectedFramework]);

  const loadComplianceData = async () => {
    setLoading(true);
    try {
      const [statusData, reportsData, auditData] = await Promise.all([
        securityAPIService.getComplianceStatus(),
        securityAPIService.getComplianceReports(),
        securityAPIService.getAuditTrail({ limit: 100 })
      ]);

      // Process framework status
      const frameworkStatuses = statusData.map((fw: any) => ({
        framework: fw.framework,
        score: fw.score,
        compliantCount: fw.compliantCount,
        totalCount: fw.totalCount,
        lastAssessment: fw.lastAssessment || new Date().toISOString(),
        trend: fw.previousScore ? (fw.score > fw.previousScore ? 'up' : fw.score < fw.previousScore ? 'down' : 'stable') : 'stable'
      }));

      setFrameworks(frameworkStatuses);
      setReports(reportsData);
      setAuditTrail(auditData);
    } catch (error) {
      console.error('Failed to load compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFrameworkDetails = async (framework: string) => {
    try {
      const details = await securityAPIService.getComplianceFrameworkDetails(framework);
      setFrameworkDetails(details);
    } catch (error) {
      console.error('Failed to load framework details:', error);
    }
  };

  const generateReport = async (reportType: string) => {
    setIsGeneratingReport(true);
    try {
      const report = await securityAPIService.generateComplianceReport({
        framework: selectedFramework,
        reportType,
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
        endDate: new Date()
      });

      // Download report
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedFramework}_${reportType}_${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Reload reports
      loadComplianceData();
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'compliant': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'partial': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'non_compliant': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'not_applicable': return <Info className="h-4 w-4 text-gray-400" />;
      default: return null;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === 'down') return <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />;
    return <div className="h-4 w-4 bg-gray-400 rounded-full" />;
  };

  // Prepare chart data
  const frameworkScoreData = frameworks.map(fw => ({
    framework: fw.framework,
    score: fw.score,
    fullMark: 100
  }));

  const requirementStatusData = frameworkDetails?.requirements.reduce((acc, req) => {
    const existing = acc.find(item => item.name === req.status);
    if (existing) {
      existing.value++;
    } else {
      acc.push({ name: req.status, value: 1 });
    }
    return acc;
  }, [] as { name: string; value: number }[]) || [];

  const statusColors: Record<string, string> = {
    compliant: '#10B981',
    partial: '#F59E0B',
    non_compliant: '#EF4444',
    not_applicable: '#9CA3AF'
  };

  const complianceTrendData = [
    { month: 'Jan', SOC2: 75, GDPR: 80, HIPAA: 70 },
    { month: 'Feb', SOC2: 78, GDPR: 82, HIPAA: 72 },
    { month: 'Mar', SOC2: 80, GDPR: 85, HIPAA: 75 },
    { month: 'Apr', SOC2: 82, GDPR: 87, HIPAA: 78 },
    { month: 'May', SOC2: 85, GDPR: 88, HIPAA: 80 },
    { month: 'Jun', SOC2: 88, GDPR: 90, HIPAA: 82 }
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Compliance & Reporting</h3>
          <p className="text-sm text-gray-600">Monitor compliance status and generate reports</p>
        </div>
        <Button
          onClick={loadComplianceData}
          variant="outline"
          size="sm"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Framework Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {frameworks.map((fw) => (
          <Card
            key={fw.framework}
            className={`cursor-pointer hover:shadow-lg transition-shadow ${
              selectedFramework === fw.framework ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setSelectedFramework(fw.framework)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{fw.framework}</CardTitle>
                {getTrendIcon(fw.trend)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-3xl font-bold ${getScoreColor(fw.score)}`}>
                      {fw.score.toFixed(1)}%
                    </span>
                    <Award className={`h-8 w-8 ${getScoreColor(fw.score)}`} />
                  </div>
                  <Progress value={fw.score} className="h-2" />
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>{fw.compliantCount}/{fw.totalCount} compliant</span>
                  <span>{new Date(fw.lastAssessment).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Framework Comparison</CardTitle>
            <CardDescription>Compliance scores across frameworks</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={frameworkScoreData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="framework" />
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compliance Trend</CardTitle>
            <CardDescription>Historical compliance scores</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={complianceTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="SOC2" stroke="#3B82F6" strokeWidth={2} />
                <Line type="monotone" dataKey="GDPR" stroke="#10B981" strokeWidth={2} />
                <Line type="monotone" dataKey="HIPAA" stroke="#F59E0B" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{selectedFramework} Compliance</CardTitle>
              <CardDescription>Detailed compliance requirements and status</CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Select defaultValue="assessment">
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assessment">Assessment</SelectItem>
                  <SelectItem value="audit">Audit Report</SelectItem>
                  <SelectItem value="certification">Certification</SelectItem>
                  <SelectItem value="gap_analysis">Gap Analysis</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => generateReport('assessment')}
                disabled={isGeneratingReport}
              >
                {isGeneratingReport ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="requirements">Requirements</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
              <TabsTrigger value="audit">Audit Trail</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {frameworkDetails && (
                <>
                  {/* Requirement Status Distribution */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Requirement Status</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={requirementStatusData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {requirementStatusData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={statusColors[entry.name] || '#8884d8'} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Key Metrics</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Total Requirements</span>
                            <span className="font-semibold">{frameworkDetails.requirements.length}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Last Assessment</span>
                            <span className="font-semibold">
                              {frameworkDetails.lastAssessment 
                                ? new Date(frameworkDetails.lastAssessment).toLocaleDateString()
                                : 'Never'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Compliance Score</span>
                            <span className={`font-semibold ${getScoreColor(frameworkDetails.complianceScore || 0)}`}>
                              {(frameworkDetails.complianceScore || 0).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Critical Gaps</span>
                            <span className="font-semibold text-red-600">
                              {frameworkDetails.gaps?.filter(g => g.severity === 'critical').length || 0}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Next Review</span>
                            <span className="font-semibold">
                              {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Compliance Gaps */}
                  {frameworkDetails.gaps && frameworkDetails.gaps.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Compliance Gaps</CardTitle>
                        <CardDescription>Areas requiring immediate attention</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {frameworkDetails.gaps.slice(0, 5).map((gap, index) => (
                            <Alert key={index} className={`border-l-4 ${
                              gap.severity === 'critical' ? 'border-red-500' :
                              gap.severity === 'high' ? 'border-orange-500' :
                              gap.severity === 'medium' ? 'border-yellow-500' :
                              'border-gray-500'
                            }`}>
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="font-medium">{gap.description}</p>
                                    <p className="text-sm text-gray-600 mt-1">
                                      Requirement: {gap.requirementId}
                                    </p>
                                    {gap.remediationPlan && (
                                      <p className="text-sm text-gray-600 mt-1">
                                        Remediation: {gap.remediationPlan}
                                      </p>
                                    )}
                                  </div>
                                  <Badge variant={
                                    gap.severity === 'critical' ? 'destructive' :
                                    gap.severity === 'high' ? 'default' :
                                    gap.severity === 'medium' ? 'secondary' :
                                    'outline'
                                  }>
                                    {gap.severity}
                                  </Badge>
                                </div>
                              </AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="requirements">
              {frameworkDetails && (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Requirement</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Evidence</TableHead>
                        <TableHead>Last Reviewed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {frameworkDetails.requirements.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell className="font-mono text-sm">{req.id}</TableCell>
                          <TableCell>{req.category}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{req.title}</p>
                              <p className="text-xs text-gray-500">{req.description}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(req.status)}
                              <span className="text-sm capitalize">{req.status.replace('_', ' ')}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{req.evidence.length} items</Badge>
                          </TableCell>
                          <TableCell>
                            {req.lastReviewed 
                              ? new Date(req.lastReviewed).toLocaleDateString()
                              : 'Never'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="reports">
              <div className="space-y-4">
                {reports.filter(r => r.framework === selectedFramework).map((report) => (
                  <div key={report.id} className="border rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <FileText className="h-5 w-5 text-gray-500" />
                          <h4 className="font-medium">{report.title}</h4>
                          <Badge variant="outline">{report.reportType}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Period: {new Date(report.period.start).toLocaleDateString()} - {new Date(report.period.end).toLocaleDateString()}
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            Generated: {new Date(report.generatedAt).toLocaleString()}
                          </span>
                          <span className="flex items-center">
                            <ClipboardCheck className="h-3 w-3 mr-1" />
                            Score: {report.summary.overallScore.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}

                {reports.filter(r => r.framework === selectedFramework).length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <FileSearch className="h-12 w-12 mx-auto mb-3" />
                    <p>No reports generated yet</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="audit">
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-medium">Compliance Audit Trail</h4>
                  <Select defaultValue="all">
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="create">Create</SelectItem>
                      <SelectItem value="update">Update</SelectItem>
                      <SelectItem value="delete">Delete</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Object</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Risk</TableHead>
                        <TableHead>Frameworks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditTrail
                        .filter(entry => entry.complianceFrameworks.includes(selectedFramework))
                        .slice(0, 10)
                        .map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-sm">
                              {new Date(entry.timestamp).toLocaleString()}
                            </TableCell>
                            <TableCell className="font-medium">{entry.action}</TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p>{entry.objectType}</p>
                                <p className="text-xs text-gray-500">{entry.objectId}</p>
                              </div>
                            </TableCell>
                            <TableCell>{entry.actorId || 'System'}</TableCell>
                            <TableCell>
                              {entry.riskLevel && (
                                <Badge variant={
                                  entry.riskLevel === 'critical' ? 'destructive' :
                                  entry.riskLevel === 'high' ? 'default' :
                                  entry.riskLevel === 'medium' ? 'secondary' :
                                  'outline'
                                }>
                                  {entry.riskLevel}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {entry.complianceFrameworks.map((fw, index) => (
                                  <Badge key={index} variant="outline" className="text-xs">
                                    {fw}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComplianceReports;