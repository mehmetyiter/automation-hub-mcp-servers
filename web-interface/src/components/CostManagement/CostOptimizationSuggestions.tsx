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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '../ui/accordion';
import {
  Lightbulb,
  Zap,
  TrendingDown,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronRight,
  Info,
  Shield
} from 'lucide-react';

interface OptimizationSuggestion {
  id: string;
  type: 'model_switch' | 'provider_switch' | 'caching' | 'batching' | 'scheduling';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  currentCost: number;
  optimizedCost: number;
  savingsAmount: number;
  savingsPercentage: number;
  implementation: {
    steps: string[];
    estimatedTime: string;
    requiredChanges: Array<{
      file: string;
      type: 'config' | 'code' | 'infrastructure';
      description: string;
      before: string;
      after: string;
    }>;
    risks: Array<{
      type: 'performance' | 'reliability' | 'compatibility' | 'cost';
      severity: 'low' | 'medium' | 'high';
      description: string;
      mitigation: string;
    }>;
    rollbackPlan: string[];
  };
  confidence: number;
  automatable: boolean;
  status?: 'pending' | 'implementing' | 'completed' | 'failed';
}

interface OptimizationPlan {
  userId: string;
  currentMonthlyCost: number;
  optimizedMonthlyCost: number;
  totalSavings: number;
  savingsPercentage: number;
  suggestions: OptimizationSuggestion[];
  implementationTimeline: {
    immediate: OptimizationSuggestion[];
    shortTerm: OptimizationSuggestion[];
    longTerm: OptimizationSuggestion[];
  };
  riskAssessment: {
    overallRisk: 'low' | 'medium' | 'high';
    riskFactors: Array<{
      type: string;
      severity: string;
      description: string;
      mitigation: string;
    }>;
    mitigationStrategies: string[];
  };
  confidenceScore: number;
}

export const CostOptimizationSuggestions: React.FC = () => {
  const [optimizationPlan, setOptimizationPlan] = useState<OptimizationPlan | null>(null);
  const [implementingIds, setImplementingIds] = useState<Set<string>>(new Set());
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOptimizationPlan();
  }, []);

  const loadOptimizationPlan = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/v1/cost/optimizations');
      if (!response.ok) {
        throw new Error('Failed to load optimization suggestions');
      }
      
      const data = await response.json();
      
      // Transform the data into the expected format
      const suggestions = data.data || [];
      const totalSavings = suggestions.reduce((sum: number, s: any) => sum + s.potentialMonthlySavings, 0);
      const currentCost = suggestions.reduce((sum: number, s: any) => sum + s.currentCost, 0) || 100;
      
      const plan: OptimizationPlan = {
        userId: 'current-user',
        currentMonthlyCost: currentCost,
        optimizedMonthlyCost: currentCost - totalSavings,
        totalSavings,
        savingsPercentage: (totalSavings / currentCost) * 100,
        suggestions: suggestions,
        implementationTimeline: categorizeByTimeline(suggestions),
        riskAssessment: assessRisks(suggestions),
        confidenceScore: 0.85
      };
      
      setOptimizationPlan(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const categorizeByTimeline = (suggestions: OptimizationSuggestion[]) => {
    const immediate = suggestions.filter(s => 
      s.implementation?.estimatedTime?.includes('hour') || 
      s.implementation?.estimatedTime?.includes('day')
    );
    
    const shortTerm = suggestions.filter(s => 
      s.implementation?.estimatedTime?.includes('week') &&
      !s.implementation?.estimatedTime?.includes('weeks')
    );
    
    const longTerm = suggestions.filter(s => 
      s.implementation?.estimatedTime?.includes('weeks') ||
      s.implementation?.estimatedTime?.includes('month')
    );

    return { immediate, shortTerm, longTerm };
  };

  const assessRisks = (suggestions: OptimizationSuggestion[]) => {
    const riskFactors: any[] = [];
    
    suggestions.forEach(s => {
      if (s.implementation?.risks) {
        riskFactors.push(...s.implementation.risks);
      }
    });

    const highRiskCount = riskFactors.filter(r => r.severity === 'high').length;
    const overallRisk = highRiskCount > 2 ? 'high' : highRiskCount > 0 ? 'medium' : 'low';

    return {
      overallRisk,
      riskFactors,
      mitigationStrategies: [
        'Implement changes gradually with monitoring',
        'Maintain rollback capabilities',
        'Test in staging environment first'
      ]
    };
  };

  const handleImplementOptimization = async (suggestionId: string, mode: 'test' | 'gradual' | 'full' = 'gradual') => {
    setImplementingIds(new Set([...implementingIds, suggestionId]));
    
    try {
      const response = await fetch(`/api/v1/cost/optimizations/${suggestionId}/implement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });

      if (response.ok) {
        setCompletedIds(new Set([...completedIds, suggestionId]));
        // Reload to get updated data
        loadOptimizationPlan();
      } else {
        throw new Error('Failed to implement optimization');
      }
    } catch (error) {
      console.error('Failed to implement optimization:', error);
      setError('Failed to implement optimization');
    } finally {
      const newImplementing = new Set(implementingIds);
      newImplementing.delete(suggestionId);
      setImplementingIds(newImplementing);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'model_switch':
        return <Zap className="h-4 w-4" />;
      case 'provider_switch':
        return <RefreshCw className="h-4 w-4" />;
      case 'caching':
        return <Shield className="h-4 w-4" />;
      case 'batching':
        return <Clock className="h-4 w-4" />;
      case 'scheduling':
        return <Clock className="h-4 w-4" />;
      default:
        return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'default';
      case 'medium':
        return 'secondary';
      case 'low':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getRiskColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'text-red-600 bg-red-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const renderOptimizationCard = (suggestion: OptimizationSuggestion) => {
    const isImplementing = implementingIds.has(suggestion.id);
    const isCompleted = completedIds.has(suggestion.id);

    return (
      <Card key={suggestion.id} className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                {getTypeIcon(suggestion.type)}
              </div>
              <div>
                <CardTitle className="text-lg">{suggestion.title}</CardTitle>
                <CardDescription className="mt-1">{suggestion.description}</CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={getPriorityColor(suggestion.priority)}>
                {suggestion.priority}
              </Badge>
              {suggestion.automatable && (
                <Badge variant="outline">
                  <Zap className="h-3 w-3 mr-1" />
                  Auto
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Savings Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Potential Savings</p>
                <p className="text-xl font-bold text-green-600">
                  ${suggestion.savingsAmount.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">
                  {suggestion.savingsPercentage.toFixed(1)}% reduction
                </p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Implementation Time</p>
                <p className="text-lg font-semibold">
                  {suggestion.implementation.estimatedTime}
                </p>
                <Progress 
                  value={suggestion.confidence * 100} 
                  className="mt-2 h-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {(suggestion.confidence * 100).toFixed(0)}% confidence
                </p>
              </div>
            </div>

            {/* Implementation Details */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="details">
                <AccordionTrigger>Implementation Details</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {/* Steps */}
                    <div>
                      <h4 className="font-semibold mb-2">Implementation Steps</h4>
                      <ol className="list-decimal list-inside space-y-1">
                        {suggestion.implementation.steps.map((step, index) => (
                          <li key={index} className="text-sm text-gray-600">{step}</li>
                        ))}
                      </ol>
                    </div>

                    {/* Required Changes */}
                    {suggestion.implementation.requiredChanges.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Required Changes</h4>
                        <div className="space-y-2">
                          {suggestion.implementation.requiredChanges.map((change, index) => (
                            <div key={index} className="p-2 bg-gray-50 rounded text-sm">
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline">{change.type}</Badge>
                                <span className="font-mono text-xs">{change.file}</span>
                              </div>
                              <p className="text-gray-600 mt-1">{change.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Risks */}
                    {suggestion.implementation.risks.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Risks & Mitigations</h4>
                        <div className="space-y-2">
                          {suggestion.implementation.risks.map((risk, index) => (
                            <div key={index} className={`p-3 rounded-lg ${getRiskColor(risk.severity)}`}>
                              <div className="flex items-start space-x-2">
                                <AlertTriangle className="h-4 w-4 mt-0.5" />
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{risk.description}</p>
                                  <p className="text-xs mt-1">Mitigation: {risk.mitigation}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center space-x-2">
                {isCompleted && (
                  <Badge variant="outline" className="text-green-600">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Implemented
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleImplementOptimization(suggestion.id, 'test')}
                  disabled={isImplementing || isCompleted}
                >
                  Test
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleImplementOptimization(suggestion.id, 'full')}
                  disabled={isImplementing || isCompleted}
                >
                  {isImplementing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Implementing...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Implement
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-red-800">
          {error}
          <Button
            variant="outline"
            size="sm"
            onClick={loadOptimizationPlan}
            className="ml-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!optimizationPlan || optimizationPlan.suggestions.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Lightbulb className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold mb-2">No Optimization Opportunities</h3>
          <p className="text-gray-600">Your setup is already well-optimized!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingDown className="h-5 w-5" />
            <span>Optimization Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <DollarSign className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <p className="text-2xl font-bold text-blue-600">
                ${optimizationPlan.currentMonthlyCost.toFixed(2)}
              </p>
              <p className="text-sm text-blue-500">Current Cost</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <TrendingDown className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold text-green-600">
                ${optimizationPlan.totalSavings.toFixed(2)}
              </p>
              <p className="text-sm text-green-500">Potential Savings</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <Zap className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <p className="text-2xl font-bold text-purple-600">
                {optimizationPlan.savingsPercentage.toFixed(1)}%
              </p>
              <p className="text-sm text-purple-500">Cost Reduction</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Shield className="h-8 w-8 mx-auto mb-2 text-gray-600" />
              <p className="text-2xl font-bold text-gray-600">
                {optimizationPlan.riskAssessment.overallRisk}
              </p>
              <p className="text-sm text-gray-500">Overall Risk</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Assessment Alert */}
      {optimizationPlan.riskAssessment.overallRisk !== 'low' && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Risk Assessment:</strong> The overall risk level is {optimizationPlan.riskAssessment.overallRisk}.
            Please review individual optimization risks before implementing.
          </AlertDescription>
        </Alert>
      )}

      {/* Optimization Suggestions by Timeline */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">
            All ({optimizationPlan.suggestions.length})
          </TabsTrigger>
          <TabsTrigger value="immediate">
            Immediate ({optimizationPlan.implementationTimeline.immediate.length})
          </TabsTrigger>
          <TabsTrigger value="short">
            Short Term ({optimizationPlan.implementationTimeline.shortTerm.length})
          </TabsTrigger>
          <TabsTrigger value="long">
            Long Term ({optimizationPlan.implementationTimeline.longTerm.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {optimizationPlan.suggestions.map(renderOptimizationCard)}
        </TabsContent>

        <TabsContent value="immediate" className="space-y-4">
          {optimizationPlan.implementationTimeline.immediate.map(renderOptimizationCard)}
        </TabsContent>

        <TabsContent value="short" className="space-y-4">
          {optimizationPlan.implementationTimeline.shortTerm.map(renderOptimizationCard)}
        </TabsContent>

        <TabsContent value="long" className="space-y-4">
          {optimizationPlan.implementationTimeline.longTerm.map(renderOptimizationCard)}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CostOptimizationSuggestions;