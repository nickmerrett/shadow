#!/bin/bash

# Shadow Server Build Script
# Compiles TypeScript and copies required assets

set -e  # Exit on any error

echo "🔨 Building Shadow Server..."

echo "📦 Compiling TypeScript..."
tsc

echo "🔗 Resolving path aliases..."
tsc-alias

echo "📄 Copying tool instruction files..."

mkdir -p dist/prompt/tools

# Copy all markdown files from each tool directory
for tool_dir in src/prompt/tools/*/; do
    if [ -d "$tool_dir" ]; then
        tool_name=$(basename "$tool_dir")
        echo "  📋 Copying $tool_name instructions..."
        
        # Create corresponding dist directory
        mkdir -p "dist/prompt/tools/$tool_name"
        
        # Copy markdown files
        if ls "$tool_dir"*.md >/dev/null 2>&1; then
            cp "$tool_dir"*.md "dist/prompt/tools/$tool_name/"
        fi
    fi
done

echo "✅ Server build complete!"