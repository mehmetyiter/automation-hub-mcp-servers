import { MultiModelOrchestrator } from '../src/ai-analysis/multi-model-orchestrator.js';
import { BusinessLogicRequest } from '../src/ai-analysis/business-logic-generator.js';

describe('MultiModelOrchestrator', () => {
  let orchestrator: MultiModelOrchestrator;
  
  beforeEach(() => {
    orchestrator = new MultiModelOrchestrator();
  });
  
  afterEach(() => {
    // Clean up any event listeners
    orchestrator.removeAllListeners();
  });
  
  describe('generateBusinessLogic', () => {
    it('should handle simple requests with single model', async () => {
      const request: BusinessLogicRequest = {
        description: 'Calculate simple interest on a loan',
        domain: 'finance',
        context: {
          loanType: 'personal'
        },
        dataStructure: {
          inputs: [
            { name: 'principal', type: 'number', description: 'Loan amount' },
            { name: 'rate', type: 'percentage', description: 'Interest rate' },
            { name: 'time', type: 'number', description: 'Time in years' }
          ],
          outputs: [
            { name: 'interest', type: 'number', description: 'Interest amount' },
            { name: 'total', type: 'number', description: 'Total amount' }
          ]
        }
      };
      
      const result = await orchestrator.generateBusinessLogic(request);
      
      expect(result).toBeDefined();
      expect(result.implementation).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.modelUsed).toHaveLength(1);
      expect(result.validationResults).toHaveLength(1);
    });
    
    it('should use multiple models for complex requests', async () => {
      const request: BusinessLogicRequest = {
        description: 'Complex risk assessment for enterprise loan approval with compliance',
        domain: 'finance',
        context: {
          regulations: ['Basel III', 'GDPR']
        },
        dataStructure: {
          inputs: [
            { name: 'creditScore', type: 'number' },
            { name: 'income', type: 'number' },
            { name: 'debt', type: 'number' },
            { name: 'collateral', type: 'object' },
            { name: 'businessData', type: 'object' }
          ],
          outputs: [
            { name: 'riskScore', type: 'number' },
            { name: 'approvalDecision', type: 'boolean' },
            { name: 'complianceReport', type: 'object' }
          ],
          relationships: [
            { from: 'creditScore', to: 'riskScore', type: 'linear' },
            { from: 'income', to: 'riskScore', type: 'logarithmic' }
          ]
        },
        requirements: {
          accuracy: 'critical',
          compliance: ['Basel III', 'GDPR'],
          scalability: 'enterprise'
        }
      };
      
      const result = await orchestrator.generateBusinessLogic(request);
      
      expect(result).toBeDefined();
      expect(result.modelUsed.length).toBeGreaterThanOrEqual(2);
      expect(result.validationResults.length).toBeGreaterThan(1);
      expect(result.confidence).toBeGreaterThan(0.7);
    });
    
    it('should handle model failures gracefully', async () => {
      const request: BusinessLogicRequest = {
        description: 'Test request',
        dataStructure: {
          inputs: [{ name: 'test', type: 'string' }],
          outputs: [{ name: 'result', type: 'string' }]
        },
        context: {}
      };
      
      // Simulate all models being unhealthy
      const modelStatus = orchestrator.getModelStatus();
      modelStatus.forEach((_, modelId) => {
        modelStatus.set(modelId, false);
      });
      
      // Should still attempt to generate with fallback
      await expect(orchestrator.generateBusinessLogic(request)).rejects.toThrow();
    });
  });
  
  describe('complexity analysis', () => {
    it('should correctly classify simple requests', async () => {
      const request: BusinessLogicRequest = {
        description: 'Add two numbers',
        dataStructure: {
          inputs: [
            { name: 'a', type: 'number' },
            { name: 'b', type: 'number' }
          ],
          outputs: [
            { name: 'sum', type: 'number' }
          ]
        },
        context: {}
      };
      
      const result = await orchestrator.generateBusinessLogic(request);
      expect(result.modelUsed).toHaveLength(1); // Simple = single model
    });
    
    it('should correctly classify enterprise requests', async () => {
      const request: BusinessLogicRequest = {
        description: 'Enterprise financial risk assessment',
        domain: 'finance',
        dataStructure: {
          inputs: Array(25).fill(null).map((_, i) => ({
            name: `var${i}`,
            type: 'number' as const
          })),
          outputs: Array(10).fill(null).map((_, i) => ({
            name: `output${i}`,
            type: 'number' as const
          })),
          relationships: Array(10).fill(null).map((_, i) => ({
            from: `var${i}`,
            to: `output${i % 10}`,
            type: 'linear' as const
          }))
        },
        requirements: {
          accuracy: 'critical',
          scalability: 'enterprise',
          compliance: ['GDPR', 'Basel III', 'SOX']
        },
        context: {}
      };
      
      const result = await orchestrator.generateBusinessLogic(request);
      expect(result.modelUsed.length).toBeGreaterThanOrEqual(3); // Enterprise = multiple models
    });
  });
  
  describe('model management', () => {
    it('should track model performance metrics', async () => {
      const request: BusinessLogicRequest = {
        description: 'Test calculation',
        dataStructure: {
          inputs: [{ name: 'x', type: 'number' }],
          outputs: [{ name: 'y', type: 'number' }]
        },
        context: {}
      };
      
      await orchestrator.generateBusinessLogic(request);
      
      const metrics = orchestrator.getModelPerformanceMetrics();
      expect(metrics.size).toBeGreaterThan(0);
      
      const firstModelMetrics = Array.from(metrics.values())[0];
      expect(firstModelMetrics.totalRequests).toBe(1);
      expect(firstModelMetrics.avgResponseTime).toBeGreaterThan(0);
    });
    
    it('should support adding and removing models', async () => {
      const newModel = {
        id: 'custom-model',
        name: 'Custom Model',
        provider: 'Custom',
        capabilities: ['code-generation'],
        performance: {
          avgResponseTime: 1000,
          successRate: 0.9,
          accuracy: 0.85,
          lastUpdated: new Date()
        },
        cost: {
          perRequest: 0.01,
          perToken: 0.00001
        },
        availability: 0.95
      };
      
      await orchestrator.addModel(newModel);
      const status = orchestrator.getModelStatus();
      expect(status.has('custom-model')).toBe(true);
      
      await orchestrator.removeModel('custom-model');
      const updatedStatus = orchestrator.getModelStatus();
      expect(updatedStatus.has('custom-model')).toBe(false);
    });
    
    it('should find optimal model within budget', () => {
      const budget = 0.03;
      const complexity = { level: 'moderate' as const, score: 50, factors: [] };
      
      const strategy = orchestrator.getOptimalModelForBudget(budget, complexity);
      
      expect(strategy).toBeDefined();
      expect(strategy.primary).toBeDefined();
      // Should select models within budget
    });
  });
  
  describe('ensemble strategies', () => {
    it('should handle weighted voting ensemble', async () => {
      const request: BusinessLogicRequest = {
        description: 'Calculate with ensemble',
        domain: 'finance',
        dataStructure: {
          inputs: Array(15).fill(null).map((_, i) => ({
            name: `input${i}`,
            type: 'number' as const
          })),
          outputs: [{ name: 'result', type: 'number' }]
        },
        requirements: {
          accuracy: 'high'
        },
        context: {}
      };
      
      const result = await orchestrator.generateBusinessLogic(request);
      
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.6);
      // Ensemble should improve confidence
    });
  });
  
  describe('validation', () => {
    it('should perform multi-stage validation for enterprise requests', async () => {
      const request: BusinessLogicRequest = {
        description: 'Enterprise healthcare data processing',
        domain: 'healthcare',
        dataStructure: {
          inputs: [
            { name: 'patientData', type: 'object' },
            { name: 'medicalRecords', type: 'array' }
          ],
          outputs: [
            { name: 'diagnosis', type: 'object' },
            { name: 'recommendations', type: 'array' }
          ]
        },
        requirements: {
          accuracy: 'critical',
          compliance: ['HIPAA'],
          scalability: 'enterprise'
        },
        context: {}
      };
      
      const result = await orchestrator.generateBusinessLogic(request);
      
      expect(result.validationResults.length).toBeGreaterThanOrEqual(3);
      
      const validationTypes = result.validationResults.map(v => v.validator);
      expect(validationTypes).toContain('basic');
      expect(validationTypes).toContain('comprehensive');
      expect(validationTypes).toContain('compliance');
    });
  });
});