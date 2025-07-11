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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  Info,
  Calculator,
  Zap,
  Shield,
  Clock,
  Star,
  ChevronRight
} from 'lucide-react';

interface ModelPricing {
  model: string;
  inputTokenPrice: number;
  outputTokenPrice: number;
  contextWindow: number;
  features: string[];
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

interface ProviderPricing {
  provider: string;
  models: ModelPricing[];
  reliability: number;
  lastUpdated: string;
}

interface CostComparison {
  provider: string;
  model: string;
  estimatedCost: number;
  qualityScore: number;
  reliabilityScore: number;
  latencyScore: number;
  overallScore: number;
  pros: string[];
  cons: string[];
  suitabilityReason: string;
}

interface TaskRequirements {
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  qualityRequirement: 'basic' | 'high' | 'premium';
  latencyRequirement: 'standard' | 'fast' | 'real-time';
  features: string[];
  contextNeeded: number;
}

export const ProviderCostComparison: React.FC = () => {
  const [providers, setProviders] = useState<ProviderPricing[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>(['openai', 'anthropic']);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [comparison, setComparison] = useState<CostComparison[]>([]);
  const [taskRequirements, setTaskRequirements] = useState<TaskRequirements>({
    complexity: 'moderate',
    estimatedInputTokens: 1000,
    estimatedOutputTokens: 500,
    qualityRequirement: 'high',
    latencyRequirement: 'standard',
    features: [],
    contextNeeded: 4096
  });
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'manual' | 'automatic'>('automatic');

  useEffect(() => {
    loadProviderData();
  }, []);

  useEffect(() => {
    if (mode === 'automatic' && providers.length > 0) {
      findBestOption();
    }
  }, [taskRequirements, mode, providers]);

  const loadProviderData = async () => {
    setLoading(true);
    try {
      const providerList = ['openai', 'anthropic', 'google', 'cohere'];
      const pricingData = await Promise.all(
        providerList.map(async (provider) => {
          const response = await fetch(`/api/v1/cost/pricing?provider=${provider}`);
          if (response.ok) {
            const data = await response.json();
            return data.data;
          }
          return null;
        })
      );

      setProviders(pricingData.filter(p => p !== null));
    } catch (error) {
      console.error('Failed to load provider data:', error);
    } finally {
      setLoading(false);
    }
  };

  const comparePricing = async () => {
    if (!selectedModel || selectedProviders.length === 0) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/cost/pricing/compare?providers=${selectedProviders.join(',')}&model=${selectedModel}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setComparison(data.data.models);
      }
    } catch (error) {
      console.error('Failed to compare pricing:', error);
    } finally {
      setLoading(false);
    }
  };

  const findBestOption = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/cost/pricing/cheapest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskRequirements)
      });

      if (response.ok) {
        const data = await response.json();
        const result = data.data;
        setComparison([result.bestOption, ...result.alternatives]);
      }
    } catch (error) {
      console.error('Failed to find best option:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthlyCost = (
    inputPrice: number,
    outputPrice: number,
    monthlyRequests: number = 10000
  ) => {
    const inputCost = (taskRequirements.estimatedInputTokens / 1000) * inputPrice * monthlyRequests;
    const outputCost = (taskRequirements.estimatedOutputTokens / 1000) * outputPrice * monthlyRequests;
    return inputCost + outputCost;
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getFeatureBadge = (feature: string) => {
    const badges: Record<string, { color: string; icon: React.ElementType }> = {
      'function-calling': { color: 'blue', icon: Zap },
      'vision': { color: 'purple', icon: Star },
      'json-mode': { color: 'green', icon: Shield },
      'long-context': { color: 'orange', icon: Clock }
    };

    const badge = badges[feature] || { color: 'gray', icon: Info };

    return (
      <Badge key={feature} variant="outline" className="text-xs">
        <badge.icon className="h-3 w-3 mr-1" />
        {feature}
      </Badge>
    );
  };

  const radarData = comparison.map(item => ({
    provider: item.provider,
    quality: item.qualityScore * 100,
    reliability: item.reliabilityScore * 100,
    latency: item.latencyScore * 100,
    cost: (1 - (item.estimatedCost / Math.max(...comparison.map(c => c.estimatedCost)))) * 100
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Provider Cost Comparison</h2>
        <div className="flex items-center space-x-2">
          <Select value={mode} onValueChange={(value: 'manual' | 'automatic') => setMode(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="automatic">Automatic</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Task Requirements (Automatic Mode) */}
      {mode === 'automatic' && (
        <Card>
          <CardHeader>
            <CardTitle>Task Requirements</CardTitle>
            <CardDescription>
              Define your requirements and we'll find the best provider/model combination
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label>Complexity</Label>
                <Select
                  value={taskRequirements.complexity}
                  onValueChange={(value: 'simple' | 'moderate' | 'complex') => 
                    setTaskRequirements({ ...taskRequirements, complexity: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Simple</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="complex">Complex</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Quality Requirement</Label>
                <Select
                  value={taskRequirements.qualityRequirement}
                  onValueChange={(value: 'basic' | 'high' | 'premium') => 
                    setTaskRequirements({ ...taskRequirements, qualityRequirement: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Latency Requirement</Label>
                <Select
                  value={taskRequirements.latencyRequirement}
                  onValueChange={(value: 'standard' | 'fast' | 'real-time') => 
                    setTaskRequirements({ ...taskRequirements, latencyRequirement: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="fast">Fast</SelectItem>
                    <SelectItem value="real-time">Real-time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Input Tokens (avg)</Label>
                <Input
                  type="number"
                  value={taskRequirements.estimatedInputTokens}
                  onChange={(e) => 
                    setTaskRequirements({ 
                      ...taskRequirements, 
                      estimatedInputTokens: parseInt(e.target.value) || 0 
                    })
                  }
                />
              </div>

              <div>
                <Label>Output Tokens (avg)</Label>
                <Input
                  type="number"
                  value={taskRequirements.estimatedOutputTokens}
                  onChange={(e) => 
                    setTaskRequirements({ 
                      ...taskRequirements, 
                      estimatedOutputTokens: parseInt(e.target.value) || 0 
                    })
                  }
                />
              </div>

              <div>
                <Label>Context Window Needed</Label>
                <Input
                  type="number"
                  value={taskRequirements.contextNeeded}
                  onChange={(e) => 
                    setTaskRequirements({ 
                      ...taskRequirements, 
                      contextNeeded: parseInt(e.target.value) || 0 
                    })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual Comparison Controls */}
      {mode === 'manual' && (
        <Card>
          <CardHeader>
            <CardTitle>Manual Comparison</CardTitle>
            <CardDescription>
              Select providers and model to compare pricing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end space-x-4">
              <div className="flex-1">
                <Label>Providers</Label>
                <div className="flex items-center space-x-2 mt-2">
                  {['openai', 'anthropic', 'google', 'cohere'].map(provider => (
                    <Badge
                      key={provider}
                      variant={selectedProviders.includes(provider) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedProviders(prev => 
                          prev.includes(provider) 
                            ? prev.filter(p => p !== provider)
                            : [...prev, provider]
                        );
                      }}
                    >
                      {provider}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <Label>Model Type</Label>
                <Input
                  placeholder="e.g., gpt-4, claude-3"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                />
              </div>
              <Button onClick={comparePricing}>
                Compare
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison Results */}
      {comparison.length > 0 && (
        <>
          {/* Best Option Card */}
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Star className="h-5 w-5 text-green-600" />
                <span>Recommended Option</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    {comparison[0].provider} - {comparison[0].model}
                  </h3>
                  <p className="text-gray-600 mb-4">{comparison[0].suitabilityReason}</p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Estimated Cost</span>
                      <span className="font-semibold text-green-600">
                        ${comparison[0].estimatedCost.toFixed(4)}/request
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Monthly (10K requests)</span>
                      <span className="font-semibold">
                        ${(comparison[0].estimatedCost * 10000).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-green-600 mb-1">Pros</h4>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {comparison[0].pros.map((pro, index) => (
                        <li key={index}>{pro}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium text-red-600 mb-1">Cons</h4>
                    <ul className="list-disc list-inside text-sm text-gray-600">
                      {comparison[0].cons.map((con, index) => (
                        <li key={index}>{con}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider/Model</TableHead>
                    <TableHead>Cost/Request</TableHead>
                    <TableHead>Monthly (10K)</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Reliability</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead>Overall</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {item.provider} - {item.model}
                      </TableCell>
                      <TableCell>${item.estimatedCost.toFixed(4)}</TableCell>
                      <TableCell>${(item.estimatedCost * 10000).toFixed(2)}</TableCell>
                      <TableCell>
                        <span className={getScoreColor(item.qualityScore)}>
                          {(item.qualityScore * 100).toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={getScoreColor(item.reliabilityScore)}>
                          {(item.reliabilityScore * 100).toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={getScoreColor(item.latencyScore)}>
                          {(item.latencyScore * 100).toFixed(0)}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Progress 
                            value={item.overallScore * 100} 
                            className="w-16 h-2"
                          />
                          <span className="text-sm font-medium">
                            {(item.overallScore * 100).toFixed(0)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Visual Comparisons */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cost Comparison Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Cost Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={comparison}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="provider" />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip formatter={(value) => [`$${Number(value).toFixed(4)}`, 'Cost/Request']} />
                    <Bar dataKey="estimatedCost" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Performance Radar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="provider" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar
                      name="Quality"
                      dataKey="quality"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.3}
                    />
                    <Radar
                      name="Reliability"
                      dataKey="reliability"
                      stroke="#82ca9d"
                      fill="#82ca9d"
                      fillOpacity={0.3}
                    />
                    <Radar
                      name="Speed"
                      dataKey="latency"
                      stroke="#ffc658"
                      fill="#ffc658"
                      fillOpacity={0.3}
                    />
                    <Radar
                      name="Cost Efficiency"
                      dataKey="cost"
                      stroke="#ff7c7c"
                      fill="#ff7c7c"
                      fillOpacity={0.3}
                    />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Provider Details */}
          <Card>
            <CardHeader>
              <CardTitle>Provider Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {providers.map((provider) => (
                  <div key={provider.provider} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-lg">{provider.provider}</h3>
                      <Badge variant="outline">
                        {(provider.reliability * 100).toFixed(0)}% reliable
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {provider.models.map((model) => (
                        <div key={model.model} className="bg-gray-50 rounded-lg p-3">
                          <h4 className="font-medium mb-2">{model.model}</h4>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Input</span>
                              <span>${model.inputTokenPrice}/1K tokens</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Output</span>
                              <span>${model.outputTokenPrice}/1K tokens</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Context</span>
                              <span>{model.contextWindow.toLocaleString()} tokens</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {model.features.map(feature => getFeatureBadge(feature))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ProviderCostComparison;