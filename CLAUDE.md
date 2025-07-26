# Automation Hub MCP Servers - Development Guidelines

## 🚨 CRITICAL: NO TEMPLATES ALLOWED 🚨

**NEVER ADD HARDCODED TEMPLATES OR PATTERNS TO THIS PROJECT!**

We use pure AI-driven workflow generation. Any hardcoded templates, domain-specific patterns, or pre-defined workflow structures will:
- Cause duplicate content issues
- Override user intentions
- Create maintenance nightmares
- Break the AI's creative workflow generation

## Project Overview

AI-powered automation platform for creating workflows across multiple platforms (n8n, Vapi, Zapier, etc.) using natural language.

## Architecture

### 1. **n8n MCP Server** (`/n8n-mcp/`)
- **Purpose**: AI workflow generation and n8n integration
- **Port**: 3006
- **Key Features**:
  - AI-powered workflow generation (OpenAI/Anthropic)
  - Quick & Advanced workflow builders
  - Node catalog system
  - Connection validation & auto-fix
  - NO TEMPLATES - pure AI generation

### 2. **Auth MCP Server** (`/auth-mcp/`)
- **Purpose**: Authentication and credential management
- **Port**: 3005
- **Features**:
  - JWT-based authentication
  - Encrypted credential storage
  - Session management
  - **IMPORTANT**: Users MUST use their own credentials - no env fallbacks!

### 3. **API Gateway** (`/api-gateway/`)
- **Purpose**: Central routing and request forwarding
- **Port**: 8080
- **Routes**:
  - `/api/auth/*` → Auth service (port 3005)
  - `/api/n8n/*` → n8n service (port 3006)

### 4. **Web Interface** (`/web-interface/`)
- **Purpose**: User interface
- **Port**: 5173
- **Tech**: React + TypeScript + Tailwind
- **Features**:
  - AI Assistant for workflow creation
  - Credential management
  - Workflow visualization

## Development Principles

### 1. **AI-First Approach**
- All workflow generation must be AI-driven
- NO hardcoded templates or patterns
- Let AI analyze and create unique workflows
- Trust the AI's creativity

### 2. **Dynamic Prompt Generation**
- Use `DynamicPromptGenerator` for AI analysis
- Never fallback to templates
- Keep prompts clean and user-focused
- Don't add unnecessary metadata

### 3. **Workflow Quality**
- Focus on connection validation
- Auto-fix disconnected nodes
- Ensure proper node types via catalog
- Validate against user requirements

### 4. **Error Handling**
- Clear error messages
- Graceful fallbacks (but NOT to templates!)
- Comprehensive logging
- User-friendly notifications

## Key Systems

### Workflow Generation V2 (`ai-workflow-generator-v2.ts`)
- **Quick Mode**: Simple sequential workflows
- **Advanced Mode**: Complex workflows with parallel execution, switches, merges
- **Auto-detection**: Chooses mode based on complexity
- **Validation**: Auto-fixes disconnected nodes

### Node Catalog (`n8n-node-catalog.ts`)
- 50+ n8n node definitions
- Intelligent node matching
- Use case based selection
- Category organization

### Prompt Processing
- **Parser**: Handles BRANCH and numbered list formats
- **Builder**: Creates proper n8n JSON structure
- **Validator**: Ensures all nodes connected
- **NO TEMPLATES**: Pure AI-based generation

## Common Issues & Solutions

### Issue: "Use this prompt" adds duplicate content
**Solution**: Removed all template systems. Now only uses user's original request.

### Issue: Disconnected nodes
**Solution**: QuickValidator with auto-fix based on node positions.

### Issue: Wrong node types
**Solution**: Node catalog with intelligent matching.

### Issue: Multiple workflows in response
**Solution**: PromptCleaner detects and removes secondary workflows.

## 🚨 CRITICAL: Workflow Validation Rules 🚨

**EVERY workflow MUST be validated before returning to user!**

### Validation Pipeline:
1. **During Generation** (ai-workflow-generator-v2.ts):
   - QuickValidator.validate() after building
   - QuickValidator.autoFix() if validation fails
   - Re-validate after fixes

2. **Before Response** (http-server-v2.ts):
   - WorkflowValidator for comprehensive checks
   - QuickValidator.autoFix() for connection issues
   - Clean circular references

3. **What Gets Fixed Automatically**:
   - Disconnected nodes (connected by position)
   - Missing webhook paths
   - Missing code in Function/Code nodes
   - Sequential connections for isolated nodes
   - Invalid node types (via WorkflowValidator)

4. **What Still Needs Manual Implementation**:
   - Merge node insertion for parallel branches
   - Recovery strategy execution nodes
   - Database save operations after updates
   - Proper branch termination

### Validation Classes:
- **QuickValidator**: Fast connection validation & auto-fix
- **WorkflowValidator**: Comprehensive validation with learning
- **WorkflowSanitizer**: Parameter correction for n8n compatibility

**NEVER skip validation - it's the difference between a working and broken workflow!**

## 🚨 CRITICAL: No Dummy/Mock/Template Nodes or Data! 🚨

**NEVER create dummy, mock, placeholder, or template nodes/data!**

This includes:
- ❌ No dummy action nodes for empty switch outputs
- ❌ No placeholder nodes for missing connections
- ❌ No template nodes for any purpose
- ❌ No mock data in any form
- ❌ No arbitrary "nearest node" connections
- ❌ No meaningless branch connections just to "fix" validation

**Why?**
- Violates our "no templates" principle
- Creates confusion for users
- Hides real validation errors
- Goes against pure AI-driven generation
- Creates non-functional workflows that look valid but don't work

**Instead:**
- Report validation errors clearly
- Let AI fix its own mistakes
- Trust the AI to generate complete workflows
- If a switch has empty outputs, it's an AI generation error
- Each branch must have a meaningful conclusion

## 🚨 CRITICAL: No Duplicate Methods or Code! 🚨

**NEVER create duplicate methods, functions, or code blocks!**

### Common Duplication Issues to Avoid:
1. **Duplicate Method Declarations**: Never declare the same method multiple times in a class
2. **Copy-Paste Programming**: Don't copy entire methods between files - extract to shared utilities
3. **Multiple Abstract Declarations**: Abstract methods should only be declared once in base class
4. **Repeated Utility Functions**: Common utilities like ID generation, crypto, or math should be centralized

### Best Practices:
1. **Extract Common Code**: Create utility modules in `/src/utils/` for shared functionality
2. **Use Inheritance Properly**: Implement abstract methods in child classes, don't redeclare them
3. **Single Source of Truth**: Each function should have one implementation, one location
4. **DRY Principle**: Don't Repeat Yourself - if you need the same code twice, refactor it

### Examples of What NOT to Do:
```typescript
// ❌ BAD: Same method in multiple files
// file1.ts
generateId(): string { return uuid(); }

// file2.ts
generateId(): string { return uuid(); }

// ✅ GOOD: Shared utility
// utils/id-generator.ts
export function generateId(): string { return uuid(); }

// file1.ts & file2.ts
import { generateId } from './utils/id-generator';
```

### Before Creating Any Method:
1. **Search First**: Check if a similar method already exists
2. **Consider Extraction**: If you need it in multiple places, put it in utils
3. **Review Inheritance**: For class methods, check if parent class already has it
4. **Avoid Copy-Paste**: Never copy code between files without refactoring

## 🔄 CRITICAL: Keep Learning System Updated 🔄

**When updating CLAUDE.md, ALWAYS update the learning system rules!**

### Update Checklist:
1. **New Rules Added**: Update `/n8n-mcp/src/learning/system-rules.ts`
2. **Best Practices Changed**: Add to `SYSTEM_RULES.bestPractices`
3. **Errors to Avoid**: Add to `SYSTEM_RULES.avoidErrors`
4. **Critical Requirements**: Add to `SYSTEM_RULES.principles` with severity: 'critical'
5. **Validation Rules**: Add to appropriate category in system-rules.ts

### Why This Matters:
- Learning engine uses these rules to enhance every prompt
- AI gets pre-instructed with our latest best practices
- Ensures consistent behavior across all workflow generations
- Prevents regression to old patterns

### How to Update:
```typescript
// Example: Adding a new critical rule
{
  category: 'your_category',
  rule: 'Your new rule description',
  description: 'Why this rule exists',
  severity: 'critical', // or 'error', 'warning'
  examples: {
    wrong: 'What not to do',
    correct: 'What to do instead'
  }
}
```

## 🔀 CRITICAL: Switch Node Rules 🔀

**EVERY switch node MUST have properly defined outputs!**

### Switch Node Requirements:
1. **Define All Cases**: Every possible case must have an output
2. **Connect All Outputs**: Each case must connect to processing nodes
3. **No Empty Branches**: Never leave a switch output unconnected
4. **Meaningful Routing**: Each route must serve a purpose

### Example:
```json
"connections": {
  "Route By Type": {
    "main": [
      [{"node": "Process Type A", "type": "main", "index": 0}],
      [{"node": "Process Type B", "type": "main", "index": 0}],
      [{"node": "Handle Unknown", "type": "main", "index": 0}]
    ]
  }
}
```

## 🔗 CRITICAL: Multi-Section Connection Rules 🔗

**When generating workflows in sections, connections between sections are MANDATORY!**

### Section Connection Rules:
1. **Explicit Dependencies**: Each section must know its dependencies
2. **End-to-Start Connections**: Last nodes of section A must connect to first nodes of section B
3. **No Orphan Sections**: Every section must be part of the workflow flow
4. **Validate After Merge**: Always validate the complete workflow after merging

### Common Section Connection Errors:
- ❌ Generating sections independently without connections
- ❌ Dead-end nodes at section boundaries
- ❌ Missing connections between dependent sections
- ❌ Switch nodes without output definitions

### Correct Section Connection:
```typescript
// When merging sections, ensure connections:
prevSection.endNodeIds.forEach(endId => {
  connections[endId] = {
    main: [[{
      node: currentSection.startNodeId,
      type: "main",
      index: 0
    }]]
  };
});
```

## 🎯 CRITICAL: Holistic Approach to Problem Solving 🎯

**ALWAYS approach problems holistically to achieve the system's purpose!**

### Core Principles:
0. **Excellence Over Shortcuts**: Never return "minimal" or "fallback" responses when errors occur
   - Every error is an opportunity to improve the system
   - Investigate root causes, don't paper over problems
   - Fail loudly with detailed error reports rather than silently with minimal data
   - Our system must be near-perfect; invest in long-term quality
1. **Don't Hide Problems**: Never cover up errors with quick fixes
2. **Research When Needed**: Take time to find proper solutions
3. **Meaningful Connections**: Every node connection must serve the workflow's purpose
4. **Branch Completion**: Each branch must reach a logical conclusion:
   - Database save/update
   - Email/notification send
   - API call that completes an action
   - File write operation
   - Any operation that fulfills the branch's purpose
5. **Respect User Preferences**: ALWAYS use the user's chosen provider
   - Never default to OpenAI or any specific provider
   - If user selected Anthropic, use Anthropic
   - If user selected Gemini, use Gemini
   - Provider choice is sacred - respect it!

### Validation Philosophy:
- **Smart Merging**: Only merge branches that need merging
- **Complete Branches**: Don't force-merge branches that already have proper conclusions
- **Purpose-Driven**: Every connection must help achieve the workflow's goal
- **Iterative Improvement**: Don't just report errors - actively fix them:
  1. Auto-fix what's possible
  2. Request AI corrections for complex issues
  3. Re-validate after each fix
  4. Repeat until resolved (with reasonable limits)

### Error Resolution Strategy:
1. **First Pass**: QuickValidator auto-fix (connections, basic issues)
2. **Second Pass**: AI-assisted repair for remaining issues
3. **Third Pass**: Final validation and detailed error report
4. **Maximum Attempts**: 3 iterations to prevent infinite loops
5. **Transparency**: Include unresolved issues in response

### Branch Completion Rules:
1. A branch is complete when it:
   - Saves data (database, file, API)
   - Sends communication (email, SMS, notification)
   - Responds to a webhook
   - Performs a final action that fulfills its purpose

2. Don't merge branches that:
   - Already have terminal nodes
   - Complete their purpose independently
   - End with meaningful operations

3. Only merge branches when:
   - Multiple paths need to converge for the next step
   - The workflow logic requires combining results
   - Branches are incomplete and need continuation

## Testing

### Basic Workflow Test
```bash
curl -X POST http://localhost:8080/api/n8n/tools/n8n_generate_workflow \
  -H "Content-Type: application/json" \
  -d '{"prompt": "send email when form submitted", "name": "Contact Form"}'
```

### Complex Workflow Test
```bash
curl -X POST http://localhost:8080/api/n8n/tools/n8n_generate_workflow \
  -H "Content-Type: application/json" \
  -d '{"prompt": "monitor brand reputation with parallel processing", "name": "Brand Monitor"}'
```

## DO NOT ADD

❌ Domain templates
❌ Workflow patterns
❌ Hardcoded prompt structures
❌ Pre-defined node sequences
❌ Template-based generation
❌ Fixed workflow architectures
❌ Environment variable API keys for providers
❌ Fallback to .env credentials

## ALWAYS USE

✅ AI-driven generation
✅ Dynamic analysis
✅ User's exact requirements
✅ Creative workflow design
✅ Node catalog for type matching
✅ Connection validation

## Important Notes

### Credential Encryption
- The auth service uses AES-256-GCM encryption for credentials
- ENCRYPTION_KEY must be set in `/auth-mcp/.env`
- If ENCRYPTION_KEY changes, existing credentials cannot be decrypted
- Users must re-save credentials after encryption key changes
- **NEVER** change ENCRYPTION_KEY in production without a migration plan

## Developer Resources

- **Developer Guide**: See `/n8n-mcp/docs/DEVELOPER_GUIDE.md` for:
  - Workflow metadata requirements
  - Error tracking system usage
  - Validation pipeline details
  - Debugging tips and tools

## 🚨 CRITICAL: n8n Node Parameter Formats 🚨

**n8n requires specific parameter formats for certain nodes!**

### Common Parameter Format Issues:
1. **Email Send Node (`emailSend`)**:
   - `toRecipients` MUST be an array, not a string
   - ❌ Wrong: `"toRecipients": "admin@example.com"`
   - ✅ Correct: `"toRecipients": ["admin@example.com"]`

2. **Merge Node**:
   - `mergeByFields.values` MUST be an array
   - Even if empty, it should be `[]`

3. **MongoDB Node**:
   - `documentId` requires specific structure:
   ```json
   "documentId": {
     "__rl": true,
     "value": "{{$json.id}}",
     "mode": "id"
   }
   ```

4. **Switch Node**:
   - Must have `mode` parameter (e.g., "expression")
   - Must have `options` object (at least empty `{}`)

### Error: "propertyValues[itemName] is not iterable"
This error occurs when n8n expects an array but receives a string or other non-iterable value. The `cleanWorkflow` function in `json-cleaner.ts` now automatically fixes these issues.

### Implementation:
Parameter format fixes are handled in two complementary systems:

1. **json-cleaner.ts**: Quick fixes during workflow generation
   - Converts string `toRecipients` to array format
   - Ensures merge node fields are properly structured
   - Fixes MongoDB documentId format
   - Adds required switch node parameters
   - Fixes HTTP Request header/query parameters to array format
   - Ensures Code node language and code parameters
   - Validates Set, If, Filter, and other node structures

2. **node-parameters-registry.ts**: Comprehensive parameter validation
   - Centralized registry of all node parameter requirements
   - Type validation and transformation
   - Default value application
   - Required parameter enforcement
   - Custom validators for complex requirements

### Common Node Parameter Requirements:

1. **Array Parameters** (MUST be arrays, not strings/objects):
   - emailSend/sendEmail: `toRecipients`
   - httpRequest: `headerParameters.parameters`, `queryParameters.parameters`
   - merge: `mergeByFields.values`
   - set: `values.values`
   - if/filter: `conditions.conditions`
   - scheduleTrigger: `rule.interval`
   - slack: `attachments`
   - aggregate: `fieldsToAggregate.fieldToAggregate`

2. **Object Parameters** (MUST be objects with specific structure):
   - mongoDb: `documentId` requires `{__rl: true, value: "...", mode: "id"}`
   - switch: `options` (at least empty `{}`)
   - httpRequest headers/query: Array of `{name: "...", value: "..."}`

3. **Required Parameters**:
   - webhook: `httpMethod`, `path`
   - httpRequest: `method`, `url`
   - code: `language`, `jsCode`/`pythonCode`
   - switch: `mode`
   - All operation-based nodes: `operation`

4. **Language-Specific Parameters**:
   - Code node: `jsCode` for JavaScript, `pythonCode` for Python
   - Different parameter names based on selected options

## Session History

### 2025-01-26 Updates (continued)
- Fixed "propertyValues[itemName] is not iterable" error:
  - Root cause: emailSend nodes expecting array for toRecipients but receiving string
  - Added automatic parameter format fixing in json-cleaner.ts
  - System now converts incorrect parameter formats to n8n-compatible formats
- Added comprehensive node parameter validation and auto-fixing
- Created node-parameters-registry.ts for centralized parameter management:
  - Supports 30+ common n8n nodes
  - Automatic type conversion and validation
  - Default value application
  - Custom validators for complex requirements
- Analyzed n8n node documentation to extract parameter requirements:
  - HTTP Request: headers/query must be arrays of {name, value} objects
  - Code node: language-specific code parameters (jsCode vs pythonCode)
  - Set/If/Filter: nested array structures for conditions
  - Webhook: required path and method parameters
- Enhanced json-cleaner.ts with additional node fixes:
  - HTTP Request parameter arrays
  - Code node language detection
  - Multiple condition-based nodes
  - Trigger node configurations

### 2025-01-26 Updates
- Added comprehensive switch node validation and rules:
  - Switch nodes must have all output branches explicitly defined
  - Each case must connect to meaningful processing nodes
  - No empty branches allowed
- Implemented multi-section workflow connection rules:
  - Sections must be explicitly connected
  - End-to-start connections are mandatory
  - Dead-end nodes are not allowed
- Updated system components:
  - `system-rules.ts`: Added switch node and section connection rules
  - `enhanced-prompt-generator.ts`: Added switch node guidance
  - `multi-step-generator.ts`: Added critical connection requirements
  - `workflow-validator.ts`: Added validateSwitchNodes method
  - `learning-engine.ts`: Added switch pattern learning
- Root cause analysis of "Satellite Image Analysis" workflow failure:
  - 64 disconnected nodes due to missing section connections
  - Switch nodes without output definitions
  - Dead-end nodes with no logical conclusion

### 2025-01-25 Updates
- Fixed critical issue: n8n showing empty workflow with "Could not find property option" error
- Root cause: `cleanWorkflow()` function was stripping out essential n8n metadata fields
- Fixed `json-cleaner.ts` to preserve all required fields: id, versionId, meta, tags, pinData
- Fixed `multi-step-generator.ts` to include all metadata fields when merging workflow sections
- Issue: Multi-step workflow generation was creating workflows without required n8n metadata
- Solution: Added ID generation and metadata fields to the mergeSections method
- Added comprehensive error tracking system:
  - Tracks all workflow generation failures
  - Monitors AI provider errors and timeouts
  - Provides insights and recommendations
  - Exports error data for analysis
- Created Developer Guide documenting:
  - Workflow metadata requirements
  - Error tracking usage
  - Best practices and debugging tips
- Fixed learning engine integration:
  - Removed hardcoded OpenAI references
  - Learning system now uses user's selected AI provider
  - Created centralized LearningService
  - Integrated system rules from CLAUDE.md into learning context
- System rules integration:
  - Learning engine now knows all critical rules from CLAUDE.md
  - Prompt enhancement includes system requirements
  - AI gets pre-instructed with our best practices
  - "Zero-shot" → "Few-shot" learning improvement

### 2025-01-16 Updates
- Implemented Phase 2 of workflow improvements
- Added Advanced Workflow Builder
- Created comprehensive node catalog
- **REMOVED ALL TEMPLATE SYSTEMS**
- Fixed "use this prompt" duplication issue
- Improved prompt parsing and validation

### Previous Issues (Resolved)
- Disconnected nodes → Auto-fix validation
- Duplicate workflows → Single generation
- Template contamination → Removed all templates
- Wrong node types → Node catalog system

## Remember

This is an AI-first platform. Trust the AI to create unique, creative workflows based on user requirements. Never constrain it with templates or patterns. Every workflow should be as unique as the user's needs.