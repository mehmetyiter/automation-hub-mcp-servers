/**
 * Dynamic Code Generator with Event-Driven Architecture
 */

import { DynamicCodeGeneratorDI } from './dynamic-code-generator-di.js';
import { CodeGenerationRequest, GeneratedCode } from './types.js';
import { globalEventEmitter, EventTypes, EventBuilder } from './events/event-emitter.js';
import { IServiceContainer } from './dependency-injection/container.js';

export class DynamicCodeGeneratorWithEvents extends DynamicCodeGeneratorDI {
  constructor(container: IServiceContainer) {
    super(container);
  }

  async generateCode(request: CodeGenerationRequest): Promise<GeneratedCode> {
    const startTime = Date.now();
    const codeId = this.generateCodeId(request);

    // Emit generation started event
    new EventBuilder()
      .type(EventTypes.GENERATION_STARTED)
      .codeId(codeId)
      .data({
        request,
        startTime
      })
      .emit();

    try {
      // Call parent implementation
      const result = await super.generateCode(request);

      const duration = Date.now() - startTime;
      const codeSize = result.code.length;

      // Emit generation completed event
      new EventBuilder()
        .type(EventTypes.GENERATION_COMPLETED)
        .codeId(codeId)
        .data({
          request,
          result,
          duration,
          codeSize,
          success: result.success
        })
        .emit();

      // Check performance thresholds
      if (duration > 5000) {
        new EventBuilder()
          .type(EventTypes.PERFORMANCE_THRESHOLD_EXCEEDED)
          .codeId(codeId)
          .data({
            metric: 'generation_time',
            threshold: 5000,
            actual: duration
          })
          .emit();
      }

      if (codeSize > 10000) {
        new EventBuilder()
          .type(EventTypes.PERFORMANCE_THRESHOLD_EXCEEDED)
          .codeId(codeId)
          .data({
            metric: 'code_size',
            threshold: 10000,
            actual: codeSize
          })
          .emit();
      }

      return result;
    } catch (error) {
      // Emit generation failed event
      new EventBuilder()
        .type(EventTypes.GENERATION_FAILED)
        .codeId(codeId)
        .data({
          request,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime
        })
        .emit();

      throw error;
    }
  }

  async validateCode(code: string, context: any, language: string): Promise<any> {
    const startTime = Date.now();

    // Emit validation started event
    new EventBuilder()
      .type(EventTypes.VALIDATION_STARTED)
      .data({
        language,
        codeLength: code.length,
        startTime
      })
      .emit();

    try {
      const result = await this.validationEngine.validateCode(code, context, language);

      // Emit validation completed event
      new EventBuilder()
        .type(EventTypes.VALIDATION_COMPLETED)
        .data({
          language,
          isValid: result.isValid,
          issueCount: result.issues.length,
          duration: Date.now() - startTime
        })
        .emit();

      // Emit security issues if found
      const securityIssues = result.issues.filter(i => i.type === 'security');
      if (securityIssues.length > 0) {
        new EventBuilder()
          .type(EventTypes.SECURITY_ISSUE_DETECTED)
          .data({
            issues: securityIssues,
            severity: securityIssues.some(i => i.severity === 'error') ? 'high' : 'medium'
          })
          .emit();
      }

      return result;
    } catch (error) {
      // Emit validation failed event
      new EventBuilder()
        .type(EventTypes.VALIDATION_FAILED)
        .data({
          language,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime
        })
        .emit();

      throw error;
    }
  }

  async optimizeCode(code: string, context: any): Promise<string> {
    const startTime = Date.now();
    const originalSize = code.length;

    // Emit optimization started event
    new EventBuilder()
      .type(EventTypes.OPTIMIZATION_STARTED)
      .data({
        originalSize,
        startTime
      })
      .emit();

    try {
      const optimizedCode = await this.optimizationEngine.optimizeCode(code, context);
      const optimizedSize = optimizedCode.length;
      const improvement = Math.round(((originalSize - optimizedSize) / originalSize) * 100);

      // Emit optimization completed event
      new EventBuilder()
        .type(EventTypes.OPTIMIZATION_COMPLETED)
        .data({
          originalSize,
          optimizedSize,
          improvement,
          duration: Date.now() - startTime
        })
        .emit();

      return optimizedCode;
    } catch (error) {
      // Emit optimization failed event
      new EventBuilder()
        .type(EventTypes.OPTIMIZATION_FAILED)
        .data({
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime
        })
        .emit();

      // Return original code if optimization fails
      return code;
    }
  }

  async executeGeneratedCode(
    codeId: string,
    executionContext: any
  ): Promise<any> {
    // Check cache first
    const cached = this.generatedCodeCache.get(codeId);
    if (cached) {
      new EventBuilder()
        .type(EventTypes.CACHE_HIT)
        .codeId(codeId)
        .data({
          cacheKey: codeId,
          cacheType: 'generated_code'
        })
        .emit();
    } else {
      new EventBuilder()
        .type(EventTypes.CACHE_MISS)
        .codeId(codeId)
        .data({
          cacheKey: codeId,
          cacheType: 'generated_code'
        })
        .emit();
    }

    return super.executeGeneratedCode(codeId, executionContext);
  }

  async provideFeedback(
    codeId: string,
    feedback: {
      rating: number;
      worked: boolean;
      issues?: string[];
      suggestions?: string[];
    }
  ): Promise<void> {
    // Emit feedback received event
    new EventBuilder()
      .type(EventTypes.FEEDBACK_RECEIVED)
      .codeId(codeId)
      .data({
        feedback,
        timestamp: new Date().toISOString()
      })
      .emit();

    // Process feedback
    await super.provideFeedback(codeId, feedback);

    // Emit feedback processed event
    new EventBuilder()
      .type(EventTypes.FEEDBACK_PROCESSED)
      .codeId(codeId)
      .data({
        feedback,
        processed: true
      })
      .emit();

    // If feedback indicates issues, consider optimization
    if (!feedback.worked || feedback.rating < 3) {
      globalEventEmitter.emitEvent({
        type: 'optimization_started',
        timestamp: new Date().toISOString(),
        codeId,
        data: {
          reason: 'negative_feedback',
          feedback
        }
      });
    }
  }


  // Override profileCode to add events
  async profileCode(codeId: string, options?: any): Promise<any> {
    // Emit profile started event
    new EventBuilder()
      .type(EventTypes.PERFORMANCE_PROFILE_STARTED)
      .codeId(codeId)
      .data({
        options,
        startTime: Date.now()
      })
      .emit();

    try {
      const profile = await super.profileCode(codeId);

      // Emit profile completed event
      new EventBuilder()
        .type(EventTypes.PERFORMANCE_PROFILE_COMPLETED)
        .codeId(codeId)
        .data({
          profile,
          overallScore: profile.overallScore
        })
        .emit();

      // Check if performance is below threshold
      if (profile.overallScore < 70) {
        new EventBuilder()
          .type(EventTypes.PERFORMANCE_THRESHOLD_EXCEEDED)
          .codeId(codeId)
          .data({
            metric: 'overall_score',
            threshold: 70,
            actual: profile.overallScore
          })
          .emit();
      }

      return profile;
    } catch (error) {
      // Emit error event
      new EventBuilder()
        .type(EventTypes.ERROR_OCCURRED)
        .codeId(codeId)
        .data({
          operation: 'profile_code',
          error: error instanceof Error ? error.message : String(error)
        })
        .emit();

      throw error;
    }
  }

  // Override createVersion to add events
  async createVersion(
    codeId: string,
    code: string,
    metadata: any,
    createdBy: string = 'system'
  ): Promise<any> {
    const version = await this.versionManager.createVersion(codeId, code, metadata, createdBy);

    // Emit version created event
    new EventBuilder()
      .type(EventTypes.VERSION_CREATED)
      .codeId(codeId)
      .data({
        version,
        versionNumber: version.version,
        createdBy
      })
      .emit();

    return version;
  }

  // Clear cache with event
  clearCache(): void {
    const cacheSize = this.generatedCodeCache.size;
    this.generatedCodeCache.clear();

    // Emit cache cleared event
    new EventBuilder()
      .type(EventTypes.CACHE_CLEARED)
      .data({
        cacheType: 'generated_code',
        itemsCleared: cacheSize
      })
      .emit();
  }
}