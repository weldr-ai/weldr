#!/bin/bash

# Script to create a new commit
# Usage: ./commit.sh <commit-message> [user-name] [user-email]

set -e  # Exit on any error

# Source common utilities
source "$(dirname "$0")/common.sh"

# Check if correct number of arguments provided
if [ $# -lt 1 ] || [ $# -gt 3 ]; then
    print_error "Invalid number of arguments"
    echo "Usage: $0 <commit-message> [user-name] [user-email]"
    echo "Example: $0 \"Add new features\""
    echo "Example: $0 \"Add new features\" \"John Doe\" \"john@example.com\""
    exit 1
fi

COMMIT_MESSAGE=$1
USER_NAME=$2
USER_EMAIL=$3

cd $WORKSPACE_DIR

# Stage all changes first
git add . > /dev/null 2>&1

# Check if anything was actually staged
if git diff --cached --quiet; then
    exit 0
fi

# Create commit since there are staged changes
if [ -n "$USER_NAME" ] && [ -n "$USER_EMAIL" ]; then
    # Use provided user name and email
    git -c user.name="$USER_NAME" -c user.email="$USER_EMAIL" commit -m "$COMMIT_MESSAGE" > /dev/null 2>&1
else
    # Use default git configuration
    git commit -m "$COMMIT_MESSAGE" > /dev/null 2>&1
fi

if [ "$NODE_ENV" = "production" ]; then
    /.weldr/scripts/sync.sh > /dev/null 2>&1
fi
