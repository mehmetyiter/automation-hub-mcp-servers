import { 
  CodeGenerationRequest, 
  CodeContext, 
  ValidationResult,
  ValidationIssue 
} from '../types';
import { AIService } from '../../ai-service';

export class PythonCodeAdapter {
  private aiService: AIService;

  constructor(provider?: string) {
    this.aiService = new AIService(provider);
  }

  async generatePythonCode(
    request: CodeGenerationRequest,
    context: CodeContext
  ): Promise<string> {
    console.log('🐍 Generating Python code...');
    
    const pythonPrompt = `
TASK: Generate production-ready Python code for n8n Python Code Node based on the analysis.

USER REQUEST: "${request.description}"

CONTEXT:
${JSON.stringify(context, null, 2)}

Generate complete, executable Python code that:

1. **IMPLEMENTS SPECIFIC BUSINESS LOGIC** (not generic "return items")
2. **HANDLES INPUT DATA VALIDATION**
3. **PERFORMS REQUIRED CALCULATIONS/TRANSFORMATIONS**
4. **INCLUDES COMPREHENSIVE ERROR HANDLING**
5. **OPTIMIZES FOR PERFORMANCE**
6. **FOLLOWS n8n PYTHON NODE BEST PRACTICES**

PYTHON CODE REQUIREMENTS:
- Access input items via: items = $input.all()
- Each item has a 'json' property containing data
- Return list of dictionaries with 'json' key: return [{"json": {...}}]
- Use Python 3.x syntax and features
- Include type hints where appropriate
- Handle edge cases (empty input, None values, type mismatches)
- Include proper exception handling
- Use list comprehensions for efficiency where applicable
- Follow PEP 8 style guidelines

n8n PYTHON NODE SPECIFICS:
- Available globals: $input, $json, $node, $workflow, $item
- datetime module is pre-imported
- json module is pre-imported
- Common libraries available: requests, pandas, numpy (check workflow context)

CRITICAL GUIDELINES:
❌ DO NOT return generic "return items"
❌ DO NOT use placeholder comments like "# Add your logic here"
❌ DO NOT skip error handling
❌ DO NOT ignore the specific request details
✅ DO implement actual business logic based on the request
✅ DO include specific calculations/transformations requested
✅ DO handle real data transformations
✅ DO provide production-ready code
✅ DO use meaningful variable names
✅ DO add docstrings for complex functions

RESPONSE FORMAT:
Return ONLY the Python code, no markdown formatting, no explanations.
The code should be ready to paste directly into n8n Python Code Node.

Based on the analysis, generate code that specifically addresses: ${context.intent.primaryFunction}`;

    const generatedCode = await this.aiService.callAI(pythonPrompt);
    
    // Clean the generated code
    let cleanCode = generatedCode;
    
    // Remove markdown if present
    cleanCode = cleanCode.replace(/```python\\n?/g, '');
    cleanCode = cleanCode.replace(/```\\n?/g, '');
    cleanCode = cleanCode.trim();
    
    // Ensure proper structure
    if (!cleanCode.includes('items = $input.all()')) {
      cleanCode = this.addPythonInputHandling(cleanCode);
    }
    
    if (!cleanCode.includes('return')) {
      cleanCode = this.addPythonReturnStatement(cleanCode);
    }
    
    return cleanCode;
  }

  private addPythonInputHandling(code: string): string {
    const inputHandling = `# Get input items
items = $input.all()

# Validate input
if not items:
    return []

`;
    
    return inputHandling + code;
  }

  private addPythonReturnStatement(code: string): string {
    // Find the last processed data variable
    const processedVarMatch = code.match(/(\w*[Rr]esult\w*|\w*[Dd]ata\w*|\w*[Ii]tems\w*)\s*=/);
    
    if (processedVarMatch) {
      const varName = processedVarMatch[1];
      return code + `\n\n# Return processed items\nreturn ${varName}`;
    }
    
    return code + '\n\n# Return processed items\nreturn processed_items';
  }

  async validatePythonCode(code: string, context: CodeContext): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];
    const suggestions: string[] = [];
    
    // Basic syntax validation
    try {
      // Check for basic Python syntax errors
      if (!this.checkPythonSyntax(code)) {
        issues.push({
          type: 'syntax',
          severity: 'error',
          message: 'Invalid Python syntax detected'
        });
      }
    } catch (error: any) {
      issues.push({
        type: 'syntax',
        severity: 'error',
        message: `Syntax validation error: ${error.message}`
      });
    }
    
    // n8n specific validations
    if (!code.includes('$input.all()') && !code.includes('items')) {
      issues.push({
        type: 'logic',
        severity: 'warning',
        message: 'Code does not access input items'
      });
      suggestions.push('Add "items = $input.all()" to access input data');
    }
    
    if (!code.includes('return')) {
      issues.push({
        type: 'logic',
        severity: 'error',
        message: 'Code does not return any data'
      });
      suggestions.push('Add return statement with list of dictionaries');
    }
    
    // Check for proper return format
    if (code.includes('return') && !this.checkReturnFormat(code)) {
      issues.push({
        type: 'logic',
        severity: 'warning',
        message: 'Return format may not be compatible with n8n'
      });
      suggestions.push('Ensure return format is: [{"json": {...}}]');
    }
    
    // Security checks
    const securityIssues = this.checkPythonSecurity(code);
    issues.push(...securityIssues);
    
    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      suggestions
    };
  }

  private checkPythonSyntax(code: string): boolean {
    // Basic Python syntax patterns
    const syntaxPatterns = [
      /^\s*def\s+\w+\s*\(/m,  // Function definitions
      /^\s*class\s+\w+/m,      // Class definitions
      /^\s*if\s+.*:/m,         // If statements
      /^\s*for\s+\w+\s+in\s+/m, // For loops
      /^\s*while\s+.*:/m,      // While loops
      /^\s*try:/m,             // Try blocks
      /^\s*except/m            // Except blocks
    ];
    
    // Check for basic indentation issues
    const lines = code.split('\n');
    let indentLevel = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Check for colon at end of control structures
      if (trimmed.match(/^(if|for|while|def|class|try|except|elif|else|with)\b/) && 
          !trimmed.endsWith(':') && !trimmed.includes('lambda')) {
        return false;
      }
      
      // Basic indentation check
      const leadingSpaces = line.match(/^(\s*)/)?.[1].length || 0;
      if (leadingSpaces % 4 !== 0 && leadingSpaces % 2 !== 0) {
        return false;
      }
    }
    
    return true;
  }

  private checkReturnFormat(code: string): boolean {
    // Check if return statement returns proper n8n format
    const returnMatches = code.match(/return\s+(.+)$/m);
    if (!returnMatches) return false;
    
    const returnValue = returnMatches[1].trim();
    
    // Check for common correct patterns
    const correctPatterns = [
      /^\[.*\]/, // Returns a list
      /\[{"json":\s*/, // Explicit n8n format
      /processed_items/, // Common variable name
      /result/, // Common variable name
      /output/ // Common variable name
    ];
    
    return correctPatterns.some(pattern => pattern.test(returnValue));
  }

  private checkPythonSecurity(code: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    // Dangerous functions
    const dangerous = [
      { pattern: /\beval\s*\(/, message: 'eval() is unsafe - use ast.literal_eval() instead' },
      { pattern: /\bexec\s*\(/, message: 'exec() is unsafe and should be avoided' },
      { pattern: /\b__import__\s*\(/, message: '__import__() can be unsafe' },
      { pattern: /\bopen\s*\(/, message: 'File operations may be restricted in n8n' },
      { pattern: /\bos\.\w+/, message: 'OS operations may be restricted in n8n' },
      { pattern: /\bsubprocess/, message: 'Subprocess operations are not allowed in n8n' }
    ];
    
    dangerous.forEach(({ pattern, message }) => {
      if (pattern.test(code)) {
        issues.push({
          type: 'security',
          severity: 'error',
          message
        });
      }
    });
    
    return issues;
  }

  generatePythonFallbackCode(request: CodeGenerationRequest): string {
    const description = request.description.toLowerCase();
    
    let code = `# ${request.description}
# Generated Python code for n8n

# Get input items from previous node
items = $input.all()

# Validate input
if not items:
    print("No input items received")
    return []

# Process each item
processed_items = []

for item in items:
    try:
        # Extract data from current item
        data = item.get('json', {})
        
`;

    // Add specific logic based on keywords
    if (description.includes('calculate') || description.includes('sum')) {
      code += `        # Perform calculation
        numeric_values = [v for v in data.values() if isinstance(v, (int, float))]
        calculated_value = sum(numeric_values) if numeric_values else 0
        
        result = {
            **data,
            'calculated_value': calculated_value,
            'processed_at': datetime.now().isoformat()
        }
`;
    } else if (description.includes('filter')) {
      code += `        # Apply filter logic
        # Modify this condition based on your requirements
        if data.get('status') == 'active':  # Example filter
            result = {
                **data,
                'filtered': True,
                'processed_at': datetime.now().isoformat()
            }
`;
    } else if (description.includes('transform')) {
      code += `        # Transform data
        result = {
            'id': data.get('id'),
            # Add transformed fields
            'transformed_field': str(data.get('originalField', '')).upper(),
            'processed_at': datetime.now().isoformat()
        }
`;
    } else if (description.includes('validate')) {
      code += `        # Validate data
        required_fields = ['id', 'name']  # Modify as needed
        missing_fields = [f for f in required_fields if not data.get(f)]
        
        result = {
            **data,
            'is_valid': len(missing_fields) == 0,
            'validation_errors': missing_fields,
            'processed_at': datetime.now().isoformat()
        }
`;
    } else {
      code += `        # Process data
        result = {
            **data,
            'processed': True,
            'processed_at': datetime.now().isoformat()
        }
`;
    }

    code += `        
        # Add to processed items
        processed_items.append({
            'json': result
        })
        
    except Exception as e:
        print(f"Error processing item: {e}")
        
        # Add error item
        processed_items.append({
            'json': {
                **data,
                'error': str(e),
                'processing_failed': True
            }
        })

# Return all processed items
return processed_items`;

    return code;
  }
}