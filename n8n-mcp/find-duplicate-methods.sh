#!/bin/bash

# Script to find duplicate method declarations in TypeScript files

echo "=== Finding Duplicate Method Declarations in TypeScript Files ==="
echo ""

# Create temporary files to store results
TEMP_METHODS=$(mktemp)
TEMP_DUPLICATES=$(mktemp)

# Find all TypeScript files
echo "Scanning all TypeScript files..."
find /home/mehmet/Documents/n8nMCP/automation-hub-mcp-servers/n8n-mcp -name "*.ts" -type f | while read -r file; do
    # Extract method declarations with line numbers
    # Look for various method patterns
    grep -n -E '^\s*(public|protected|private|abstract|static|async|override)?\s*(public|protected|private|abstract|static|async|override)?\s*(public|protected|private|abstract|static|async|override)?\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\(' "$file" 2>/dev/null | while read -r line; do
        line_num=$(echo "$line" | cut -d: -f1)
        method_line=$(echo "$line" | cut -d: -f2-)
        # Extract method name
        method_name=$(echo "$method_line" | sed -E 's/^\s*(public|protected|private|abstract|static|async|override|readonly)*\s*//g' | sed -E 's/\s*\(.*$//' | sed -E 's/^\s*//' | awk '{print $1}')
        if [[ -n "$method_name" && "$method_name" != "if" && "$method_name" != "for" && "$method_name" != "while" && "$method_name" != "switch" && "$method_name" != "catch" && "$method_name" != "try" && "$method_name" != "constructor" && "$method_name" != "return" && "$method_name" != "throw" && "$method_name" != "await" && "$method_name" != "new" && "$method_name" != "function" && "$method_name" != "const" && "$method_name" != "let" && "$method_name" != "var" ]]; then
            echo "$method_name|$file:$line_num|$method_line" >> "$TEMP_METHODS"
        fi
    done
done

# Sort and find duplicates
echo ""
echo "=== DUPLICATE METHOD DECLARATIONS FOUND ==="
echo ""

# Group by method name and find duplicates
sort -t'|' -k1,1 "$TEMP_METHODS" | awk -F'|' '
{
    method = $1
    location = $2
    line = $3
    
    if (method == prev_method) {
        if (!seen[method]) {
            print "\n### Method: " method
            print "Found in multiple locations:"
            print "  - " prev_location " => " prev_line
            seen[method] = 1
        }
        print "  - " location " => " line
    }
    
    prev_method = method
    prev_location = location
    prev_line = line
}' > "$TEMP_DUPLICATES"

# Display results
cat "$TEMP_DUPLICATES"

# Additional analysis for specific patterns
echo ""
echo ""
echo "=== DETAILED ANALYSIS BY PATTERN ==="

echo ""
echo "1. Duplicate async methods:"
grep -r -n "async\s\+[a-zA-Z_][a-zA-Z0-9_]*\s*(" /home/mehmet/Documents/n8nMCP/automation-hub-mcp-servers/n8n-mcp --include="*.ts" | \
    sed -E 's/^([^:]+:[0-9]+:).*async\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(.*/\2|\1/' | \
    sort | \
    awk -F'|' '{count[$1]++; locations[$1] = locations[$1] "\n  " $2} END {for (method in count) if (count[method] > 1) print "\n" method " (found " count[method] " times):" locations[method]}'

echo ""
echo "2. Duplicate abstract methods:"
grep -r -n "abstract\s\+[a-zA-Z_][a-zA-Z0-9_]*\s*(" /home/mehmet/Documents/n8nMCP/automation-hub-mcp-servers/n8n-mcp --include="*.ts" | \
    sed -E 's/^([^:]+:[0-9]+:).*abstract\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(.*/\2|\1/' | \
    sort | \
    awk -F'|' '{count[$1]++; locations[$1] = locations[$1] "\n  " $2} END {for (method in count) if (count[method] > 1) print "\n" method " (found " count[method] " times):" locations[method]}'

echo ""
echo "3. Duplicate public methods:"
grep -r -n "public\s\+[a-zA-Z_][a-zA-Z0-9_]*\s*(" /home/mehmet/Documents/n8nMCP/automation-hub-mcp-servers/n8n-mcp --include="*.ts" | \
    sed -E 's/^([^:]+:[0-9]+:).*public\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(.*/\2|\1/' | \
    sort | \
    awk -F'|' '{count[$1]++; locations[$1] = locations[$1] "\n  " $2} END {for (method in count) if (count[method] > 1) print "\n" method " (found " count[method] " times):" locations[method]}'

echo ""
echo "4. Duplicate private methods:"
grep -r -n "private\s\+[a-zA-Z_][a-zA-Z0-9_]*\s*(" /home/mehmet/Documents/n8nMCP/automation-hub-mcp-servers/n8n-mcp --include="*.ts" | \
    sed -E 's/^([^:]+:[0-9]+:).*private\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(.*/\2|\1/' | \
    sort | \
    awk -F'|' '{count[$1]++; locations[$1] = locations[$1] "\n  " $2} END {for (method in count) if (count[method] > 1) print "\n" method " (found " count[method] " times):" locations[method]}'

echo ""
echo "5. Duplicate protected methods:"
grep -r -n "protected\s\+[a-zA-Z_][a-zA-Z0-9_]*\s*(" /home/mehmet/Documents/n8nMCP/automation-hub-mcp-servers/n8n-mcp --include="*.ts" | \
    sed -E 's/^([^:]+:[0-9]+:).*protected\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(.*/\2|\1/' | \
    sort | \
    awk -F'|' '{count[$1]++; locations[$1] = locations[$1] "\n  " $2} END {for (method in count) if (count[method] > 1) print "\n" method " (found " count[method] " times):" locations[method]}'

# Clean up
rm -f "$TEMP_METHODS" "$TEMP_DUPLICATES"

echo ""
echo "=== Scan Complete ==="