# n8n Node Types Knowledge Base

## Overview
n8n is a workflow automation platform that provides 400+ integrations and native AI capabilities. It allows users to build powerful automations using a visual interface with the flexibility to add code when needed.

## Core Node Categories

### 1. Trigger Nodes
Trigger nodes start workflows based on specific events or conditions:

- **Webhook Trigger**: Receives HTTP requests to trigger workflows
- **Execute Workflow Trigger**: Triggers when called by another workflow
- **Error Trigger**: Activates when a workflow execution fails
- **Chat Trigger**: Handles chat interactions and conversations
- **MCP Server Trigger**: Manages Model Context Protocol server connections
- **Local File Trigger**: Monitors local file system changes
- **n8n Evaluation Trigger**: Used for workflow evaluations and testing
- **Stripe Trigger**: Responds to Stripe payment events

### 2. Data Input/Output Nodes
Nodes for handling data sources and destinations:

- **HTTP Request Node**: Makes HTTP/API calls with support for authentication, pagination, and proxies
- **Webhook Node**: Creates webhook endpoints
- **Respond to Webhook Node**: Sends responses back to webhook callers
- **n8n Form Node**: Creates interactive forms for data collection
- **Execution Data Node**: Handles execution-specific data

### 3. Data Processing & Transformation Nodes
Nodes for manipulating and transforming data:

- **Code Node**: Execute custom JavaScript/Python code
- **Merge Node**: Combines data from multiple sources with various merge strategies (including chooseBranch mode)
- **Split Node**: Divides data into multiple outputs
- **Loop Node**: Iterates over data items
- **IF Node**: Conditional branching based on data values
- **Switch Node**: Multi-way branching for complex routing
- **Token Splitter Node**: Splits text into tokens for AI processing
- **Information Extractor Node**: Extracts structured information from unstructured data
- **Text Classifier Node**: Categorizes text using AI
- **Summarize Node**: Creates summaries of text content

### 4. Workflow Control Nodes
Nodes for managing workflow execution flow:

- **Execute Sub-workflow Node**: Runs other workflows as sub-processes
- **Execute Workflow Node**: Triggers other workflows
- **Wait Node**: Pauses workflow execution
- **Error Handler**: Manages error conditions

### 5. AI & LangChain Nodes
AI-powered nodes for intelligent automation:

- **AI Agent Node**: Builds AI agents with tool calling capabilities
- **Chat Model Nodes**: Various LLM integrations (Cohere, OpenAI, etc.)
- **OpenAI Embeddings Node**: Creates vector embeddings
- **Default Data Loader Node**: Loads and prepares data for AI processing
- **Model Selector Node**: Chooses appropriate AI models
- **Simple Vector Store**: Memory management for AI workflows
- **Call n8n Workflow Tool**: AI tool for calling n8n workflows

### 6. Database & Storage Nodes
Integration with various data storage systems:

- **Microsoft SQL Node**: SQL Server database operations
- **Google Sheets Node**: Spreadsheet operations
- **Microsoft SharePoint Node**: SharePoint integration

### 7. Communication & Messaging Nodes
Nodes for various communication channels:

- **Telegram Node**: Telegram messaging integration
- **Google Ads Node**: Google Ads API integration

### 8. Specialized Integration Nodes
Service-specific integrations:

- **Airtop Node**: Browser automation with window management
- **Stripe Integration**: Payment processing
- **IMAP**: Email handling

## Common Node Patterns & Usage

### 1. Basic Webhook → Process → Response Pattern
```
Webhook Trigger → Code/Transform Node → Respond to Webhook
```

### 2. Error Handling Pattern
```
Main Workflow → Error Trigger → Error Handler/Notification
```

### 3. Data Enrichment Pattern
```
Data Source → HTTP Request (API calls) → Merge → Output
```

### 4. AI Processing Pipeline
```
Data Loader → Token Splitter → AI Agent/Chat Model → Response Processing
```

### 5. Conditional Execution Pattern
```
Trigger → IF/Switch Node → [Branch A nodes] / [Branch B nodes] → Merge
```

### 6. Loop Processing Pattern
```
Data Source → Loop Node → Processing Nodes → Accumulator
```

### 7. Sub-workflow Pattern
```
Main Workflow → Execute Sub-workflow → Continue Processing
```

## Key Features & Capabilities

### Error Handling
- Continue on Fail option for resilient workflows
- Error Trigger nodes can link to parent executions
- Retry on error functionality

### Data Management
- Paired item handling for tracking data lineage
- Support for streaming and batch processing
- Binary data handling

### Authentication & Security
- Multiple authentication methods (OAuth2, API keys, etc.)
- HTTP proxy support for various nodes
- Credential management system

### Workflow Management
- Static and dynamic webhooks
- Workflow activation/deactivation
- Version control integration
- Granular push/pull of workflows and credentials

### Performance Features
- Lazy loading of dependencies
- Caching mechanisms (e.g., tokenizer JSONs)
- Configurable timeouts and limits

## Best Practices

1. **Error Handling**: Always implement error handling for critical workflows
2. **Data Validation**: Use IF/Switch nodes to validate data before processing
3. **Modular Design**: Break complex workflows into sub-workflows
4. **Resource Management**: Be mindful of memory usage in loops and large data processing
5. **Authentication**: Store credentials securely and use appropriate authentication methods
6. **Testing**: Use the n8n Evaluation Trigger for workflow testing
7. **Documentation**: Use descriptive node names and workflow descriptions

## Node Development
- Community nodes can be created as npm packages
- Nodes require proper error handling and continue on fail support
- Custom nodes should follow n8n's node development guidelines
- Node linting tools are available for quality assurance

This knowledge base provides a foundation for understanding n8n's capabilities without prescribing rigid templates, allowing for flexible and creative workflow design based on specific use cases.