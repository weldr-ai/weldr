#!/bin/bash

set -e

# Source common utilities
source "$(dirname "$0")/common.sh"

PORT=4000
API_ENDPOINT="/api/openapi.json"
BASE_URL="http://localhost:${PORT}"
TIMEOUT=30

SERVER_SRC_PATH="$WORKSPACE_DIR/src/index.ts"
SERVER_SERVER_PATH="$WORKSPACE_DIR/server/index.ts"

cleanup() {
    # Kill any process using the port directly
    local pids_on_port=$(lsof -ti:$PORT 2>/dev/null)
    if [ ! -z "$pids_on_port" ]; then
        echo "$pids_on_port" | xargs -r kill -TERM 2>/dev/null || true
        sleep 1
        echo "$pids_on_port" | xargs -r kill -KILL 2>/dev/null || true
    fi

    # Also try to kill the original server PID if it still exists
    if [ ! -z "$SERVER_PID" ] && kill -0 $SERVER_PID 2>/dev/null; then
        kill -TERM $SERVER_PID 2>/dev/null || true
        sleep 1
        kill -KILL $SERVER_PID 2>/dev/null || true
    fi
}

trap cleanup EXIT

cd $WORKSPACE_DIR

if command -v bun >/dev/null 2>&1; then
    if [ -f "$SERVER_SRC_PATH" ]; then
        PORT=4000 bun run tsx src/index.ts >/dev/null 2>&1 &
        SERVER_PID=$!
    elif [ -f "$SERVER_SERVER_PATH" ]; then
        PORT=4000 bun run tsx server/index.ts >/dev/null 2>&1 &
        SERVER_PID=$!
    else
        print_error "Server file not found at $SERVER_SRC_PATH or $SERVER_SERVER_PATH"
        exit 1
    fi
else
    print_error "bun not found"
    exit 1
fi

count=0
while [ $count -lt $TIMEOUT ]; do
    if curl -s -f "${BASE_URL}${API_ENDPOINT}" >/dev/null 2>&1; then
        break
    fi

    sleep 1
    count=$((count + 1))
done

if [ $count -eq $TIMEOUT ]; then
    print_error "Server failed to start within ${TIMEOUT} seconds"
    exit 1
fi

# Fetch and output the OpenAPI JSON
if ! curl -s -f "${BASE_URL}${API_ENDPOINT}" 2>/dev/null; then
    print_error "Failed to fetch OpenAPI JSON from ${BASE_URL}${API_ENDPOINT}"
    exit 1
fi

# Exit successfully - cleanup will be called automatically via trap
exit 0
