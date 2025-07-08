# Automation Hub MCP Servers - Claude Code Integration

## Project Overview
This is an AI-powered automation platform that helps users create workflows across multiple platforms (n8n, Vapi, Zapier, etc.) using natural language prompts.

## Key Components

### 1. **n8n MCP Server** (`/n8n-mcp/`)
- AI-powered workflow generation using OpenAI/Anthropic
- Training data system for continuous improvement
- HTTP API server on port 3006
- MCP server for tool-based integration

### 2. **Auth MCP Server** (`/auth-mcp/`)
- User authentication and session management
- Encrypted credential storage
- HTTP API server on port 3005

### 3. **API Gateway** (`/api-gateway/`)
- Central routing hub on port 8080
- Routes: `/api/auth/*` → auth service, `/api/n8n/*` → n8n service

### 4. **Web Interface** (`/web-interface/`)
- React-based frontend on port 5173
- Automation creation with AI assistance
- Credential management

## Current Session Summary (2025-01-07)

### Issues Reported by User:
1. **Disconnected Nodes**: "Final Orchestration" node remains disconnected in generated workflows
2. **Duplicate Workflows**: Creating 2 identical workflows instead of 1
3. **Empty Workflow Error**: "propertyValues[itemName] is not iterable" error on first attempt

### Implemented Solutions:

1. **validateBranchConnections** - Validates each branch immediately after AI generation:
   - Normalizes connection format (string vs object)
   - Creates linear connections if none exist
   - Finds truly disconnected nodes
   - Connects orphans based on position and node type
   - Ensures proper start_node and end_nodes

2. **Improved AI Prompts**:
   - Added validation checklist in prompts
   - Emphasized connection requirements
   - Provided exact connection format examples
   - Required every node to appear in connections

3. **Connection Normalization**:
   - Handles both string format: `"NodeName"`
   - And object format: `{"node": "NodeName", "type": "main", "index": 0}`
   - Ensures consistent object format throughout

4. **Fixed Duplicate Workflow Creation**:
   - Root cause: `n8n_generate_workflow` endpoint was creating the workflow AND returning it
   - Frontend then called `n8n_create_workflow` again with the same data
   - Solution: Modified `n8n_generate_workflow` to only generate and return the workflow structure
   - The actual creation now happens only in the `n8n_create_workflow` call

5. **Special Handling for Final/Orchestration Nodes**:
   - Added logic in `validateAndFixConnections` to connect final/orchestration nodes to the last merge node
   - Ensures these nodes are properly connected in the workflow

### Files Modified Today:
- `/n8n-mcp/src/ai-workflow-generator.ts` - Added validateBranchConnections and final node handling
- `/n8n-mcp/training-data/n8n-workflow-patterns.json` - Added learning from disconnected nodes issue
- `/n8n-mcp/src/n8n-client.ts` - Added undefined check for workflow
- `/n8n-mcp/src/http-server.ts` - Fixed duplicate creation by removing createWorkflow call

## Next Steps:
1. Fix AI response parsing to extract workflow properly
2. Test complex workflows with new validation
3. Verify disconnected nodes are reduced

## Testing Commands:
```bash
# Simple test
curl -X POST http://localhost:8080/api/n8n/tools/n8n_generate_workflow \
  -H "Content-Type: application/json" \
  -d '{"prompt": "webhook", "name": "test"}'

# Complex workflow test
curl -X POST http://localhost:8080/api/n8n/tools/n8n_generate_workflow \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Complex workflow with BRANCH...", "name": "complex test"}'
```