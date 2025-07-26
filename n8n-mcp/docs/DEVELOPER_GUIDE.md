# n8n MCP Developer Guide

## Table of Contents
1. [Workflow Structure Requirements](#workflow-structure-requirements)
2. [Error Tracking System](#error-tracking-system)
3. [AI Provider Integration](#ai-provider-integration)
4. [Validation System](#validation-system)
5. [Best Practices](#best-practices)

## Workflow Structure Requirements

### Required Fields for n8n Workflows

Every workflow MUST include the following fields for n8n compatibility:

```typescript
interface N8nWorkflow {
  // Required fields
  name: string;              // Workflow name
  nodes: N8nNode[];         // Array of workflow nodes
  connections: Connections;  // Node connections object
  active: boolean;          // Workflow active state
  settings: Settings;       // Workflow settings
  
  // Required metadata fields
  id: string;               // Unique workflow identifier
  versionId: string;        // Version tracking ID
  meta: {
    instanceId: string;     // n8n instance identifier
  };
  tags: string[];          // Workflow tags (can be empty array)
  pinData: object;         // Pinned data for nodes (can be empty object)
}
```

### ID Generation

Use the centralized ID generators from `utils/id-generator.ts`:

```typescript
import { generateWorkflowId, generateVersionId, generateInstanceId } from '../utils/id-generator.js';

const workflow = {
  id: generateWorkflowId(),        // Format: wf_timestamp_random
  versionId: generateVersionId(),  // Format: random UUID
  meta: {
    instanceId: generateInstanceId() // Format: random UUID
  }
};
```

### Node Structure

Each node must have:

```typescript
interface N8nNode {
  id: string;              // Unique node ID within workflow
  name: string;            // Display name (must be unique)
  type: string;            // n8n node type (e.g., 'n8n-nodes-base.httpRequest')
  typeVersion: number;     // Node type version
  position: [number, number]; // [x, y] coordinates
  parameters: object;      // Node-specific parameters
}
```

### Connection Structure

Connections use node names (not IDs) as keys:

```typescript
interface Connections {
  [nodeName: string]: {
    main: Array<Array<{
      node: string;      // Target node name
      type: 'main';      // Connection type
      index: number;     // Output index (usually 0)
    }>>
  }
}
```

### Example Minimal Valid Workflow

```typescript
const validWorkflow = {
  name: "My Workflow",
  nodes: [
    {
      id: "1",
      name: "Start",
      type: "n8n-nodes-base.start",
      typeVersion: 1,
      position: [250, 300],
      parameters: {}
    }
  ],
  connections: {},
  active: false,
  settings: {},
  id: generateWorkflowId(),
  versionId: generateVersionId(),
  meta: {
    instanceId: generateInstanceId()
  },
  tags: [],
  pinData: {}
};
```

## Error Tracking System

### Using the Error Tracker

The error tracking system automatically monitors workflow generation failures:

```typescript
import { errorTracker } from './monitoring/error-tracker.js';

// Track an error
await errorTracker.trackError({
  type: 'generation',  // or 'validation', 'serialization', 'ai_provider', 'node_configuration'
  severity: 'error',   // or 'critical', 'warning'
  message: 'Failed to generate workflow',
  details: {
    // Any relevant error details
  },
  context: {
    prompt: userPrompt,
    workflowName: name,
    provider: 'anthropic',
    nodeCount: 50,
    phase: 'generation'
  }
});
```

### Error Types

- **generation**: Workflow generation failures
- **validation**: Validation errors (disconnected nodes, missing parameters)
- **serialization**: JSON serialization issues (circular references)
- **ai_provider**: AI API errors (timeouts, rate limits)
- **node_configuration**: Invalid node configurations

### Monitoring Endpoints

- `GET /api/monitoring/errors` - Recent errors
- `GET /api/monitoring/errors/metrics` - Error metrics
- `GET /api/monitoring/errors/insights` - System insights and recommendations
- `POST /api/monitoring/errors/search` - Search errors
- `GET /api/monitoring/errors/export?format=json|csv` - Export errors

### Error Analysis

The system automatically:
- Detects common error patterns
- Tracks resolution success rates
- Provides improvement recommendations
- Monitors provider reliability

## AI Provider Integration

### Adding a New Provider

1. Create provider class extending `BaseAIProvider`:

```typescript
import { BaseAIProvider } from './base-provider.js';
import { errorTracker } from '../monitoring/error-tracker.js';

export class MyProvider extends BaseAIProvider {
  name: AIProvider = 'myprovider';
  
  async generateWorkflow(prompt: string, name: string): Promise<any> {
    try {
      // Implementation
    } catch (error) {
      // Always track errors
      await errorTracker.trackError({
        type: 'ai_provider',
        severity: 'error',
        message: error.message,
        context: { provider: this.name }
      });
      throw error;
    }
  }
}
```

2. Register in `ProviderFactory`:

```typescript
case 'myprovider':
  return new MyProvider(options);
```

### Provider Best Practices

- Implement retry logic for transient failures
- Use appropriate timeouts (2 minutes for generation)
- Track all errors for monitoring
- Return consistent error formats
- Validate responses before returning

## Validation System

### Validation Pipeline

1. **QuickValidator** - Fast connection validation
   - Checks disconnected nodes
   - Validates connections
   - Auto-fixes simple issues

2. **WorkflowValidator** - Comprehensive validation
   - Node type validation
   - Parameter checking
   - Learning from past errors

3. **WorkflowSanitizer** - n8n compatibility
   - Parameter normalization
   - Type corrections

### Auto-Fix Capabilities

The system can automatically fix:
- Disconnected nodes (connected by position)
- Missing webhook paths
- Missing code in Function nodes
- Sequential connections
- Basic parameter issues

### What Cannot Be Auto-Fixed

- Complex branch logic errors
- Business logic issues
- Missing required integrations
- Semantic errors in code

## Best Practices

### 1. Error Handling Philosophy

**Never hide errors with minimal responses:**

```typescript
// ❌ BAD
catch (error) {
  return { nodes: [], connections: {} }; // Don't do this!
}

// ✅ GOOD
catch (error) {
  // Log detailed error
  console.error('Detailed error:', error);
  
  // Track for analysis
  await errorTracker.trackError({...});
  
  // Throw with context
  throw new Error(`Workflow generation failed: ${error.message}`);
}
```

### 2. Workflow Generation

**Always validate before returning:**

```typescript
const workflow = generateWorkflow();

// Validate structure
const validation = validator.validate(workflow);
if (!validation.isValid) {
  // Attempt auto-fix
  workflow = validator.autoFix(workflow);
}

// Ensure metadata
workflow.id = workflow.id || generateWorkflowId();
workflow.versionId = workflow.versionId || generateVersionId();
```

### 3. Connection Management

**Use node names, not IDs:**

```typescript
// ❌ BAD
connections["1"] = { main: [[{ node: "2" }]] };

// ✅ GOOD
connections["Start Node"] = { main: [[{ node: "Process Node" }]] };
```

### 4. Multi-Step Generation

For complex workflows (>50 nodes), use multi-step generation:

1. Create generation plan
2. Generate sections independently
3. Merge with proper connections
4. Validate complete workflow

### 5. Performance Considerations

- Batch API requests when possible
- Use progress callbacks for long operations
- Implement reasonable timeouts
- Cache node catalog lookups

### 6. Security

- Never log API keys or credentials
- Sanitize user inputs
- Validate all external data
- Use environment variables for secrets

## Debugging Tips

### Common Issues and Solutions

1. **"Could not find property option" error**
   - Missing required metadata fields
   - Check id, versionId, meta fields

2. **Disconnected nodes**
   - Nodes not in connections object
   - Use QuickValidator.autoFix()

3. **Circular reference errors**
   - Complex object references
   - Use cleanWorkflow() utility

4. **Timeout errors**
   - Large workflow generation
   - Increase timeout or optimize prompt

### Debug Tools

1. **Workflow inspection:**
   ```bash
   cat /tmp/cleaned-workflow.json | jq '.'
   ```

2. **Error logs:**
   ```bash
   tail -f logs/workflow-errors/*.jsonl
   ```

3. **API testing:**
   ```bash
   curl http://localhost:3006/api/monitoring/errors/insights
   ```

## Testing

### Unit Tests

Test individual components:

```typescript
describe('WorkflowValidator', () => {
  it('should detect disconnected nodes', () => {
    const workflow = { nodes: [...], connections: {} };
    const result = validator.validate(workflow);
    expect(result.isValid).toBe(false);
  });
});
```

### Integration Tests

Test complete workflows:

```typescript
it('should generate valid workflow', async () => {
  const result = await generator.generateFromPrompt('test prompt');
  expect(result.workflow.id).toBeDefined();
  expect(result.workflow.versionId).toBeDefined();
});
```

### Error Scenario Tests

Test error handling:

```typescript
it('should track timeout errors', async () => {
  // Simulate timeout
  const errorId = await errorTracker.trackError({
    type: 'ai_provider',
    severity: 'error',
    message: 'Request timeout'
  });
  
  const error = await errorTracker.getErrorById(errorId);
  expect(error.type).toBe('ai_provider');
});
```

## Contributing

1. Follow the error handling philosophy
2. Add comprehensive error tracking
3. Write tests for new features
4. Update documentation
5. Never introduce hardcoded templates