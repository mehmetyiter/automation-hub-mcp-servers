import { CodeGenerationDatabase } from '../database/code-generation-db';
import { AIService } from '../../ai-service';
import { DynamicCodeGenerator } from '../dynamic-code-generator';
import { RealTimeQualityAssessor } from '../quality/real-time-quality-assessor';
import { AdvancedPerformanceMetrics } from '../performance/advanced-metrics';
import * as crypto from 'crypto';
import { 
  VersioningError,
  ValidationError 
} from '../errors/custom-errors';

// Internal types for performance metrics
interface PerformanceMetricsData {
  performance: {
    executionTime: {
      avg: number;
      min: number;
      max: number;
    };
    throughput: {
      itemsPerSecond: number;
    };
  };
  memoryProfile: {
    heapUsed: number;
    heapTotal: number;
  };
  codeQuality?: {
    maintainabilityIndex: number;
    cyclomaticComplexity: number;
    documentationScore: number;
  };
  security?: {
    vulnerabilities: Array<{
      severity: 'critical' | 'high' | 'medium' | 'low';
      type: string;
    }>;
  };
}

export interface CodeVersion {
  id: string;
  codeId: string;
  version: number;
  code: string;
  metadata: VersionMetadata;
  qualityScore: number;
  performanceScore: number;
  createdAt: Date;
  createdBy: string;
  tags: string[];
  parentVersion?: string;
  isActive: boolean;
  deploymentStatus: DeploymentStatus;
}

export interface VersionMetadata {
  description: string;
  changeType: 'major' | 'minor' | 'patch' | 'rollback';
  changes: string[];
  context: Record<string, unknown>;
  request: Record<string, unknown>;
  improvements: string[];
  regressions: string[];
}

export interface DeploymentStatus {
  deployed: boolean;
  environment?: string;
  deployedAt?: Date;
  performanceMetrics?: Record<string, unknown>;
  issues?: string[];
}

export interface VersionComparison {
  versionA: CodeVersion;
  versionB: CodeVersion;
  codeDiff: CodeDiff;
  qualityDiff: QualityDiff;
  performanceDiff: PerformanceDiff;
  recommendation: VersionRecommendation;
}

export interface CodeDiff {
  additions: number;
  deletions: number;
  modifications: number;
  changes: DiffChange[];
}

export interface DiffChange {
  type: 'add' | 'delete' | 'modify';
  location: string;
  before?: string;
  after?: string;
  impact: 'low' | 'medium' | 'high';
}

export interface QualityDiff {
  overallChange: number;
  improvements: string[];
  regressions: string[];
  metrics: {
    readability: number;
    maintainability: number;
    security: number;
    testability: number;
  };
}

export interface PerformanceDiff {
  executionTimeChange: number;
  throughputChange: number;
  memoryUsageChange: number;
  improvements: string[];
  regressions: string[];
}

export interface VersionRecommendation {
  recommendedVersion: string;
  reason: string;
  confidence: number;
  risks: string[];
  benefits: string[];
}

export interface RollbackRequest {
  codeId: string;
  targetVersion: string;
  reason: string;
  skipValidation?: boolean;
}

export interface RollbackResult {
  success: boolean;
  newVersion: CodeVersion;
  validationResults?: Record<string, unknown>;
  warnings?: string[];
  performanceComparison?: PerformanceDiff;
}

export class CodeVersionManager {
  private database: CodeGenerationDatabase;
  private aiService: AIService;
  private qualityAssessor: RealTimeQualityAssessor;
  private performanceMetrics: AdvancedPerformanceMetrics;
  private versionCache: Map<string, CodeVersion[]>;

  constructor(provider?: string) {
    this.database = new CodeGenerationDatabase();
    this.aiService = new AIService(provider);
    this.qualityAssessor = new RealTimeQualityAssessor(provider);
    this.performanceMetrics = new AdvancedPerformanceMetrics(provider);
    this.versionCache = new Map();
  }

  async createVersion(
    codeId: string,
    code: string,
    metadata: VersionMetadata,
    createdBy: string = 'system'
  ): Promise<CodeVersion> {
    console.log('📝 Creating new code version...');
    
    // Get existing versions
    const existingVersions = await this.getVersionHistory(codeId);
    const versionNumber = existingVersions.length + 1;
    
    // Assess quality and performance
    const [qualityAssessment, performanceMetrics] = await Promise.all([
      this.qualityAssessor.assessCodeQuality(code, { intent: metadata.context }),
      this.performanceMetrics.collectDetailedMetrics(
        `${codeId}_v${versionNumber}`,
        code,
        metadata.context
      )
    ]);
    
    const version: CodeVersion = {
      id: this.generateVersionId(codeId, versionNumber),
      codeId,
      version: versionNumber,
      code,
      metadata,
      qualityScore: qualityAssessment.overallScore,
      performanceScore: this.calculatePerformanceScore(performanceMetrics),
      createdAt: new Date(),
      createdBy,
      tags: this.generateTags(metadata),
      parentVersion: existingVersions.length > 0 
        ? existingVersions[existingVersions.length - 1].id 
        : undefined,
      isActive: true,
      deploymentStatus: {
        deployed: false
      }
    };
    
    // Save to database
    await this.saveVersion(version);
    
    // Update cache
    this.updateCache(codeId, version);
    
    // Deactivate previous versions if this is not a rollback
    if (metadata.changeType !== 'rollback') {
      await this.deactivatePreviousVersions(codeId, version.id);
    }
    
    console.log(`✅ Created version ${versionNumber} for code ${codeId}`);
    return version;
  }

  async getVersionHistory(codeId: string): Promise<CodeVersion[]> {
    // Check cache first
    if (this.versionCache.has(codeId)) {
      return this.versionCache.get(codeId)!;
    }
    
    // Load from database
    const versions = await this.loadVersionsFromDatabase(codeId);
    
    // Update cache
    this.versionCache.set(codeId, versions);
    
    return versions;
  }

  async getActiveVersion(codeId: string): Promise<CodeVersion | null> {
    const versions = await this.getVersionHistory(codeId);
    return versions.find(v => v.isActive) || null;
  }

  async compareVersions(
    codeId: string,
    versionAId: string,
    versionBId: string
  ): Promise<VersionComparison> {
    console.log(`📊 Comparing versions ${versionAId} and ${versionBId}`);
    
    const versions = await this.getVersionHistory(codeId);
    const versionA = versions.find(v => v.id === versionAId);
    const versionB = versions.find(v => v.id === versionBId);
    
    if (!versionA) {
      throw new VersioningError(
        `Version ${versionAId} not found`,
        codeId,
        'compareVersions'
      );
    }
    
    if (!versionB) {
      throw new VersioningError(
        `Version ${versionBId} not found`,
        codeId,
        'compareVersions'
      );
    }
    
    // Perform comparisons in parallel
    const [codeDiff, qualityDiff, performanceDiff] = await Promise.all([
      this.compareCode(versionA.code, versionB.code),
      this.compareQuality(versionA, versionB),
      this.comparePerformance(versionA, versionB)
    ]);
    
    // Generate recommendation
    const recommendation = await this.generateRecommendation(
      versionA,
      versionB,
      qualityDiff,
      performanceDiff
    );
    
    return {
      versionA,
      versionB,
      codeDiff,
      qualityDiff,
      performanceDiff,
      recommendation
    };
  }

  async rollback(request: RollbackRequest): Promise<RollbackResult> {
    console.log(`🔄 Rolling back code ${request.codeId} to version ${request.targetVersion}`);
    
    const versions = await this.getVersionHistory(request.codeId);
    const targetVersion = versions.find(v => v.id === request.targetVersion);
    
    if (!targetVersion) {
      throw new VersioningError(
        `Target version ${request.targetVersion} not found`,
        request.codeId,
        'rollback'
      );
    }
    
    const currentVersion = versions.find(v => v.isActive);
    if (!currentVersion) {
      throw new VersioningError(
        'No active version found',
        request.codeId,
        'rollback'
      );
    }
    
    // Create rollback metadata
    const rollbackMetadata: VersionMetadata = {
      description: `Rollback from v${currentVersion.version} to v${targetVersion.version}`,
      changeType: 'rollback',
      changes: [`Rolled back due to: ${request.reason}`],
      context: targetVersion.metadata.context,
      request: targetVersion.metadata.request,
      improvements: [],
      regressions: []
    };
    
    // Create new version with rollback code
    const newVersion = await this.createVersion(
      request.codeId,
      targetVersion.code,
      rollbackMetadata,
      'rollback_system'
    );
    
    // Perform validation if not skipped
    let validationResults;
    if (!request.skipValidation) {
      validationResults = await this.validateRollback(
        currentVersion,
        targetVersion,
        newVersion
      );
    }
    
    // Compare performance
    const performanceComparison = await this.comparePerformance(
      currentVersion,
      newVersion
    );
    
    const result: RollbackResult = {
      success: true,
      newVersion,
      validationResults,
      warnings: this.generateRollbackWarnings(
        currentVersion,
        targetVersion,
        performanceComparison
      ),
      performanceComparison
    };
    
    // Log rollback event
    await this.logRollbackEvent(request, result);
    
    return result;
  }

  async autoSelectBestVersion(codeId: string): Promise<CodeVersion> {
    console.log('🤖 Auto-selecting best version...');
    
    const versions = await this.getVersionHistory(codeId);
    
    if (versions.length === 0) {
      throw new Error('No versions available');
    }
    
    // Score each version
    const scoredVersions = await Promise.all(
      versions.map(async (version) => {
        const score = await this.calculateVersionScore(version);
        return { version, score };
      })
    );
    
    // Sort by score and return best
    scoredVersions.sort((a, b) => b.score - a.score);
    
    const bestVersion = scoredVersions[0].version;
    console.log(`✨ Best version selected: v${bestVersion.version} (score: ${scoredVersions[0].score})`);
    
    return bestVersion;
  }

  async tagVersion(
    codeId: string,
    versionId: string,
    tags: string[]
  ): Promise<void> {
    const versions = await this.getVersionHistory(codeId);
    const version = versions.find(v => v.id === versionId);
    
    if (!version) {
      throw new Error('Version not found');
    }
    
    // Add tags
    version.tags = [...new Set([...version.tags, ...tags])];
    
    // Update in database
    await this.updateVersion(version);
    
    // Update cache
    this.updateCache(codeId, version);
  }

  async deployVersion(
    codeId: string,
    versionId: string,
    environment: string
  ): Promise<void> {
    const versions = await this.getVersionHistory(codeId);
    const version = versions.find(v => v.id === versionId);
    
    if (!version) {
      throw new Error('Version not found');
    }
    
    // Update deployment status
    version.deploymentStatus = {
      deployed: true,
      environment,
      deployedAt: new Date()
    };
    
    // Update in database
    await this.updateVersion(version);
    
    // Update cache
    this.updateCache(codeId, version);
    
    console.log(`🚀 Deployed version ${version.version} to ${environment}`);
  }

  private async compareCode(codeA: string, codeB: string): Promise<CodeDiff> {
    const prompt = `
Compare these two code versions and identify differences:

Version A:
${codeA}

Version B:
${codeB}

Analyze the differences and provide:
{
  "additions": <number of lines added>,
  "deletions": <number of lines deleted>,
  "modifications": <number of lines modified>,
  "changes": [
    {
      "type": "add|delete|modify",
      "location": "function/section name",
      "before": "code before change (if applicable)",
      "after": "code after change (if applicable)",
      "impact": "low|medium|high"
    }
  ]
}`;

    try {
      const response = await this.aiService.getJSONResponse(prompt);
      return response as CodeDiff;
    } catch (error) {
      return this.performBasicDiff(codeA, codeB);
    }
  }

  private performBasicDiff(codeA: string, codeB: string): CodeDiff {
    const linesA = codeA.split('\n');
    const linesB = codeB.split('\n');
    
    const additions = Math.max(0, linesB.length - linesA.length);
    const deletions = Math.max(0, linesA.length - linesB.length);
    
    return {
      additions,
      deletions,
      modifications: Math.abs(linesA.length - linesB.length),
      changes: []
    };
  }

  private async compareQuality(
    versionA: CodeVersion,
    versionB: CodeVersion
  ): Promise<QualityDiff> {
    const qualityA = await this.qualityAssessor.assessCodeQuality(
      versionA.code,
      { intent: versionA.metadata.context }
    );
    
    const qualityB = await this.qualityAssessor.assessCodeQuality(
      versionB.code,
      { intent: versionB.metadata.context }
    );
    
    const overallChange = qualityB.overallScore - qualityA.overallScore;
    
    return {
      overallChange,
      improvements: qualityB.strengths.filter(s => !qualityA.strengths.includes(s)),
      regressions: qualityB.weaknesses.filter(w => !qualityA.weaknesses.includes(w)),
      metrics: {
        readability: qualityB.breakdown.readability.score - qualityA.breakdown.readability.score,
        maintainability: qualityB.breakdown.maintainability.score - qualityA.breakdown.maintainability.score,
        security: qualityB.breakdown.security.score - qualityA.breakdown.security.score,
        testability: qualityB.breakdown.testability.score - qualityA.breakdown.testability.score
      }
    };
  }

  private async comparePerformance(
    versionA: CodeVersion,
    versionB: CodeVersion
  ): Promise<PerformanceDiff> {
    const perfA = await this.performanceMetrics.collectDetailedMetrics(
      versionA.id,
      versionA.code,
      versionA.metadata.context
    );
    
    const perfB = await this.performanceMetrics.collectDetailedMetrics(
      versionB.id,
      versionB.code,
      versionB.metadata.context
    );
    
    return {
      executionTimeChange: perfB.performance.executionTime.avg - perfA.performance.executionTime.avg,
      throughputChange: perfB.performance.throughput.itemsPerSecond - perfA.performance.throughput.itemsPerSecond,
      memoryUsageChange: perfB.memoryProfile.heapUsed - perfA.memoryProfile.heapUsed,
      improvements: this.identifyPerformanceImprovements(perfA, perfB),
      regressions: this.identifyPerformanceRegressions(perfA, perfB)
    };
  }

  private identifyPerformanceImprovements(perfA: PerformanceMetricsData, perfB: PerformanceMetricsData): string[] {
    const improvements: string[] = [];
    
    if (perfB.performance.executionTime.avg < perfA.performance.executionTime.avg) {
      improvements.push(`Execution time improved by ${Math.round((perfA.performance.executionTime.avg - perfB.performance.executionTime.avg) / perfA.performance.executionTime.avg * 100)}%`);
    }
    
    if (perfB.performance.throughput.itemsPerSecond > perfA.performance.throughput.itemsPerSecond) {
      improvements.push(`Throughput increased by ${Math.round((perfB.performance.throughput.itemsPerSecond - perfA.performance.throughput.itemsPerSecond) / perfA.performance.throughput.itemsPerSecond * 100)}%`);
    }
    
    if (perfB.memoryProfile.heapUsed < perfA.memoryProfile.heapUsed) {
      improvements.push(`Memory usage reduced by ${Math.round((perfA.memoryProfile.heapUsed - perfB.memoryProfile.heapUsed) / 1024 / 1024)}MB`);
    }
    
    return improvements;
  }

  private identifyPerformanceRegressions(perfA: PerformanceMetricsData, perfB: PerformanceMetricsData): string[] {
    const regressions: string[] = [];
    
    if (perfB.performance.executionTime.avg > perfA.performance.executionTime.avg * 1.2) {
      regressions.push(`Execution time increased by ${Math.round((perfB.performance.executionTime.avg - perfA.performance.executionTime.avg) / perfA.performance.executionTime.avg * 100)}%`);
    }
    
    if (perfB.performance.throughput.itemsPerSecond < perfA.performance.throughput.itemsPerSecond * 0.8) {
      regressions.push(`Throughput decreased by ${Math.round((perfA.performance.throughput.itemsPerSecond - perfB.performance.throughput.itemsPerSecond) / perfA.performance.throughput.itemsPerSecond * 100)}%`);
    }
    
    if (perfB.memoryProfile.leaks.length > perfA.memoryProfile.leaks.length) {
      regressions.push(`New memory leaks detected: ${perfB.memoryProfile.leaks.length - perfA.memoryProfile.leaks.length}`);
    }
    
    return regressions;
  }

  private async generateRecommendation(
    versionA: CodeVersion,
    versionB: CodeVersion,
    qualityDiff: QualityDiff,
    performanceDiff: PerformanceDiff
  ): Promise<VersionRecommendation> {
    // Calculate overall improvement score
    const qualityImprovement = qualityDiff.overallChange;
    const performanceImprovement = 
      -performanceDiff.executionTimeChange * 0.3 + 
      performanceDiff.throughputChange * 0.3 - 
      performanceDiff.memoryUsageChange * 0.001;
    
    const totalImprovement = (qualityImprovement + performanceImprovement) / 2;
    
    const recommendedVersion = totalImprovement > 0 ? versionB.id : versionA.id;
    const confidence = Math.abs(totalImprovement) / 100;
    
    return {
      recommendedVersion,
      reason: totalImprovement > 0 
        ? `Version ${versionB.version} shows ${Math.round(totalImprovement)}% overall improvement`
        : `Version ${versionA.version} performs better overall`,
      confidence: Math.min(1, confidence),
      risks: totalImprovement > 0 ? performanceDiff.regressions : qualityDiff.regressions,
      benefits: totalImprovement > 0 ? [...qualityDiff.improvements, ...performanceDiff.improvements] : []
    };
  }

  private async validateRollback(
    currentVersion: CodeVersion,
    targetVersion: CodeVersion,
    newVersion: CodeVersion
  ): Promise<any> {
    // Validate that rollback maintains critical functionality
    const validationPrompt = `
Validate this rollback operation:

Current Version (v${currentVersion.version}):
${currentVersion.code}

Rolling back to (v${targetVersion.version}):
${targetVersion.code}

Check for:
1. Missing critical functionality added after target version
2. Security vulnerabilities that were fixed
3. Performance improvements that will be lost
4. Breaking changes for dependent systems

Provide validation results:
{
  "isValid": true/false,
  "criticalIssues": ["list of critical issues"],
  "warnings": ["list of warnings"],
  "recommendations": ["list of recommendations"]
}`;

    try {
      return await this.aiService.getJSONResponse(validationPrompt);
    } catch (error) {
      return {
        isValid: true,
        criticalIssues: [],
        warnings: ['Automated validation failed, manual review recommended'],
        recommendations: []
      };
    }
  }

  private generateRollbackWarnings(
    currentVersion: CodeVersion,
    targetVersion: CodeVersion,
    performanceComparison: PerformanceDiff
  ): string[] {
    const warnings: string[] = [];
    
    // Version gap warning
    const versionGap = currentVersion.version - targetVersion.version;
    if (versionGap > 5) {
      warnings.push(`Rolling back ${versionGap} versions - significant changes may be lost`);
    }
    
    // Performance warnings
    if (performanceComparison.executionTimeChange > 0) {
      warnings.push('Performance will be degraded after rollback');
    }
    
    // Time-based warning
    const daysSince = Math.floor(
      (currentVersion.createdAt.getTime() - targetVersion.createdAt.getTime()) / 
      (1000 * 60 * 60 * 24)
    );
    if (daysSince > 30) {
      warnings.push(`Target version is ${daysSince} days old`);
    }
    
    return warnings;
  }

  private async calculateVersionScore(version: CodeVersion): Promise<number> {
    // Weighted scoring based on multiple factors
    const weights = {
      quality: 0.3,
      performance: 0.3,
      stability: 0.2,
      recency: 0.1,
      deployment: 0.1
    };
    
    // Quality score (already calculated)
    const qualityScore = version.qualityScore;
    
    // Performance score (already calculated)
    const performanceScore = version.performanceScore;
    
    // Stability score (based on deployment issues)
    const stabilityScore = version.deploymentStatus.issues 
      ? Math.max(0, 100 - version.deploymentStatus.issues.length * 20)
      : 100;
    
    // Recency score (newer versions get slight preference)
    const ageInDays = Math.floor(
      (new Date().getTime() - version.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const recencyScore = Math.max(0, 100 - ageInDays);
    
    // Deployment score
    const deploymentScore = version.deploymentStatus.deployed ? 100 : 50;
    
    // Calculate weighted total
    const totalScore = 
      qualityScore * weights.quality +
      performanceScore * weights.performance +
      stabilityScore * weights.stability +
      recencyScore * weights.recency +
      deploymentScore * weights.deployment;
    
    return Math.round(totalScore);
  }

  private calculatePerformanceScore(metrics: PerformanceMetricsData): number {
    // Convert detailed metrics to 0-100 score
    let score = 100;
    
    // Penalize high execution time
    if (metrics.performance.executionTime.avg > 100) {
      score -= Math.min(30, metrics.performance.executionTime.avg / 10);
    }
    
    // Penalize memory issues
    if (metrics.memoryProfile.leaks.length > 0) {
      score -= metrics.memoryProfile.leaks.length * 10;
    }
    
    // Penalize security issues
    score -= metrics.security.vulnerabilities.filter(v => v.severity === 'critical').length * 20;
    score -= metrics.security.vulnerabilities.filter(v => v.severity === 'high').length * 10;
    
    return Math.max(0, Math.round(score));
  }

  private generateTags(metadata: VersionMetadata): string[] {
    const tags: string[] = [];
    
    // Add change type tag
    tags.push(metadata.changeType);
    
    // Add feature tags based on changes
    metadata.changes.forEach(change => {
      if (change.toLowerCase().includes('performance')) tags.push('performance');
      if (change.toLowerCase().includes('security')) tags.push('security');
      if (change.toLowerCase().includes('bug')) tags.push('bugfix');
      if (change.toLowerCase().includes('feature')) tags.push('feature');
    });
    
    return [...new Set(tags)];
  }

  private generateVersionId(codeId: string, version: number): string {
    return `${codeId}_v${version}_${Date.now()}`;
  }

  private async saveVersion(version: CodeVersion): Promise<void> {
    // This would save to the actual database
    // For now, we'll just log it
    console.log(`💾 Saving version ${version.id} to database`);
  }

  private async updateVersion(version: CodeVersion): Promise<void> {
    // This would update in the actual database
    console.log(`💾 Updating version ${version.id} in database`);
  }

  private async loadVersionsFromDatabase(codeId: string): Promise<CodeVersion[]> {
    // This would load from the actual database
    // For now, return empty array
    return [];
  }

  private updateCache(codeId: string, version: CodeVersion): void {
    const versions = this.versionCache.get(codeId) || [];
    const existingIndex = versions.findIndex(v => v.id === version.id);
    
    if (existingIndex >= 0) {
      versions[existingIndex] = version;
    } else {
      versions.push(version);
    }
    
    this.versionCache.set(codeId, versions);
  }

  private async deactivatePreviousVersions(codeId: string, currentVersionId: string): Promise<void> {
    const versions = await this.getVersionHistory(codeId);
    
    for (const version of versions) {
      if (version.id !== currentVersionId && version.isActive) {
        version.isActive = false;
        await this.updateVersion(version);
      }
    }
  }

  private async logRollbackEvent(request: RollbackRequest, result: RollbackResult): Promise<void> {
    console.log(`📝 Logging rollback event for ${request.codeId}`);
    // This would log to an audit trail
  }

  async generateVersionReport(codeId: string): Promise<string> {
    const versions = await this.getVersionHistory(codeId);
    const activeVersion = versions.find(v => v.isActive);
    
    return `
# Code Version History Report
## Code ID: ${codeId}

### Current Active Version
${activeVersion ? `
- Version: v${activeVersion.version}
- Created: ${activeVersion.createdAt.toISOString()}
- Quality Score: ${activeVersion.qualityScore}/100
- Performance Score: ${activeVersion.performanceScore}/100
- Deployment Status: ${activeVersion.deploymentStatus.deployed ? 'Deployed' : 'Not Deployed'}
` : 'No active version'}

### Version History (${versions.length} total)
${versions.map(v => `
#### Version ${v.version}
- ID: ${v.id}
- Created: ${v.createdAt.toISOString()}
- Created By: ${v.createdBy}
- Change Type: ${v.metadata.changeType}
- Quality Score: ${v.qualityScore}/100
- Performance Score: ${v.performanceScore}/100
- Tags: ${v.tags.join(', ')}
- Status: ${v.isActive ? 'ACTIVE' : 'Inactive'}
${v.deploymentStatus.deployed ? `- Deployed to: ${v.deploymentStatus.environment}` : ''}

Changes:
${v.metadata.changes.map(c => `  - ${c}`).join('\n')}
`).join('\n')}

### Recommendations
${versions.length > 1 ? `
- Latest version quality: ${versions[versions.length - 1].qualityScore}/100
- Best performing version: v${versions.reduce((best, v) => v.performanceScore > best.performanceScore ? v : best).version}
- Most stable version: v${versions.filter(v => v.deploymentStatus.deployed).sort((a, b) => b.qualityScore - a.qualityScore)[0]?.version || 'None deployed'}
` : 'Create more versions to see recommendations'}
`;
  }
}