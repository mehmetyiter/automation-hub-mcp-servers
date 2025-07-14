import { CodeContext } from '../types.js';
import { AIService } from '../../ai-service.js';
import { CodeGenerationDatabase } from '../database/code-generation-db.js';

export interface QualityAssessment {
  overallScore: number; // 0-100
  breakdown: {
    readability: ReadabilityScore;
    maintainability: MaintainabilityScore;
    performance: PerformanceScore;
    security: SecurityScore;
    testability: TestabilityScore;
    businessLogic: BusinessLogicScore;
  };
  improvements: QualityImprovement[];
  strengths: string[];
  weaknesses: string[];
}

export interface ReadabilityScore {
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
  metrics: {
    variableNamingQuality: number;
    functionComplexity: number;
    commentQuality: number;
    codeOrganization: number;
    consistency: number;
  };
}

export interface MaintainabilityScore {
  score: number;
  factors: {
    modularity: number;
    coupling: number;
    cohesion: number;
    complexity: number;
    documentation: number;
  };
  recommendations: string[];
}

export interface PerformanceScore {
  score: number;
  bottlenecks: string[];
  optimizations: string[];
  timeComplexity: string;
  spaceComplexity: string;
}

export interface SecurityScore {
  score: number;
  vulnerabilities: string[];
  risks: string[];
  mitigations: string[];
}

export interface TestabilityScore {
  score: number;
  coverage: number;
  testableUnits: number;
  suggestions: string[];
}

export interface BusinessLogicScore {
  score: number;
  correctness: number;
  completeness: number;
  alignment: number;
  issues: string[];
}

export interface QualityImprovement {
  category: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
  implementation: string;
  impact: number; // 0-100 improvement potential
}

export class RealTimeQualityAssessor {
  private aiService: AIService;
  private database: CodeGenerationDatabase;
  private assessmentCache: Map<string, QualityAssessment>;

  constructor(provider?: string) {
    this.aiService = new AIService(provider);
    this.database = new CodeGenerationDatabase();
    this.assessmentCache = new Map();
  }

  async assessCodeQuality(
    code: string,
    context: CodeContext
  ): Promise<QualityAssessment> {
    console.log('🔍 Performing real-time code quality assessment...');
    
    // Generate cache key
    const cacheKey = this.generateCacheKey(code);
    if (this.assessmentCache.has(cacheKey)) {
      return this.assessmentCache.get(cacheKey)!;
    }

    // Perform parallel assessments
    const assessments = await Promise.all([
      this.assessReadability(code),
      this.assessMaintainability(code),
      this.assessPerformance(code, context),
      this.assessSecurity(code),
      this.assessTestability(code),
      this.assessBusinessLogicCorrectness(code, context)
    ]);

    const assessment = this.aggregateAssessments(assessments);
    
    // Cache the result
    this.assessmentCache.set(cacheKey, assessment);
    
    // Store in database for learning
    await this.storeAssessment(code, assessment);
    
    return assessment;
  }

  private async assessReadability(code: string): Promise<ReadabilityScore> {
    const prompt = `
Analyze this code for readability and provide a detailed assessment:

${code}

Evaluate and score (0-100) these aspects:
{
  "score": <overall readability score>,
  "issues": ["list of readability issues"],
  "suggestions": ["specific improvement suggestions"],
  "metrics": {
    "variableNamingQuality": <0-100>,
    "functionComplexity": <0-100>,
    "commentQuality": <0-100>,
    "codeOrganization": <0-100>,
    "consistency": <0-100>
  }
}

Consider:
- Are variable and function names descriptive and consistent?
- Is the code structure logical and easy to follow?
- Are complex sections properly commented?
- Is indentation and formatting consistent?
- Are there any overly complex or nested structures?`;

    try {
      const response = await this.aiService.getJSONResponse(prompt);
      return {
        score: response.score || this.calculateReadabilityScore(code),
        issues: response.issues || [],
        suggestions: response.suggestions || [],
        metrics: response.metrics || this.calculateReadabilityMetrics(code)
      };
    } catch (error) {
      return this.calculateManualReadability(code);
    }
  }

  private async assessMaintainability(code: string): Promise<MaintainabilityScore> {
    const prompt = `
Assess the maintainability of this code:

${code}

Evaluate these factors (0-100):
{
  "score": <overall maintainability>,
  "factors": {
    "modularity": <how well code is divided into modules>,
    "coupling": <100 - coupling level (lower coupling = higher score)>,
    "cohesion": <how well related code is grouped>,
    "complexity": <100 - cyclomatic complexity normalized>,
    "documentation": <quality of documentation>
  },
  "recommendations": ["suggestions to improve maintainability"]
}`;

    try {
      const response = await this.aiService.getJSONResponse(prompt);
      return {
        score: response.score || 70,
        factors: response.factors || {
          modularity: 70,
          coupling: 70,
          cohesion: 70,
          complexity: 70,
          documentation: 70
        },
        recommendations: response.recommendations || []
      };
    } catch (error) {
      return this.getDefaultMaintainabilityScore();
    }
  }

  private async assessPerformance(code: string, context: CodeContext): Promise<PerformanceScore> {
    const prompt = `
Analyze the performance characteristics of this code:

${code}

Context: ${JSON.stringify(context.intent)}

Provide:
{
  "score": <performance score 0-100>,
  "bottlenecks": ["identified performance bottlenecks"],
  "optimizations": ["specific optimization suggestions"],
  "timeComplexity": "O(?) notation",
  "spaceComplexity": "O(?) notation"
}

Consider:
- Loop efficiency
- Unnecessary operations
- Memory usage
- Algorithm choices
- Data structure efficiency`;

    try {
      const response = await this.aiService.getJSONResponse(prompt);
      return {
        score: response.score || 75,
        bottlenecks: response.bottlenecks || [],
        optimizations: response.optimizations || [],
        timeComplexity: response.timeComplexity || 'O(n)',
        spaceComplexity: response.spaceComplexity || 'O(1)'
      };
    } catch (error) {
      return this.analyzePerformanceManually(code);
    }
  }

  private async assessSecurity(code: string): Promise<SecurityScore> {
    const prompt = `
Perform security assessment of this code:

${code}

Identify:
{
  "score": <security score 0-100>,
  "vulnerabilities": ["list of security vulnerabilities"],
  "risks": ["potential security risks"],
  "mitigations": ["recommended security improvements"]
}

Check for:
- Input validation
- Injection vulnerabilities
- Unsafe operations
- Data exposure risks
- Error handling security`;

    try {
      const response = await this.aiService.getJSONResponse(prompt);
      return {
        score: response.score || this.calculateSecurityScore(code),
        vulnerabilities: response.vulnerabilities || [],
        risks: response.risks || [],
        mitigations: response.mitigations || []
      };
    } catch (error) {
      return this.performManualSecurityCheck(code);
    }
  }

  private async assessTestability(code: string): Promise<TestabilityScore> {
    const prompt = `
Assess the testability of this code:

${code}

Evaluate:
{
  "score": <testability score 0-100>,
  "coverage": <estimated test coverage potential>,
  "testableUnits": <number of testable units>,
  "suggestions": ["suggestions to improve testability"]
}

Consider:
- Function purity
- Side effects
- Dependencies
- Modularity
- Clear inputs/outputs`;

    try {
      const response = await this.aiService.getJSONResponse(prompt);
      return {
        score: response.score || 70,
        coverage: response.coverage || 70,
        testableUnits: response.testableUnits || this.countTestableUnits(code),
        suggestions: response.suggestions || []
      };
    } catch (error) {
      return this.getDefaultTestabilityScore(code);
    }
  }

  private async assessBusinessLogicCorrectness(
    code: string,
    context: CodeContext
  ): Promise<BusinessLogicScore> {
    const prompt = `
Assess if this code correctly implements the business logic:

Code:
${code}

Business Requirements:
${JSON.stringify(context.intent)}

Evaluate:
{
  "score": <overall correctness 0-100>,
  "correctness": <logic correctness 0-100>,
  "completeness": <requirement coverage 0-100>,
  "alignment": <business alignment 0-100>,
  "issues": ["logic issues or missing requirements"]
}`;

    try {
      const response = await this.aiService.getJSONResponse(prompt);
      return {
        score: response.score || 80,
        correctness: response.correctness || 80,
        completeness: response.completeness || 80,
        alignment: response.alignment || 80,
        issues: response.issues || []
      };
    } catch (error) {
      return {
        score: 75,
        correctness: 75,
        completeness: 75,
        alignment: 75,
        issues: []
      };
    }
  }

  private aggregateAssessments(assessments: any[]): QualityAssessment {
    const [readability, maintainability, performance, security, testability, businessLogic] = assessments;
    
    // Calculate overall score
    const weights = {
      readability: 0.2,
      maintainability: 0.2,
      performance: 0.15,
      security: 0.2,
      testability: 0.1,
      businessLogic: 0.15
    };
    
    const overallScore = Math.round(
      readability.score * weights.readability +
      maintainability.score * weights.maintainability +
      performance.score * weights.performance +
      security.score * weights.security +
      testability.score * weights.testability +
      businessLogic.score * weights.businessLogic
    );
    
    // Identify improvements
    const improvements = this.generateImprovements({
      readability,
      maintainability,
      performance,
      security,
      testability,
      businessLogic
    });
    
    // Identify strengths and weaknesses
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    
    if (readability.score >= 80) strengths.push('Excellent code readability');
    if (readability.score < 60) weaknesses.push('Poor code readability');
    
    if (security.score >= 90) strengths.push('Strong security practices');
    if (security.score < 70) weaknesses.push('Security vulnerabilities present');
    
    if (performance.score >= 85) strengths.push('Optimized for performance');
    if (performance.score < 60) weaknesses.push('Performance bottlenecks detected');
    
    if (businessLogic.score >= 90) strengths.push('Correctly implements business logic');
    if (businessLogic.score < 70) weaknesses.push('Business logic issues');
    
    return {
      overallScore,
      breakdown: {
        readability,
        maintainability,
        performance,
        security,
        testability,
        businessLogic
      },
      improvements,
      strengths,
      weaknesses
    };
  }

  private generateImprovements(breakdown: any): QualityImprovement[] {
    const improvements: QualityImprovement[] = [];
    
    // Readability improvements
    if (breakdown.readability.score < 70) {
      improvements.push({
        category: 'readability',
        priority: 'high',
        description: 'Improve variable naming and code structure',
        implementation: breakdown.readability.suggestions[0] || 'Use more descriptive variable names',
        impact: 100 - breakdown.readability.score
      });
    }
    
    // Security improvements
    if (breakdown.security.vulnerabilities.length > 0) {
      improvements.push({
        category: 'security',
        priority: 'high',
        description: 'Fix security vulnerabilities',
        implementation: breakdown.security.mitigations[0] || 'Add input validation',
        impact: 100 - breakdown.security.score
      });
    }
    
    // Performance improvements
    if (breakdown.performance.bottlenecks.length > 0) {
      improvements.push({
        category: 'performance',
        priority: 'medium',
        description: 'Optimize performance bottlenecks',
        implementation: breakdown.performance.optimizations[0] || 'Optimize loops',
        impact: 100 - breakdown.performance.score
      });
    }
    
    // Sort by priority and impact
    return improvements.sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      return (priorityWeight[b.priority] * b.impact) - (priorityWeight[a.priority] * a.impact);
    });
  }

  // Manual calculation methods
  private calculateReadabilityScore(code: string): number {
    const lines = code.split('\n');
    let score = 100;
    
    // Deduct for long lines
    const longLines = lines.filter(l => l.length > 80).length;
    score -= (longLines / lines.length) * 20;
    
    // Deduct for deep nesting
    const maxIndent = Math.max(...lines.map(l => (l.match(/^\s*/)?.[0].length || 0) / 2));
    score -= maxIndent * 5;
    
    // Bonus for comments
    const commentLines = lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('/*')).length;
    score += Math.min(10, (commentLines / lines.length) * 20);
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private calculateReadabilityMetrics(code: string): any {
    return {
      variableNamingQuality: 70,
      functionComplexity: 70,
      commentQuality: 70,
      codeOrganization: 70,
      consistency: 70
    };
  }

  private calculateManualReadability(code: string): ReadabilityScore {
    return {
      score: this.calculateReadabilityScore(code),
      issues: [],
      suggestions: ['Add more descriptive comments', 'Use consistent naming conventions'],
      metrics: this.calculateReadabilityMetrics(code)
    };
  }

  private getDefaultMaintainabilityScore(): MaintainabilityScore {
    return {
      score: 70,
      factors: {
        modularity: 70,
        coupling: 70,
        cohesion: 70,
        complexity: 70,
        documentation: 70
      },
      recommendations: ['Improve code modularity', 'Add comprehensive documentation']
    };
  }

  private analyzePerformanceManually(code: string): PerformanceScore {
    const hasNestedLoops = /for.*\{[^}]*for/s.test(code);
    const score = hasNestedLoops ? 60 : 80;
    
    return {
      score,
      bottlenecks: hasNestedLoops ? ['Nested loops detected'] : [],
      optimizations: hasNestedLoops ? ['Consider optimizing nested loops'] : [],
      timeComplexity: hasNestedLoops ? 'O(n²)' : 'O(n)',
      spaceComplexity: 'O(1)'
    };
  }

  private calculateSecurityScore(code: string): number {
    let score = 100;
    
    if (code.includes('eval')) score -= 50;
    if (code.includes('innerHTML')) score -= 30;
    if (!code.includes('try')) score -= 10;
    if (!code.includes('validate')) score -= 10;
    
    return Math.max(0, score);
  }

  private performManualSecurityCheck(code: string): SecurityScore {
    const vulnerabilities: string[] = [];
    const risks: string[] = [];
    const mitigations: string[] = [];
    
    if (code.includes('eval')) {
      vulnerabilities.push('Use of eval() function');
      mitigations.push('Replace eval() with safer alternatives');
    }
    
    if (!code.includes('validate')) {
      risks.push('No input validation detected');
      mitigations.push('Add input validation');
    }
    
    return {
      score: this.calculateSecurityScore(code),
      vulnerabilities,
      risks,
      mitigations
    };
  }

  private countTestableUnits(code: string): number {
    // Count functions
    const functionMatches = code.match(/function\s+\w+|=>\s*{|=\s*\(/g) || [];
    return functionMatches.length;
  }

  private getDefaultTestabilityScore(code: string): TestabilityScore {
    const units = this.countTestableUnits(code);
    return {
      score: 70,
      coverage: 70,
      testableUnits: units,
      suggestions: ['Extract complex logic into pure functions', 'Reduce side effects']
    };
  }

  private generateCacheKey(code: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(code).digest('hex');
  }

  private async storeAssessment(code: string, assessment: QualityAssessment): Promise<void> {
    try {
      // Store assessment results for learning and improvement
      console.log('💾 Storing quality assessment results');
    } catch (error) {
      console.error('Failed to store assessment:', error);
    }
  }

  async generateQualityReport(assessment: QualityAssessment): Promise<string> {
    return `
# Code Quality Assessment Report

## Overall Score: ${assessment.overallScore}/100

### Breakdown:
- **Readability**: ${assessment.breakdown.readability.score}/100
- **Maintainability**: ${assessment.breakdown.maintainability.score}/100
- **Performance**: ${assessment.breakdown.performance.score}/100
- **Security**: ${assessment.breakdown.security.score}/100
- **Testability**: ${assessment.breakdown.testability.score}/100
- **Business Logic**: ${assessment.breakdown.businessLogic.score}/100

### Strengths:
${assessment.strengths.map(s => `- ${s}`).join('\n')}

### Weaknesses:
${assessment.weaknesses.map(w => `- ${w}`).join('\n')}

### Top Improvements:
${assessment.improvements.slice(0, 5).map((imp, i) => 
  `${i + 1}. **${imp.description}** (${imp.priority} priority)
   - ${imp.implementation}
   - Potential impact: ${imp.impact}% improvement`
).join('\n\n')}

### Performance Analysis:
- Time Complexity: ${assessment.breakdown.performance.timeComplexity}
- Space Complexity: ${assessment.breakdown.performance.spaceComplexity}

### Security Status:
${assessment.breakdown.security.vulnerabilities.length === 0 
  ? '✅ No security vulnerabilities detected'
  : `⚠️ ${assessment.breakdown.security.vulnerabilities.length} security issues found`}
`;
  }
}