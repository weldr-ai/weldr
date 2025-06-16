#!/bin/bash

# update-project.sh - Update project from boilerplate templates
# Usage: ./update-project.sh <server|web>

set -e

# Source common utilities
source "$(dirname "$0")/common.sh"

if [[ $# -ne 1 ]]; then
    print_error "Invalid number of arguments"
    exit 1
fi

if [[ $1 != "server" && $1 != "web" ]]; then
    print_error "Invalid argument"
    exit 1
fi

if [[ $1 == "server" ]]; then
    if [ "$NODE_ENV" = "development" ]; then
        "$(dirname "$0")/add-server.sh"
    else
        /.weldr/scripts/add-server.sh
    fi
elif [[ $1 == "web" ]]; then
    if [ "$NODE_ENV" = "development" ]; then
        "$(dirname "$0")/add-web.sh"
    else
        /.weldr/scripts/add-web.sh
    fi
fi

cd $WORKSPACE_DIR && bun run check:fix
