#!/bin/bash

# Script to checkout a specific commit and create a new branch from it
# Usage: ./revert.sh <commit-hash> <version-id>

set -e  # Exit on any error

# Source common utilities
source "$(dirname "$0")/common.sh"

# Check if correct number of arguments provided
if [ $# -ne 2 ]; then
    print_error "Invalid number of arguments"
    echo "Usage: $0 <commit-hash> <version-id>"
    echo "Example: $0 abc123def as321dsad2sa"
    exit 1
fi

COMMIT_HASH=$1
VERSION_ID=$2

cd $WORKSPACE_DIR

# Validate that we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository"
    exit 1
fi

# Check if the commit hash exists
if ! git cat-file -e "$COMMIT_HASH" 2>/dev/null; then
    print_error "Commit '$COMMIT_HASH' does not exist"
    exit 1
fi

# Check if branch name already exists
if git show-ref --verify --quiet refs/heads/"$VERSION_ID"; then
    print_error "Branch '$VERSION_ID' already exists"
    print_error "Please use a different version-id for the new branch"
    exit 1
fi

if ! git checkout --detach "$COMMIT_HASH" > /dev/null 2>&1; then
    print_error "Failed to checkout commit '$COMMIT_HASH'"
    exit 1
fi

if ! git checkout -b "$VERSION_ID" > /dev/null 2>&1; then
    print_error "Failed to create branch '$VERSION_ID'"
    exit 1
fi

echo "Successfully created and switched to branch '$VERSION_ID' from commit '$COMMIT_HASH'"
