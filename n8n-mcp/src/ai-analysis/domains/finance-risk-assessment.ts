import { 
  DynamicBusinessLogicGenerator,
  BusinessLogicRequest,
  BusinessLogicResult,
  DataStructure,
  Variable
} from '../business-logic-generator.js';

export interface RiskAssessmentRequest {
  riskType: 'credit' | 'market' | 'operational' | 'liquidity' | 'compliance' | 'comprehensive';
  assessmentFactors: {
    financial?: boolean;
    behavioral?: boolean;
    environmental?: boolean;
    historical?: boolean;
    predictive?: boolean;
  };
  industryType?: 'banking' | 'insurance' | 'investment' | 'lending' | 'fintech';
  regulatoryFramework?: string[];
  riskAppetite?: 'conservative' | 'moderate' | 'aggressive';
  timeHorizon?: 'short' | 'medium' | 'long';
}

export interface RiskModel {
  baseModel: string;
  adjustmentFactors: string[];
  stressScenarios?: string[];
  regulatoryRequirements: string[];
}

export class FinanceRiskAssessmentGenerator {
  private businessLogicGenerator: DynamicBusinessLogicGenerator;
  private riskModels: Map<string, RiskModel> = new Map();
  
  constructor(aiProvider?: string) {
    this.businessLogicGenerator = new DynamicBusinessLogicGenerator(aiProvider);
    this.initializeRiskModels();
  }
  
  private initializeRiskModels(): void {
    this.riskModels = new Map([
      ['credit', {
        baseModel: 'probability_of_default',
        adjustmentFactors: ['lgd', 'ead', 'maturity'],
        stressScenarios: ['recession', 'market_crash', 'pandemic'],
        regulatoryRequirements: ['basel_iii', 'ifrs9', 'cecl']
      }],
      ['market', {
        baseModel: 'value_at_risk',
        adjustmentFactors: ['volatility', 'correlation', 'liquidity'],
        stressScenarios: ['black_swan', 'flash_crash', 'currency_crisis'],
        regulatoryRequirements: ['basel_iii', 'mifid_ii']
      }],
      ['operational', {
        baseModel: 'loss_distribution',
        adjustmentFactors: ['frequency', 'severity', 'controls'],
        stressScenarios: ['cyber_attack', 'system_failure', 'fraud'],
        regulatoryRequirements: ['basel_iii', 'sox', 'gdpr']
      }]
    ]);
  }
  
  async generateRiskAssessmentLogic(request: RiskAssessmentRequest): Promise<BusinessLogicResult> {
    const dataStructure = this.buildDataStructure(request);
    const businessRequest = this.buildBusinessRequest(request, dataStructure);
    
    // Generate the business logic
    const result = await this.businessLogicGenerator.generateBusinessLogic(businessRequest);
    
    // Add finance-specific risk patterns
    result.businessLogic.implementation = this.enhanceWithRiskPatterns(
      result.businessLogic.implementation,
      request
    );
    
    // Add regulatory compliance checks
    if (request.regulatoryFramework && request.regulatoryFramework.length > 0) {
      result.businessLogic.implementation = this.addRegulatoryCompliance(
        result.businessLogic.implementation,
        request.regulatoryFramework
      );
    }
    
    return result;
  }
  
  private buildDataStructure(request: RiskAssessmentRequest): DataStructure {
    const inputs: Variable[] = [];
    const outputs: Variable[] = [
      {
        name: 'riskScore',
        type: 'number',
        range: '0-100',
        businessMeaning: 'Overall risk score (0=low risk, 100=high risk)'
      },
      {
        name: 'riskCategory',
        type: 'categorical',
        range: 'low|medium|high|critical',
        businessMeaning: 'Risk classification category'
      },
      {
        name: 'riskFactors',
        type: 'object',
        businessMeaning: 'Detailed breakdown of risk factors'
      },
      {
        name: 'mitigationStrategies',
        type: 'array',
        businessMeaning: 'Recommended risk mitigation strategies'
      },
      {
        name: 'confidenceLevel',
        type: 'percentage',
        businessMeaning: 'Confidence in risk assessment'
      },
      {
        name: 'regulatoryCompliance',
        type: 'object',
        businessMeaning: 'Regulatory compliance status and requirements'
      }
    ];
    
    // Financial factors
    if (request.assessmentFactors.financial) {
      if (request.riskType === 'credit') {
        inputs.push(
          {
            name: 'annualIncome',
            type: 'number',
            range: '0-unlimited',
            businessMeaning: 'Annual income in base currency'
          },
          {
            name: 'debtToIncomeRatio',
            type: 'percentage',
            range: '0-100',
            businessMeaning: 'Total debt as percentage of income'
          },
          {
            name: 'creditScore',
            type: 'number',
            range: '300-850',
            businessMeaning: 'Credit bureau score'
          },
          {
            name: 'employmentStatus',
            type: 'categorical',
            range: 'employed|self-employed|unemployed|retired',
            businessMeaning: 'Current employment status'
          },
          {
            name: 'loanAmount',
            type: 'number',
            businessMeaning: 'Requested loan amount'
          },
          {
            name: 'loanPurpose',
            type: 'categorical',
            businessMeaning: 'Purpose of the loan'
          },
          {
            name: 'collateralValue',
            type: 'number',
            businessMeaning: 'Value of collateral if secured'
          }
        );
      } else if (request.riskType === 'market') {
        inputs.push(
          {
            name: 'portfolioValue',
            type: 'number',
            businessMeaning: 'Total portfolio value'
          },
          {
            name: 'assetAllocation',
            type: 'object',
            businessMeaning: 'Distribution across asset classes'
          },
          {
            name: 'historicalVolatility',
            type: 'percentage',
            businessMeaning: 'Historical price volatility'
          },
          {
            name: 'correlation',
            type: 'number',
            range: '-1 to 1',
            businessMeaning: 'Correlation with market indices'
          },
          {
            name: 'leverage',
            type: 'number',
            businessMeaning: 'Leverage ratio'
          }
        );
      }
    }
    
    // Behavioral factors
    if (request.assessmentFactors.behavioral) {
      inputs.push(
        {
          name: 'paymentHistory',
          type: 'object',
          businessMeaning: 'Historical payment behavior'
        },
        {
          name: 'accountAge',
          type: 'number',
          businessMeaning: 'Age of account in months'
        },
        {
          name: 'transactionPatterns',
          type: 'object',
          businessMeaning: 'Transaction behavior patterns'
        },
        {
          name: 'riskTakingBehavior',
          type: 'categorical',
          range: 'conservative|moderate|aggressive',
          businessMeaning: 'Historical risk-taking behavior'
        }
      );
    }
    
    // Environmental factors
    if (request.assessmentFactors.environmental) {
      inputs.push(
        {
          name: 'economicIndicators',
          type: 'object',
          businessMeaning: 'Relevant economic indicators'
        },
        {
          name: 'industryRisk',
          type: 'categorical',
          range: 'low|medium|high',
          businessMeaning: 'Industry-specific risk level'
        },
        {
          name: 'geographicRisk',
          type: 'categorical',
          range: 'low|medium|high',
          businessMeaning: 'Geographic/regional risk factors'
        },
        {
          name: 'regulatoryEnvironment',
          type: 'categorical',
          range: 'stable|changing|volatile',
          businessMeaning: 'Regulatory environment stability'
        }
      );
    }
    
    // Historical factors
    if (request.assessmentFactors.historical) {
      inputs.push(
        {
          name: 'historicalDefaults',
          type: 'number',
          businessMeaning: 'Number of historical defaults'
        },
        {
          name: 'lossHistory',
          type: 'array',
          businessMeaning: 'Historical loss events'
        },
        {
          name: 'performanceHistory',
          type: 'object',
          businessMeaning: 'Historical performance metrics'
        }
      );
    }
    
    // Predictive factors
    if (request.assessmentFactors.predictive) {
      inputs.push(
        {
          name: 'futureIncomeProjection',
          type: 'object',
          businessMeaning: 'Projected future income'
        },
        {
          name: 'marketOutlook',
          type: 'categorical',
          range: 'bullish|neutral|bearish',
          businessMeaning: 'Market outlook projection'
        },
        {
          name: 'stressTestResults',
          type: 'object',
          businessMeaning: 'Results from stress testing'
        }
      );
    }
    
    return { inputs, outputs };
  }
  
  private buildBusinessRequest(
    request: RiskAssessmentRequest,
    dataStructure: DataStructure
  ): BusinessLogicRequest {
    const riskModel = this.riskModels.get(request.riskType) || this.riskModels.get('credit')!;
    
    const description = `Generate a sophisticated ${request.riskType} risk assessment model for ${
      request.industryType || 'financial services'
    } that evaluates risk based on ${
      Object.entries(request.assessmentFactors)
        .filter(([_, enabled]) => enabled)
        .map(([factor]) => factor)
        .join(', ')
    } factors. The model should comply with ${
      request.regulatoryFramework?.join(', ') || 'standard'
    } regulations, support ${
      request.riskAppetite || 'moderate'
    } risk appetite, and provide actionable insights for ${
      request.timeHorizon || 'medium'
    }-term risk management.`;
    
    return {
      description,
      domain: 'finance',
      context: {
        process: 'risk_assessment',
        riskType: request.riskType,
        industry: request.industryType || 'financial_services',
        riskModel: riskModel,
        regulatoryFramework: request.regulatoryFramework || [],
        riskAppetite: request.riskAppetite || 'moderate',
        timeHorizon: request.timeHorizon || 'medium',
        assessmentFactors: request.assessmentFactors
      },
      dataStructure,
      requirements: {
        accuracy: 'critical',
        performance: request.riskType === 'market' ? 'realtime' : 'batch',
        compliance: request.regulatoryFramework || [],
        scalability: 'enterprise'
      },
      examples: this.generateExamples(request)
    };
  }
  
  private generateExamples(request: RiskAssessmentRequest): any[] {
    const examples = [];
    
    if (request.riskType === 'credit') {
      // Low risk credit example
      examples.push({
        input: {
          annualIncome: 150000,
          debtToIncomeRatio: 25,
          creditScore: 780,
          employmentStatus: 'employed',
          loanAmount: 50000,
          collateralValue: 100000,
          paymentHistory: { latePayments: 0, defaults: 0 }
        },
        expectedOutput: {
          riskScore: 15,
          riskCategory: 'low',
          confidenceLevel: 95,
          mitigationStrategies: ['Standard monitoring']
        },
        explanation: 'High income, low DTI, excellent credit'
      });
      
      // High risk credit example
      examples.push({
        input: {
          annualIncome: 40000,
          debtToIncomeRatio: 65,
          creditScore: 580,
          employmentStatus: 'unemployed',
          loanAmount: 30000,
          collateralValue: 0,
          paymentHistory: { latePayments: 5, defaults: 1 }
        },
        expectedOutput: {
          riskScore: 85,
          riskCategory: 'high',
          confidenceLevel: 90,
          mitigationStrategies: ['Require co-signer', 'Higher interest rate', 'Lower loan amount']
        },
        explanation: 'Low income, high DTI, poor credit, unemployed'
      });
    } else if (request.riskType === 'market') {
      // Low risk market example
      examples.push({
        input: {
          portfolioValue: 1000000,
          assetAllocation: { stocks: 40, bonds: 40, cash: 20 },
          historicalVolatility: 10,
          correlation: 0.3,
          leverage: 1.0
        },
        expectedOutput: {
          riskScore: 25,
          riskCategory: 'low',
          confidenceLevel: 85,
          mitigationStrategies: ['Maintain diversification']
        },
        explanation: 'Well-diversified, low volatility, no leverage'
      });
    }
    
    return examples;
  }
  
  private enhanceWithRiskPatterns(implementation: string, request: RiskAssessmentRequest): string {
    const riskTypePatterns: Record<string, string> = {
      credit: `
// Credit Risk Specific Patterns
const CREDIT_RISK_MODELS = {
  pd: calculateProbabilityOfDefault,
  lgd: calculateLossGivenDefault,
  ead: calculateExposureAtDefault
};

function calculateProbabilityOfDefault(creditData: any): number {
  // Merton model approach
  const assetValue = creditData.collateralValue || creditData.annualIncome * 3;
  const debtValue = creditData.loanAmount;
  const volatility = creditData.historicalVolatility || 0.3;
  
  const distanceToDefault = (Math.log(assetValue / debtValue) + 0.5 * volatility * volatility) / volatility;
  const pd = 1 - normalCDF(distanceToDefault);
  
  return Math.min(Math.max(pd, 0.001), 0.999);
}

function calculateLossGivenDefault(creditData: any): number {
  const collateralCoverage = creditData.collateralValue / creditData.loanAmount;
  const recoveryRate = Math.min(collateralCoverage * 0.8, 0.95); // 80% recovery on collateral
  
  return 1 - recoveryRate;
}

function calculateExpectedLoss(pd: number, lgd: number, ead: number): number {
  return pd * lgd * ead;
}

// Credit scoring factors
const CREDIT_SCORE_WEIGHTS = {
  paymentHistory: 0.35,
  creditUtilization: 0.30,
  creditHistory: 0.15,
  creditMix: 0.10,
  newCredit: 0.10
};`,

      market: `
// Market Risk Specific Patterns
const MARKET_RISK_MODELS = {
  var: calculateValueAtRisk,
  cvar: calculateConditionalVaR,
  stress: performStressTesting
};

function calculateValueAtRisk(portfolioData: any, confidenceLevel: number = 0.95): number {
  const portfolioValue = portfolioData.portfolioValue;
  const volatility = portfolioData.historicalVolatility / 100;
  const zScore = getZScore(confidenceLevel);
  
  // Parametric VaR
  const var = portfolioValue * volatility * zScore * Math.sqrt(portfolioData.timeHorizon || 1);
  
  return var;
}

function calculateConditionalVaR(portfolioData: any, var: number): number {
  // Expected Shortfall (CVaR)
  const tailProbability = 1 - (portfolioData.confidenceLevel || 0.95);
  const expectedShortfall = var * (1 + 0.5 * tailProbability);
  
  return expectedShortfall;
}

function performStressTesting(portfolioData: any): any {
  const scenarios = {
    marketCrash: { equityShock: -0.30, bondShock: 0.05 },
    interestRateShock: { equityShock: -0.10, bondShock: -0.15 },
    currencyCrisis: { equityShock: -0.20, bondShock: -0.10 }
  };
  
  const results = {};
  Object.entries(scenarios).forEach(([scenario, shocks]) => {
    const equityLoss = portfolioData.assetAllocation.stocks * shocks.equityShock;
    const bondLoss = portfolioData.assetAllocation.bonds * shocks.bondShock;
    results[scenario] = portfolioData.portfolioValue * (equityLoss + bondLoss);
  });
  
  return results;
}`,

      operational: `
// Operational Risk Specific Patterns
const OPERATIONAL_RISK_MODELS = {
  lda: lossDistributionApproach,
  scorecard: operationalRiskScorecard,
  scenario: scenarioAnalysis
};

function lossDistributionApproach(opRiskData: any): any {
  // Frequency and severity modeling
  const frequency = poissonDistribution(opRiskData.historicalEvents || 2);
  const severity = lognormalDistribution(
    opRiskData.averageLoss || 100000,
    opRiskData.lossVolatility || 0.5
  );
  
  // Monte Carlo simulation for aggregate loss
  const simulations = 10000;
  const losses = [];
  
  for (let i = 0; i < simulations; i++) {
    const numEvents = frequency.sample();
    let totalLoss = 0;
    for (let j = 0; j < numEvents; j++) {
      totalLoss += severity.sample();
    }
    losses.push(totalLoss);
  }
  
  return {
    expectedLoss: average(losses),
    var95: percentile(losses, 0.95),
    var99: percentile(losses, 0.99)
  };
}

function operationalRiskScorecard(opRiskData: any): any {
  const riskCategories = {
    process: assessProcessRisk(opRiskData),
    people: assessPeopleRisk(opRiskData),
    systems: assessSystemRisk(opRiskData),
    external: assessExternalRisk(opRiskData)
  };
  
  const weights = { process: 0.3, people: 0.25, systems: 0.25, external: 0.2 };
  
  const overallScore = Object.entries(riskCategories).reduce(
    (total, [category, score]) => total + score * weights[category],
    0
  );
  
  return { categories: riskCategories, overall: overallScore };
}`
    };
    
    const pattern = riskTypePatterns[request.riskType] || riskTypePatterns.credit;
    
    // Add common risk utilities
    const commonUtilities = `
// Common Risk Assessment Utilities
function normalCDF(x: number): number {
  // Approximation of normal cumulative distribution function
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x) / Math.sqrt(2);
  
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return 0.5 * (1 + sign * y);
}

function getZScore(confidenceLevel: number): number {
  // Inverse normal distribution for common confidence levels
  const zScores = {
    0.90: 1.282,
    0.95: 1.645,
    0.99: 2.326,
    0.995: 2.576
  };
  
  return zScores[confidenceLevel] || 1.645;
}

// Risk categorization
function categorizeRisk(score: number): string {
  if (score <= 25) return 'low';
  if (score <= 50) return 'medium';
  if (score <= 75) return 'high';
  return 'critical';
}

// Risk mitigation strategies
function generateMitigationStrategies(riskScore: number, riskFactors: any): string[] {
  const strategies = [];
  
  if (riskScore > 75) {
    strategies.push('Immediate risk reduction required');
    strategies.push('Enhanced monitoring and controls');
    strategies.push('Senior management approval required');
  } else if (riskScore > 50) {
    strategies.push('Implement additional controls');
    strategies.push('Regular risk review schedule');
    strategies.push('Consider risk transfer options');
  } else if (riskScore > 25) {
    strategies.push('Standard monitoring procedures');
    strategies.push('Periodic risk assessment');
  } else {
    strategies.push('Maintain current controls');
    strategies.push('Annual risk review');
  }
  
  return strategies;
}
`;
    
    return pattern + '\n\n' + commonUtilities + '\n\n' + implementation;
  }
  
  private addRegulatoryCompliance(
    implementation: string, 
    regulatoryFramework: string[]
  ): string {
    const regulatoryChecks = `
// Regulatory Compliance Checks
const REGULATORY_REQUIREMENTS = {
  basel_iii: {
    minCapitalRatio: 0.08,
    liquidityCoverageRatio: 1.0,
    leverageRatio: 0.03
  },
  ifrs9: {
    expectedCreditLoss: true,
    stagingCriteria: ['12month', 'lifetime', 'credit_impaired']
  },
  mifid_ii: {
    transparencyRequired: true,
    bestExecution: true,
    appropriatenessTest: true
  },
  gdpr: {
    dataMinimization: true,
    purposeLimitation: true,
    consent: true
  }
};

function checkRegulatoryCompliance(
  riskData: any, 
  frameworks: string[]
): any {
  const complianceResults = {};
  
  frameworks.forEach(framework => {
    const requirements = REGULATORY_REQUIREMENTS[framework];
    if (requirements) {
      complianceResults[framework] = validateAgainstFramework(riskData, requirements);
    }
  });
  
  return {
    compliant: Object.values(complianceResults).every(r => r.compliant),
    details: complianceResults,
    actions: generateComplianceActions(complianceResults)
  };
}

function validateAgainstFramework(data: any, requirements: any): any {
  // Framework-specific validation logic
  const violations = [];
  const warnings = [];
  
  Object.entries(requirements).forEach(([requirement, threshold]) => {
    // Validate each requirement
    if (!meetsRequirement(data, requirement, threshold)) {
      violations.push({
        requirement,
        expected: threshold,
        actual: data[requirement]
      });
    }
  });
  
  return {
    compliant: violations.length === 0,
    violations,
    warnings
  };
}

// Integrate compliance check into main risk assessment
const regulatoryCompliance = checkRegulatoryCompliance(
  riskData, 
  ${JSON.stringify(regulatoryFramework)}
);
`;
    
    return implementation + '\n\n' + regulatoryChecks;
  }
}

// Convenience function
export function createRiskAssessmentGenerator(aiProvider?: string): FinanceRiskAssessmentGenerator {
  return new FinanceRiskAssessmentGenerator(aiProvider);
}

// Pre-configured risk assessment templates
export const RISK_ASSESSMENT_TEMPLATES = {
  credit_risk_banking: {
    riskType: 'credit' as const,
    assessmentFactors: {
      financial: true,
      behavioral: true,
      environmental: true,
      historical: true,
      predictive: true
    },
    industryType: 'banking' as const,
    regulatoryFramework: ['basel_iii', 'ifrs9'],
    riskAppetite: 'moderate' as const,
    timeHorizon: 'medium' as const
  },
  
  market_risk_trading: {
    riskType: 'market' as const,
    assessmentFactors: {
      financial: true,
      behavioral: true,
      environmental: true,
      historical: true,
      predictive: true
    },
    industryType: 'investment' as const,
    regulatoryFramework: ['basel_iii', 'mifid_ii'],
    riskAppetite: 'aggressive' as const,
    timeHorizon: 'short' as const
  },
  
  operational_risk_insurance: {
    riskType: 'operational' as const,
    assessmentFactors: {
      financial: true,
      behavioral: true,
      environmental: true,
      historical: true,
      predictive: false
    },
    industryType: 'insurance' as const,
    regulatoryFramework: ['solvency_ii', 'gdpr'],
    riskAppetite: 'conservative' as const,
    timeHorizon: 'long' as const
  },
  
  comprehensive_risk_fintech: {
    riskType: 'comprehensive' as const,
    assessmentFactors: {
      financial: true,
      behavioral: true,
      environmental: true,
      historical: true,
      predictive: true
    },
    industryType: 'fintech' as const,
    regulatoryFramework: ['basel_iii', 'gdpr', 'psd2'],
    riskAppetite: 'moderate' as const,
    timeHorizon: 'medium' as const
  }
};