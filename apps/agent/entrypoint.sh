#!/bin/bash

# Set the workspace directory
WORKSPACE_DIR="/workspace"

# Check if the workspace is empty
if [ -z "$(ls -A $WORKSPACE_DIR)" ]; then
    echo "Downloading project files to workspace..."
    if [ -n "$FLY_APP_NAME" ]; then
        # Extract project ID from FLY_APP_NAME (everything after the last dash)
        PROJECT_ID="${FLY_APP_NAME##*-}"
        ENDPOINT_URL=${TIGRIS_ENDPOINT_URL:-https://fly.storage.tigris.dev}
        aws s3 sync s3://$PROJECT_ID $WORKSPACE_DIR/ --endpoint-url="$ENDPOINT_URL" --region=auto --quiet
        cd $WORKSPACE_DIR && bun install --no-verify --no-progress --silent 2>&1
        echo "Project files downloaded to workspace"
    else
        echo "Warning: FLY_APP_NAME not set, skipping download"
    fi
fi

# Run the server
/.weldr/main
