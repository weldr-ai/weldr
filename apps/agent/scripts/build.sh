#!/bin/bash

# Script to deploy a preview build to Fly.io
# Usage: ./build.sh <BUILD_ID> <FLY_ACCESS_TOKEN>
# Example: ./build.sh app-build-1234567890 1234567890

set -e # Exit on any error

# Source common utilities
source "$(dirname "$0")/common.sh"

# Check if flyctl is installed
if ! command -v flyctl &> /dev/null; then
    print_error "flyctl could not be found"
    exit 1
fi

# Check if required arguments are provided
if [ $# -ne 2 ]; then
    print_error "Invalid number of arguments"
    echo "Usage: $0 <BUILD_ID> <FLY_ACCESS_TOKEN>"
    echo "Example: $0 app-build-1234567890 1234567890"
    exit 1
fi

cd $WORKSPACE_DIR && bun install --no-verify --no-progress --silent 2>&1

# Build and push using fly deploy
if output=$(cd $WORKSPACE_DIR && flyctl deploy \
  --app weldr-images \
  --remote-only \
  --build-only \
  --image-label "$1" \
  --access-token "$2" \
  --push 2>&1); then
    echo "Deployment completed successfully!"
else
    print_error "Deployment failed:"
    echo "$output" >&2
    exit 1
fi
