#!/bin/bash

# Script to find duplicate method declarations in TypeScript source files

echo "=== Finding Duplicate Method Declarations in n8n-mcp TypeScript Source Files ==="
echo "=== (Excluding node_modules and dist directories) ==="
echo ""

BASE_DIR="/home/mehmet/Documents/n8nMCP/automation-hub-mcp-servers/n8n-mcp"

# Create a comprehensive search for duplicate methods
echo "Analyzing all TypeScript files for duplicate method declarations..."
echo ""

# Function to extract and analyze methods
analyze_methods() {
    local pattern="$1"
    local description="$2"
    
    echo "=== $description ==="
    echo ""
    
    # Find all matching methods
    find "$BASE_DIR" -name "*.ts" -type f \
        -not -path "*/node_modules/*" \
        -not -path "*/dist/*" \
        -exec grep -Hn "$pattern" {} \; 2>/dev/null | \
    awk -F: '
    {
        file = $1
        line_num = $2
        method_line = $0
        sub(/^[^:]+:[^:]+:/, "", method_line)
        
        # Extract method name
        gsub(/^\s+/, "", method_line)
        gsub(/^\s*(public|protected|private|abstract|static|async|override|readonly)*\s*/, "", method_line)
        
        # Get the method name
        if (match(method_line, /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/, arr)) {
            method_name = arr[1]
            
            # Skip common keywords
            if (method_name != "if" && method_name != "for" && method_name != "while" && 
                method_name != "switch" && method_name != "catch" && method_name != "try" && 
                method_name != "return" && method_name != "throw" && method_name != "await" &&
                method_name != "new" && method_name != "function" && method_name != "const" &&
                method_name != "let" && method_name != "var" && method_name != "import" &&
                method_name != "export" && method_name != "super" && method_name != "this") {
                
                occurrences[method_name] = occurrences[method_name] file ":" line_num " => " method_line "\n"
                count[method_name]++
            }
        }
    }
    END {
        found_duplicates = 0
        for (method in count) {
            if (count[method] > 1) {
                found_duplicates = 1
                print "Method: " method " (found " count[method] " times)"
                print occurrences[method]
            }
        }
        if (!found_duplicates) {
            print "No duplicates found for this pattern."
        }
    }'
    
    echo ""
}

# Analyze different method patterns
analyze_methods "^\s*public\s\+[a-zA-Z_][a-zA-Z0-9_]*\s*(" "Public Methods"
analyze_methods "^\s*private\s\+[a-zA-Z_][a-zA-Z0-9_]*\s*(" "Private Methods"
analyze_methods "^\s*protected\s\+[a-zA-Z_][a-zA-Z0-9_]*\s*(" "Protected Methods"
analyze_methods "^\s*abstract\s\+[a-zA-Z_][a-zA-Z0-9_]*\s*(" "Abstract Methods"
analyze_methods "^\s*async\s\+[a-zA-Z_][a-zA-Z0-9_]*\s*(" "Async Methods (without modifiers)"
analyze_methods "^\s*\(public\|private\|protected\)\s\+async\s\+[a-zA-Z_][a-zA-Z0-9_]*\s*(" "Async Methods (with modifiers)"
analyze_methods "^\s*static\s\+[a-zA-Z_][a-zA-Z0-9_]*\s*(" "Static Methods"
analyze_methods "^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*(" "Methods without modifiers"

echo "=== Checking for methods declared multiple times in the same file ==="
echo ""

# Check each file individually for internal duplicates
find "$BASE_DIR" -name "*.ts" -type f \
    -not -path "*/node_modules/*" \
    -not -path "*/dist/*" | while read -r file; do
    
    # Extract all method declarations from this file
    methods=$(grep -n "^\s*\(public\|private\|protected\|abstract\|static\|async\|override\)*.*[a-zA-Z_][a-zA-Z0-9_]*\s*(" "$file" 2>/dev/null | \
        sed -E 's/^([0-9]+):.*?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(.*/\1:\2/' | \
        grep -E '^[0-9]+:[a-zA-Z_]' | \
        grep -v -E ':(if|for|while|switch|catch|try|return|throw|await|new|function|const|let|var|import|export|super|this|constructor)$')
    
    # Check for duplicates within the file
    if [ -n "$methods" ]; then
        duplicates=$(echo "$methods" | cut -d: -f2 | sort | uniq -d)
        if [ -n "$duplicates" ]; then
            echo "File: $file"
            echo "$duplicates" | while read -r method; do
                echo "  Duplicate method: $method"
                echo "$methods" | grep ":$method$" | while read -r occurrence; do
                    line_num=$(echo "$occurrence" | cut -d: -f1)
                    echo "    Line $line_num"
                done
            done
            echo ""
        fi
    fi
done

echo "=== Analysis Complete ==="