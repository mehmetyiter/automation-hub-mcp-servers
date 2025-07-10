/**
 * Example usage of the Event-Driven Architecture
 */

import { globalEventEmitter, EventTypes, EventBuilder } from './event-emitter';
import { registerEventListeners } from './event-listeners';
import { DynamicCodeGeneratorWithEvents } from '../dynamic-code-generator-events';
import { globalContainer } from '../dependency-injection/container';
import { initializeServices } from '../dependency-injection/service-registry';
import { CodeGenerationRequest } from '../types';

// Example 1: Basic event handling
export function example1BasicEvents() {
  console.log('\n=== Example 1: Basic Event Handling ===\n');

  // Register a simple event handler
  globalEventEmitter.on(EventTypes.GENERATION_COMPLETED, (event) => {
    console.log('Code generation completed!', {
      codeId: event.codeId,
      duration: event.data.duration,
      success: event.data.success
    });
  });

  // Emit an event
  new EventBuilder()
    .type(EventTypes.GENERATION_COMPLETED)
    .codeId('test-123')
    .data({
      duration: 1500,
      success: true,
      codeSize: 500
    })
    .emit();
}

// Example 2: Chained events
export async function example2ChainedEvents() {
  console.log('\n=== Example 2: Chained Events ===\n');

  // Set up event chain
  globalEventEmitter.on(EventTypes.GENERATION_COMPLETED, (event) => {
    if (event.data.success) {
      // Trigger validation after generation
      new EventBuilder()
        .type(EventTypes.VALIDATION_STARTED)
        .codeId(event.codeId!)
        .data({
          triggeredBy: 'generation_completed'
        })
        .emit();
    }
  });

  globalEventEmitter.on(EventTypes.VALIDATION_COMPLETED, (event) => {
    if (event.data.isValid) {
      // Trigger optimization after validation
      new EventBuilder()
        .type(EventTypes.OPTIMIZATION_STARTED)
        .codeId(event.codeId!)
        .data({
          triggeredBy: 'validation_completed'
        })
        .emit();
    }
  });

  // Start the chain
  new EventBuilder()
    .type(EventTypes.GENERATION_COMPLETED)
    .codeId('chain-test-123')
    .data({
      success: true
    })
    .emit();

  // Wait for events to propagate
  await new Promise(resolve => setTimeout(resolve, 100));
}

// Example 3: Error handling with events
export function example3ErrorHandling() {
  console.log('\n=== Example 3: Error Handling with Events ===\n');

  // Error handler with retry logic
  const retryCount = new Map<string, number>();

  globalEventEmitter.on(EventTypes.GENERATION_FAILED, async (event) => {
    const codeId = event.codeId || 'unknown';
    const count = retryCount.get(codeId) || 0;

    if (count < 3) {
      console.log(`Retrying generation for ${codeId} (attempt ${count + 1})`);
      retryCount.set(codeId, count + 1);

      // Retry after delay
      setTimeout(() => {
        new EventBuilder()
          .type(EventTypes.GENERATION_STARTED)
          .codeId(codeId)
          .data({
            retry: true,
            attemptNumber: count + 1
          })
          .emit();
      }, 1000 * Math.pow(2, count)); // Exponential backoff
    } else {
      console.error(`Max retries exceeded for ${codeId}`);
      retryCount.delete(codeId);
    }
  });

  // Simulate failure
  new EventBuilder()
    .type(EventTypes.GENERATION_FAILED)
    .codeId('retry-test-123')
    .data({
      error: 'Network timeout',
      duration: 5000
    })
    .emit();
}

// Example 4: Performance monitoring
export function example4PerformanceMonitoring() {
  console.log('\n=== Example 4: Performance Monitoring ===\n');

  const performanceStats = new Map<string, any[]>();

  // Collect performance metrics
  globalEventEmitter.on(EventTypes.GENERATION_COMPLETED, (event) => {
    const stats = performanceStats.get('generation') || [];
    stats.push({
      timestamp: event.timestamp,
      duration: event.data.duration,
      codeSize: event.data.codeSize
    });
    performanceStats.set('generation', stats);

    // Calculate average
    const avgDuration = stats.reduce((sum, s) => sum + s.duration, 0) / stats.length;
    console.log(`Average generation time: ${avgDuration.toFixed(2)}ms`);
  });

  // Threshold monitoring
  globalEventEmitter.on(EventTypes.PERFORMANCE_THRESHOLD_EXCEEDED, (event) => {
    console.warn('⚠️ Performance threshold exceeded:', {
      metric: event.data.metric,
      threshold: event.data.threshold,
      actual: event.data.actual
    });

    // Could trigger auto-scaling or optimization
  });

  // Simulate multiple generations
  for (let i = 0; i < 5; i++) {
    new EventBuilder()
      .type(EventTypes.GENERATION_COMPLETED)
      .codeId(`perf-test-${i}`)
      .data({
        duration: Math.random() * 3000 + 1000,
        codeSize: Math.random() * 1000 + 500,
        success: true
      })
      .emit();
  }
}

// Example 5: Full integration with code generator
export async function example5FullIntegration() {
  console.log('\n=== Example 5: Full Integration ===\n');

  // Initialize services
  initializeServices();

  // Register all event listeners
  registerEventListeners();

  // Set up custom analytics listener
  const analytics = {
    totalGenerations: 0,
    successfulGenerations: 0,
    totalDuration: 0,
    errors: [] as any[]
  };

  globalEventEmitter.on(EventTypes.GENERATION_COMPLETED, (event) => {
    analytics.totalGenerations++;
    if (event.data.success) {
      analytics.successfulGenerations++;
    }
    analytics.totalDuration += event.data.duration as number;
  });

  globalEventEmitter.on(EventTypes.GENERATION_FAILED, (event) => {
    analytics.errors.push({
      timestamp: event.timestamp,
      error: event.data.error
    });
  });

  // Create code generator with events
  const generator = new DynamicCodeGeneratorWithEvents(globalContainer);

  // Generate code
  const request: CodeGenerationRequest = {
    description: 'Transform data by adding timestamps and validation',
    nodeType: 'code',
    workflowContext: {
      workflowPurpose: 'Data processing'
    },
    requirements: {
      language: 'javascript',
      errorHandling: 'comprehensive'
    }
  };

  try {
    const result = await generator.generateCode(request);
    console.log('Generated code:', result.code.substring(0, 200) + '...');
  } catch (error) {
    console.error('Generation failed:', error);
  }

  // Display analytics
  console.log('\n📊 Analytics:', {
    totalGenerations: analytics.totalGenerations,
    successRate: `${(analytics.successfulGenerations / analytics.totalGenerations * 100).toFixed(1)}%`,
    avgDuration: `${(analytics.totalDuration / analytics.totalGenerations).toFixed(2)}ms`,
    errorCount: analytics.errors.length
  });
}

// Example 6: Event history and replay
export function example6EventHistory() {
  console.log('\n=== Example 6: Event History ===\n');

  // Process some events
  const events = [
    { type: EventTypes.GENERATION_STARTED, codeId: 'history-1' },
    { type: EventTypes.GENERATION_COMPLETED, codeId: 'history-1', data: { duration: 1200 } },
    { type: EventTypes.VALIDATION_STARTED, codeId: 'history-1' },
    { type: EventTypes.VALIDATION_COMPLETED, codeId: 'history-1', data: { isValid: true } }
  ];

  events.forEach(event => {
    new EventBuilder()
      .type(event.type)
      .codeId(event.codeId)
      .data(event.data || {})
      .emit();
  });

  // Get history
  const history = globalEventEmitter.getHistory();
  console.log(`Total events in history: ${history.length}`);

  // Get specific event type history
  const generationHistory = globalEventEmitter.getHistory(EventTypes.GENERATION_COMPLETED);
  console.log(`Generation completed events: ${generationHistory.length}`);

  // Replay events (useful for debugging)
  console.log('\nReplaying last 5 events:');
  history.slice(-5).forEach(event => {
    console.log(`- ${event.type} at ${event.timestamp}`);
  });
}

// Example 7: Custom event patterns
export function example7CustomPatterns() {
  console.log('\n=== Example 7: Custom Event Patterns ===\n');

  // Implement saga pattern
  class CodeGenerationSaga {
    private state: Map<string, any> = new Map();

    constructor() {
      this.registerHandlers();
    }

    private registerHandlers() {
      globalEventEmitter.on(EventTypes.GENERATION_STARTED, (event) => {
        this.state.set(event.codeId!, {
          status: 'generating',
          startTime: Date.now()
        });
      });

      globalEventEmitter.on(EventTypes.GENERATION_COMPLETED, (event) => {
        const state = this.state.get(event.codeId!);
        if (state) {
          state.status = 'validating';
          // Trigger next step
          new EventBuilder()
            .type(EventTypes.VALIDATION_STARTED)
            .codeId(event.codeId!)
            .emit();
        }
      });

      globalEventEmitter.on(EventTypes.VALIDATION_COMPLETED, (event) => {
        const state = this.state.get(event.codeId!);
        if (state && event.data.isValid) {
          state.status = 'optimizing';
          // Trigger optimization
          new EventBuilder()
            .type(EventTypes.OPTIMIZATION_STARTED)
            .codeId(event.codeId!)
            .emit();
        }
      });

      globalEventEmitter.on(EventTypes.OPTIMIZATION_COMPLETED, (event) => {
        const state = this.state.get(event.codeId!);
        if (state) {
          state.status = 'completed';
          const totalTime = Date.now() - state.startTime;
          console.log(`Saga completed for ${event.codeId} in ${totalTime}ms`);
          this.state.delete(event.codeId!);
        }
      });
    }

    start(codeId: string) {
      new EventBuilder()
        .type(EventTypes.GENERATION_STARTED)
        .codeId(codeId)
        .emit();
    }
  }

  const saga = new CodeGenerationSaga();
  saga.start('saga-test-123');
}

// Run all examples
export async function runAllExamples() {
  example1BasicEvents();
  await example2ChainedEvents();
  example3ErrorHandling();
  example4PerformanceMonitoring();
  await example5FullIntegration();
  example6EventHistory();
  example7CustomPatterns();
}