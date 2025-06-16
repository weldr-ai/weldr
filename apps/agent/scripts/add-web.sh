#!/bin/bash

set -e

# Source common utilities
source "$(dirname "$0")/common.sh"

BOILERPLATE_DIR="$BOILERPLATES_DIR/add-web"

# Check if we have the required files
if [ ! -f "$WORKSPACE_DIR/package.json" ]; then
    print_error "No package.json found. Make sure workspace is initialized."
    exit 1
fi

if [ ! -d "$BOILERPLATE_DIR" ]; then
    print_error "web-only boilerplate directory not found at $BOILERPLATE_DIR"
    exit 1
fi

# Step 1: Rename src directory to server
if [ -d "$WORKSPACE_DIR/src" ]; then
    if [ -d "$WORKSPACE_DIR/server" ]; then
        rm -rf "$WORKSPACE_DIR/server"
    fi
    mv "$WORKSPACE_DIR/src" "$WORKSPACE_DIR/server"
else
    mkdir -p "$WORKSPACE_DIR/server"
fi

# Step 2: Replace all @/ with @server/ in the codebase
# Find all TypeScript, JavaScript, and JSON files and replace @/ with @server/
# Exclude node_modules, .git, and dist directories
find "$WORKSPACE_DIR" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" \) \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/dist/*" \
    -not -path "*/boilerplates/*" \
    -exec sed -i.bak 's|@/|@server/|g' {} \;

# Remove backup files created by sed
find "$WORKSPACE_DIR" -name "*.bak" \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/dist/*" \
    -not -path "*/boilerplates/*" \
    -delete

# Step 3: Copy files and directories from web-only boilerplate
# Copy the web directory
if [ -d "$BOILERPLATE_DIR/web" ]; then
    cp -r "$BOILERPLATE_DIR/web" "$WORKSPACE_DIR/"
fi

# Copy additional config files
for file in "components.json" "vite.config.ts" "Dockerfile"; do
    if [ -f "$BOILERPLATE_DIR/$file" ]; then
        cp "$BOILERPLATE_DIR/$file" "$WORKSPACE_DIR/"
    fi
done

# Step 4: Override tsconfig.json
if [ -f "$BOILERPLATE_DIR/tsconfig.json" ]; then
    cp "$BOILERPLATE_DIR/tsconfig.json" "$WORKSPACE_DIR/tsconfig.json"
else
    print_error "tsconfig.json not found in boilerplate"
    exit 1
fi

# Step 5: Update package.json scripts and dependencies
# Run the Node.js script to update package.json
if [ "$NODE_ENV" = "development" ]; then
    node "$(dirname "$0")/update-package.js" --web
else
    node /.weldr/scripts/update-package.js --web
fi

cd $WORKSPACE_DIR && bun install --no-verify --no-progress --silent 2>&1
