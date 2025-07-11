import { AIService } from '../ai-service.js';
import { BusinessLogicImplementation, BusinessDomain } from './business-logic-generator.js';

export interface ComplianceRequirement {
  regulation: string;
  description: string;
  applicableIndustries: string[];
  requirements: string[];
  validationRules: string[];
  penalties: string[];
}

export interface ComplianceValidation {
  isCompliant: boolean;
  violations: ComplianceViolation[];
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ComplianceViolation {
  regulation: string;
  requirement: string;
  violation: string;
  severity: 'minor' | 'major' | 'critical';
  remediation: string;
}

export class RegulatoryComplianceEngine {
  private complianceDatabase: Map<string, ComplianceRequirement[]> = new Map();
  
  constructor(private aiService: AIService) {
    this.initializeComplianceDatabase();
  }
  
  async validateCompliance(
    implementation: BusinessLogicImplementation,
    domain: BusinessDomain
  ): Promise<ComplianceValidation> {
    
    const applicableRegulations = this.getApplicableRegulations(domain.businessDomain.industry);
    const violations: ComplianceViolation[] = [];
    
    for (const regulation of applicableRegulations) {
      const regulationViolations = await this.validateRegulation(implementation, regulation);
      violations.push(...regulationViolations);
    }
    
    const riskLevel = this.calculateRiskLevel(violations);
    const recommendations = this.generateComplianceRecommendations(violations, domain);
    
    return {
      isCompliant: violations.length === 0,
      violations,
      recommendations,
      riskLevel
    };
  }
  
  private initializeComplianceDatabase(): void {
    // Finance regulations
    this.complianceDatabase.set('finance', [
      {
        regulation: 'GDPR',
        description: 'General Data Protection Regulation',
        applicableIndustries: ['finance', 'healthcare', 'technology', 'retail'],
        requirements: [
          'Data minimization principles',
          'Explicit consent for processing',
          'Right to erasure implementation',
          'Data portability support',
          'Privacy by design',
          'Data breach notification procedures'
        ],
        validationRules: [
          'Personal data must be anonymized or pseudonymized',
          'Data retention periods must be defined',
          'Data access controls must be implemented',
          'Audit trails for data processing must exist',
          'User consent must be tracked and revocable'
        ],
        penalties: ['Up to 4% of annual global turnover or €20 million']
      },
      {
        regulation: 'Basel III',
        description: 'International banking regulation standards',
        applicableIndustries: ['banking', 'finance'],
        requirements: [
          'Capital adequacy ratios',
          'Liquidity coverage ratios',
          'Leverage ratios',
          'Risk assessment methodologies',
          'Stress testing requirements',
          'Counter-cyclical buffers'
        ],
        validationRules: [
          'Risk calculations must be transparent',
          'Stress testing must be included',
          'Conservative assumptions for risk parameters',
          'Capital buffers must meet minimum requirements',
          'Liquidity ratios must be monitored daily'
        ],
        penalties: ['Regulatory sanctions', 'License revocation', 'Operating restrictions']
      },
      {
        regulation: 'PSD2',
        description: 'Payment Services Directive 2',
        applicableIndustries: ['banking', 'fintech', 'payments'],
        requirements: [
          'Strong Customer Authentication (SCA)',
          'Open banking API requirements',
          'Transaction monitoring',
          'Fraud prevention measures',
          'Third-party provider access controls'
        ],
        validationRules: [
          'Two-factor authentication for payments',
          'API security standards compliance',
          'Real-time fraud detection',
          'Transaction limits enforcement',
          'Consent management for data sharing'
        ],
        penalties: ['Up to 4% of annual turnover', 'License suspension']
      }
    ]);
    
    // Healthcare regulations
    this.complianceDatabase.set('healthcare', [
      {
        regulation: 'HIPAA',
        description: 'Health Insurance Portability and Accountability Act',
        applicableIndustries: ['healthcare', 'insurance', 'technology'],
        requirements: [
          'Protected Health Information (PHI) safeguards',
          'Access controls and authorization',
          'Audit logging and monitoring',
          'Encryption requirements',
          'Business Associate Agreements',
          'Incident response procedures'
        ],
        validationRules: [
          'PHI must be encrypted at rest and in transit',
          'Access must be role-based and audited',
          'Minimum necessary information principle',
          'Patient consent tracking',
          'Data breach notification within 60 days'
        ],
        penalties: ['$100 to $50,000 per violation', 'Up to $1.5 million annually']
      },
      {
        regulation: 'FDA 21 CFR Part 11',
        description: 'Electronic Records and Electronic Signatures',
        applicableIndustries: ['healthcare', 'pharmaceutical', 'medical devices'],
        requirements: [
          'Electronic signature validation',
          'Audit trail maintenance',
          'System validation documentation',
          'Change control procedures',
          'Data integrity controls'
        ],
        validationRules: [
          'Electronic signatures must be unique',
          'Complete audit trails required',
          'System access controls mandatory',
          'Data cannot be altered without detection',
          'Backup and recovery procedures required'
        ],
        penalties: ['Product recalls', 'FDA warning letters', 'Criminal prosecution']
      }
    ]);
    
    // Technology regulations
    this.complianceDatabase.set('technology', [
      {
        regulation: 'SOC 2',
        description: 'Service Organization Control 2',
        applicableIndustries: ['technology', 'saas', 'cloud services'],
        requirements: [
          'Security controls',
          'Availability monitoring',
          'Processing integrity',
          'Confidentiality measures',
          'Privacy controls'
        ],
        validationRules: [
          'Access controls must be documented',
          'Change management procedures required',
          'Incident response plans mandatory',
          'Regular security assessments',
          'Employee training documentation'
        ],
        penalties: ['Loss of customer trust', 'Contract violations', 'Business impact']
      },
      {
        regulation: 'CCPA',
        description: 'California Consumer Privacy Act',
        applicableIndustries: ['technology', 'retail', 'finance'],
        requirements: [
          'Consumer data rights',
          'Opt-out mechanisms',
          'Data inventory maintenance',
          'Privacy policy requirements',
          'Data sale disclosures'
        ],
        validationRules: [
          'Clear opt-out options required',
          'Data deletion requests honored within 45 days',
          'Privacy notices must be comprehensive',
          'Data sharing agreements documented',
          'Consumer request tracking required'
        ],
        penalties: ['$2,500 per violation', '$7,500 per intentional violation']
      }
    ]);
    
    // Insurance regulations
    this.complianceDatabase.set('insurance', [
      {
        regulation: 'Solvency II',
        description: 'European insurance regulatory framework',
        applicableIndustries: ['insurance', 'reinsurance'],
        requirements: [
          'Capital requirements calculation',
          'Risk management framework',
          'Governance requirements',
          'Reporting obligations',
          'Public disclosure requirements'
        ],
        validationRules: [
          'Solvency Capital Requirement (SCR) calculation',
          'Minimum Capital Requirement (MCR) monitoring',
          'Risk assessment documentation',
          'Quarterly reporting compliance',
          'Stress testing implementation'
        ],
        penalties: ['Regulatory intervention', 'Capital add-ons', 'License restrictions']
      }
    ]);
    
    // Retail regulations
    this.complianceDatabase.set('retail', [
      {
        regulation: 'PCI DSS',
        description: 'Payment Card Industry Data Security Standard',
        applicableIndustries: ['retail', 'ecommerce', 'hospitality'],
        requirements: [
          'Cardholder data protection',
          'Network security controls',
          'Access control measures',
          'Regular security testing',
          'Security policy maintenance'
        ],
        validationRules: [
          'Card data must be encrypted',
          'Network segmentation required',
          'Regular vulnerability scanning',
          'Access logs must be maintained',
          'Annual security assessments required'
        ],
        penalties: ['$5,000 to $100,000 per month', 'Card processing suspension']
      }
    ]);
  }
  
  private getApplicableRegulations(industry: string): ComplianceRequirement[] {
    const regulations: ComplianceRequirement[] = [];
    
    // Get industry-specific regulations
    const industryRegs = this.complianceDatabase.get(industry?.toLowerCase()) || [];
    regulations.push(...industryRegs);
    
    // Add cross-industry regulations
    this.complianceDatabase.forEach((regs, key) => {
      regs.forEach(reg => {
        if (reg.applicableIndustries.includes(industry?.toLowerCase()) && 
            !regulations.some(r => r.regulation === reg.regulation)) {
          regulations.push(reg);
        }
      });
    });
    
    return regulations;
  }
  
  private async validateRegulation(
    implementation: BusinessLogicImplementation,
    regulation: ComplianceRequirement
  ): Promise<ComplianceViolation[]> {
    
    const validationPrompt = `
TASK: Validate business logic implementation against regulatory requirements.

IMPLEMENTATION:
${implementation.implementation}

REGULATION: ${regulation.regulation} - ${regulation.description}
REQUIREMENTS:
${regulation.requirements.map(req => `- ${req}`).join('\n')}

VALIDATION RULES:
${regulation.validationRules.map(rule => `- ${rule}`).join('\n')}

Check implementation for compliance violations and return JSON:

{
  "violations": [
    {
      "regulation": "${regulation.regulation}",
      "requirement": "which requirement is violated",
      "violation": "description of the violation",
      "severity": "minor|major|critical",
      "remediation": "how to fix this violation"
    }
  ]
}

Be specific about violations and provide actionable remediation steps.`;

    const result = await this.aiService.getJSONResponse(validationPrompt);
    return result.violations || [];
  }
  
  private calculateRiskLevel(violations: ComplianceViolation[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalCount = violations.filter(v => v.severity === 'critical').length;
    const majorCount = violations.filter(v => v.severity === 'major').length;
    const minorCount = violations.filter(v => v.severity === 'minor').length;
    
    if (criticalCount > 0) return 'critical';
    if (majorCount > 2 || (majorCount > 0 && minorCount > 5)) return 'high';
    if (majorCount > 0 || minorCount > 3) return 'medium';
    return 'low';
  }
  
  private generateComplianceRecommendations(
    violations: ComplianceViolation[],
    domain: BusinessDomain
  ): string[] {
    const recommendations: string[] = [];
    
    if (violations.length === 0) {
      recommendations.push('✅ Implementation appears compliant with applicable regulations');
      recommendations.push('💡 Consider periodic compliance reviews as regulations evolve');
      return recommendations;
    }
    
    // Group by regulation
    const violationsByRegulation = violations.reduce((acc, violation) => {
      if (!acc[violation.regulation]) {
        acc[violation.regulation] = [];
      }
      acc[violation.regulation].push(violation);
      return acc;
    }, {} as Record<string, ComplianceViolation[]>);
    
    // Generate recommendations by regulation
    Object.entries(violationsByRegulation).forEach(([regulation, regViolations]) => {
      recommendations.push(`\n🚨 ${regulation} Compliance Issues (${regViolations.length} violations):`);
      
      // Prioritize critical violations
      const criticalViolations = regViolations.filter(v => v.severity === 'critical');
      if (criticalViolations.length > 0) {
        recommendations.push('⚠️ CRITICAL violations requiring immediate attention:');
        criticalViolations.forEach(violation => {
          recommendations.push(`  • ${violation.remediation}`);
        });
      }
      
      // Then major violations
      const majorViolations = regViolations.filter(v => v.severity === 'major');
      if (majorViolations.length > 0) {
        recommendations.push('🟠 Major violations to address:');
        majorViolations.forEach(violation => {
          recommendations.push(`  • ${violation.remediation}`);
        });
      }
      
      // Finally minor violations
      const minorViolations = regViolations.filter(v => v.severity === 'minor');
      if (minorViolations.length > 0) {
        recommendations.push('🟡 Minor improvements recommended:');
        minorViolations.forEach(violation => {
          recommendations.push(`  • ${violation.remediation}`);
        });
      }
    });
    
    // Add general recommendations based on industry
    recommendations.push('\n📋 General Compliance Recommendations:');
    switch (domain.businessDomain.industry?.toLowerCase()) {
      case 'finance':
      case 'banking':
        recommendations.push('  • Implement comprehensive audit logging for all financial transactions');
        recommendations.push('  • Ensure real-time monitoring for suspicious activities');
        recommendations.push('  • Maintain detailed documentation for regulatory audits');
        break;
      case 'healthcare':
        recommendations.push('  • Implement role-based access controls for all PHI');
        recommendations.push('  • Ensure end-to-end encryption for patient data');
        recommendations.push('  • Maintain comprehensive audit trails for compliance');
        break;
      case 'technology':
        recommendations.push('  • Implement privacy-by-design principles');
        recommendations.push('  • Ensure transparent data processing practices');
        recommendations.push('  • Maintain up-to-date privacy policies');
        break;
    }
    
    return recommendations;
  }
  
  // Additional compliance checking methods
  
  async generateComplianceReport(
    implementation: BusinessLogicImplementation,
    domain: BusinessDomain
  ): Promise<string> {
    const validation = await this.validateCompliance(implementation, domain);
    
    let report = `# Regulatory Compliance Report\n\n`;
    report += `**Industry**: ${domain.businessDomain.industry}\n`;
    report += `**Date**: ${new Date().toISOString()}\n`;
    report += `**Overall Compliance Status**: ${validation.isCompliant ? '✅ Compliant' : '❌ Non-Compliant'}\n`;
    report += `**Risk Level**: ${validation.riskLevel.toUpperCase()}\n\n`;
    
    if (validation.violations.length > 0) {
      report += `## Violations Summary\n\n`;
      report += `Total Violations: ${validation.violations.length}\n`;
      report += `- Critical: ${validation.violations.filter(v => v.severity === 'critical').length}\n`;
      report += `- Major: ${validation.violations.filter(v => v.severity === 'major').length}\n`;
      report += `- Minor: ${validation.violations.filter(v => v.severity === 'minor').length}\n\n`;
      
      report += `## Detailed Violations\n\n`;
      validation.violations.forEach((violation, index) => {
        report += `### ${index + 1}. ${violation.regulation} - ${violation.requirement}\n`;
        report += `**Severity**: ${violation.severity.toUpperCase()}\n`;
        report += `**Violation**: ${violation.violation}\n`;
        report += `**Remediation**: ${violation.remediation}\n\n`;
      });
    }
    
    report += `## Recommendations\n\n`;
    validation.recommendations.forEach(rec => {
      report += `${rec}\n`;
    });
    
    return report;
  }
  
  getRegulationDetails(regulation: string): ComplianceRequirement | undefined {
    for (const [industry, regulations] of this.complianceDatabase.entries()) {
      const found = regulations.find(reg => reg.regulation === regulation);
      if (found) return found;
    }
    return undefined;
  }
  
  getIndustryRegulations(industry: string): ComplianceRequirement[] {
    return this.getApplicableRegulations(industry);
  }
  
  async suggestComplianceImprovements(
    implementation: BusinessLogicImplementation,
    targetRegulation: string
  ): Promise<string[]> {
    const improvementPrompt = `
TASK: Suggest improvements to make the implementation compliant with ${targetRegulation}.

IMPLEMENTATION:
${implementation.implementation}

Analyze and suggest specific code improvements for ${targetRegulation} compliance.
Return array of actionable improvement suggestions.`;

    const result = await this.aiService.getJSONResponse(improvementPrompt);
    return result.suggestions || [];
  }
}

// Export convenience function
export function createRegulatoryComplianceEngine(aiProvider?: string): RegulatoryComplianceEngine {
  return new RegulatoryComplianceEngine(new AIService(aiProvider));
}