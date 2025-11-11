#!/bin/bash

set -e

# Set paths
WORKSPACE_BASE="${WORKSPACE_BASE:-/workspace}"
METADATA_FILE="${WORKSPACE_BASE}/.weldr-state.json"
TARGET_USAGE_PERCENT="${TARGET_VOLUME_USAGE_PERCENT:-70}"

# Function to check disk usage
check_disk_usage() {
    local mount_point="$1"
    df "$mount_point" | awk 'NR==2 {print $5}' | sed 's/%//'
}

# Check if metadata file exists
if [ ! -f "$METADATA_FILE" ]; then
    echo "No metadata file found at ${METADATA_FILE}"
    echo "Nothing to clean up"
    exit 0
fi

# Get current disk usage
CURRENT_USAGE=$(check_disk_usage "$WORKSPACE_BASE")
echo "Current disk usage: ${CURRENT_USAGE}%"
echo "Target disk usage: ${TARGET_USAGE_PERCENT}%"

# If we're already below target, no cleanup needed
if [ "$CURRENT_USAGE" -le "$TARGET_USAGE_PERCENT" ]; then
    echo "✅ Disk usage is within acceptable limits"
    exit 0
fi

echo "🧹 Starting LRU cleanup..."

# Extract branch directories sorted by lastAccessedAt (oldest first)
# Format: lastAccessedAt|branchId
SORTED_BRANCHES=$(jq -r '.branches | to_entries |
    map("\(.value.lastAccessedAt)|\(.key)") |
    sort |
    .[]' "$METADATA_FILE")

if [ -z "$SORTED_BRANCHES" ]; then
    echo "No branches found in metadata"
    exit 0
fi

CLEANED_COUNT=0
CLEANED_SIZE=0

# Iterate through branches from oldest to newest
while IFS='|' read -r timestamp branch_id; do
    BRANCH_DIR="${WORKSPACE_BASE}/${branch_id}"

    # Check if directory exists
    if [ ! -d "$BRANCH_DIR" ]; then
        echo "Removing stale metadata entry for non-existent branch: ${branch_id}"
        # Remove from metadata
        jq --arg bid "$branch_id" 'del(.branches[$bid])' "$METADATA_FILE" > "${METADATA_FILE}.tmp"
        mv "${METADATA_FILE}.tmp" "$METADATA_FILE"
        continue
    fi

    # Calculate directory size before removal
    DIR_SIZE=$(du -sb "$BRANCH_DIR" 2>/dev/null | awk '{print $1}')
    DIR_SIZE_MB=$((DIR_SIZE / 1024 / 1024))

    echo "Removing branch directory: ${branch_id} (last accessed: ${timestamp}, size: ${DIR_SIZE_MB}MB)"

    # Remove the directory
    rm -rf "$BRANCH_DIR"

    # Remove from metadata
    jq --arg bid "$branch_id" 'del(.branches[$bid])' "$METADATA_FILE" > "${METADATA_FILE}.tmp"
    mv "${METADATA_FILE}.tmp" "$METADATA_FILE"

    CLEANED_COUNT=$((CLEANED_COUNT + 1))
    CLEANED_SIZE=$((CLEANED_SIZE + DIR_SIZE_MB))

    # Check disk usage again
    CURRENT_USAGE=$(check_disk_usage "$WORKSPACE_BASE")
    echo "  Current disk usage after cleanup: ${CURRENT_USAGE}%"

    # If we've reached the target, stop cleaning
    if [ "$CURRENT_USAGE" -le "$TARGET_USAGE_PERCENT" ]; then
        echo "✅ Reached target disk usage"
        break
    fi
done <<< "$SORTED_BRANCHES"

echo ""
echo "Cleanup summary:"
echo "  Branches removed: ${CLEANED_COUNT}"
echo "  Space freed: ${CLEANED_SIZE}MB"
echo "  Final disk usage: ${CURRENT_USAGE}%"

# Check if we successfully reduced usage
if [ "$CURRENT_USAGE" -le "$TARGET_USAGE_PERCENT" ]; then
    echo "✅ LRU cleanup completed successfully"
    exit 0
else
    echo "⚠️  Unable to reduce disk usage to target level"
    echo "Current: ${CURRENT_USAGE}%, Target: ${TARGET_USAGE_PERCENT}%"
    # Don't exit with error - we did our best
    exit 0
fi

