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

## ALWAYS USE

✅ AI-driven generation
✅ Dynamic analysis
✅ User's exact requirements
✅ Creative workflow design
✅ Node catalog for type matching
✅ Connection validation

## Session History

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