#!/usr/bin/env node

import { readFileSync } from 'fs';
import { WorkflowAnalyzer, WorkflowValidator } from './n8n-mcp/dist/workflow-generation/workflow-analyzer.js';

const detailedPrompt = `## AI Assistant Analysis:
To create a comprehensive transaction monitoring system for banks using n8n, we will design a workflow that integrates real-time transaction analysis with anti-money laundering controls, sanctions list checks, and more. This workflow will ensure all elements are connected through a central orchestration node and includes necessary error handling, data processing, and reporting.

### Workflow Plan

#### 1. **Main Entry Point: Transaction Stream Trigger**
- **Node:** \`n8n-nodes-base.webhook\`
- **Purpose:** To receive real-time transaction data.

#### 2. **Central Router: Decision Making and Routing**
- **Node:** \`n8n-nodes-base.switch\`
- **Purpose:** Route transactions based on risk levels and necessary checks (e.g., AML, sanctions).

#### 3. **Feature Branches**

**A. AML Controls & Sanctions Checks**
- **Node:** \`n8n-nodes-base.httpRequest\` (for sanctions list API)
- **Node:** \`n8n-nodes-base.code\` (for AML checks logic)
- **Purpose:** Verify transactions against AML rules and sanctions lists.
- **Connection:** Webhook -> Switch -> AML/Sanctions Check
- **Error Handling:** \`n8n-nodes-base.errorTrigger\`

**B. Unusual Pattern Detection (ML Model)**
- **Node:** \`n8n-nodes-base.httpRequest\` (connect to ML model API)
- **Purpose:** Analyze transactions for unusual patterns.
- **Connection:** AML/Sanctions Check -> Pattern Detection
- **Error Handling:** \`n8n-nodes-base.errorTrigger\`

**C. Risk Scoring & Segmentation**
- **Node:** \`n8n-nodes-base.code\`
- **Purpose:** Assign risk scores and categorize transactions.
- **Connection:** Pattern Detection -> Risk Scoring
- **Error Handling:** \`n8n-nodes-base.errorTrigger\`

**D. Freeze High-Risk Transactions**
- **Node:** \`n8n-nodes-base.httpRequest\` (transaction management API)
- **Purpose:** Automatically freeze transactions deemed high risk.
- **Connection:** Risk Scoring -> Freeze Transactions
- **Error Handling:** \`n8n-nodes-base.errorTrigger\`

**E. Notify Compliance Officer**
- **Node:** \`n8n-nodes-base.emailSend\`
- **Purpose:** Alert compliance officers about high-risk transactions.
- **Connection:** Freeze Transactions -> Notify Compliance
- **Error Handling:** \`n8n-nodes-base.errorTrigger\`

**F. KYC Documentation Deficiency Check**
- **Node:** \`n8n-nodes-base.httpRequest\` (KYC database API)
- **Purpose:** Check for missing KYC documents.
- **Connection:** AML/Sanctions Check -> KYC Check
- **Error Handling:** \`n8n-nodes-base.errorTrigger\`

**G. Regulatory Reporting (BRSA, MASAK)**
- **Node:** \`n8n-nodes-base.httpRequest\` (regulatory reporting API)
- **Purpose:** Submit required reports.
- **Connection:** Risk Scoring -> Reporting
- **Error Handling:** \`n8n-nodes-base.errorTrigger\`

**H. Fraud Prevention Rule Engine**
- **Node:** \`n8n-nodes-base.code\`
- **Purpose:** Apply fraud prevention rules.
- **Connection:** AML/Sanctions Check -> Fraud Prevention
- **Error Handling:** \`n8n-nodes-base.errorTrigger\`

**I. Audit Trail Full Record**
- **Node:** \`n8n-nodes-base.googleDrive\` or database node
- **Purpose:** Maintain a complete audit trail.
- **Connection:** All nodes -> Audit Trail
- **Error Handling:** \`n8n-nodes-base.errorTrigger\`

**J. Customer Due Diligence Process**
- **Node:** \`n8n-nodes-base.httpRequest\` (CDD API)
- **Purpose:** Perform enhanced due diligence for high-risk customers.
- **Connection:** Risk Scoring -> CDD Process
- **Error Handling:** \`n8n-nodes-base.errorTrigger\`

#### 4. **Central Merge Node**
- **Node:** \`n8n-nodes-base.merge\`
- **Purpose:** Combine results from all feature branches before final processing.
- **Connection:** All branches -> Merge Node

#### 5. **Final Processing/Response**
- **Node:** \`n8n-nodes-base.respondToWebhook\`
- **Purpose:** Provide a final response to the initiating webhook.
- **Connection:** Merge Node -> Respond to Webhook

### Error Handling
- **Global Error Node:** \`n8n-nodes-base.errorTrigger\`
- **Purpose:** Capture and manage errors throughout the workflow.
- **Connection:** Error nodes are integrated after every critical operation.

## User Requirements:
Transaction monitoring system for banks:
- Real-time transaction stream analysis
- AML (Anti-Money Laundering) controls
- Sanctions list cross-check
- Unusual pattern detection (ML model)
- Risk scoring and segmentation
- Freeze high-risk transactions
- Notify compliance officer
- KYC documentation deficiency check
- Regulatory reporting (BRSA, MASAK)
- Customer due diligence process
- Fraud prevention rule engine
- Audit trail full record`;

async function testWorkflowAnalyzer() {
  console.log('🚀 Testing Workflow Analyzer...\n');
  
  // Test 1: Analyze the prompt
  const analyzer = new WorkflowAnalyzer();
  const workflowPlan = analyzer.analyzePrompt(detailedPrompt);
  
  console.log('📋 Analysis Results:');
  console.log(`   Requirements found: ${workflowPlan.requirements.length}`);
  console.log(`   Connections planned: ${workflowPlan.connections.length}`);
  console.log(`   Parallel branches: ${workflowPlan.parallelBranches.length}`);
  console.log(`   Missing features: ${workflowPlan.missingFeatures.length}`);
  
  console.log('\n🔍 Requirements:');
  workflowPlan.requirements.forEach((req, i) => {
    console.log(`   ${i + 1}. ${req.name} (${req.nodeType})`);
    console.log(`      ${req.description}`);
  });
  
  console.log('\n⚠️  Missing Features:');
  workflowPlan.missingFeatures.forEach((feature, i) => {
    console.log(`   ${i + 1}. ${feature}`);
  });
  
  console.log('\n🔗 Connections:');
  workflowPlan.connections.forEach((conn, i) => {
    console.log(`   ${i + 1}. ${conn.from} -> ${conn.to} (${conn.type})`);
  });
  
  // Test 2: Validate against the generated workflow
  console.log('\n📊 Validating Generated Workflow...');
  
  const workflowJson = JSON.parse(readFileSync('/home/mehmet/Documents/n8nMCP/transaction monitoring system for banks5.json', 'utf8'));
  
  const validator = new WorkflowValidator();
  const validation = validator.validateImplementation(workflowPlan, workflowJson);
  
  console.log(`\n✅ Validation Results:`);
  console.log(`   Compliance Score: ${(validation.score * 100).toFixed(1)}%`);
  console.log(`   Is Valid: ${validation.isValid}`);
  console.log(`   Issues Found: ${validation.issues.length}`);
  
  console.log('\n🎯 Implemented Features:');
  validation.implemented.forEach((feature, i) => {
    console.log(`   ✅ ${i + 1}. ${feature}`);
  });
  
  if (validation.missing.length > 0) {
    console.log('\n❌ Missing Features:');
    validation.missing.forEach((feature, i) => {
      console.log(`   ❌ ${i + 1}. ${feature}`);
    });
  }
  
  if (validation.issues.length > 0) {
    console.log('\n⚠️  Issues Found:');
    validation.issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue.severity.toUpperCase()}: ${issue.message}`);
      if (issue.suggestion) {
        console.log(`      💡 Suggestion: ${issue.suggestion}`);
      }
    });
  }
  
  if (validation.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    validation.recommendations.forEach((rec, i) => {
      console.log(`   ${i + 1}. ${rec}`);
    });
  }
  
  console.log('\n🎉 Workflow Analyzer test completed!');
}

testWorkflowAnalyzer().catch(console.error);