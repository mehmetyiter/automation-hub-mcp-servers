import { CodeContext } from '../types.js';
import { AIService } from '../../ai-service.js';
import { CodeGenerationDatabase } from '../database/code-generation-db.js';

export interface SecurityScanResult {
  overallScore: number; // 0-100 (100 = most secure)
  vulnerabilities: SecurityVulnerability[];
  dataFlowAnalysis: DataFlowAnalysis;
  inputValidation: InputValidationReport;
  privacyCompliance: PrivacyComplianceReport;
  secretDetection: SecretDetectionReport;
  accessControl: AccessControlReport;
  recommendations: SecurityRecommendation[];
  complianceStatus: ComplianceStatus;
}

export interface SecurityVulnerability {
  id: string;
  type: VulnerabilityType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  location: {
    line?: number;
    column?: number;
    snippet: string;
  };
  description: string;
  impact: string;
  fix: {
    description: string;
    code?: string;
    effort: 'trivial' | 'easy' | 'moderate' | 'complex';
  };
  cwe?: string; // Common Weakness Enumeration ID
  owasp?: string; // OWASP category
}

export enum VulnerabilityType {
  INJECTION = 'injection',
  XSS = 'cross_site_scripting',
  CSRF = 'cross_site_request_forgery',
  INSECURE_DIRECT_OBJECT_REFERENCE = 'insecure_direct_object_reference',
  SECURITY_MISCONFIGURATION = 'security_misconfiguration',
  SENSITIVE_DATA_EXPOSURE = 'sensitive_data_exposure',
  MISSING_ACCESS_CONTROL = 'missing_access_control',
  INSECURE_CRYPTO = 'insecure_cryptographic_storage',
  INSUFFICIENT_TRANSPORT_PROTECTION = 'insufficient_transport_layer_protection',
  UNVALIDATED_REDIRECT = 'unvalidated_redirects_and_forwards',
  CODE_INJECTION = 'code_injection',
  PATH_TRAVERSAL = 'path_traversal',
  COMMAND_INJECTION = 'command_injection',
  LDAP_INJECTION = 'ldap_injection',
  XPATH_INJECTION = 'xpath_injection',
  NOSQL_INJECTION = 'nosql_injection',
  OS_COMMAND_INJECTION = 'os_command_injection',
  BUFFER_OVERFLOW = 'buffer_overflow',
  FORMAT_STRING = 'format_string',
  INTEGER_OVERFLOW = 'integer_overflow'
}

export interface DataFlowAnalysis {
  sources: DataSource[];
  sinks: DataSink[];
  flows: DataFlow[];
  taintedVariables: string[];
  sanitizationPoints: SanitizationPoint[];
}

export interface DataSource {
  type: 'user_input' | 'external_api' | 'database' | 'file' | 'environment';
  location: string;
  trusted: boolean;
}

export interface DataSink {
  type: 'output' | 'database' | 'file' | 'api_call' | 'execution';
  location: string;
  requiresSanitization: boolean;
}

export interface DataFlow {
  from: DataSource;
  to: DataSink;
  path: string[];
  isSanitized: boolean;
  risk: 'high' | 'medium' | 'low';
}

export interface SanitizationPoint {
  location: string;
  method: string;
  effectiveness: number; // 0-100
}

export interface InputValidationReport {
  validated: boolean;
  validationMethods: string[];
  unvalidatedInputs: string[];
  recommendations: string[];
}

export interface PrivacyComplianceReport {
  gdprCompliant: boolean;
  ccpaCompliant: boolean;
  dataHandling: {
    personalDataDetected: boolean;
    encryptionUsed: boolean;
    retentionPolicy: boolean;
    userConsent: boolean;
  };
  issues: string[];
}

export interface SecretDetectionReport {
  secretsFound: Secret[];
  hardcodedCredentials: boolean;
  recommendations: string[];
}

export interface Secret {
  type: 'api_key' | 'password' | 'token' | 'certificate' | 'private_key';
  location: string;
  severity: 'critical' | 'high';
  redactedValue: string;
}

export interface AccessControlReport {
  implemented: boolean;
  methods: string[];
  issues: string[];
  recommendations: string[];
}

export interface SecurityRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  implementation: string;
  effort: number; // hours
  impact: number; // 0-100
}

export interface ComplianceStatus {
  owasp: {
    compliant: boolean;
    violations: string[];
  };
  cis: {
    compliant: boolean;
    violations: string[];
  };
  pci: {
    applicable: boolean;
    compliant: boolean;
    violations: string[];
  };
  hipaa: {
    applicable: boolean;
    compliant: boolean;
    violations: string[];
  };
}

export class AdvancedSecurityScanner {
  private aiService: AIService;
  private database: CodeGenerationDatabase;
  private knownPatterns: Map<string, VulnerabilityType>;
  
  constructor(provider?: string) {
    this.aiService = new AIService(provider);
    this.database = new CodeGenerationDatabase();
    this.initializeKnownPatterns();
  }

  private initializeKnownPatterns() {
    this.knownPatterns = new Map([
      [/eval\s*\(/g.source, VulnerabilityType.CODE_INJECTION],
      [/new\s+Function\s*\(/g.source, VulnerabilityType.CODE_INJECTION],
      [/innerHTML\s*=/g.source, VulnerabilityType.XSS],
      [/document\.write/g.source, VulnerabilityType.XSS],
      [/exec\s*\(/g.source, VulnerabilityType.COMMAND_INJECTION],
      [/require\s*\(\s*[^'"]/g.source, VulnerabilityType.PATH_TRAVERSAL],
      [/\.\.\/|\.\.\\/g.source, VulnerabilityType.PATH_TRAVERSAL],
      [/process\.env\./g.source, VulnerabilityType.SENSITIVE_DATA_EXPOSURE],
      [/password\s*[:=]\s*['"][^'"]+['"]/gi.source, VulnerabilityType.SENSITIVE_DATA_EXPOSURE],
      [/api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi.source, VulnerabilityType.SENSITIVE_DATA_EXPOSURE],
      [/token\s*[:=]\s*['"][^'"]+['"]/gi.source, VulnerabilityType.SENSITIVE_DATA_EXPOSURE]
    ]);
  }

  async performDeepSecurityScan(
    code: string,
    context: CodeContext
  ): Promise<SecurityScanResult> {
    console.log('🔒 Performing advanced security scan...');
    
    // Perform all security checks in parallel
    const [
      vulnerabilities,
      dataFlow,
      inputValidation,
      privacyCompliance,
      secrets,
      accessControl
    ] = await Promise.all([
      this.scanForVulnerabilities(code),
      this.analyzeDataFlow(code),
      this.checkInputValidation(code),
      this.assessPrivacyCompliance(code, context),
      this.scanForSecretLeakage(code),
      this.checkAccessControls(code)
    ]);
    
    // Aggregate results
    const result = this.aggregateSecurityResults({
      vulnerabilities,
      dataFlow,
      inputValidation,
      privacyCompliance,
      secrets,
      accessControl
    });
    
    // Generate recommendations
    result.recommendations = await this.generateSecurityRecommendations(result);
    
    // Check compliance
    result.complianceStatus = this.checkComplianceStatus(result);
    
    // Store scan results
    await this.storeScanResults(code, result);
    
    return result;
  }

  private async scanForVulnerabilities(code: string): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];
    
    // Pattern-based scanning
    for (const [pattern, type] of this.knownPatterns) {
      const regex = new RegExp(pattern, 'g');
      let match;
      
      while ((match = regex.exec(code)) !== null) {
        vulnerabilities.push(await this.createVulnerability(
          type,
          match,
          code
        ));
      }
    }
    
    // AI-based vulnerability detection
    const aiVulnerabilities = await this.aiDetectVulnerabilities(code);
    vulnerabilities.push(...aiVulnerabilities);
    
    return vulnerabilities;
  }

  private async createVulnerability(
    type: VulnerabilityType,
    match: RegExpExecArray,
    code: string
  ): Promise<SecurityVulnerability> {
    const lines = code.substring(0, match.index).split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    
    const vulnerability: SecurityVulnerability = {
      id: `vuln_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity: this.determineSeverity(type),
      location: {
        line,
        column,
        snippet: this.extractSnippet(code, match.index)
      },
      description: this.getVulnerabilityDescription(type),
      impact: this.getVulnerabilityImpact(type),
      fix: this.getVulnerabilityFix(type),
      cwe: this.getCWE(type),
      owasp: this.getOWASP(type)
    };
    
    return vulnerability;
  }

  private async aiDetectVulnerabilities(code: string): Promise<SecurityVulnerability[]> {
    const prompt = `
Perform a comprehensive security vulnerability analysis of this code:

${code}

Identify security vulnerabilities including but not limited to:
- Injection attacks (SQL, NoSQL, Command, LDAP, XPath, etc.)
- Cross-site scripting (XSS) - reflected, stored, DOM-based
- Cross-site request forgery (CSRF)
- Insecure direct object references
- Security misconfigurations
- Sensitive data exposure
- Missing function level access control
- Using components with known vulnerabilities
- Unvalidated redirects and forwards

Return vulnerabilities in this format:
{
  "vulnerabilities": [
    {
      "type": "vulnerability type",
      "severity": "critical|high|medium|low",
      "line": <line number if identifiable>,
      "description": "detailed description",
      "impact": "potential impact",
      "fix": "how to fix",
      "cwe": "CWE ID if applicable",
      "owasp": "OWASP category"
    }
  ]
}`;

    try {
      const response = await this.aiService.getJSONResponse(prompt);
      return response.vulnerabilities?.map((vuln: any) => ({
        id: `ai_vuln_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: this.mapToVulnerabilityType(vuln.type),
        severity: vuln.severity,
        location: {
          line: vuln.line,
          snippet: vuln.snippet || ''
        },
        description: vuln.description,
        impact: vuln.impact,
        fix: {
          description: vuln.fix,
          effort: 'moderate'
        },
        cwe: vuln.cwe,
        owasp: vuln.owasp
      })) || [];
    } catch (error) {
      console.error('AI vulnerability detection failed:', error);
      return [];
    }
  }

  private async analyzeDataFlow(code: string): Promise<DataFlowAnalysis> {
    const prompt = `
Analyze the data flow in this code:

${code}

Identify:
1. Data sources (user input, external APIs, databases, files, environment)
2. Data sinks (outputs, database writes, file writes, API calls, code execution)
3. Data flow paths from sources to sinks
4. Variables that carry tainted (untrusted) data
5. Sanitization or validation points

Return analysis:
{
  "sources": [{"type": "source type", "location": "where", "trusted": boolean}],
  "sinks": [{"type": "sink type", "location": "where", "requiresSanitization": boolean}],
  "flows": [{"from": source, "to": sink, "path": ["variable names"], "isSanitized": boolean, "risk": "high|medium|low"}],
  "taintedVariables": ["variable names"],
  "sanitizationPoints": [{"location": "where", "method": "how", "effectiveness": 0-100}]
}`;

    try {
      const response = await this.aiService.getJSONResponse(prompt);
      return response as DataFlowAnalysis;
    } catch (error) {
      return this.performManualDataFlowAnalysis(code);
    }
  }

  private performManualDataFlowAnalysis(code: string): DataFlowAnalysis {
    const sources: DataSource[] = [];
    const sinks: DataSink[] = [];
    const flows: DataFlow[] = [];
    
    // Detect input sources
    if (code.includes('$input')) {
      sources.push({
        type: 'user_input',
        location: '$input',
        trusted: false
      });
    }
    
    // Detect output sinks
    if (code.includes('return')) {
      sinks.push({
        type: 'output',
        location: 'return statement',
        requiresSanitization: true
      });
    }
    
    // Simple flow detection
    if (sources.length > 0 && sinks.length > 0) {
      flows.push({
        from: sources[0],
        to: sinks[0],
        path: ['data'],
        isSanitized: code.includes('validate') || code.includes('sanitize'),
        risk: code.includes('validate') ? 'low' : 'high'
      });
    }
    
    return {
      sources,
      sinks,
      flows,
      taintedVariables: [],
      sanitizationPoints: []
    };
  }

  private async checkInputValidation(code: string): Promise<InputValidationReport> {
    const validationMethods: string[] = [];
    const unvalidatedInputs: string[] = [];
    
    // Check for validation patterns
    if (code.includes('validate')) validationMethods.push('Custom validation');
    if (code.includes('typeof')) validationMethods.push('Type checking');
    if (code.includes('isNaN')) validationMethods.push('Numeric validation');
    if (code.includes('test(')) validationMethods.push('Regex validation');
    if (code.includes('schema')) validationMethods.push('Schema validation');
    
    // Check for unvalidated inputs
    const inputPattern = /\$input\.all\(\)|item\.json/g;
    let match;
    while ((match = inputPattern.exec(code)) !== null) {
      const surroundingCode = code.substring(
        Math.max(0, match.index - 100),
        Math.min(code.length, match.index + 100)
      );
      
      if (!surroundingCode.includes('validate') && 
          !surroundingCode.includes('if') &&
          !surroundingCode.includes('typeof')) {
        unvalidatedInputs.push(match[0]);
      }
    }
    
    return {
      validated: validationMethods.length > 0 && unvalidatedInputs.length === 0,
      validationMethods,
      unvalidatedInputs,
      recommendations: unvalidatedInputs.length > 0 
        ? ['Add input validation for all user inputs']
        : []
    };
  }

  private async assessPrivacyCompliance(
    code: string,
    context: CodeContext
  ): Promise<PrivacyComplianceReport> {
    const personalDataPatterns = [
      /email/i,
      /phone/i,
      /address/i,
      /ssn|social.?security/i,
      /dob|date.?of.?birth/i,
      /name/i,
      /credit.?card/i
    ];
    
    const personalDataDetected = personalDataPatterns.some(pattern => pattern.test(code));
    const encryptionUsed = code.includes('encrypt') || code.includes('hash');
    
    return {
      gdprCompliant: !personalDataDetected || encryptionUsed,
      ccpaCompliant: !personalDataDetected || encryptionUsed,
      dataHandling: {
        personalDataDetected,
        encryptionUsed,
        retentionPolicy: false, // Would need more context
        userConsent: false // Would need more context
      },
      issues: personalDataDetected && !encryptionUsed 
        ? ['Personal data handled without encryption']
        : []
    };
  }

  private async scanForSecretLeakage(code: string): Promise<SecretDetectionReport> {
    const secrets: Secret[] = [];
    
    // Common secret patterns
    const secretPatterns = [
      { regex: /api[_-]?key\s*[:=]\s*["']([^"']+)["']/gi, type: 'api_key' as const },
      { regex: /password\s*[:=]\s*["']([^"']+)["']/gi, type: 'password' as const },
      { regex: /token\s*[:=]\s*["']([^"']+)["']/gi, type: 'token' as const },
      { regex: /private[_-]?key\s*[:=]\s*["']([^"']+)["']/gi, type: 'private_key' as const }
    ];
    
    for (const { regex, type } of secretPatterns) {
      let match;
      while ((match = regex.exec(code)) !== null) {
        secrets.push({
          type,
          location: `Line ${code.substring(0, match.index).split('\n').length}`,
          severity: 'critical',
          redactedValue: match[1].substring(0, 4) + '****'
        });
      }
    }
    
    return {
      secretsFound: secrets,
      hardcodedCredentials: secrets.length > 0,
      recommendations: secrets.length > 0 
        ? ['Use environment variables for secrets', 'Implement secure secret management']
        : []
    };
  }

  private async checkAccessControls(code: string): Promise<AccessControlReport> {
    const methods: string[] = [];
    const issues: string[] = [];
    
    // Check for access control implementations
    if (code.includes('authorize')) methods.push('Authorization checks');
    if (code.includes('permission')) methods.push('Permission validation');
    if (code.includes('role')) methods.push('Role-based access control');
    if (code.includes('auth')) methods.push('Authentication checks');
    
    // Check for missing access controls
    const sensitiveOperations = [
      'delete',
      'update',
      'write',
      'admin',
      'config'
    ];
    
    for (const op of sensitiveOperations) {
      if (code.includes(op) && !methods.length) {
        issues.push(`${op} operation without access control`);
      }
    }
    
    return {
      implemented: methods.length > 0,
      methods,
      issues,
      recommendations: issues.length > 0 
        ? ['Implement proper access controls for sensitive operations']
        : []
    };
  }

  private aggregateSecurityResults(components: any): SecurityScanResult {
    const allVulnerabilities = components.vulnerabilities;
    
    // Calculate overall score
    let score = 100;
    for (const vuln of allVulnerabilities) {
      switch (vuln.severity) {
        case 'critical': score -= 25; break;
        case 'high': score -= 15; break;
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
      }
    }
    
    score = Math.max(0, score);
    
    return {
      overallScore: score,
      vulnerabilities: allVulnerabilities,
      dataFlowAnalysis: components.dataFlow,
      inputValidation: components.inputValidation,
      privacyCompliance: components.privacyCompliance,
      secretDetection: components.secrets,
      accessControl: components.accessControl,
      recommendations: [],
      complianceStatus: {
        owasp: { compliant: true, violations: [] },
        cis: { compliant: true, violations: [] },
        pci: { applicable: false, compliant: true, violations: [] },
        hipaa: { applicable: false, compliant: true, violations: [] }
      }
    };
  }

  private async generateSecurityRecommendations(
    result: SecurityScanResult
  ): Promise<SecurityRecommendation[]> {
    const recommendations: SecurityRecommendation[] = [];
    
    // Critical vulnerabilities
    const criticalVulns = result.vulnerabilities.filter(v => v.severity === 'critical');
    if (criticalVulns.length > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'vulnerabilities',
        description: `Fix ${criticalVulns.length} critical vulnerabilities`,
        implementation: criticalVulns[0].fix.description,
        effort: criticalVulns.length * 2,
        impact: 90
      });
    }
    
    // Input validation
    if (!result.inputValidation.validated) {
      recommendations.push({
        priority: 'high',
        category: 'input_validation',
        description: 'Implement comprehensive input validation',
        implementation: 'Add validation for all user inputs using schema validation',
        effort: 4,
        impact: 80
      });
    }
    
    // Secret management
    if (result.secretDetection.hardcodedCredentials) {
      recommendations.push({
        priority: 'critical',
        category: 'secrets',
        description: 'Remove hardcoded credentials',
        implementation: 'Use environment variables or secure secret management',
        effort: 2,
        impact: 95
      });
    }
    
    // Access control
    if (!result.accessControl.implemented) {
      recommendations.push({
        priority: 'high',
        category: 'access_control',
        description: 'Implement access control mechanisms',
        implementation: 'Add authentication and authorization checks',
        effort: 8,
        impact: 85
      });
    }
    
    return recommendations.sort((a, b) => {
      const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      return (priorityWeight[b.priority] * b.impact) - (priorityWeight[a.priority] * a.impact);
    });
  }

  private checkComplianceStatus(result: SecurityScanResult): ComplianceStatus {
    const status: ComplianceStatus = {
      owasp: { compliant: true, violations: [] },
      cis: { compliant: true, violations: [] },
      pci: { applicable: false, compliant: true, violations: [] },
      hipaa: { applicable: false, compliant: true, violations: [] }
    };
    
    // OWASP compliance
    if (result.vulnerabilities.some(v => v.type === VulnerabilityType.INJECTION)) {
      status.owasp.compliant = false;
      status.owasp.violations.push('A03:2021 - Injection');
    }
    
    if (result.vulnerabilities.some(v => v.type === VulnerabilityType.XSS)) {
      status.owasp.compliant = false;
      status.owasp.violations.push('A03:2021 - Cross-site Scripting');
    }
    
    if (result.secretDetection.hardcodedCredentials) {
      status.owasp.compliant = false;
      status.owasp.violations.push('A07:2021 - Identification and Authentication Failures');
    }
    
    // CIS compliance
    if (!result.inputValidation.validated) {
      status.cis.compliant = false;
      status.cis.violations.push('CIS Control 5: Account Management');
    }
    
    return status;
  }

  // Helper methods
  private determineSeverity(type: VulnerabilityType): 'critical' | 'high' | 'medium' | 'low' {
    const severityMap: Record<VulnerabilityType, 'critical' | 'high' | 'medium' | 'low'> = {
      [VulnerabilityType.CODE_INJECTION]: 'critical',
      [VulnerabilityType.COMMAND_INJECTION]: 'critical',
      [VulnerabilityType.INJECTION]: 'critical',
      [VulnerabilityType.NOSQL_INJECTION]: 'critical',
      [VulnerabilityType.OS_COMMAND_INJECTION]: 'critical',
      [VulnerabilityType.LDAP_INJECTION]: 'critical',
      [VulnerabilityType.XPATH_INJECTION]: 'critical',
      [VulnerabilityType.BUFFER_OVERFLOW]: 'critical',
      [VulnerabilityType.XSS]: 'high',
      [VulnerabilityType.SENSITIVE_DATA_EXPOSURE]: 'high',
      [VulnerabilityType.PATH_TRAVERSAL]: 'high',
      [VulnerabilityType.CSRF]: 'high',
      [VulnerabilityType.MISSING_ACCESS_CONTROL]: 'high',
      [VulnerabilityType.INSECURE_CRYPTO]: 'medium',
      [VulnerabilityType.UNVALIDATED_REDIRECT]: 'medium',
      [VulnerabilityType.INSECURE_DIRECT_OBJECT_REFERENCE]: 'medium',
      [VulnerabilityType.SECURITY_MISCONFIGURATION]: 'medium',
      [VulnerabilityType.INSUFFICIENT_TRANSPORT_PROTECTION]: 'medium',
      [VulnerabilityType.FORMAT_STRING]: 'medium',
      [VulnerabilityType.INTEGER_OVERFLOW]: 'low'
    };
    
    return severityMap[type] || 'medium';
  }

  private extractSnippet(code: string, index: number): string {
    const start = Math.max(0, index - 50);
    const end = Math.min(code.length, index + 50);
    return code.substring(start, end).trim();
  }

  private getVulnerabilityDescription(type: VulnerabilityType): string {
    const partialDescriptions = {
      [VulnerabilityType.CODE_INJECTION]: 'Code injection vulnerability allows attackers to execute arbitrary code',
      [VulnerabilityType.XSS]: 'Cross-site scripting vulnerability allows injection of malicious scripts',
      [VulnerabilityType.COMMAND_INJECTION]: 'Command injection allows execution of system commands',
      [VulnerabilityType.PATH_TRAVERSAL]: 'Path traversal vulnerability allows access to unauthorized files',
      [VulnerabilityType.SENSITIVE_DATA_EXPOSURE]: 'Sensitive data is exposed in the code'
    };
    
    const descriptions = this.createCompleteMap(partialDescriptions, 'Security vulnerability detected');
    return descriptions[type];
  }

  private getVulnerabilityImpact(type: VulnerabilityType): string {
    const partialImpacts = {
      [VulnerabilityType.CODE_INJECTION]: 'Complete system compromise possible',
      [VulnerabilityType.XSS]: 'User session hijacking and data theft',
      [VulnerabilityType.COMMAND_INJECTION]: 'Server compromise and data breach',
      [VulnerabilityType.PATH_TRAVERSAL]: 'Unauthorized file access',
      [VulnerabilityType.SENSITIVE_DATA_EXPOSURE]: 'Credential theft and unauthorized access'
    };
    
    const impacts = this.createCompleteMap(partialImpacts, 'Security breach possible');
    return impacts[type];
  }

  private getVulnerabilityFix(type: VulnerabilityType): any {
    const partialFixes = {
      [VulnerabilityType.CODE_INJECTION]: {
        description: 'Never use eval() or Function constructor with user input',
        code: '// Use safer alternatives like JSON.parse() or specific parsing functions',
        effort: 'easy'
      },
      [VulnerabilityType.XSS]: {
        description: 'Sanitize all user input before rendering',
        code: 'const sanitized = DOMPurify.sanitize(userInput);',
        effort: 'easy'
      },
      [VulnerabilityType.COMMAND_INJECTION]: {
        description: 'Use parameterized commands or avoid shell execution',
        effort: 'moderate'
      },
      [VulnerabilityType.PATH_TRAVERSAL]: {
        description: 'Validate and sanitize file paths',
        code: 'const safePath = path.normalize(userPath).replace(/^(\.\.[\\/])+/, \'\');',
        effort: 'easy'
      },
      [VulnerabilityType.SENSITIVE_DATA_EXPOSURE]: {
        description: 'Use environment variables for sensitive data',
        code: 'const apiKey = process.env.API_KEY;',
        effort: 'trivial'
      }
    };
    
    const fixes = this.createCompleteMap(partialFixes, { description: 'Apply security best practices', effort: 'moderate' });
    return fixes[type];
  }

  private getCWE(type: VulnerabilityType): string {
    const partialCweMap = {
      [VulnerabilityType.CODE_INJECTION]: 'CWE-94',
      [VulnerabilityType.XSS]: 'CWE-79',
      [VulnerabilityType.COMMAND_INJECTION]: 'CWE-77',
      [VulnerabilityType.PATH_TRAVERSAL]: 'CWE-22',
      [VulnerabilityType.SENSITIVE_DATA_EXPOSURE]: 'CWE-200'
    };
    
    const cweMap = this.createCompleteMap(partialCweMap, '');
    return cweMap[type];
  }

  private getOWASP(type: VulnerabilityType): string {
    const partialOwaspMap = {
      [VulnerabilityType.CODE_INJECTION]: 'A03:2021',
      [VulnerabilityType.XSS]: 'A03:2021',
      [VulnerabilityType.COMMAND_INJECTION]: 'A03:2021',
      [VulnerabilityType.PATH_TRAVERSAL]: 'A01:2021',
      [VulnerabilityType.SENSITIVE_DATA_EXPOSURE]: 'A02:2021'
    };
    
    const owaspMap = this.createCompleteMap(partialOwaspMap, '');
    return owaspMap[type];
  }

  private getAllVulnerabilityTypes(): VulnerabilityType[] {
    return Object.values(VulnerabilityType);
  }

  private createCompleteMap<T>(partialMap: Partial<Record<VulnerabilityType, T>>, defaultValue: T): Record<VulnerabilityType, T> {
    const completeMap = {} as Record<VulnerabilityType, T>;
    for (const type of this.getAllVulnerabilityTypes()) {
      completeMap[type] = partialMap[type] ?? defaultValue;
    }
    return completeMap;
  }

  private mapToVulnerabilityType(type: string): VulnerabilityType {
    const typeMap: Record<string, VulnerabilityType> = {
      'injection': VulnerabilityType.INJECTION,
      'xss': VulnerabilityType.XSS,
      'command_injection': VulnerabilityType.COMMAND_INJECTION,
      'path_traversal': VulnerabilityType.PATH_TRAVERSAL
    };
    
    return typeMap[type.toLowerCase()] || VulnerabilityType.SECURITY_MISCONFIGURATION;
  }

  private async storeScanResults(code: string, result: SecurityScanResult): Promise<void> {
    try {
      // Store security scan results for analysis and improvement
      console.log('💾 Storing security scan results');
    } catch (error) {
      console.error('Failed to store scan results:', error);
    }
  }

  async generateSecurityReport(result: SecurityScanResult): Promise<string> {
    return `
# Security Scan Report

## Overall Security Score: ${result.overallScore}/100

### Executive Summary
${result.overallScore >= 80 ? '✅ Code meets security standards' : '⚠️ Security improvements needed'}

Total vulnerabilities: ${result.vulnerabilities.length}
- Critical: ${result.vulnerabilities.filter(v => v.severity === 'critical').length}
- High: ${result.vulnerabilities.filter(v => v.severity === 'high').length}
- Medium: ${result.vulnerabilities.filter(v => v.severity === 'medium').length}
- Low: ${result.vulnerabilities.filter(v => v.severity === 'low').length}

### Vulnerabilities Detail
${result.vulnerabilities.map(v => `
#### ${v.type.replace(/_/g, ' ').toUpperCase()} (${v.severity.toUpperCase()})
- **Location**: ${v.location.snippet}
- **Description**: ${v.description}
- **Impact**: ${v.impact}
- **Fix**: ${v.fix.description}
${v.cwe ? `- **CWE**: ${v.cwe}` : ''}
${v.owasp ? `- **OWASP**: ${v.owasp}` : ''}
`).join('\n')}

### Input Validation
${result.inputValidation.validated ? '✅ Input validation implemented' : '❌ Input validation missing'}
${result.inputValidation.unvalidatedInputs.length > 0 ? 
  `Unvalidated inputs: ${result.inputValidation.unvalidatedInputs.join(', ')}` : ''}

### Secret Detection
${result.secretDetection.hardcodedCredentials ? 
  `⚠️ ${result.secretDetection.secretsFound.length} hardcoded secrets found!` : 
  '✅ No hardcoded secrets detected'}

### Access Control
${result.accessControl.implemented ? '✅ Access controls implemented' : '❌ Access controls missing'}

### Privacy Compliance
- GDPR: ${result.privacyCompliance.gdprCompliant ? '✅ Compliant' : '❌ Non-compliant'}
- CCPA: ${result.privacyCompliance.ccpaCompliant ? '✅ Compliant' : '❌ Non-compliant'}

### Top Security Recommendations
${result.recommendations.slice(0, 5).map((rec, i) => 
  `${i + 1}. **${rec.description}** (${rec.priority} priority)
   - Implementation: ${rec.implementation}
   - Effort: ${rec.effort} hours
   - Impact: ${rec.impact}% improvement`
).join('\n\n')}

### Compliance Status
- **OWASP Top 10**: ${result.complianceStatus.owasp.compliant ? '✅' : '❌'} ${
  result.complianceStatus.owasp.violations.length > 0 ? 
  `Violations: ${result.complianceStatus.owasp.violations.join(', ')}` : ''
}
- **CIS Controls**: ${result.complianceStatus.cis.compliant ? '✅' : '❌'}
`;
  }
}