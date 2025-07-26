# Enhanced Error Reporting Documentation

## Overview

The n8n MCP server now provides enhanced error reporting for workflow validation issues. This helps frontend applications display more detailed and actionable information to users.

## Response Structure

When a workflow is generated, the response includes validation information:

```json
{
  "success": true,
  "data": {
    "workflow": { /* workflow JSON */ },
    "provider": "openai",
    "usage": { /* token usage */ },
    "validationReport": {
      "isValid": false,
      "issues": [
        {
          "node": "Update Guest Registry",
          "nodeType": "n8n-nodes-base.function",
          "issue": "Node has no follow-up activities",
          "severity": "warning",
          "suggestion": "Add database save or notification after update",
          "category": "branch_completion",
          "autoFixable": false
        }
      ],
      "repairAttempts": 2,
      "requiresManualFix": true
    },
    "validationIssues": [ /* legacy format */ ]
  }
}
```

## Issue Categories

- **connection**: Node connectivity issues (disconnected nodes, missing connections)
- **branch_completion**: Branches that don't have proper conclusions
- **parallel_processing**: Issues with merge nodes and parallel branches
- **configuration**: Parameter or configuration problems
- **error_handling**: Missing or incomplete error handling
- **general**: Other validation issues

## Severity Levels

- **error**: Critical issues that prevent workflow execution
- **warning**: Issues that should be addressed but don't block execution
- **info**: Suggestions for improvement

## Auto-Fixable Issues

The `autoFixable` flag indicates whether the issue can be automatically resolved:
- `true`: Can be fixed automatically (e.g., disconnected nodes)
- `false`: Requires manual intervention or AI assistance

## Manual Fix Endpoint

Frontend can request fixes for validation issues:

```bash
POST /tools/n8n_fix_workflow
```

Request body:
```json
{
  "workflow": { /* current workflow */ },
  "issues": [
    {
      "node": "Update Guest Registry",
      "message": "Node has no follow-up activities",
      "type": "branch_completion",
      "suggestion": "Add database save or notification"
    }
  ],
  "originalPrompt": "Theater management system",
  "provider": "openai"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "workflow": { /* fixed workflow */ },
    "fixesApplied": [
      "Connected disconnected node: Update Guest Registry",
      "Added database save operation after guest update"
    ],
    "remainingIssues": []
  }
}
```

## Frontend Implementation Guide

### 1. Display Validation Issues

```javascript
if (response.data.validationReport && !response.data.validationReport.isValid) {
  const report = response.data.validationReport;
  
  // Show warning banner
  if (report.requiresManualFix) {
    showWarning(`Workflow has ${report.issues.length} issues that need attention`);
  }
  
  // Display issues by category
  const issuesByCategory = report.issues.reduce((acc, issue) => {
    if (!acc[issue.category]) acc[issue.category] = [];
    acc[issue.category].push(issue);
    return acc;
  }, {});
  
  // Render issues with fix buttons
  Object.entries(issuesByCategory).forEach(([category, issues]) => {
    renderIssueCategory(category, issues);
  });
}
```

### 2. Auto-Fix Implementation

```javascript
async function autoFixWorkflow(workflow, issues) {
  const autoFixableIssues = issues.filter(i => i.autoFixable);
  
  if (autoFixableIssues.length === 0) {
    showInfo('No auto-fixable issues found');
    return;
  }
  
  const response = await fetch('/api/n8n/tools/n8n_fix_workflow', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      workflow,
      issues: autoFixableIssues,
      originalPrompt: workflowPrompt
    })
  });
  
  if (response.ok) {
    const result = await response.json();
    updateWorkflow(result.data.workflow);
    showSuccess(`Applied ${result.data.fixesApplied.length} fixes`);
  }
}
```

### 3. Issue Visualization

For better UX, visualize issues directly on the workflow:

```javascript
function highlightProblematicNodes(workflow, issues) {
  issues.forEach(issue => {
    const node = workflow.nodes.find(n => n.name === issue.node);
    if (node) {
      // Add visual indicator
      node.issues = node.issues || [];
      node.issues.push({
        type: issue.category,
        severity: issue.severity,
        message: issue.issue
      });
    }
  });
}
```

### 4. Progressive Enhancement

Start with basic functionality and enhance:

1. **Basic**: Show validation errors in a list
2. **Better**: Categorize and prioritize issues
3. **Best**: Interactive fixing with visual feedback

## Best Practices

1. **Always check validationReport**: Even successful workflows may have warnings
2. **Respect severity levels**: Don't block users for warnings
3. **Provide context**: Show the original prompt when fixing issues
4. **Batch fixes**: Group related issues for better AI fixes
5. **User control**: Let users choose which fixes to apply

## Error States

Handle these error scenarios:

```javascript
// No AI provider configured
if (error.message.includes('No API key provided') || error.message.includes('No AI provider configured')) {
  showError('Please add an AI provider credential');
}

// Fix failed
if (!fixResult.success) {
  showError(`Unable to fix: ${fixResult.error}`);
  // Offer manual editing option
  enableManualEditMode();
}

// Partial fix
if (fixResult.data.remainingIssues.length > 0) {
  showWarning('Some issues could not be fixed automatically');
  displayRemainingIssues(fixResult.data.remainingIssues);
}
```