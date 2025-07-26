#!/bin/bash

echo "=== Finding Real Duplicate Method Declarations in n8n-mcp TypeScript Source Files ==="
echo ""

BASE_DIR="/home/mehmet/Documents/n8nMCP/automation-hub-mcp-servers/n8n-mcp"

# Create temporary file for results
TEMP_FILE=$(mktemp)

# Function to find duplicate method declarations across files
find_cross_file_duplicates() {
    echo "=== Searching for methods declared in multiple files ==="
    echo ""
    
    # Find all TypeScript files and extract method declarations
    find "$BASE_DIR" -name "*.ts" -type f \
        -not -path "*/node_modules/*" \
        -not -path "*/dist/*" \
        -exec grep -Hn '^\s*\(public\|private\|protected\|abstract\|static\|async\|override\)\+\s\+\([a-zA-Z_][a-zA-Z0-9_]*\)\s*(' {} \; | \
    awk -F':' '
    {
        file = $1
        line = $2
        code = $0
        sub(/^[^:]+:[^:]+:/, "", code)
        
        # Extract method name
        if (match(code, /(public|private|protected|abstract|static|async|override)+\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/, arr)) {
            method = arr[2]
            if (length(method) > 1) {  # Skip single-letter methods
                locations[method] = locations[method] file ":" line "\n"
                count[method]++
            }
        }
    }
    END {
        for (method in count) {
            if (count[method] > 1) {
                print "Method: " method " (found in " count[method] " locations)"
                print locations[method]
            }
        }
    }' | sort
}

# Function to find duplicate methods within the same class
find_same_class_duplicates() {
    echo ""
    echo "=== Searching for duplicate methods within the same class ==="
    echo ""
    
    find "$BASE_DIR" -name "*.ts" -type f \
        -not -path "*/node_modules/*" \
        -not -path "*/dist/*" | while read -r file; do
        
        # Extract class definitions and their methods
        awk '
        /^(export\s+)?(abstract\s+)?class\s+[A-Za-z_][A-Za-z0-9_]*/ {
            in_class = 1
            class_name = $0
            gsub(/.*class\s+/, "", class_name)
            gsub(/\s.*/, "", class_name)
            delete methods
            brace_count = 0
        }
        
        in_class {
            if (/{/) brace_count++
            if (/}/) brace_count--
            
            if (brace_count == 0 && /}/) {
                in_class = 0
                # Check for duplicates
                for (method in methods) {
                    if (methods[method] > 1) {
                        print "File: " FILENAME
                        print "Class: " class_name
                        print "Duplicate method: " method " (declared " methods[method] " times)"
                        print ""
                    }
                }
            }
            
            # Match method declarations
            if (match($0, /^\s*(public|private|protected|abstract|static|async|override)*\s*(public|private|protected|abstract|static|async|override)*\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/, arr)) {
                method_name = arr[3]
                if (length(method_name) > 1 && method_name != "if" && method_name != "for" && method_name != "while") {
                    methods[method_name]++
                }
            }
        }
        ' "$file"
    done
}

# Function to find interface methods declared multiple times
find_interface_duplicates() {
    echo ""
    echo "=== Searching for duplicate methods in interfaces ==="
    echo ""
    
    find "$BASE_DIR" -name "*.ts" -type f \
        -not -path "*/node_modules/*" \
        -not -path "*/dist/*" | while read -r file; do
        
        # Extract interface definitions and their methods
        awk '
        /^(export\s+)?interface\s+[A-Za-z_][A-Za-z0-9_]*/ {
            in_interface = 1
            interface_name = $0
            gsub(/.*interface\s+/, "", interface_name)
            gsub(/\s.*/, "", interface_name)
            delete methods
            brace_count = 0
        }
        
        in_interface {
            if (/{/) brace_count++
            if (/}/) brace_count--
            
            if (brace_count == 0 && /}/) {
                in_interface = 0
                # Check for duplicates
                for (method in methods) {
                    if (methods[method] > 1) {
                        print "File: " FILENAME
                        print "Interface: " interface_name
                        print "Duplicate method: " method " (declared " methods[method] " times)"
                        print ""
                    }
                }
            }
            
            # Match method declarations in interfaces
            if (match($0, /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/, arr)) {
                method_name = arr[1]
                if (length(method_name) > 1) {
                    methods[method_name]++
                }
            }
        }
        ' "$file"
    done
}

# Function to find specific problematic patterns
find_problematic_patterns() {
    echo ""
    echo "=== Searching for specific problematic patterns ==="
    echo ""
    
    echo "1. Multiple abstract method declarations with same name:"
    grep -rn "abstract.*(" "$BASE_DIR" --include="*.ts" \
        --exclude-dir=node_modules --exclude-dir=dist | \
        grep -E "abstract\s+[a-zA-Z_][a-zA-Z0-9_]+\s*\(" | \
        sed -E 's/.*abstract\s+([a-zA-Z_][a-zA-Z0-9_]+)\s*\(.*/\1/' | \
        sort | uniq -c | grep -v "^[[:space:]]*1 " | \
        while read count method; do
            echo "  Method '$method' declared abstract $count times"
            grep -rn "abstract.*$method\s*(" "$BASE_DIR" --include="*.ts" \
                --exclude-dir=node_modules --exclude-dir=dist | head -5
            echo ""
        done
    
    echo ""
    echo "2. Methods with identical signatures in same directory:"
    find "$BASE_DIR" -type d -not -path "*/node_modules/*" -not -path "*/dist/*" | while read -r dir; do
        if ls "$dir"/*.ts >/dev/null 2>&1; then
            grep -h "^\s*\(public\|private\|protected\)\s\+\(async\s\+\)\?[a-zA-Z_][a-zA-Z0-9_]*\s*(" "$dir"/*.ts 2>/dev/null | \
                sed -E 's/^\s+//' | sort | uniq -c | grep -v "^[[:space:]]*1 " | \
                while read count signature; do
                    if [ $count -gt 1 ]; then
                        echo "  Directory: $dir"
                        echo "  Duplicate signature ($count times): $signature"
                        grep -l "$signature" "$dir"/*.ts | head -3
                        echo ""
                    fi
                done
        fi
    done
}

# Run all checks
find_cross_file_duplicates
find_same_class_duplicates  
find_interface_duplicates
find_problematic_patterns

echo "=== Analysis Complete ==="