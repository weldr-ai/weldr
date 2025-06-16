#!/bin/bash

set -e

if [ -n "$FLY_APP_NAME" ]; then
    # Extract project ID from FLY_APP_NAME (everything after the last dash)
    PROJECT_ID="${FLY_APP_NAME##*-}"
    # Use custom endpoint for Tigris
    ENDPOINT_URL=${TIGRIS_ENDPOINT_URL:-https://fly.storage.tigris.dev}

    if aws s3 sync /workspace/ s3://$PROJECT_ID --endpoint-url="$ENDPOINT_URL" --region=auto --delete --exclude "node_modules/*"; then
        echo "Upload completed successfully"
    else
        echo "Error: Upload failed"
        exit 1
    fi
else
    echo "Error: FLY_APP_NAME not set"
    exit 1
fi
