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
    
    // Fix function node return statements
    if (cloned.nodes && Array.isArray(cloned.nodes)) {
      cloned.nodes.forEach((node: any) => {
        if (node.type === 'n8n-nodes-base.function' && node.parameters?.functionCode) {
          // Fix return statements that use {json: data} instead of [{json: data}]
          // Only fix if it's not already returning an array
          if (!node.parameters.functionCode.includes('return [{') && 
              node.parameters.functionCode.includes('return {json:')) {
            node.parameters.functionCode = node.parameters.functionCode
              .replace(/return\s*{\s*json:\s*([^}]+)\s*};?$/gm, 'return [{json: $1}];');
          }
        }
      });
    }
    
    return cloned;
  } catch (error) {
    console.error('Error cleaning workflow:', error);
    // Return a minimal workflow structure if cleaning fails
    return {
      name: workflow.name || 'Untitled',
      nodes: workflow.nodes || [],
      connections: {},
      settings: workflow.settings || {},
      active: workflow.active || false
    };
  }
}