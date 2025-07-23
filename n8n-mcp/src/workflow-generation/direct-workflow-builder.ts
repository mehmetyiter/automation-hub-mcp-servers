// workflow-generation/direct-workflow-builder.ts

import { NodeParameterHandler } from './node-parameter-handler.js';
import { WorkflowPlan } from './workflow-analyzer.js';
import { AIProviderInterface } from '../types/ai-provider.js';
import { UserRequiredValuesRegistry } from './user-required-values.js';
import { NodeTypeMapper } from './node-type-mapper.js';

export class DirectWorkflowBuilder {
  private parameterHandler: NodeParameterHandler;
  private userRequiredRegistry: UserRequiredValuesRegistry;
  private provider: AIProviderInterface | null = null;
  
  constructor() {
    this.parameterHandler = new NodeParameterHandler();
    this.userRequiredRegistry = new UserRequiredValuesRegistry();
  }
  
  setProvider(provider: AIProviderInterface): void {
    this.provider = provider;
  }
  
  build(aiWorkflow: any, workflowPlan?: WorkflowPlan): any {
    console.log('DirectWorkflowBuilder: Preserving AI response exactly...');
    
    if (!aiWorkflow || !aiWorkflow.nodes || !aiWorkflow.connections) {
      throw new Error('Invalid AI workflow structure');
    }
    
    console.log(`AI provided ${aiWorkflow.nodes.length} nodes with full parameters`);
    
    // Create a clean copy preserving all AI details
    let workflow = {
      name: aiWorkflow.name,
      nodes: this.preserveNodes(aiWorkflow.nodes),
      connections: this.preserveConnections(aiWorkflow.connections),
      active: false,
      settings: {},
      versionId: this.generateVersionId(),
      meta: {
        instanceId: this.generateInstanceId()
      },
      id: this.generateWorkflowId(),
      tags: [],
      pinData: {}
    };
    
    // Post-processing: Add missing features based on workflow plan
    if (workflowPlan) {
      workflow = this.applyPostProcessing(workflow, workflowPlan);
    }
    
    // Apply provider's post-processing if available
    console.log('Checking for post-processing capability...');
    console.log('Provider exists:', !!this.provider);
    if (this.provider) {
      console.log('Provider type:', this.provider.constructor.name);
      console.log('Has applyPostProcessing:', 'applyPostProcessing' in this.provider);
      console.log('Method type:', typeof (this.provider as any).applyPostProcessing);
    }
    
    if (this.provider && 'applyPostProcessing' in this.provider) {
      console.log('Calling provider post-processing...');
      workflow = (this.provider as any).applyPostProcessing(workflow);
    } else {
      console.log('Post-processing not available');
    }
    
    console.log('DirectWorkflowBuilder: All AI details preserved');
    
    // Analyze user required values
    const userValueAnalysis = this.userRequiredRegistry.analyzeWorkflow(workflow.nodes);
    if (userValueAnalysis.length > 0) {
      const report = this.userRequiredRegistry.generateReport(userValueAnalysis);
      console.log('\n=== User Configuration Required ===');
      console.log(report);
      
      // Add report to workflow metadata
      if (!workflow.meta) {
        workflow.meta = { instanceId: this.generateInstanceId() };
      }
      (workflow.meta as any).userConfigurationRequired = {
        hasRequiredValues: true,
        analysis: userValueAnalysis,
        report: report
      };
    }
    
    return workflow;
  }
  
  private preserveNodes(aiNodes: any[]): any[] {
    return aiNodes.map((node, index) => {
      // Check if node type needs mapping
      const originalType = node.type;
      const mappedType = NodeTypeMapper.mapNodeType(originalType);
      
      if (NodeTypeMapper.needsMapping(originalType)) {
        console.log(`  Mapping node type: ${originalType} -> ${mappedType}`);
        console.log(`  ${NodeTypeMapper.getMappingDescription(originalType, mappedType)}`);
      }
      
      // Extract AI parameters first
      let aiParameters = this.parameterHandler.extractAIParameters(node);
      
      // Transform parameters if node type was mapped
      if (originalType !== mappedType) {
        aiParameters = NodeTypeMapper.transformParameters(originalType, mappedType, aiParameters);
      }
      
      // Enhance code nodes with intelligent code generation
      if ((mappedType === 'n8n-nodes-base.function') && 
          (!aiParameters.functionCode || aiParameters.functionCode === '// Your code here\nreturn $input.all();')) {
        aiParameters.functionCode = this.generateCodeForNode(node.name);
        console.log(`  Generated code for ${node.name}`);
      }
      
      // Merge with node type defaults, preserving AI values
      const mergedParameters = this.parameterHandler.mergeParameters(mappedType, aiParameters);
      
      // Log when MQTT default broker is applied
      if (mappedType === 'n8n-nodes-base.mqtt' && mergedParameters.broker === 'mqtt://localhost:1883' && !aiParameters.broker) {
        console.log(`  Applied default MQTT broker URL for ${node.name}`);
      }
      
      // Preserve all AI parameters exactly
      const preservedNode: any = {
        id: node.id || (index + 1).toString(),
        name: node.name,
        type: mappedType,
        typeVersion: node.typeVersion || 1,
        position: Array.isArray(node.position) ? node.position : [256 + (index * 200), 304],
        parameters: mergedParameters
      };
      
      // Add webhook ID if it's a webhook node
      if (node.type === 'n8n-nodes-base.webhook') {
        preservedNode.webhookId = node.webhookId || this.generateWebhookId();
      }
      
      // Ensure all required parameters are present
      const fixedNode = this.parameterHandler.ensureNodeParameters(preservedNode);
      
      // Fix common parameter issues
      const finalNode = this.parameterHandler.fixCommonParameterIssues(fixedNode);
      
      // Validate parameters
      const errors = this.parameterHandler.validateNodeParameters(finalNode);
      if (errors.length > 0) {
        console.log(`  Parameter validation warnings for ${node.name}:`, errors);
      }
      
      return finalNode;
    });
  }
  
  private preserveConnections(aiConnections: any): any {
    // AI connections are already in perfect format, just return them
    console.log('Preserving AI connections exactly:', Object.keys(aiConnections).length, 'connections');
    return aiConnections;
  }
  
  private generateVersionId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  private generateInstanceId(): string {
    return '7221b4279d96e7954ef75d7c02b5031844eee3ca1705c75c15ad040f91c7b140';
  }
  
  private generateWorkflowId(): string {
    return Math.random().toString(36).substr(2, 16);
  }
  
  private generateWebhookId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  private applyPostProcessing(workflow: any, workflowPlan: WorkflowPlan): any {
    console.log('Applying post-processing based on workflow plan...');
    
    // Check if error handling is needed but missing
    if (workflowPlan.errorHandling.globalErrorNode) {
      const hasErrorTrigger = workflow.nodes.some((node: any) => 
        node.type === 'n8n-nodes-base.errorTrigger'
      );
      
      if (!hasErrorTrigger) {
        console.log('Adding missing error handling nodes...');
        workflow = this.addErrorHandling(workflow, workflowPlan);
      }
    }
    
    // Fix code node formatting issues
    workflow.nodes = workflow.nodes.map((node: any) => {
      if (node.type === 'n8n-nodes-base.code' && node.parameters?.jsCode) {
        node.parameters.jsCode = this.fixCodeFormatting(node.parameters.jsCode);
      }
      return node;
    });
    
    return workflow;
  }
  
  private addErrorHandling(workflow: any, workflowPlan: WorkflowPlan): any {
    const errorTriggerId = (workflow.nodes.length + 1).toString();
    const errorNotificationId = (workflow.nodes.length + 2).toString();
    
    // Add error trigger node
    const errorTriggerNode = {
      id: errorTriggerId,
      name: 'Error Handler',
      type: 'n8n-nodes-base.errorTrigger',
      typeVersion: 1,
      position: [250, 600],
      parameters: {}
    };
    
    // Add error notification node
    const errorNotificationNode = {
      id: errorNotificationId,
      name: 'Error Notification',
      type: 'n8n-nodes-base.emailSend',
      typeVersion: 1,
      position: [450, 600],
      parameters: {
        toRecipients: 'admin@company.com',
        subject: 'Workflow Error: {{$node["Error Handler"].json["error"]["message"]}}',
        text: 'An error occurred in the workflow:\\n\\nError: {{$node["Error Handler"].json["error"]["message"]}}\\nNode: {{$node["Error Handler"].json["error"]["node"]["name"]}}\\nTime: {{$now}}',
        options: {}
      }
    };
    
    // Add nodes to workflow
    workflow.nodes.push(errorTriggerNode);
    workflow.nodes.push(errorNotificationNode);
    
    // Add connection from error trigger to notification
    if (!workflow.connections['Error Handler']) {
      workflow.connections['Error Handler'] = {
        main: [[{
          node: 'Error Notification',
          type: 'main',
          index: 0
        }]]
      };
    }
    
    console.log('Error handling nodes added successfully');
    return workflow;
  }
  
  private fixCodeFormatting(jsCode: string): string {
    // Fix common formatting issues in code nodes
    return jsCode
      .replace(/,\s*/g, ',\\n  ') // Add newlines after commas
      .replace(/return\s*{/g, 'return {\\n  ') // Format return statements
      .replace(/}\s*;/g, '\\n};') // Format closing braces
      .replace(/\\n\\n+/g, '\\n\\n') // Remove extra blank lines
      .trim();
  }

  private generateCodeForNode(nodeName: string): string {
    const lowerName = nodeName.toLowerCase();
    
    // Sensor data processing
    if (lowerName.includes('sensor') || lowerName.includes('process sensor')) {
      return `// Process sensor data and check alert conditions
const processedItems = items.map(item => {
  const sensorData = item.json;
  
  // Extract sensor readings
  const temperature = sensorData.temperature || 0;
  const humidity = sensorData.humidity || 0;
  const pressure = sensorData.pressure || 0;
  const sensorType = sensorData.type || 'unknown';
  const location = sensorData.location || 'unknown';
  
  // Define alert thresholds based on sensor type
  let alertRequired = false;
  let alertMessage = '';
  
  if (sensorType === 'temperature' || sensorType === 'cooler') {
    if (temperature > 25 || temperature < 2) {
      alertRequired = true;
      alertMessage = \`Temperature alert: \${temperature}°C at \${location}\`;
    }
  } else if (sensorType === 'shelf') {
    const stockLevel = sensorData.stockLevel || 100;
    if (stockLevel < 20) {
      alertRequired = true;
      alertMessage = \`Low stock alert: \${stockLevel}% at \${location}\`;
    }
  } else if (sensorType === 'security') {
    if (sensorData.motion || sensorData.breach) {
      alertRequired = true;
      alertMessage = \`Security alert at \${location}\`;
    }
  }
  
  return {
    json: {
      ...sensorData,
      processed: true,
      timestamp: new Date().toISOString(),
      alertRequired,
      alertMessage,
      type: sensorType
    }
  };
});

return processedItems;`;
    }
    
    // Sales report generation
    if (lowerName.includes('sales report') || lowerName.includes('generate daily')) {
      return `// Generate daily sales report with analytics
const salesData = items.map(item => item.json);

// Calculate daily metrics
const totalSales = salesData.reduce((sum, sale) => sum + (sale.amount || 0), 0);
const transactionCount = salesData.length;
const averageTransaction = transactionCount > 0 ? totalSales / transactionCount : 0;

// Group by category
const salesByCategory = {};
salesData.forEach(sale => {
  const category = sale.category || 'Other';
  if (!salesByCategory[category]) {
    salesByCategory[category] = { count: 0, total: 0 };
  }
  salesByCategory[category].count++;
  salesByCategory[category].total += sale.amount || 0;
});

// Find top products
const productSales = {};
salesData.forEach(sale => {
  const product = sale.productName || 'Unknown';
  if (!productSales[product]) {
    productSales[product] = 0;
  }
  productSales[product] += sale.quantity || 0;
});

const topProducts = Object.entries(productSales)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([product, quantity]) => ({ product, quantity }));

// Generate report
return [{
  json: {
    reportDate: new Date().toISOString().split('T')[0],
    metrics: {
      totalSales,
      transactionCount,
      averageTransaction: Math.round(averageTransaction * 100) / 100
    },
    salesByCategory,
    topProducts,
    generatedAt: new Date().toISOString()
  }
}];`;
    }
    
    // Expiration data processing
    if (lowerName.includes('expiration') || lowerName.includes('expiry')) {
      return `// Process inventory for expiration warnings
const today = new Date();
const warningDays = 7; // Alert for products expiring within 7 days

const expiringProducts = items.filter(item => {
  const product = item.json;
  if (!product.expirationDate) return false;
  
  const expiryDate = new Date(product.expirationDate);
  const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
  
  return daysUntilExpiry <= warningDays && daysUntilExpiry >= 0;
}).map(item => {
  const product = item.json;
  const expiryDate = new Date(product.expirationDate);
  const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
  
  return {
    json: {
      ...product,
      daysUntilExpiry,
      urgency: daysUntilExpiry <= 3 ? 'high' : 'medium',
      alertMessage: \`\${product.productName} expires in \${daysUntilExpiry} days\`
    }
  };
});

return expiringProducts.length > 0 ? expiringProducts : [{ json: { noExpiringProducts: true } }];`;
    }
    
    // Order suggestions
    if (lowerName.includes('order suggestion') || lowerName.includes('inventory')) {
      return `// Generate intelligent order suggestions
const inventoryData = items.map(item => item.json);

const orderSuggestions = inventoryData.filter(item => {
  const currentStock = item.currentStock || 0;
  const minStock = item.minStock || 10;
  const avgDailySales = item.avgDailySales || 0;
  
  // Need to reorder if below minimum or will run out in 7 days
  const daysOfStock = avgDailySales > 0 ? currentStock / avgDailySales : 999;
  return currentStock < minStock || daysOfStock < 7;
}).map(item => {
  const currentStock = item.currentStock || 0;
  const maxStock = item.maxStock || 100;
  const avgDailySales = item.avgDailySales || 0;
  const leadTime = item.leadTimeDays || 3;
  
  // Calculate optimal order quantity
  const safetyStock = avgDailySales * leadTime * 1.5;
  const orderQuantity = Math.max(
    maxStock - currentStock + safetyStock,
    item.minOrderQuantity || 1
  );
  
  return {
    json: {
      productId: item.productId,
      productName: item.productName,
      currentStock,
      suggestedOrderQuantity: Math.ceil(orderQuantity),
      estimatedCost: orderQuantity * (item.unitCost || 0),
      urgency: currentStock === 0 ? 'critical' : 'normal',
      supplier: item.preferredSupplier || 'Default Supplier'
    }
  };
});

return orderSuggestions.length > 0 ? orderSuggestions : [{ json: { noOrdersNeeded: true } }];`;
    }
    
    // Customer density analysis
    if (lowerName.includes('customer density') || lowerName.includes('analyze customer')) {
      return `// Analyze customer density and checkout optimization
const densityData = items[0]?.json || {};

// Extract metrics
const currentCustomers = densityData.currentCustomers || 0;
const activeCheckouts = densityData.activeCheckouts || 0;
const avgWaitTime = densityData.avgWaitTime || 0;
const queueLength = densityData.queueLength || 0;

// Calculate recommendations
const customersPerCheckout = activeCheckouts > 0 ? currentCustomers / activeCheckouts : currentCustomers;
const needsAttention = customersPerCheckout > 10 || avgWaitTime > 5 || queueLength > 15;

const recommendations = [];
if (customersPerCheckout > 10) {
  recommendations.push('Open additional checkout lanes');
}
if (avgWaitTime > 5) {
  recommendations.push('Deploy express checkout for small baskets');
}
if (queueLength > 15) {
  recommendations.push('Call backup cashiers immediately');
}

return [{
  json: {
    timestamp: new Date().toISOString(),
    metrics: {
      currentCustomers,
      activeCheckouts,
      avgWaitTime,
      queueLength,
      customersPerCheckout: Math.round(customersPerCheckout * 10) / 10
    },
    needsAttention,
    recommendations,
    alertLevel: needsAttention ? 'high' : 'normal'
  }
}];`;
    }
    
    // Energy consumption analysis
    if (lowerName.includes('energy') || lowerName.includes('consumption')) {
      return `// Analyze energy consumption and optimization
const energyData = items.map(item => item.json);

// Calculate total consumption
const totalConsumption = energyData.reduce((sum, reading) => {
  return sum + (reading.consumption || 0);
}, 0);

// Find peak usage
const peakReading = energyData.reduce((peak, reading) => {
  return reading.consumption > peak.consumption ? reading : peak;
}, { consumption: 0 });

// Calculate average by zone
const zoneConsumption = {};
energyData.forEach(reading => {
  const zone = reading.zone || 'Unknown';
  if (!zoneConsumption[zone]) {
    zoneConsumption[zone] = { total: 0, count: 0 };
  }
  zoneConsumption[zone].total += reading.consumption || 0;
  zoneConsumption[zone].count++;
});

// Generate optimization suggestions
const suggestions = [];
Object.entries(zoneConsumption).forEach(([zone, data]) => {
  const avgConsumption = data.total / data.count;
  if (avgConsumption > 1000) {
    suggestions.push(\`High consumption in \${zone}: Consider LED upgrade or timer controls\`);
  }
});

return [{
  json: {
    reportDate: new Date().toISOString(),
    totalConsumption,
    peakUsage: {
      consumption: peakReading.consumption,
      time: peakReading.timestamp,
      zone: peakReading.zone
    },
    zoneAnalysis: Object.entries(zoneConsumption).map(([zone, data]) => ({
      zone,
      averageConsumption: Math.round(data.total / data.count),
      totalReadings: data.count
    })),
    optimizationSuggestions: suggestions,
    estimatedSavings: suggestions.length * 150 // $150 per optimization
  }
}];`;
    }
    
    // Profit-loss analysis
    if (lowerName.includes('profit') || lowerName.includes('loss')) {
      return `// Generate profit-loss analysis
const financialData = items[0]?.json || {};

// Extract key metrics
const revenue = financialData.totalRevenue || 0;
const costs = financialData.totalCosts || 0;
const profit = revenue - costs;
const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

// Category breakdown
const categoryPerformance = financialData.categories?.map(cat => ({
  category: cat.name,
  revenue: cat.revenue || 0,
  costs: cat.costs || 0,
  profit: (cat.revenue || 0) - (cat.costs || 0),
  margin: cat.revenue > 0 ? (((cat.revenue - cat.costs) / cat.revenue) * 100).toFixed(2) : 0
})) || [];

// Identify top and bottom performers
const sortedCategories = [...categoryPerformance].sort((a, b) => b.profit - a.profit);
const topPerformers = sortedCategories.slice(0, 3);
const bottomPerformers = sortedCategories.slice(-3).reverse();

return [{
  json: {
    period: financialData.period || 'Current Month',
    summary: {
      totalRevenue: revenue,
      totalCosts: costs,
      netProfit: profit,
      profitMargin: profitMargin.toFixed(2) + '%',
      status: profit > 0 ? 'Profitable' : 'Loss'
    },
    categoryPerformance,
    insights: {
      topPerformers,
      bottomPerformers,
      recommendations: profit < 0 ? 
        ['Review pricing strategy', 'Reduce operational costs', 'Focus on high-margin products'] :
        ['Maintain current strategy', 'Consider expansion', 'Invest in marketing']
    },
    generatedAt: new Date().toISOString()
  }
}];`;
    }
    
    // HTML report creation
    if (lowerName.includes('html') || lowerName.includes('create') && lowerName.includes('report')) {
      return `// Create HTML report from data
const reportData = items[0]?.json || {};

const htmlContent = \`
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    .metric { display: inline-block; margin: 10px 20px; }
    .metric-value { font-size: 24px; font-weight: bold; color: #2196F3; }
    .metric-label { color: #666; }
  </style>
</head>
<body>
  <h1>\${reportData.reportTitle || 'Daily Report'}</h1>
  <p>Generated on: \${new Date().toLocaleDateString()}</p>
  
  \${reportData.metrics ? \`
    <div class="metrics">
      \${Object.entries(reportData.metrics).map(([key, value]) => \`
        <div class="metric">
          <div class="metric-value">\${value}</div>
          <div class="metric-label">\${key.replace(/([A-Z])/g, ' $1').trim()}</div>
        </div>
      \`).join('')}
    </div>
  \` : ''}
  
  \${reportData.tableData ? \`
    <table>
      <thead>
        <tr>\${Object.keys(reportData.tableData[0] || {}).map(key => \`<th>\${key}</th>\`).join('')}</tr>
      </thead>
      <tbody>
        \${reportData.tableData.map(row => \`
          <tr>\${Object.values(row).map(val => \`<td>\${val}</td>\`).join('')}</tr>
        \`).join('')}
      </tbody>
    </table>
  \` : ''}
</body>
</html>\`;

return [{
  json: {
    html: htmlContent,
    reportData,
    generated: new Date().toISOString()
  }
}];`;
    }
    
    // Final processing
    if (lowerName.includes('final') || lowerName.includes('process final')) {
      return `// Finalize and summarize all results
const allResults = items.map(item => item.json);

// Aggregate all operations
const summary = {
  totalOperations: allResults.length,
  timestamp: new Date().toISOString(),
  results: {}
};

// Group results by type
allResults.forEach(result => {
  const type = result.operationType || 'unknown';
  if (!summary.results[type]) {
    summary.results[type] = {
      count: 0,
      items: []
    };
  }
  summary.results[type].count++;
  summary.results[type].items.push(result);
});

// Generate final status
const hasErrors = allResults.some(r => r.error || r.alertRequired);
const status = hasErrors ? 'Attention Required' : 'All Systems Normal';

return [{
  json: {
    workflowExecution: {
      status,
      summary,
      executedAt: new Date().toISOString(),
      nextRunScheduled: new Date(Date.now() + 60000).toISOString() // Next minute
    }
  }
}];`;
    }
    
    // Default/generic code
    return `// ${nodeName} logic
const processedItems = items.map(item => {
  // Process each item
  const data = item.json;
  
  return {
    json: {
      ...data,
      processed: true,
      processedBy: '${nodeName}',
      timestamp: new Date().toISOString()
    }
  };
});

return processedItems;`;
  }
}