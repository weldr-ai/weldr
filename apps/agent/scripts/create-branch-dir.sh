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
METADATA_FILE="${WORKSPACE_BASE}/.weldr-state.json"
MAX_USAGE_PERCENT="${MAX_VOLUME_USAGE_PERCENT:-85}"

# Ensure workspace directory exists
mkdir -p "${WORKSPACE_BASE}"

# Initialize metadata file if it doesn't exist
if [ ! -f "$METADATA_FILE" ]; then
    echo '{"branches":{}}' > "$METADATA_FILE"
fi

# Function to get current timestamp in ISO 8601 format
get_timestamp() {
    date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# Function to update metadata for existing or new branch
update_metadata() {
    local branch_id="$1"
    local project_id="$2"
    local is_new="$3"
    local timestamp=$(get_timestamp)
    local size_bytes=0

    # Calculate directory size if it exists
    if [ -d "$BRANCH_DIR" ]; then
        size_bytes=$(du -sb "$BRANCH_DIR" 2>/dev/null | awk '{print $1}')
    fi

    # Use jq to update the metadata file
    if [ "$is_new" = "true" ]; then
        # New branch entry
        jq --arg bid "$branch_id" \
           --arg pid "$project_id" \
           --arg ts "$timestamp" \
           --arg size "$size_bytes" \
           '.branches[$bid] = {
               branchId: $bid,
               projectId: $pid,
               lastAccessedAt: $ts,
               sizeBytes: ($size | tonumber),
               createdAt: $ts
           }' "$METADATA_FILE" > "${METADATA_FILE}.tmp"
    else
        # Update existing entry
        jq --arg bid "$branch_id" \
           --arg ts "$timestamp" \
           --arg size "$size_bytes" \
           '.branches[$bid].lastAccessedAt = $ts |
            .branches[$bid].sizeBytes = ($size | tonumber)' \
           "$METADATA_FILE" > "${METADATA_FILE}.tmp"
    fi

    mv "${METADATA_FILE}.tmp" "$METADATA_FILE"
}

# Function to check disk usage
check_disk_usage() {
    local mount_point="$1"
    df "$mount_point" | awk 'NR==2 {print $5}' | sed 's/%//'
}

# Check if branch directory already exists
if [ -d "$BRANCH_DIR" ]; then
    echo "Branch directory already exists: ${BRANCH_DIR}"
    update_metadata "$BRANCH_ID" "$PROJECT_ID" "false"
    echo "STATUS=reused"
    echo "BRANCH_DIR=${BRANCH_DIR}"
    echo "✅ Updated metadata for existing branch"
    exit 0
fi

# Directory doesn't exist - check if we need to cleanup first
CURRENT_USAGE=$(check_disk_usage "$WORKSPACE_BASE")
echo "Current disk usage: ${CURRENT_USAGE}%"

if [ "$CURRENT_USAGE" -ge "$MAX_USAGE_PERCENT" ]; then
    echo "⚠️  Disk usage (${CURRENT_USAGE}%) exceeds threshold (${MAX_USAGE_PERCENT}%)"
    echo "Running LRU cleanup..."

    # Call cleanup script
    CLEANUP_SCRIPT="$(dirname "$0")/cleanup-lru.sh"
    if [ -x "$CLEANUP_SCRIPT" ]; then
        if ! "$CLEANUP_SCRIPT"; then
            echo "WARNING: LRU cleanup failed or was unable to free enough space" >&2
        fi
    else
        echo "WARNING: Cleanup script not found or not executable: ${CLEANUP_SCRIPT}" >&2
    fi

    # Check usage again after cleanup
    CURRENT_USAGE=$(check_disk_usage "$WORKSPACE_BASE")
    echo "Disk usage after cleanup: ${CURRENT_USAGE}%"

    if [ "$CURRENT_USAGE" -ge "$MAX_USAGE_PERCENT" ]; then
        echo "ERROR: Still not enough space after cleanup (${CURRENT_USAGE}% >= ${MAX_USAGE_PERCENT}%)" >&2
        exit 1
    fi
fi

# Create the branch directory
echo "Creating branch directory: ${BRANCH_DIR}"
mkdir -p "$BRANCH_DIR"

# Update metadata with new branch
update_metadata "$BRANCH_ID" "$PROJECT_ID" "true"

echo "STATUS=created"
echo "BRANCH_DIR=${BRANCH_DIR}"
echo "✅ Created branch directory and updated metadata"
exit 0

