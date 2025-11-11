#!/bin/bash

set -e

BRANCH_ID="$1"
PROJECT_ID="$2"

if [ -z "$BRANCH_ID" ] || [ -z "$PROJECT_ID" ]; then
    echo "Usage: $0 <branch_id> <project_id>" >&2
    exit 1
fi

# Set paths
WORKSPACE_BASE="${WORKSPACE_BASE:-/workspace}"
BRANCH_DIR="${WORKSPACE_BASE}/${BRANCH_ID}"

# Validate required environment variables
for var in "S3_ACCESS_KEY_ID" "S3_SECRET_ACCESS_KEY" "S3_ENDPOINT"; do
    if [ -z "${!var}" ]; then
        missing_vars="$missing_vars $var"
    fi
done

if [ ! -z "$missing_vars" ]; then
    echo "ERROR: The following required environment variables are missing:$missing_vars" >&2
    exit 1
fi

# Check if branch directory exists
if [ ! -d "$BRANCH_DIR" ]; then
    echo "ERROR: Branch directory ${BRANCH_DIR} does not exist" >&2
    exit 1
fi

# Set S3 bucket name
BUCKET_NAME="project-${PROJECT_ID}-branch-${BRANCH_ID}"
S3_REGION="${S3_REGION:-auto}"

# Configure rclone for this sync operation
export RCLONE_CONFIG_S3_TYPE=s3
export RCLONE_CONFIG_S3_PROVIDER=Other
export RCLONE_CONFIG_S3_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID}"
export RCLONE_CONFIG_S3_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY}"
export RCLONE_CONFIG_S3_ENDPOINT="${S3_ENDPOINT}"
export RCLONE_CONFIG_S3_REGION="${S3_REGION}"
export RCLONE_CONFIG_S3_ACL=private

echo "Starting sync from S3..."
echo "  Branch: ${BRANCH_ID}"
echo "  Project: ${PROJECT_ID}"
echo "  Source Bucket: ${BUCKET_NAME}"
echo "  Destination: ${BRANCH_DIR}"

# Check if bucket exists first
if ! rclone lsf "s3:${BUCKET_NAME}" --max-depth 1 > /dev/null 2>&1; then
    echo "⚠️  Bucket ${BUCKET_NAME} does not exist or is empty - skipping sync"
    echo "SYNC_STATUS=skipped"
    echo "REASON=bucket_not_found"
    exit 0
fi

# Sync from S3 to local directory
# Using sync to ensure local matches S3
if rclone sync \
    "s3:${BUCKET_NAME}/" \
    "${BRANCH_DIR}" \
    --exclude "node_modules/**" \
    --exclude ".next/**" \
    --exclude "dist/**" \
    --exclude "build/**" \
    --exclude ".turbo/**" \
    --exclude "**/.cache/**" \
    --exclude "**/tmp/**" \
    --exclude "**/*.log" \
    --exclude "**/.DS_Store" \
    --exclude "**/coverage/**" \
    --exclude "**/.nyc_output/**" \
    --exclude "**/out/**" \
    --exclude "**/.output/**" \
    --exclude "**/.nitro/**" \
    --exclude "**/.vercel/**" \
    --exclude "**/.react-router/**" \
    --exclude "**/.vscode/**" \
    --exclude "**/.idea/**" \
    --progress \
    --stats 10s \
    --stats-one-line; then
    echo "✅ Successfully synced from S3"
    echo "SYNC_STATUS=success"
    echo "BUCKET_NAME=${BUCKET_NAME}"
    exit 0
else
    echo "ERROR: Failed to sync from S3" >&2
    echo "SYNC_STATUS=failed"
    exit 1
fi

