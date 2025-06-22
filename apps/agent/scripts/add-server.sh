#!/bin/bash

set -e

# Source common utilities
source "$(dirname "$0")/common.sh"

BOILERPLATE_DIR="$BOILERPLATES_DIR/add-server"

# Check if we have the required files
if [ ! -f "$WORKSPACE_DIR/package.json" ]; then
    print_error "No package.json found. Make sure workspace is initialized."
    exit 1
fi

if [ ! -d "$BOILERPLATE_DIR" ]; then
    print_error "add-server boilerplate directory not found at $BOILERPLATE_DIR"
    exit 1
fi

# Step 1: Rename src directory to server
if [ -d "$WORKSPACE_DIR/src" ]; then
    if [ -d "$WORKSPACE_DIR/web" ]; then
        rm -rf "$WORKSPACE_DIR/web"
    fi
    mv "$WORKSPACE_DIR/src" "$WORKSPACE_DIR/web"
else
    mkdir -p "$WORKSPACE_DIR/web"
fi

# Step 2: Replace all @/ with @server/ in the codebase
# Find all TypeScript, JavaScript, and JSON files and replace @/ with @server/
# Exclude node_modules, .git, and dist directories
find "$WORKSPACE_DIR" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.json" \) \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/dist/*" \
    -not -path "*/boilerplates/*" \
    -exec sed -i.bak 's|@/|@web/|g' {} \;

# Remove backup files created by sed
find "$WORKSPACE_DIR" -name "*.bak" \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/dist/*" \
    -not -path "*/boilerplates/*" \
    -delete

# Step 3: Copy files and directories from add-server boilerplate
# Copy the web directory
if [ -d "$BOILERPLATE_DIR/server" ]; then
    cp -r "$BOILERPLATE_DIR/server" "$WORKSPACE_DIR/"
fi

# Copy additional config files
for file in "vite.config.ts"; do
    if [ -f "$BOILERPLATE_DIR/$file" ]; then
        cp "$BOILERPLATE_DIR/$file" "$WORKSPACE_DIR/"
    fi
done

# Copy the api.$.ts file
if [ -f "$BOILERPLATE_DIR/api.$.ts" ]; then
    cp "$BOILERPLATE_DIR/api.$.ts" "$WORKSPACE_DIR/web/routes/api.$.ts"
fi

# Copy the orpc.ts file
if [ -f "$BOILERPLATE_DIR/orpc.ts" ]; then
    cp "$BOILERPLATE_DIR/orpc.ts" "$WORKSPACE_DIR/web/lib/orpc.ts"
fi

# Step 4: Override tsconfig.json
if [ -f "$BOILERPLATE_DIR/tsconfig.json" ]; then
    cp "$BOILERPLATE_DIR/tsconfig.json" "$WORKSPACE_DIR/tsconfig.json"
else
    print_error "tsconfig.json not found in boilerplate"
    exit 1
fi

# Step 5: Update router.tsx to include orpc
ROUTER_FILE="$WORKSPACE_DIR/web/router.tsx"
if [ -f "$ROUTER_FILE" ]; then
        # Add orpc import at the very beginning of the file (only if not already present)
    if ! grep -q 'import { orpc } from "./lib/orpc"' "$ROUTER_FILE"; then
        sed -i.bak '1s/^/import { orpc } from ".\/lib\/orpc";\n/' "$ROUTER_FILE"
    fi

    # Update the context object to include orpc (only if not already present)
    if ! grep -q "orpc," "$ROUTER_FILE"; then
        sed -i.bak 's/context: {/context: {\
        orpc,/' "$ROUTER_FILE"
    fi

    # Remove backup file
    rm -f "$ROUTER_FILE.bak"
fi

# Also update __root.tsx to include orpc in the context interface
ROOT_FILE="$WORKSPACE_DIR/web/routes/__root.tsx"
if [ -f "$ROOT_FILE" ]; then
        # Add ORPCReactUtils type import at the very beginning of the file (only if not already present)
    if ! grep -q 'import type { ORPCReactUtils } from "@/lib/orpc"' "$ROOT_FILE"; then
        sed -i.bak '1s/^/import type { ORPCReactUtils } from "@\/lib\/orpc";\n/' "$ROOT_FILE"
    fi

    # Update the router context interface to include orpc (only if not already present)
    if ! grep -q "orpc: ORPCReactUtils;" "$ROOT_FILE"; then
        sed -i.bak 's/interface MyRouterContext {/interface MyRouterContext {\
  orpc: ORPCReactUtils;/' "$ROOT_FILE"
    fi

    # Remove backup file
    rm -f "$ROOT_FILE.bak"
fi

# Step 6: Update package.json scripts and dependencies
# Run the Node.js script to update package.json
if [ "$NODE_ENV" = "development" ]; then
    node "$(dirname "$0")/update-package.js" --server
else
    node /.weldr/scripts/update-package.js --server
fi

cd $WORKSPACE_DIR && bun install --frozen-lockfile --no-verify --no-progress --silent 2>&1
