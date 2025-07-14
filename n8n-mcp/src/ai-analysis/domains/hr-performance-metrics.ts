import { 
  DynamicBusinessLogicGenerator,
  BusinessLogicRequest,
  BusinessLogicResult,
  DataStructure,
  Variable
} from '../business-logic-generator.js';

export interface PerformanceMetricsRequest {
  evaluationType: 'individual' | 'team' | 'department' | '360degree' | 'continuous';
  metricsCategories: {
    productivity?: boolean;
    quality?: boolean;
    collaboration?: boolean;
    leadership?: boolean;
    innovation?: boolean;
    growth?: boolean;
    cultural?: boolean;
  };
  industryType?: 'technology' | 'healthcare' | 'finance' | 'retail' | 'manufacturing' | 'services';
  evaluationPeriod?: 'monthly' | 'quarterly' | 'annual' | 'continuous';
  performanceFramework?: 'okr' | 'kpi' | 'balanced_scorecard' | 'smart_goals' | 'custom';
  includeCompensation?: boolean;
  includeDevelopment?: boolean;
}

export interface PerformanceModel {
  framework: string;
  metrics: string[];
  weightings: Record<string, number>;
  benchmarks: Record<string, any>;
}

export class HRPerformanceMetricsGenerator {
  private businessLogicGenerator: DynamicBusinessLogicGenerator;
  private performanceModels: Map<string, PerformanceModel> = new Map();
  
  constructor(aiProvider?: string) {
    this.businessLogicGenerator = new DynamicBusinessLogicGenerator(aiProvider);
    this.initializePerformanceModels();
  }
  
  private initializePerformanceModels(): void {
    this.performanceModels = new Map([
      ['okr', {
        framework: 'Objectives and Key Results',
        metrics: ['objective_completion', 'key_result_achievement', 'stretch_goal_progress'],
        weightings: { objectives: 0.4, keyResults: 0.4, alignment: 0.2 },
        benchmarks: { completion: 70, stretch: 100, alignment: 80 }
      }],
      ['kpi', {
        framework: 'Key Performance Indicators',
        metrics: ['efficiency', 'effectiveness', 'quality', 'timeliness'],
        weightings: { efficiency: 0.3, effectiveness: 0.3, quality: 0.25, timeliness: 0.15 },
        benchmarks: { efficiency: 85, effectiveness: 80, quality: 90, timeliness: 95 }
      }],
      ['balanced_scorecard', {
        framework: 'Balanced Scorecard',
        metrics: ['financial', 'customer', 'internal_process', 'learning_growth'],
        weightings: { financial: 0.25, customer: 0.25, process: 0.25, growth: 0.25 },
        benchmarks: { financial: 100, customer: 85, process: 80, growth: 75 }
      }]
    ]);
  }
  
  async generatePerformanceMetricsLogic(request: PerformanceMetricsRequest): Promise<BusinessLogicResult> {
    const dataStructure = this.buildDataStructure(request);
    const businessRequest = this.buildBusinessRequest(request, dataStructure);
    
    // Generate the business logic
    const result = await this.businessLogicGenerator.generateBusinessLogic(businessRequest);
    
    // Add HR-specific performance patterns
    result.businessLogic.implementation = this.enhanceWithHRPatterns(
      result.businessLogic.implementation,
      request
    );
    
    // Add performance framework logic
    if (request.performanceFramework) {
      result.businessLogic.implementation = this.addFrameworkLogic(
        result.businessLogic.implementation,
        request.performanceFramework
      );
    }
    
    return result;
  }
  
  private buildDataStructure(request: PerformanceMetricsRequest): DataStructure {
    const inputs: Variable[] = [];
    const outputs: Variable[] = [
      {
        name: 'overallScore',
        type: 'number',
        range: '0-100',
        businessMeaning: 'Overall performance score'
      },
      {
        name: 'performanceRating',
        type: 'categorical',
        range: 'exceeds|meets|developing|needs_improvement',
        businessMeaning: 'Performance rating category'
      },
      {
        name: 'categoryScores',
        type: 'object',
        businessMeaning: 'Scores broken down by category'
      },
      {
        name: 'strengths',
        type: 'array',
        businessMeaning: 'Identified strength areas'
      },
      {
        name: 'developmentAreas',
        type: 'array',
        businessMeaning: 'Areas for improvement'
      },
      {
        name: 'recommendations',
        type: 'object',
        businessMeaning: 'Development and action recommendations'
      }
    ];
    
    if (request.includeCompensation) {
      outputs.push({
        name: 'compensationRecommendation',
        type: 'object',
        businessMeaning: 'Compensation adjustment recommendations'
      });
    }
    
    if (request.includeDevelopment) {
      outputs.push({
        name: 'developmentPlan',
        type: 'object',
        businessMeaning: 'Personalized development plan'
      });
    }
    
    // Productivity metrics
    if (request.metricsCategories.productivity) {
      inputs.push(
        {
          name: 'tasksCompleted',
          type: 'number',
          businessMeaning: 'Number of tasks completed'
        },
        {
          name: 'goalsAchieved',
          type: 'number',
          businessMeaning: 'Number of goals achieved'
        },
        {
          name: 'projectDelivery',
          type: 'percentage',
          businessMeaning: 'Projects delivered on time'
        },
        {
          name: 'efficiency',
          type: 'percentage',
          businessMeaning: 'Work efficiency rating'
        },
        {
          name: 'outputQuality',
          type: 'number',
          range: '1-5',
          businessMeaning: 'Quality of work output'
        }
      );
    }
    
    // Quality metrics
    if (request.metricsCategories.quality) {
      inputs.push(
        {
          name: 'errorRate',
          type: 'percentage',
          businessMeaning: 'Error or defect rate'
        },
        {
          name: 'customerSatisfaction',
          type: 'number',
          range: '1-5',
          businessMeaning: 'Customer/stakeholder satisfaction'
        },
        {
          name: 'qualityScore',
          type: 'number',
          range: '0-100',
          businessMeaning: 'Work quality assessment'
        },
        {
          name: 'reworkRequired',
          type: 'percentage',
          businessMeaning: 'Percentage of work requiring revision'
        }
      );
    }
    
    // Collaboration metrics
    if (request.metricsCategories.collaboration) {
      inputs.push(
        {
          name: 'teamworkRating',
          type: 'number',
          range: '1-5',
          businessMeaning: 'Teamwork effectiveness rating'
        },
        {
          name: 'communicationScore',
          type: 'number',
          range: '1-5',
          businessMeaning: 'Communication effectiveness'
        },
        {
          name: 'peerFeedback',
          type: 'number',
          range: '1-5',
          businessMeaning: 'Average peer feedback score'
        },
        {
          name: 'knowledgeSharing',
          type: 'number',
          range: '0-100',
          businessMeaning: 'Knowledge sharing contributions'
        },
        {
          name: 'conflictResolution',
          type: 'number',
          range: '1-5',
          businessMeaning: 'Conflict resolution skills'
        }
      );
    }
    
    // Leadership metrics
    if (request.metricsCategories.leadership) {
      inputs.push(
        {
          name: 'teamPerformance',
          type: 'percentage',
          businessMeaning: 'Team performance improvement'
        },
        {
          name: 'employeeEngagement',
          type: 'number',
          range: '1-5',
          businessMeaning: 'Team engagement score'
        },
        {
          name: 'mentoring',
          type: 'number',
          businessMeaning: 'Number of employees mentored'
        },
        {
          name: 'strategicContribution',
          type: 'number',
          range: '1-5',
          businessMeaning: 'Strategic thinking and contribution'
        },
        {
          name: 'decisionMaking',
          type: 'number',
          range: '1-5',
          businessMeaning: 'Decision-making effectiveness'
        }
      );
    }
    
    // Innovation metrics
    if (request.metricsCategories.innovation) {
      inputs.push(
        {
          name: 'ideasGenerated',
          type: 'number',
          businessMeaning: 'Number of innovative ideas proposed'
        },
        {
          name: 'ideasImplemented',
          type: 'number',
          businessMeaning: 'Number of ideas implemented'
        },
        {
          name: 'processImprovements',
          type: 'number',
          businessMeaning: 'Process improvements initiated'
        },
        {
          name: 'innovationImpact',
          type: 'number',
          range: '1-5',
          businessMeaning: 'Impact of innovations'
        }
      );
    }
    
    // Growth metrics
    if (request.metricsCategories.growth) {
      inputs.push(
        {
          name: 'skillsAcquired',
          type: 'number',
          businessMeaning: 'New skills acquired'
        },
        {
          name: 'trainingCompleted',
          type: 'number',
          businessMeaning: 'Training hours completed'
        },
        {
          name: 'certifications',
          type: 'number',
          businessMeaning: 'Professional certifications earned'
        },
        {
          name: 'growthGoalsAchieved',
          type: 'percentage',
          businessMeaning: 'Personal growth goals achieved'
        },
        {
          name: 'adaptability',
          type: 'number',
          range: '1-5',
          businessMeaning: 'Adaptability to change'
        }
      );
    }
    
    // Cultural metrics
    if (request.metricsCategories.cultural) {
      inputs.push(
        {
          name: 'valuesAlignment',
          type: 'number',
          range: '1-5',
          businessMeaning: 'Alignment with company values'
        },
        {
          name: 'culturalContribution',
          type: 'number',
          range: '1-5',
          businessMeaning: 'Contribution to company culture'
        },
        {
          name: 'diversityInclusion',
          type: 'number',
          range: '1-5',
          businessMeaning: 'Support for diversity and inclusion'
        },
        {
          name: 'ethicalBehavior',
          type: 'number',
          range: '1-5',
          businessMeaning: 'Ethical behavior and integrity'
        }
      );
    }
    
    return { inputs, outputs };
  }
  
  private buildBusinessRequest(
    request: PerformanceMetricsRequest,
    dataStructure: DataStructure
  ): BusinessLogicRequest {
    const performanceModel = this.performanceModels.get(request.performanceFramework || 'kpi') || 
                            this.performanceModels.get('kpi')!;
    
    const description = `Generate a comprehensive ${request.evaluationType} performance evaluation system for ${
      request.industryType || 'general'
    } industry that measures performance based on ${
      Object.entries(request.metricsCategories)
        .filter(([_, enabled]) => enabled)
        .map(([category]) => category)
        .join(', ')
    } metrics. The system should use ${
      request.performanceFramework || 'KPI'
    } framework, support ${
      request.evaluationPeriod || 'annual'
    } evaluations, and provide actionable insights for employee development${
      request.includeCompensation ? ' and compensation decisions' : ''
    }.`;
    
    return {
      description,
      domain: 'hr',
      context: {
        process: 'performance_evaluation',
        evaluationType: request.evaluationType,
        industry: request.industryType || 'general',
        performanceModel: performanceModel,
        evaluationPeriod: request.evaluationPeriod || 'annual',
        metricsCategories: request.metricsCategories,
        includeCompensation: request.includeCompensation || false,
        includeDevelopment: request.includeDevelopment || false
      },
      dataStructure,
      requirements: {
        accuracy: 'high',
        performance: 'batch',
        scalability: request.evaluationType === 'department' ? 'enterprise' : 'medium'
      },
      examples: this.generateExamples(request)
    };
  }
  
  private generateExamples(request: PerformanceMetricsRequest): any[] {
    const examples = [];
    
    // High performer example
    const highPerformer: any = {};
    if (request.metricsCategories.productivity) {
      highPerformer.tasksCompleted = 150;
      highPerformer.goalsAchieved = 12;
      highPerformer.projectDelivery = 95;
      highPerformer.efficiency = 92;
      highPerformer.outputQuality = 4.8;
    }
    if (request.metricsCategories.quality) {
      highPerformer.errorRate = 2;
      highPerformer.customerSatisfaction = 4.7;
      highPerformer.qualityScore = 94;
      highPerformer.reworkRequired = 5;
    }
    if (request.metricsCategories.collaboration) {
      highPerformer.teamworkRating = 4.8;
      highPerformer.communicationScore = 4.7;
      highPerformer.peerFeedback = 4.6;
    }
    
    examples.push({
      input: highPerformer,
      expectedOutput: {
        overallScore: 92,
        performanceRating: 'exceeds',
        strengths: ['Exceptional productivity', 'High quality output', 'Strong team player'],
        developmentAreas: ['Continue leadership development'],
        recommendations: { nextRole: 'Consider for promotion', training: 'Advanced leadership' }
      },
      explanation: 'High performer exceeding expectations'
    });
    
    // Average performer example
    const averagePerformer: any = {};
    if (request.metricsCategories.productivity) {
      averagePerformer.tasksCompleted = 100;
      averagePerformer.goalsAchieved = 8;
      averagePerformer.projectDelivery = 80;
      averagePerformer.efficiency = 75;
      averagePerformer.outputQuality = 3.5;
    }
    if (request.metricsCategories.quality) {
      averagePerformer.errorRate = 8;
      averagePerformer.customerSatisfaction = 3.8;
      averagePerformer.qualityScore = 78;
      averagePerformer.reworkRequired = 12;
    }
    
    examples.push({
      input: averagePerformer,
      expectedOutput: {
        overallScore: 75,
        performanceRating: 'meets',
        strengths: ['Consistent performer', 'Reliable'],
        developmentAreas: ['Improve efficiency', 'Enhance quality'],
        recommendations: { training: 'Time management, Quality improvement' }
      },
      explanation: 'Solid performer meeting expectations'
    });
    
    return examples;
  }
  
  private enhanceWithHRPatterns(implementation: string, request: PerformanceMetricsRequest): string {
    const hrPatterns = `
// HR Performance Evaluation Patterns
const PERFORMANCE_FRAMEWORKS = {
  okr: {
    name: 'Objectives and Key Results',
    calculateScore: calculateOKRScore,
    weights: { objectives: 0.4, keyResults: 0.4, alignment: 0.2 }
  },
  kpi: {
    name: 'Key Performance Indicators',
    calculateScore: calculateKPIScore,
    weights: { efficiency: 0.3, effectiveness: 0.3, quality: 0.25, timeliness: 0.15 }
  },
  balanced_scorecard: {
    name: 'Balanced Scorecard',
    calculateScore: calculateBalancedScore,
    weights: { financial: 0.25, customer: 0.25, process: 0.25, growth: 0.25 }
  },
  smart_goals: {
    name: 'SMART Goals',
    calculateScore: calculateSMARTScore,
    weights: { specific: 0.2, measurable: 0.2, achievable: 0.2, relevant: 0.2, timely: 0.2 }
  }
};

// Performance distribution calibration
function calibratePerformanceDistribution(scores: number[], targetDistribution: any): number[] {
  // Apply forced distribution if required
  const distribution = {
    exceeds: 0.15,      // Top 15%
    meets_plus: 0.20,   // Next 20%
    meets: 0.50,        // Middle 50%
    developing: 0.10,   // Next 10%
    needs_improvement: 0.05  // Bottom 5%
  };
  
  const sortedScores = [...scores].sort((a, b) => b - a);
  const calibrated = [];
  
  let index = 0;
  Object.entries(distribution).forEach(([rating, percentage]) => {
    const count = Math.round(scores.length * percentage);
    for (let i = 0; i < count && index < scores.length; i++) {
      calibrated.push({
        originalScore: sortedScores[index],
        calibratedRating: rating,
        percentile: (index / scores.length) * 100
      });
      index++;
    }
  });
  
  return calibrated;
}

// 360-degree feedback aggregation
function aggregate360Feedback(feedbackData: any): any {
  const sources = {
    self: { weight: 0.20, scores: feedbackData.selfAssessment },
    manager: { weight: 0.30, scores: feedbackData.managerAssessment },
    peers: { weight: 0.25, scores: averageScores(feedbackData.peerAssessments) },
    directReports: { weight: 0.15, scores: averageScores(feedbackData.directReportAssessments) },
    customers: { weight: 0.10, scores: averageScores(feedbackData.customerAssessments) }
  };
  
  const weightedScore = Object.entries(sources).reduce((total, [source, data]) => {
    if (data.scores) {
      return total + (data.scores * data.weight);
    }
    return total;
  }, 0);
  
  return {
    overallScore: weightedScore,
    breakdown: sources,
    gaps: identifyPerceptionGaps(sources)
  };
}

// Continuous performance tracking
function trackContinuousPerformance(performanceData: any): any {
  const trendAnalysis = analyzeTrends(performanceData.history);
  const momentum = calculateMomentum(performanceData.recent);
  const consistency = measureConsistency(performanceData.history);
  
  return {
    currentPerformance: performanceData.current,
    trend: trendAnalysis,
    momentum: momentum,
    consistency: consistency,
    prediction: predictFuturePerformance(trendAnalysis, momentum)
  };
}

// Development planning based on performance
function generateDevelopmentPlan(performanceData: any, gaps: any[]): any {
  const plan = {
    immediate: [],    // 0-3 months
    shortTerm: [],    // 3-6 months
    longTerm: [],     // 6-12 months
    career: []        // 12+ months
  };
  
  // Prioritize development areas
  gaps.sort((a, b) => b.impact - a.impact);
  
  gaps.forEach((gap, index) => {
    const development = {
      area: gap.area,
      currentLevel: gap.current,
      targetLevel: gap.target,
      activities: getDevelopmentActivities(gap),
      resources: getDevelopmentResources(gap),
      timeline: estimateTimeline(gap),
      success_metrics: defineSuccessMetrics(gap)
    };
    
    if (index < 2) plan.immediate.push(development);
    else if (index < 4) plan.shortTerm.push(development);
    else if (index < 6) plan.longTerm.push(development);
    else plan.career.push(development);
  });
  
  return plan;
}

// Compensation recommendation engine
function generateCompensationRecommendation(
  performanceData: any,
  marketData: any,
  history: any
): any {
  const performanceMultiplier = getPerformanceMultiplier(performanceData.overallScore);
  const marketPosition = analyzeMarketPosition(marketData);
  const historicalIncreases = analyzeHistoricalIncreases(history);
  
  const baseIncrease = marketData.standardIncrease || 0.03;
  const performanceAdjustment = baseIncrease * performanceMultiplier;
  const marketAdjustment = calculateMarketAdjustment(marketPosition);
  
  const totalIncrease = baseIncrease + performanceAdjustment + marketAdjustment;
  
  return {
    recommendedIncrease: Math.min(totalIncrease, 0.15), // Cap at 15%
    breakdown: {
      base: baseIncrease,
      performance: performanceAdjustment,
      market: marketAdjustment
    },
    bonus: calculateBonus(performanceData),
    equity: recommendEquity(performanceData, marketData),
    rationale: generateCompensationRationale(performanceData, marketData)
  };
}

// Performance improvement tracking
function trackPerformanceImprovement(current: any, previous: any): any {
  const improvements = [];
  const declines = [];
  
  Object.keys(current.categoryScores).forEach(category => {
    const currentScore = current.categoryScores[category];
    const previousScore = previous.categoryScores[category] || currentScore;
    const change = currentScore - previousScore;
    
    if (change > 5) {
      improvements.push({
        category,
        improvement: change,
        percentage: (change / previousScore) * 100
      });
    } else if (change < -5) {
      declines.push({
        category,
        decline: Math.abs(change),
        percentage: (Math.abs(change) / previousScore) * 100
      });
    }
  });
  
  return {
    overallChange: current.overallScore - (previous.overallScore || current.overallScore),
    improvements,
    declines,
    consistentAreas: identifyConsistentPerformance(current, previous),
    recommendations: generateImprovementRecommendations(improvements, declines)
  };
}
`;
    
    // Add evaluation type specific patterns
    const evaluationPatterns: Record<string, string> = {
      individual: `
// Individual performance evaluation
function evaluateIndividualPerformance(data: any): any {
  const scores = calculateCategoryScores(data);
  const weighted = applyWeights(scores, CATEGORY_WEIGHTS);
  const overall = calculateOverallScore(weighted);
  
  return {
    overall,
    categories: scores,
    rating: determineRating(overall),
    percentile: calculatePercentile(overall, peerScores),
    strengths: identifyStrengths(scores),
    gaps: identifyGaps(scores, roleExpectations)
  };
}`,
      
      team: `
// Team performance evaluation
function evaluateTeamPerformance(teamData: any): any {
  const individualScores = teamData.members.map(evaluateIndividualPerformance);
  const teamMetrics = calculateTeamMetrics(teamData);
  const collaboration = assessTeamCollaboration(teamData);
  
  return {
    teamScore: aggregateTeamScore(individualScores, teamMetrics),
    collaboration: collaboration,
    distribution: analyzeScoreDistribution(individualScores),
    dynamics: assessTeamDynamics(teamData),
    recommendations: generateTeamRecommendations(teamMetrics, collaboration)
  };
}`,
      
      '360degree': `
// 360-degree performance evaluation
function evaluate360Performance(feedbackData: any): any {
  const aggregated = aggregate360Feedback(feedbackData);
  const blindSpots = identifyBlindSpots(feedbackData);
  const strengths = identifyConsensusStrengths(feedbackData);
  
  return {
    overall: aggregated.overallScore,
    perspectives: aggregated.breakdown,
    blindSpots: blindSpots,
    strengths: strengths,
    development: prioritizeDevelopmentAreas(blindSpots, aggregated.gaps)
  };
}`
    };
    
    const selectedPattern = evaluationPatterns[request.evaluationType] || evaluationPatterns.individual;
    
    return hrPatterns + '\n\n' + selectedPattern + '\n\n' + implementation;
  }
  
  private addFrameworkLogic(implementation: string, framework: string): string {
    const frameworkLogic: Record<string, string> = {
      okr: `
// OKR-specific logic
function calculateOKRScore(data: any): any {
  const objectives = data.objectives || [];
  const keyResults = data.keyResults || [];
  
  // Calculate objective completion
  const objectiveScores = objectives.map(obj => ({
    objective: obj.name,
    completion: obj.completion,
    impact: obj.impact,
    score: obj.completion * obj.impact
  }));
  
  // Calculate key result achievement
  const krScores = keyResults.map(kr => ({
    keyResult: kr.name,
    target: kr.target,
    actual: kr.actual,
    achievement: Math.min((kr.actual / kr.target) * 100, 100),
    stretch: kr.isStretch
  }));
  
  // Weighted scoring
  const objectiveAvg = average(objectiveScores.map(o => o.score));
  const krAvg = average(krScores.map(kr => kr.achievement));
  const stretchBonus = krScores.filter(kr => kr.stretch && kr.achievement > 100).length * 5;
  
  return {
    objectiveScore: objectiveAvg,
    keyResultScore: krAvg,
    stretchBonus: stretchBonus,
    overall: (objectiveAvg * 0.4) + (krAvg * 0.4) + (stretchBonus * 0.2),
    details: { objectives: objectiveScores, keyResults: krScores }
  };
}`,

      balanced_scorecard: `
// Balanced Scorecard logic
function calculateBalancedScore(data: any): any {
  const perspectives = {
    financial: calculateFinancialPerspective(data.financial),
    customer: calculateCustomerPerspective(data.customer),
    internalProcess: calculateProcessPerspective(data.process),
    learningGrowth: calculateGrowthPerspective(data.growth)
  };
  
  // Strategic alignment scoring
  const alignment = assessStrategicAlignment(perspectives);
  
  // Balance check - ensure no perspective is neglected
  const balance = checkPerspectiveBalance(perspectives);
  
  return {
    perspectives: perspectives,
    overall: calculateWeightedAverage(perspectives, PERSPECTIVE_WEIGHTS),
    alignment: alignment,
    balance: balance,
    recommendations: generateBalancedRecommendations(perspectives, balance)
  };
}

function assessStrategicAlignment(perspectives: any): number {
  // Check how well perspectives support each other
  const synergies = [
    correlate(perspectives.learningGrowth, perspectives.internalProcess),
    correlate(perspectives.internalProcess, perspectives.customer),
    correlate(perspectives.customer, perspectives.financial)
  ];
  
  return average(synergies) * 100;
}`,

      smart_goals: `
// SMART Goals evaluation logic
function calculateSMARTScore(data: any): any {
  const goals = data.goals || [];
  
  const evaluatedGoals = goals.map(goal => {
    const evaluation = {
      goal: goal.description,
      specific: evaluateSpecificity(goal),
      measurable: evaluateMeasurability(goal),
      achievable: evaluateAchievability(goal),
      relevant: evaluateRelevance(goal),
      timely: evaluateTimeliness(goal)
    };
    
    evaluation.smartScore = average([
      evaluation.specific,
      evaluation.measurable,
      evaluation.achievable,
      evaluation.relevant,
      evaluation.timely
    ]);
    
    evaluation.achievement = calculateGoalAchievement(goal);
    
    return evaluation;
  });
  
  return {
    goals: evaluatedGoals,
    overall: average(evaluatedGoals.map(g => g.achievement)),
    smartCompliance: average(evaluatedGoals.map(g => g.smartScore)),
    recommendations: generateSMARTRecommendations(evaluatedGoals)
  };
}

function evaluateSpecificity(goal: any): number {
  const criteria = [
    goal.description.length > 20,
    goal.targetMetric !== undefined,
    goal.scope !== undefined,
    goal.stakeholders !== undefined
  ];
  
  return (criteria.filter(c => c).length / criteria.length) * 100;
}`
    };
    
    const logic = frameworkLogic[framework] || '';
    
    return implementation + '\n\n' + logic;
  }
}

// Convenience function
export function createPerformanceMetricsGenerator(aiProvider?: string): HRPerformanceMetricsGenerator {
  return new HRPerformanceMetricsGenerator(aiProvider);
}

// Pre-configured performance evaluation templates
export const PERFORMANCE_TEMPLATES = {
  tech_individual_okr: {
    evaluationType: 'individual' as const,
    metricsCategories: {
      productivity: true,
      quality: true,
      collaboration: true,
      innovation: true,
      growth: true,
      cultural: false,
      leadership: false
    },
    industryType: 'technology' as const,
    evaluationPeriod: 'quarterly' as const,
    performanceFramework: 'okr' as const,
    includeCompensation: true,
    includeDevelopment: true
  },
  
  healthcare_team_kpi: {
    evaluationType: 'team' as const,
    metricsCategories: {
      productivity: true,
      quality: true,
      collaboration: true,
      cultural: true,
      innovation: false,
      growth: true,
      leadership: false
    },
    industryType: 'healthcare' as const,
    evaluationPeriod: 'monthly' as const,
    performanceFramework: 'kpi' as const,
    includeCompensation: false,
    includeDevelopment: true
  },
  
  finance_360_balanced: {
    evaluationType: '360degree' as const,
    metricsCategories: {
      productivity: true,
      quality: true,
      collaboration: true,
      leadership: true,
      innovation: true,
      growth: true,
      cultural: true
    },
    industryType: 'finance' as const,
    evaluationPeriod: 'annual' as const,
    performanceFramework: 'balanced_scorecard' as const,
    includeCompensation: true,
    includeDevelopment: true
  },
  
  continuous_performance_all: {
    evaluationType: 'continuous' as const,
    metricsCategories: {
      productivity: true,
      quality: true,
      collaboration: true,
      leadership: false,
      innovation: true,
      growth: true,
      cultural: true
    },
    industryType: 'services' as const,
    evaluationPeriod: 'continuous' as const,
    performanceFramework: 'smart_goals' as const,
    includeCompensation: false,
    includeDevelopment: true
  }
};