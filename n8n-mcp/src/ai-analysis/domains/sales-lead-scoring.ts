import { 
  DynamicBusinessLogicGenerator,
  BusinessLogicRequest,
  BusinessLogicResult,
  DataStructure,
  Variable
} from '../business-logic-generator.js';

export interface LeadScoringRequest {
  scoreFactors: {
    demographic?: boolean;
    behavioral?: boolean;
    engagement?: boolean;
    firmographic?: boolean;
    intent?: boolean;
  };
  customWeights?: Record<string, number>;
  industrySpecific?: string;
  salesProcess?: 'b2b' | 'b2c' | 'enterprise' | 'smb';
}

export class SalesLeadScoringGenerator {
  private businessLogicGenerator: DynamicBusinessLogicGenerator;
  
  constructor(aiProvider?: string) {
    this.businessLogicGenerator = new DynamicBusinessLogicGenerator(aiProvider);
  }
  
  async generateLeadScoringLogic(request: LeadScoringRequest): Promise<BusinessLogicResult> {
    const dataStructure = this.buildDataStructure(request);
    const businessRequest = this.buildBusinessRequest(request, dataStructure);
    
    // Generate the business logic
    const result = await this.businessLogicGenerator.generateBusinessLogic(businessRequest);
    
    // Add sales-specific enhancements
    result.businessLogic.implementation = this.enhanceWithSalesPatterns(
      result.businessLogic.implementation,
      request
    );
    
    return result;
  }
  
  private buildDataStructure(request: LeadScoringRequest): DataStructure {
    const inputs: Variable[] = [];
    const outputs: Variable[] = [
      {
        name: 'leadScore',
        type: 'number',
        range: '0-100',
        businessMeaning: 'Overall lead quality score'
      },
      {
        name: 'scoreCategory',
        type: 'categorical',
        range: 'cold|warm|hot|qualified',
        businessMeaning: 'Lead temperature category'
      },
      {
        name: 'scoreBreakdown',
        type: 'object',
        businessMeaning: 'Detailed breakdown of scoring components'
      },
      {
        name: 'nextBestAction',
        type: 'string',
        businessMeaning: 'Recommended action for sales team'
      }
    ];
    
    // Demographic factors
    if (request.scoreFactors.demographic) {
      inputs.push(
        {
          name: 'jobTitle',
          type: 'string',
          businessMeaning: 'Contact job title/role'
        },
        {
          name: 'seniorityLevel',
          type: 'categorical',
          range: 'entry|manager|director|vp|c-level',
          businessMeaning: 'Decision-making authority level'
        },
        {
          name: 'department',
          type: 'categorical',
          businessMeaning: 'Department or function'
        }
      );
    }
    
    // Behavioral factors
    if (request.scoreFactors.behavioral) {
      inputs.push(
        {
          name: 'websiteVisits',
          type: 'number',
          range: '0-unlimited',
          businessMeaning: 'Number of website visits'
        },
        {
          name: 'contentDownloads',
          type: 'number',
          range: '0-unlimited',
          businessMeaning: 'Number of content pieces downloaded'
        },
        {
          name: 'pageViewDuration',
          type: 'number',
          range: '0-unlimited',
          businessMeaning: 'Average time spent on website (seconds)'
        }
      );
    }
    
    // Engagement factors
    if (request.scoreFactors.engagement) {
      inputs.push(
        {
          name: 'emailOpens',
          type: 'number',
          range: '0-unlimited',
          businessMeaning: 'Number of marketing emails opened'
        },
        {
          name: 'emailClicks',
          type: 'number',
          range: '0-unlimited',
          businessMeaning: 'Number of email links clicked'
        },
        {
          name: 'formSubmissions',
          type: 'number',
          range: '0-unlimited',
          businessMeaning: 'Number of forms submitted'
        },
        {
          name: 'demoRequests',
          type: 'boolean',
          businessMeaning: 'Has requested a demo'
        }
      );
    }
    
    // Firmographic factors (B2B)
    if (request.scoreFactors.firmographic) {
      inputs.push(
        {
          name: 'companySize',
          type: 'categorical',
          range: '1-10|11-50|51-200|201-500|501-1000|1000+',
          businessMeaning: 'Number of employees'
        },
        {
          name: 'industry',
          type: 'categorical',
          businessMeaning: 'Company industry vertical'
        },
        {
          name: 'annualRevenue',
          type: 'categorical',
          range: '<1M|1-10M|10-50M|50-100M|100M+',
          businessMeaning: 'Company annual revenue'
        }
      );
    }
    
    // Intent factors
    if (request.scoreFactors.intent) {
      inputs.push(
        {
          name: 'searchIntent',
          type: 'boolean',
          businessMeaning: 'Shows buying intent signals'
        },
        {
          name: 'competitorResearch',
          type: 'boolean',
          businessMeaning: 'Has researched competitors'
        },
        {
          name: 'pricingPageVisits',
          type: 'number',
          range: '0-unlimited',
          businessMeaning: 'Number of pricing page visits'
        }
      );
    }
    
    return { inputs, outputs };
  }
  
  private buildBusinessRequest(
    request: LeadScoringRequest,
    dataStructure: DataStructure
  ): BusinessLogicRequest {
    const description = `Generate a sophisticated lead scoring algorithm for ${
      request.salesProcess || 'b2b'
    } sales that evaluates leads based on ${
      Object.entries(request.scoreFactors)
        .filter(([_, enabled]) => enabled)
        .map(([factor]) => factor)
        .join(', ')
    } factors. The scoring should identify high-quality leads, provide actionable insights for sales teams, and adapt to ${
      request.industrySpecific || 'general'
    } industry patterns.`;
    
    return {
      description,
      domain: 'sales',
      context: {
        process: 'lead_scoring',
        salesType: request.salesProcess || 'b2b',
        industry: request.industrySpecific || 'general',
        customWeights: request.customWeights || {},
        scoringFactors: request.scoreFactors
      },
      dataStructure,
      requirements: {
        accuracy: 'high',
        performance: 'realtime',
        scalability: request.salesProcess === 'enterprise' ? 'enterprise' : 'medium'
      },
      examples: this.generateExamples(request)
    };
  }
  
  private generateExamples(request: LeadScoringRequest): any[] {
    const examples = [];
    
    // High-quality lead example
    const highQualityLead: any = {};
    if (request.scoreFactors.demographic) {
      highQualityLead.jobTitle = 'VP of Operations';
      highQualityLead.seniorityLevel = 'vp';
    }
    if (request.scoreFactors.behavioral) {
      highQualityLead.websiteVisits = 15;
      highQualityLead.contentDownloads = 5;
      highQualityLead.pageViewDuration = 180;
    }
    if (request.scoreFactors.engagement) {
      highQualityLead.emailOpens = 8;
      highQualityLead.emailClicks = 4;
      highQualityLead.demoRequests = true;
    }
    
    examples.push({
      input: highQualityLead,
      expectedOutput: {
        leadScore: 85,
        scoreCategory: 'hot',
        nextBestAction: 'Schedule immediate sales call'
      },
      explanation: 'High-level decision maker with strong engagement'
    });
    
    // Low-quality lead example
    const lowQualityLead: any = {};
    if (request.scoreFactors.demographic) {
      lowQualityLead.jobTitle = 'Intern';
      lowQualityLead.seniorityLevel = 'entry';
    }
    if (request.scoreFactors.behavioral) {
      lowQualityLead.websiteVisits = 1;
      lowQualityLead.contentDownloads = 0;
      lowQualityLead.pageViewDuration = 10;
    }
    if (request.scoreFactors.engagement) {
      lowQualityLead.emailOpens = 0;
      lowQualityLead.emailClicks = 0;
      lowQualityLead.demoRequests = false;
    }
    
    examples.push({
      input: lowQualityLead,
      expectedOutput: {
        leadScore: 15,
        scoreCategory: 'cold',
        nextBestAction: 'Add to nurture campaign'
      },
      explanation: 'Low engagement, not decision maker'
    });
    
    return examples;
  }
  
  private enhanceWithSalesPatterns(implementation: string, request: LeadScoringRequest): string {
    // Add sales-specific patterns and best practices
    const enhancements = `
// Sales-specific scoring enhancements
const SALES_PROCESS_WEIGHTS = {
  b2b: { demographic: 0.4, behavioral: 0.3, engagement: 0.2, firmographic: 0.1 },
  b2c: { demographic: 0.2, behavioral: 0.4, engagement: 0.4, firmographic: 0 },
  enterprise: { demographic: 0.3, behavioral: 0.2, engagement: 0.2, firmographic: 0.3 },
  smb: { demographic: 0.3, behavioral: 0.3, engagement: 0.3, firmographic: 0.1 }
};

const BUYING_STAGE_INDICATORS = {
  awareness: ['content_download', 'blog_visit', 'webinar_registration'],
  consideration: ['case_study_view', 'pricing_visit', 'comparison_guide'],
  decision: ['demo_request', 'trial_signup', 'contact_sales']
};

// Predictive lead scoring patterns
function predictBuyingStage(leadData: any): string {
  const indicators = {
    awareness: 0,
    consideration: 0,
    decision: 0
  };
  
  // Analyze lead actions to determine buying stage
  if (leadData.contentDownloads > 0) indicators.awareness += 0.3;
  if (leadData.pricingPageVisits > 0) indicators.consideration += 0.4;
  if (leadData.demoRequests) indicators.decision += 0.5;
  
  // Return the stage with highest score
  return Object.entries(indicators)
    .sort(([,a], [,b]) => b - a)[0][0];
}

// Lead velocity scoring
function calculateLeadVelocity(leadData: any): number {
  // Measure how quickly the lead is progressing
  const recentActivity = leadData.websiteVisits > 5 && leadData.emailOpens > 3;
  const highEngagement = leadData.pageViewDuration > 120;
  
  return (recentActivity ? 1.2 : 1.0) * (highEngagement ? 1.1 : 1.0);
}
`;
    
    // Insert enhancements at the beginning of the implementation
    return enhancements + '\n\n' + implementation;
  }
}

// Convenience function for creating lead scoring generator
export function createLeadScoringGenerator(aiProvider?: string): SalesLeadScoringGenerator {
  return new SalesLeadScoringGenerator(aiProvider);
}

// Pre-configured scoring templates
export const LEAD_SCORING_TEMPLATES = {
  b2b_saas: {
    scoreFactors: {
      demographic: true,
      behavioral: true,
      engagement: true,
      firmographic: true,
      intent: true
    },
    customWeights: {
      jobTitle: 0.25,
      companySize: 0.2,
      engagement: 0.3,
      intent: 0.25
    },
    salesProcess: 'b2b' as const,
    industrySpecific: 'software'
  },
  
  b2c_ecommerce: {
    scoreFactors: {
      demographic: true,
      behavioral: true,
      engagement: true,
      firmographic: false,
      intent: true
    },
    customWeights: {
      purchaseHistory: 0.3,
      browsingBehavior: 0.3,
      engagement: 0.4
    },
    salesProcess: 'b2c' as const,
    industrySpecific: 'retail'
  },
  
  enterprise_sales: {
    scoreFactors: {
      demographic: true,
      behavioral: true,
      engagement: true,
      firmographic: true,
      intent: true
    },
    customWeights: {
      seniorityLevel: 0.3,
      companySize: 0.25,
      budgetAuthority: 0.25,
      timeline: 0.2
    },
    salesProcess: 'enterprise' as const,
    industrySpecific: 'enterprise'
  }
};