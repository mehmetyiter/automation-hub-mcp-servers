export function cleanCircularJson(obj: any): any {
  const cache = new Set();
  
  const cleaned = JSON.parse(JSON.stringify(obj, (key, value) => {
    // Handle primitive types
    if (value === null || typeof value !== 'object') {
      return value;
    }
    
    // Skip functions and symbols
    if (typeof value === 'function' || typeof value === 'symbol') {
      return undefined;
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
      return value.map(item => {
        if (typeof item === 'object' && item !== null) {
          // For objects in arrays, create a unique key
          const objKey = JSON.stringify(Object.keys(item).sort());
          if (cache.has(objKey)) {
            return { ...item }; // Return a shallow copy to break circular reference
          }
          cache.add(objKey);
        }
        return item;
      });
    }
    
    // Handle objects
    if (typeof value === 'object') {
      // Create a unique identifier for this object based on its structure
      const objKey = key + ':' + JSON.stringify(Object.keys(value).sort());
      
      // Check if we've seen a similar object structure
      if (cache.has(objKey)) {
        // Return a simplified version to break circular reference
        if (key === 'connections' && value.main) {
          // Special handling for n8n connections
          return {
            main: value.main
          };
        }
        return '[Circular Reference]';
      }
      
      cache.add(objKey);
    }
    
    return value;
  }));
  
  return cleaned;
}

export function cleanWorkflow(workflow: any): any {
  if (!workflow) return workflow;
  
  try {
    // Deep clone the workflow first to avoid modifying the original
    const cloned = JSON.parse(JSON.stringify(workflow, (key, value) => {
      // Skip functions and symbols
      if (typeof value === 'function' || typeof value === 'symbol') {
        return undefined;
      }
      
      // For connections, ensure they don't have circular references
      if (key === 'connections' && typeof value === 'object') {
        const cleanedConnections: any = {};
        for (const nodeId in value) {
          if (value[nodeId] && value[nodeId].main) {
            cleanedConnections[nodeId] = {
              main: value[nodeId].main.map((group: any[]) => 
                group.map((conn: any) => ({
                  node: conn.node,
                  type: conn.type || 'main',
                  index: conn.index || 0
                }))
              )
            };
          }
        }
        return cleanedConnections;
      }
      
      return value;
    }));
    
    // Fix function node return statements and other node-specific issues
    if (cloned.nodes && Array.isArray(cloned.nodes)) {
      cloned.nodes.forEach((node: any) => {
        // Fix function nodes
        if (node.type === 'n8n-nodes-base.function' && node.parameters?.functionCode) {
          // Fix return statements that use {json: data} instead of [{json: data}]
          // Only fix if it's not already returning an array
          if (!node.parameters.functionCode.includes('return [{') && 
              node.parameters.functionCode.includes('return {json:')) {
            node.parameters.functionCode = node.parameters.functionCode
              .replace(/return\s*{\s*json:\s*([^}]+)\s*};?$/gm, 'return [{json: $1}];');
          }
        }
        
        // Fix emailSend nodes - toRecipients must always be an array
        if (node.type === 'n8n-nodes-base.emailSend' && node.parameters) {
          if (node.parameters.toRecipients && !Array.isArray(node.parameters.toRecipients)) {
            // Convert string to array
            node.parameters.toRecipients = [node.parameters.toRecipients];
          }
        }
        
        // Fix merge nodes - ensure mergeByFields.values is an array
        if (node.type === 'n8n-nodes-base.merge' && node.parameters?.mergeByFields?.values) {
          if (!Array.isArray(node.parameters.mergeByFields.values)) {
            node.parameters.mergeByFields.values = [];
          }
        }
        
        // Fix MongoDB nodes - ensure documentId has proper structure
        if (node.type === 'n8n-nodes-base.mongoDb' && node.parameters?.documentId) {
          if (typeof node.parameters.documentId === 'string') {
            node.parameters.documentId = {
              __rl: true,
              value: node.parameters.documentId,
              mode: 'id'
            };
          }
        }
        
        // Fix switch nodes - ensure they have proper structure
        if (node.type === 'n8n-nodes-base.switch' && node.parameters) {
          if (!node.parameters.mode) {
            node.parameters.mode = 'expression';
          }
          if (!node.parameters.options) {
            node.parameters.options = {};
          }
        }
        
        // Fix HTTP Request nodes - ensure headers and query parameters are arrays
        if (node.type === 'n8n-nodes-base.httpRequest' && node.parameters) {
          if (node.parameters.headerParameters?.parameters && !Array.isArray(node.parameters.headerParameters.parameters)) {
            // Convert object to array format
            if (typeof node.parameters.headerParameters.parameters === 'object') {
              node.parameters.headerParameters.parameters = Object.entries(node.parameters.headerParameters.parameters)
                .map(([name, value]) => ({ name, value }));
            } else {
              node.parameters.headerParameters.parameters = [];
            }
          }
          if (node.parameters.queryParameters?.parameters && !Array.isArray(node.parameters.queryParameters.parameters)) {
            // Convert object to array format
            if (typeof node.parameters.queryParameters.parameters === 'object') {
              node.parameters.queryParameters.parameters = Object.entries(node.parameters.queryParameters.parameters)
                .map(([name, value]) => ({ name, value }));
            } else {
              node.parameters.queryParameters.parameters = [];
            }
          }
        }
        
        // Fix Code nodes - ensure proper language and code parameters
        if (node.type === 'n8n-nodes-base.code' && node.parameters) {
          if (!node.parameters.language) {
            node.parameters.language = 'javascript';
          }
          if (!node.parameters.mode) {
            node.parameters.mode = 'runOnceForAllItems';
          }
          // Ensure correct code parameter based on language
          if (node.parameters.language === 'javascript' && !node.parameters.jsCode && node.parameters.code) {
            node.parameters.jsCode = node.parameters.code;
            delete node.parameters.code;
          }
          if (node.parameters.language === 'python' && !node.parameters.pythonCode && node.parameters.code) {
            node.parameters.pythonCode = node.parameters.code;
            delete node.parameters.code;
          }
        }
        
        // Fix Set nodes - ensure values structure
        if (node.type === 'n8n-nodes-base.set' && node.parameters?.values?.values) {
          if (!Array.isArray(node.parameters.values.values)) {
            node.parameters.values.values = [];
          }
        }
        
        // Fix If nodes - ensure conditions structure
        if (node.type === 'n8n-nodes-base.if' && node.parameters?.conditions?.conditions) {
          if (!Array.isArray(node.parameters.conditions.conditions)) {
            node.parameters.conditions.conditions = [];
          }
        }
        
        // Fix Filter nodes - ensure conditions structure
        if (node.type === 'n8n-nodes-base.filter' && node.parameters?.conditions?.conditions) {
          if (!Array.isArray(node.parameters.conditions.conditions)) {
            node.parameters.conditions.conditions = [];
          }
        }
        
        // Fix Schedule Trigger nodes - ensure intervals are arrays
        if (node.type === 'n8n-nodes-base.scheduleTrigger' && node.parameters?.rule?.interval) {
          if (!Array.isArray(node.parameters.rule.interval)) {
            node.parameters.rule.interval = [];
          }
        }
        
        // Fix Send Email nodes (newer version) - ensure recipients are arrays
        if (node.type === 'n8n-nodes-base.sendEmail' && node.parameters) {
          if (node.parameters.toRecipients && !Array.isArray(node.parameters.toRecipients)) {
            node.parameters.toRecipients = [node.parameters.toRecipients];
          }
        }
        
        // Fix Slack nodes - ensure attachments are arrays
        if (node.type === 'n8n-nodes-base.slack' && node.parameters?.attachments) {
          if (!Array.isArray(node.parameters.attachments)) {
            node.parameters.attachments = [];
          }
        }
        
        // Fix Aggregate nodes - ensure fields to aggregate are arrays
        if (node.type === 'n8n-nodes-base.aggregate' && node.parameters?.fieldsToAggregate?.fieldToAggregate) {
          if (!Array.isArray(node.parameters.fieldsToAggregate.fieldToAggregate)) {
            node.parameters.fieldsToAggregate.fieldToAggregate = [];
          }
        }
        
        // Fix Google Sheets nodes
        if (node.type === 'n8n-nodes-base.googleSheets' && node.parameters) {
          // Ensure documentId and sheetId have proper object structure
          if (node.parameters.documentId && typeof node.parameters.documentId === 'string') {
            node.parameters.documentId = {
              __rl: true,
              value: node.parameters.documentId,
              mode: 'id'
            };
          }
          if (node.parameters.sheetId && typeof node.parameters.sheetId === 'string') {
            node.parameters.sheetId = {
              __rl: true,
              value: node.parameters.sheetId,
              mode: 'id'
            };
          }
          // Ensure values array structure
          if (node.parameters.values?.value && !Array.isArray(node.parameters.values.value)) {
            node.parameters.values.value = [];
          }
          // Ensure filters array structure
          if (node.parameters.filters?.values && !Array.isArray(node.parameters.filters.values)) {
            node.parameters.filters.values = [];
          }
          // Set default mapping mode if missing
          if (!node.parameters.mappingMode) {
            node.parameters.mappingMode = 'defineBelow';
          }
          // Ensure proper number types for row indices
          if (node.parameters.headerRow && typeof node.parameters.headerRow === 'string') {
            node.parameters.headerRow = parseInt(node.parameters.headerRow, 10) || 1;
          }
          if (node.parameters.firstDataRow && typeof node.parameters.firstDataRow === 'string') {
            node.parameters.firstDataRow = parseInt(node.parameters.firstDataRow, 10) || 2;
          }
        }
      });
    }
    
    // Preserve all important n8n workflow fields
    const result = {
      name: cloned.name || workflow.name || 'Untitled',
      nodes: cloned.nodes || workflow.nodes || [],
      connections: cloned.connections || workflow.connections || {},
      settings: cloned.settings || workflow.settings || {},
      active: cloned.active || workflow.active || false,
      // Preserve metadata fields that n8n expects
      id: cloned.id || workflow.id,
      versionId: cloned.versionId || workflow.versionId,
      meta: cloned.meta || workflow.meta || {},
      tags: cloned.tags || workflow.tags || [],
      pinData: cloned.pinData || workflow.pinData || {}
    };
    
    return result;
  } catch (error) {
    console.error('Error cleaning workflow:', error);
    console.error('Workflow structure that caused error:', {
      hasNodes: !!workflow.nodes,
      nodeCount: workflow.nodes?.length || 0,
      hasConnections: !!workflow.connections,
      connectionCount: Object.keys(workflow.connections || {}).length,
      hasMetadata: !!(workflow.id && workflow.versionId)
    });
    
    // Hata durumunda detaylı analiz yap ve sorunu çöz
    if (error instanceof TypeError && error.message.includes('circular')) {
      // Circular reference hatası - daha akıllı bir temizleme yap
      console.log('Attempting advanced circular reference cleanup...');
      try {
        return cleanCircularJson(workflow);
      } catch (circularError) {
        console.error('Advanced circular cleanup also failed:', circularError);
      }
    }
    
    // Hatayı yukarı fırlat - sistem bu hatayı handle etmeli
    throw new Error(`Workflow cleaning failed: ${error.message}. This indicates a structural problem that needs to be fixed.`);
  }
}