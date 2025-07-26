#!/bin/bash

# Script to find duplicate method declarations in TypeScript files (excluding node_modules)

echo "=== Finding Duplicate Method Declarations in TypeScript Source Files ==="
echo "(Excluding node_modules and dist directories)"
echo ""

# Create temporary files to store results
TEMP_METHODS=$(mktemp)
TEMP_RESULTS=$(mktemp)

# Base directory
BASE_DIR="/home/mehmet/Documents/n8nMCP/automation-hub-mcp-servers/n8n-mcp"

# Find all TypeScript files, excluding node_modules and dist
find "$BASE_DIR" -name "*.ts" -type f \
    -not -path "*/node_modules/*" \
    -not -path "*/dist/*" | while read -r file; do
    
    # Extract method declarations with line numbers
    grep -n -E '^\s*(public|protected|private|abstract|static|async|override)?\s*(public|protected|private|abstract|static|async|override)?\s*(public|protected|private|abstract|static|async|override)?\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\(' "$file" 2>/dev/null | while read -r line; do
        line_num=$(echo "$line" | cut -d: -f1)
        method_line=$(echo "$line" | cut -d: -f2-)
        
        # Extract method name more carefully
        method_name=$(echo "$method_line" | \
            sed -E 's/^\s*(public|protected|private|abstract|static|async|override|readonly)*\s*//g' | \
            sed -E 's/\s*\(.*$//' | \
            sed -E 's/^\s*//' | \
            awk '{print $1}')
        
        # Filter out keywords and common non-method patterns
        if [[ -n "$method_name" && \
              "$method_name" != "if" && \
              "$method_name" != "for" && \
              "$method_name" != "while" && \
              "$method_name" != "switch" && \
              "$method_name" != "catch" && \
              "$method_name" != "try" && \
              "$method_name" != "constructor" && \
              "$method_name" != "return" && \
              "$method_name" != "throw" && \
              "$method_name" != "await" && \
              "$method_name" != "new" && \
              "$method_name" != "function" && \
              "$method_name" != "const" && \
              "$method_name" != "let" && \
              "$method_name" != "var" && \
              "$method_name" != "import" && \
              "$method_name" != "export" && \
              "$method_name" != "super" && \
              "$method_name" != "this" && \
              "$method_name" != "typeof" && \
              "$method_name" != "instanceof" ]]; then
            echo "$method_name|$file:$line_num|$(echo "$method_line" | sed 's/|/_/g')" >> "$TEMP_METHODS"
        fi
    done
done

# Sort and find duplicates
sort -t'|' -k1,1 "$TEMP_METHODS" | awk -F'|' '
{
    method = $1
    location = $2
    line = $3
    
    # Store all occurrences
    if (method != "") {
        occurrences[method] = occurrences[method] location "|" line "\n"
        count[method]++
    }
}
END {
    for (method in count) {
        if (count[method] > 1) {
            print "### Method: " method " (found " count[method] " times)"
            print occurrences[method]
        }
    }
}' | sort > "$TEMP_RESULTS"

echo "=== DUPLICATE METHOD DECLARATIONS FOUND ==="
echo ""

# Display results if any duplicates found
if [ -s "$TEMP_RESULTS" ]; then
    cat "$TEMP_RESULTS"
else
    echo "No duplicate method declarations found in source files."
fi

echo ""
echo "=== DETAILED ANALYSIS BY PATTERN ==="
echo ""

# Search for specific patterns with better filtering
echo "1. Searching for duplicate async methods:"
find "$BASE_DIR" -name "*.ts" -type f \
    -not -path "*/node_modules/*" \
    -not -path "*/dist/*" \
    -exec grep -Hn "^\s*\(public\|protected\|private\)\?\s*async\s\+[a-zA-Z_][a-zA-Z0-9_]*\s*(" {} \; | \
    sed -E 's/^([^:]+:[0-9]+):.*async\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(.*/\2|\1/' | \
    sort | \
    awk -F'|' '{count[$1]++; locations[$1] = locations[$1] "\n  " $2} END {for (method in count) if (count[method] > 1) print "\n" method " (found " count[method] " times):" locations[method]}'

echo ""
echo "2. Searching for duplicate abstract methods:"
find "$BASE_DIR" -name "*.ts" -type f \
    -not -path "*/node_modules/*" \
    -not -path "*/dist/*" \
    -exec grep -Hn "^\s*\(protected\|public\|private\)\?\s*abstract\s\+[a-zA-Z_][a-zA-Z0-9_]*\s*(" {} \; | \
    sed -E 's/^([^:]+:[0-9]+):.*abstract\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(.*/\2|\1/' | \
    sort | \
    awk -F'|' '{count[$1]++; locations[$1] = locations[$1] "\n  " $2} END {for (method in count) if (count[method] > 1) print "\n" method " (found " count[method] " times):" locations[method]}'

echo ""
echo "3. Searching for methods with same signature in same file:"
find "$BASE_DIR" -name "*.ts" -type f \
    -not -path "*/node_modules/*" \
    -not -path "*/dist/*" | while read -r file; do
    
    # Extract method signatures
    methods=$(grep -n "^\s*\(public\|protected\|private\|abstract\|static\|async\|override\)\?.*[a-zA-Z_][a-zA-Z0-9_]*\s*(" "$file" 2>/dev/null | \
        sed -E 's/^([0-9]+):.*?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\).*/\1:\2(\3)/')
    
    # Check for exact duplicates within the file
    echo "$methods" | sort -t: -k2 | uniq -d -f1 | while read -r dup; do
        if [ -n "$dup" ]; then
            echo "  Duplicate in $file: $dup"
        fi
    done
done

# Clean up
rm -f "$TEMP_METHODS" "$TEMP_RESULTS"

echo ""
echo "=== Analysis Complete ==="