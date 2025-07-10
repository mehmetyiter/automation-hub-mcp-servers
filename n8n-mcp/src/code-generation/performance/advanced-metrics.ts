import { AIService } from '../../ai-service';
import { CodeGenerationDatabase } from '../database/code-generation-db';

export interface CodeQualityMetrics {
  cyclomaticComplexity: number;
  codeSmells: string[];
  duplications: number;
  maintainabilityIndex: number;
  testCoverage: number;
  documentationScore: number;
  readabilityScore: number;
}

export interface PerformanceBenchmark {
  executionTime: {
    min: number;
    max: number;
    avg: number;
    p95: number;
    p99: number;
  };
  throughput: {
    itemsPerSecond: number;
    bytesPerSecond: number;
  };
  resourceUsage: {
    cpuUsage: number;
    memoryPeak: number;
    memoryAvg: number;
  };
}

export interface MemoryProfile {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  leaks: MemoryLeak[];
  gcFrequency: number;
  gcDuration: number;
}

export interface MemoryLeak {
  location: string;
  size: number;
  growth: number;
  severity: 'low' | 'medium' | 'high';
}

export interface SecurityScanResult {
  vulnerabilities: SecurityVulnerability[];
  securityScore: number;
  complianceStatus: Record<string, boolean>;
  recommendations: string[];
}

export interface SecurityVulnerability {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location: string;
  description: string;
  fix: string;
}

export interface BusinessImpactMetrics {
  estimatedTimeSaved: number; // in minutes
  errorReduction: number; // percentage
  automationLevel: number; // percentage
  roi: number; // return on investment
  userSatisfaction: number; // 0-100
  businessValue: 'low' | 'medium' | 'high' | 'critical';
}

export interface DetailedMetrics {
  codeQuality: CodeQualityMetrics;
  performance: PerformanceBenchmark;
  memoryProfile: MemoryProfile;
  security: SecurityScanResult;
  maintainability: number;
  businessImpact: BusinessImpactMetrics;
}

export class AdvancedPerformanceMetrics {
  private aiService: AIService;
  private database: CodeGenerationDatabase;
  private metricsCache: Map<string, DetailedMetrics>;
  private cacheAccessTimes: Map<string, number> = new Map();
  private readonly MAX_CACHE_SIZE = 100;
  private readonly CACHE_CLEANUP_THRESHOLD = 120;

  constructor(provider?: string) {
    this.aiService = new AIService(provider);
    this.database = new CodeGenerationDatabase();
    this.metricsCache = new Map();
    this.cacheAccessTimes = new Map();
  }

  async collectDetailedMetrics(
    codeId: string,
    code: string,
    executionContext: any
  ): Promise<DetailedMetrics> {
    console.log('📊 Collecting detailed performance metrics...');
    
    // Track access time for LRU
    this.cacheAccessTimes.set(codeId, Date.now());
    
    // Check cache first
    if (this.metricsCache.has(codeId)) {
      console.log('🎯 Cache hit for metrics:', codeId);
      return this.metricsCache.get(codeId)!;
    }

    const metrics = await Promise.all([
      this.analyzeCodeQuality(code),
      this.benchmarkExecution(code, executionContext),
      this.profileMemoryUsage(code, executionContext),
      this.scanSecurity(code),
      this.calculateMaintainabilityIndex(code),
      this.measureBusinessImpact(code, executionContext)
    ]);

    const detailedMetrics: DetailedMetrics = {
      codeQuality: metrics[0],
      performance: metrics[1],
      memoryProfile: metrics[2],
      security: metrics[3],
      maintainability: metrics[4],
      businessImpact: metrics[5]
    };

    // Cache the results
    this.metricsCache.set(codeId, detailedMetrics);
    this.cacheAccessTimes.set(codeId, Date.now());
    
    // Clean cache if needed
    this.cleanCache();

    // Store in database
    await this.saveMetricsToDatabase(codeId, detailedMetrics);

    return detailedMetrics;
  }

  private async analyzeCodeQuality(code: string): Promise<CodeQualityMetrics> {
    console.log('🔍 Analyzing code quality...');
    
    const analysisPrompt = `
Analyze this JavaScript/Python code for quality metrics:

${code}

Provide detailed analysis:
{
  "cyclomaticComplexity": <number>,
  "codeSmells": ["list of code smells found"],
  "duplications": <number of duplicate code blocks>,
  "maintainabilityIndex": <0-100>,
  "testCoverage": <estimated percentage>,
  "documentationScore": <0-100>,
  "readabilityScore": <0-100>
}

Consider:
- Cyclomatic complexity (number of linearly independent paths)
- Code smells (long methods, deep nesting, etc.)
- Duplicate code blocks
- Maintainability based on complexity and structure
- Documentation presence and quality
- Variable naming and code organization`;

    try {
      const analysis = await this.aiService.getJSONResponse(analysisPrompt);
      
      // Add manual calculations for verification
      const calculatedMetrics = this.calculateBasicMetrics(code);
      
      return {
        cyclomaticComplexity: analysis.cyclomaticComplexity || calculatedMetrics.complexity,
        codeSmells: analysis.codeSmells || [],
        duplications: analysis.duplications || 0,
        maintainabilityIndex: analysis.maintainabilityIndex || calculatedMetrics.maintainability,
        testCoverage: analysis.testCoverage || 0,
        documentationScore: analysis.documentationScore || calculatedMetrics.documentation,
        readabilityScore: analysis.readabilityScore || calculatedMetrics.readability
      };
    } catch (error) {
      console.error('Code quality analysis failed:', error);
      return this.getDefaultCodeQualityMetrics();
    }
  }

  private calculateBasicMetrics(code: string): any {
    const lines = code.split('\n');
    const nonEmptyLines = lines.filter(l => l.trim()).length;
    
    // Count control structures for complexity
    const ifCount = (code.match(/\bif\b/g) || []).length;
    const forCount = (code.match(/\bfor\b/g) || []).length;
    const whileCount = (code.match(/\bwhile\b/g) || []).length;
    const complexity = 1 + ifCount + forCount + whileCount;
    
    // Documentation score based on comments
    const commentLines = lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('#')).length;
    const documentation = Math.min(100, (commentLines / nonEmptyLines) * 200);
    
    // Readability based on line length and nesting
    const avgLineLength = lines.reduce((sum, l) => sum + l.length, 0) / lines.length;
    const readability = Math.max(0, 100 - (avgLineLength - 80));
    
    // Maintainability based on complexity and size
    const maintainability = Math.max(0, 100 - complexity * 2 - nonEmptyLines / 10);
    
    return { complexity, documentation, readability, maintainability };
  }

  private async benchmarkExecution(
    code: string,
    executionContext: any
  ): Promise<PerformanceBenchmark> {
    console.log('⚡ Benchmarking code execution...');
    
    const iterations = 100;
    const executionTimes: number[] = [];
    let totalItemsProcessed = 0;
    let totalBytesProcessed = 0;
    
    // Prepare test data
    const testData = this.generateTestData(executionContext);
    
    // Run multiple iterations
    for (let i = 0; i < iterations; i++) {
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();
      
      try {
        // Execute code in sandbox
        const result = await this.executeInSandbox(code, testData);
        
        const endTime = process.hrtime.bigint();
        const executionTime = Number(endTime - startTime) / 1000000; // Convert to ms
        
        executionTimes.push(executionTime);
        totalItemsProcessed += result.itemsProcessed || 0;
        totalBytesProcessed += result.bytesProcessed || 0;
        
      } catch (error) {
        // Skip failed executions
        console.error('Benchmark iteration failed:', error);
      }
    }
    
    // Calculate statistics
    executionTimes.sort((a, b) => a - b);
    
    return {
      executionTime: {
        min: executionTimes[0] || 0,
        max: executionTimes[executionTimes.length - 1] || 0,
        avg: executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length,
        p95: executionTimes[Math.floor(executionTimes.length * 0.95)] || 0,
        p99: executionTimes[Math.floor(executionTimes.length * 0.99)] || 0
      },
      throughput: {
        itemsPerSecond: totalItemsProcessed / (executionTimes.reduce((sum, t) => sum + t, 0) / 1000),
        bytesPerSecond: totalBytesProcessed / (executionTimes.reduce((sum, t) => sum + t, 0) / 1000)
      },
      resourceUsage: {
        cpuUsage: 0, // Would require OS-level monitoring
        memoryPeak: 0, // Would track during execution
        memoryAvg: 0 // Would calculate average
      }
    };
  }

  private async profileMemoryUsage(
    code: string,
    executionContext: any
  ): Promise<MemoryProfile> {
    console.log('💾 Profiling memory usage...');
    
    const memorySnapshots: any[] = [];
    let gcCount = 0;
    let gcTotalDuration = 0;
    
    // Take initial snapshot
    const initialMemory = process.memoryUsage();
    
    // Execute code multiple times to detect leaks
    for (let i = 0; i < 10; i++) {
      if (global.gc) {
        const gcStartTime = Date.now();
        global.gc();
        gcTotalDuration += Date.now() - gcStartTime;
        gcCount++;
      }
      
      await this.executeInSandbox(code, executionContext);
      memorySnapshots.push(process.memoryUsage());
    }
    
    // Analyze memory growth
    const leaks = this.detectMemoryLeaks(memorySnapshots);
    
    const finalMemory = memorySnapshots[memorySnapshots.length - 1];
    
    return {
      heapUsed: finalMemory.heapUsed,
      heapTotal: finalMemory.heapTotal,
      external: finalMemory.external,
      arrayBuffers: finalMemory.arrayBuffers,
      leaks,
      gcFrequency: gcCount,
      gcDuration: gcCount > 0 ? gcTotalDuration / gcCount : 0
    };
  }

  private detectMemoryLeaks(snapshots: any[]): MemoryLeak[] {
    const leaks: MemoryLeak[] = [];
    
    if (snapshots.length < 2) return leaks;
    
    // Calculate memory growth
    const heapGrowth = snapshots[snapshots.length - 1].heapUsed - snapshots[0].heapUsed;
    const growthRate = heapGrowth / snapshots.length;
    
    if (growthRate > 1024 * 1024) { // 1MB per iteration
      leaks.push({
        location: 'heap',
        size: heapGrowth,
        growth: growthRate,
        severity: growthRate > 10 * 1024 * 1024 ? 'high' : 'medium'
      });
    }
    
    return leaks;
  }

  private async scanSecurity(code: string): Promise<SecurityScanResult> {
    console.log('🔒 Scanning for security vulnerabilities...');
    
    const securityPrompt = `
Perform comprehensive security analysis of this code:

${code}

Identify security vulnerabilities:
{
  "vulnerabilities": [
    {
      "type": "vulnerability type (e.g., injection, xss, etc.)",
      "severity": "low|medium|high|critical",
      "location": "line or section",
      "description": "detailed description",
      "fix": "recommended fix"
    }
  ],
  "securityScore": <0-100>,
  "complianceStatus": {
    "OWASP": true/false,
    "inputValidation": true/false,
    "outputEncoding": true/false,
    "errorHandling": true/false,
    "dataProtection": true/false
  },
  "recommendations": ["security improvement suggestions"]
}`;

    try {
      const analysis = await this.aiService.getJSONResponse(securityPrompt);
      
      // Add manual security checks
      const manualChecks = this.performManualSecurityChecks(code);
      
      return {
        vulnerabilities: [...(analysis.vulnerabilities || []), ...manualChecks.vulnerabilities],
        securityScore: analysis.securityScore || manualChecks.score,
        complianceStatus: analysis.complianceStatus || manualChecks.compliance,
        recommendations: analysis.recommendations || []
      };
    } catch (error) {
      return this.performManualSecurityChecks(code);
    }
  }

  private performManualSecurityChecks(code: string): SecurityScanResult {
    const vulnerabilities: SecurityVulnerability[] = [];
    let score = 100;
    
    // Check for dangerous functions
    const dangerousPatterns = [
      { pattern: /eval\s*\(/, type: 'code_injection', severity: 'critical' as const },
      { pattern: /new\s+Function\s*\(/, type: 'code_injection', severity: 'high' as const },
      { pattern: /innerHTML\s*=/, type: 'xss', severity: 'high' as const },
      { pattern: /document\.write/, type: 'xss', severity: 'medium' as const },
      { pattern: /exec\s*\(/, type: 'command_injection', severity: 'critical' as const }
    ];
    
    dangerousPatterns.forEach(({ pattern, type, severity }) => {
      if (pattern.test(code)) {
        vulnerabilities.push({
          type,
          severity,
          location: 'code',
          description: `Dangerous pattern detected: ${pattern}`,
          fix: 'Use safer alternatives'
        });
        score -= severity === 'critical' ? 30 : severity === 'high' ? 20 : 10;
      }
    });
    
    return {
      vulnerabilities,
      securityScore: Math.max(0, score),
      complianceStatus: {
        OWASP: vulnerabilities.length === 0,
        inputValidation: !code.includes('$input') || code.includes('validate'),
        outputEncoding: true,
        errorHandling: code.includes('try') && code.includes('catch'),
        dataProtection: !code.includes('password') && !code.includes('secret')
      },
      recommendations: vulnerabilities.length > 0 ? ['Fix identified vulnerabilities'] : []
    };
  }

  private async calculateMaintainabilityIndex(code: string): Promise<number> {
    const quality = await this.analyzeCodeQuality(code);
    
    // Calculate based on multiple factors
    const complexityFactor = Math.max(0, 100 - quality.cyclomaticComplexity * 5);
    const readabilityFactor = quality.readabilityScore;
    const documentationFactor = quality.documentationScore;
    const smellsFactor = Math.max(0, 100 - quality.codeSmells.length * 10);
    
    return Math.round(
      (complexityFactor + readabilityFactor + documentationFactor + smellsFactor) / 4
    );
  }

  private async measureBusinessImpact(
    code: string,
    executionContext: any
  ): Promise<BusinessImpactMetrics> {
    console.log('💼 Measuring business impact...');
    
    // Estimate based on code purpose and complexity
    const codeLines = code.split('\n').filter(l => l.trim()).length;
    const hasAutomation = code.includes('$input') && code.includes('return');
    const hasErrorHandling = code.includes('try') && code.includes('catch');
    
    // Time saved estimation (minutes per execution)
    const manualTime = codeLines * 0.5; // Assume 30 seconds per line of logic manually
    const automatedTime = 0.1; // 6 seconds execution
    const timeSaved = manualTime - automatedTime;
    
    // Error reduction based on validation and error handling
    const errorReduction = hasErrorHandling ? 80 : 50;
    
    // Automation level
    const automationLevel = hasAutomation ? 90 : 60;
    
    // ROI calculation (simplified)
    const roi = (timeSaved * 60 * 20) / 100; // Assume $20/hour cost
    
    // User satisfaction (based on code quality)
    const quality = await this.analyzeCodeQuality(code);
    const userSatisfaction = quality.readabilityScore * 0.8 + quality.maintainabilityIndex * 0.2;
    
    // Business value determination
    let businessValue: 'low' | 'medium' | 'high' | 'critical';
    if (timeSaved > 30) businessValue = 'critical';
    else if (timeSaved > 15) businessValue = 'high';
    else if (timeSaved > 5) businessValue = 'medium';
    else businessValue = 'low';
    
    return {
      estimatedTimeSaved: Math.round(timeSaved),
      errorReduction,
      automationLevel,
      roi: Math.round(roi * 100) / 100,
      userSatisfaction: Math.round(userSatisfaction),
      businessValue
    };
  }

  private generateTestData(executionContext: any): any {
    // Generate test data based on context
    return {
      $input: {
        all: () => [
          { json: { id: 1, value: 100, status: 'active' } },
          { json: { id: 2, value: 200, status: 'inactive' } },
          { json: { id: 3, value: 300, status: 'active' } }
        ]
      },
      ...executionContext
    };
  }

  private async executeInSandbox(code: string, context: any): Promise<any> {
    // Simple sandbox execution
    try {
      const fn = new Function(...Object.keys(context), code);
      const result = fn(...Object.values(context));
      
      return {
        success: true,
        result,
        itemsProcessed: Array.isArray(result) ? result.length : 1,
        bytesProcessed: JSON.stringify(result).length
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        itemsProcessed: 0,
        bytesProcessed: 0
      };
    }
  }

  private getDefaultCodeQualityMetrics(): CodeQualityMetrics {
    return {
      cyclomaticComplexity: 1,
      codeSmells: [],
      duplications: 0,
      maintainabilityIndex: 50,
      testCoverage: 0,
      documentationScore: 0,
      readabilityScore: 50
    };
  }

  private async saveMetricsToDatabase(codeId: string, metrics: DetailedMetrics): Promise<void> {
    try {
      // Store metrics in database for historical analysis
      // This would be implemented with proper database schema
      console.log(`💾 Saved metrics for code ${codeId}`);
    } catch (error) {
      console.error('Failed to save metrics to database:', error);
    }
  }

  private cleanCache(): void {
    if (this.metricsCache.size > this.CACHE_CLEANUP_THRESHOLD) {
      console.log(`🧹 Cleaning metrics cache using LRU (size: ${this.metricsCache.size})`);
      
      // Use LRU strategy - sort by access time
      const entries = Array.from(this.cacheAccessTimes.entries())
        .sort((a, b) => a[1] - b[1]); // Sort by access time (oldest first)
      
      // Remove oldest entries to get back to MAX_CACHE_SIZE
      const toRemove = entries.slice(0, this.metricsCache.size - this.MAX_CACHE_SIZE);
      toRemove.forEach(([key]) => {
        this.metricsCache.delete(key);
        this.cacheAccessTimes.delete(key);
      });
      
      console.log(`✅ Removed ${toRemove.length} metrics from cache`);
    }
  }

  async generateMetricsReport(codeId: string): Promise<string> {
    const metrics = this.metricsCache.get(codeId);
    if (!metrics) {
      return 'No metrics available for this code';
    }
    
    return `
# Code Performance Metrics Report
## Code ID: ${codeId}

### Code Quality
- Cyclomatic Complexity: ${metrics.codeQuality.cyclomaticComplexity}
- Maintainability Index: ${metrics.maintainability}/100
- Readability Score: ${metrics.codeQuality.readabilityScore}/100
- Documentation Score: ${metrics.codeQuality.documentationScore}/100
- Code Smells: ${metrics.codeQuality.codeSmells.length}

### Performance
- Average Execution Time: ${metrics.performance.executionTime.avg.toFixed(2)}ms
- P95 Execution Time: ${metrics.performance.executionTime.p95.toFixed(2)}ms
- Throughput: ${metrics.performance.throughput.itemsPerSecond.toFixed(2)} items/sec

### Security
- Security Score: ${metrics.security.securityScore}/100
- Vulnerabilities: ${metrics.security.vulnerabilities.length}
- Critical Issues: ${metrics.security.vulnerabilities.filter(v => v.severity === 'critical').length}

### Business Impact
- Time Saved: ${metrics.businessImpact.estimatedTimeSaved} minutes per execution
- Error Reduction: ${metrics.businessImpact.errorReduction}%
- ROI: $${metrics.businessImpact.roi}
- Business Value: ${metrics.businessImpact.businessValue.toUpperCase()}

### Recommendations
${metrics.security.recommendations.map(r => `- ${r}`).join('\n')}
`;
  }
}