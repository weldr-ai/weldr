#!/bin/bash

# init-project.sh - Initialize project from boilerplate templates
# Usage: ./init-project.sh <template>
# Templates: server, web, full-stack

set -e

# Source common utilities
source "$(dirname "$0")/common.sh"

# Function to show usage
show_usage() {
    echo "Usage: $0 <template>"
    echo ""
    echo "Templates:"
    echo "  server     - Server-only boilerplate"
    echo "  web        - Web-only boilerplate"
    echo "  full-stack - Full-stack boilerplate"
    echo ""
    echo "Examples:"
    echo "  $0 server"
    echo "  $0 web"
    echo "  $0 full-stack"
}

# Function to copy boilerplate
copy_boilerplate() {
    local template="$1"

    # Map template names to boilerplate directories
    local source_template=""
    case "$template" in
        "server")
            source_template="server-only"
            ;;
        "web")
            source_template="web-only"
            ;;
        "full-stack")
            source_template="full-stack"
            ;;
        *)
            print_error "Invalid template: $template"
            show_usage
            exit 1
            ;;
    esac

    local source_dir="$BOILERPLATES_DIR/$source_template"

    # Check if source template exists
    if [[ ! -d "$source_dir" ]]; then
        print_error "Template '$source_template' not found at $source_dir"
        exit 1
    fi

    # Create workspace directory if it doesn't exist
    mkdir -p "$WORKSPACE_DIR"

    # Copy template contents to workspace
    cp -r "$source_dir"/* "$WORKSPACE_DIR/"

    # Copy hidden files if they exist
    if ls "$source_dir"/.[^.]* >/dev/null 2>&1; then
        cp -r "$source_dir"/.[^.]* "$WORKSPACE_DIR/"
    fi

    # Initialize git repository if it doesn't exist
    if [ ! -d "$WORKSPACE_DIR/.git" ]; then
        cd $WORKSPACE_DIR && git init --initial-branch=main >/dev/null
    fi

    # Install dependencies
    if command -v bun &> /dev/null; then
        local bun_output
        if ! bun_output=$(cd $WORKSPACE_DIR && bun install --frozen-lockfile --no-verify --no-progress --silent 2>&1); then
            print_error "Failed to install dependencies with bun:" >&2
            echo "$bun_output" >&2
            exit 1
        fi
    else
        print_error "bun not found. Please install bun and run 'bun install' manually in $WORKSPACE_DIR"
        exit 1
    fi

    cd $WORKSPACE_DIR && bun run check:fix

    # Sync the workspace to the bucket
    if [ "$NODE_ENV" = "production" ]; then
        /.weldr/scripts/sync.sh
    fi
}

# Main script logic
main() {
    # Check arguments
    if [[ $# -ne 1 ]]; then
        print_error "Invalid number of arguments"
        show_usage
        exit 1
    fi

    local template="$1"

    # Copy the boilerplate
    copy_boilerplate "$template"
}

# Run main function with all arguments
main "$@"
