#!/bin/bash

# common.sh - Common utility functions for scripts

if [ "$NODE_ENV" = "development" ]; then
    WORKSPACE_DIR="$(dirname "$0")/../.temp"
else
    WORKSPACE_DIR="/workspace"
fi

# Set data paths based on environment
if [ "$NODE_ENV" = "development" ]; then
    # In development, use absolute paths relative to script location
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    BOILERPLATES_DIR="$SCRIPT_DIR/../data/boilerplates"
    DATA_DIR="$SCRIPT_DIR/../data"
else
    # In production, use absolute paths
    BOILERPLATES_DIR="/.weldr/data/boilerplates"
    DATA_DIR="/.weldr/data"
fi

# Function to print errors to stderr
print_error() {
    echo "[ERROR] $1" >&2
}
