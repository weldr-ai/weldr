#!/bin/bash

# Script to display the project tree structure
# Usage: ./project-tree.sh

set -e  # Exit on any error

# Source common utilities
source "$(dirname "$0")/common.sh"

# Function to display tree using the tree command
display_with_tree() {
    # Common exclusions for development projects
    tree -I 'node_modules|.git|dist|build|coverage|.next|.nuxt|vendor|target|*.log|.vscode|*.env|Dockerfile.internal' \
         -a \
         --dirsfirst \
         --sort=name
}

cd $WORKSPACE_DIR

# Check if tree command is available
if command -v tree >/dev/null 2>&1; then
    display_with_tree
else
    print_error "tree command not found"
    exit 1
fi
