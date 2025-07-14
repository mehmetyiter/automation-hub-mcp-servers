#!/usr/bin/env node

// Simple test to verify our connection format fix works

const fs = require('fs');
const path = require('path');

// Mock incorrect format (single array)
const incorrectFormat = {
  "connections": {
    "Fetch Task Data": {
      "main": [
        {
          "node": "Process Data",
          "type": "main", 
          "index": 0
        }
      ]
    },
    "Process Data": {
      "main": [
        {
          "node": "Send Result",
          "type": "main",
          "index": 0
        }
      ]
    }
  }
};

// Expected correct format (double array)
const expectedFormat = {
  "connections": {
    "Fetch Task Data": {
      "main": [
        [
          {
            "node": "Process Data",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Process Data": {
      "main": [
        [
          {
            "node": "Send Result", 
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
};

// Simulate the normalizeConnectionFormat function from our fix
function normalizeConnectionFormat(connections) {
  const normalized = {};
  
  Object.entries(connections).forEach(([sourceName, targets]) => {
    if (!targets || !targets.main) {
      return;
    }
    
    // Check if we have the wrong format (single array instead of double array)
    if (Array.isArray(targets.main) && targets.main.length > 0 && 
        typeof targets.main[0] === 'object' && targets.main[0].node) {
      // This is the incorrect format: main: [{"node": "...", "type": "main", "index": 0}]
      // Convert to correct format: main: [[{"node": "...", "type": "main", "index": 0}]]
      console.log(`Converting single array format to double array for ${sourceName}`);
      normalized[sourceName] = {
        main: [targets.main] // Wrap the single array in another array
      };
    } else {
      // Normal processing for correct format or other edge cases
      normalized[sourceName] = {
        main: targets.main.map((targetGroup) => {
          // If it's already in the correct format, keep it
          if (Array.isArray(targetGroup) && targetGroup.length > 0 && 
              typeof targetGroup[0] === 'object' && targetGroup[0].node) {
            return targetGroup;
          }
          
          // Convert string format to object format
          return targetGroup.map((target) => {
            if (typeof target === 'string') {
              return {
                node: target,
                type: 'main',
                index: 0
              };
            }
            return target;
          });
        })
      };
    }
  });
  
  return normalized;
}

console.log('Testing connection format normalization...\n');

console.log('Input (incorrect format):');
console.log(JSON.stringify(incorrectFormat.connections, null, 2));

const normalizedConnections = normalizeConnectionFormat(incorrectFormat.connections);

console.log('\nOutput (normalized to correct format):');
console.log(JSON.stringify(normalizedConnections, null, 2));

console.log('\nExpected format:');
console.log(JSON.stringify(expectedFormat.connections, null, 2));

// Check if normalization worked correctly
const normalized = JSON.stringify(normalizedConnections, null, 2);
const expected = JSON.stringify(expectedFormat.connections, null, 2);

if (normalized === expected) {
  console.log('\n✅ SUCCESS: Connection format normalization works correctly!');
  console.log('The single array format has been converted to the proper double array format.');
} else {
  console.log('\n❌ FAILURE: Connection format normalization did not work as expected.');
  console.log('Normalized output does not match expected format.');
}

console.log('\nTest completed.');