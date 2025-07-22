#!/bin/bash

# Git Automation Script for MarketLore
# This script automates git operations for the prediction markets project

set -e  # Exit on any error

# Configuration
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$REPO_DIR/logs/git-auto.log"
BACKUP_DIR="$REPO_DIR/backups"
BRANCH_NAME="main"
REMOTE_NAME="origin"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

# Create necessary directories
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$BACKUP_DIR"

# Function to check if there are changes to commit
has_changes() {
    git status --porcelain | grep -q .
}

# Function to get a meaningful commit message
generate_commit_message() {
    local changes=$(git status --porcelain)
    local message=""
    
    if echo "$changes" | grep -q "markets.csv"; then
        message="📊 Update prediction markets data"
    elif echo "$changes" | grep -q "src/predictions/"; then
        message="📈 Update generated predictions"
    elif echo "$changes" | grep -q "src/server.js"; then
        message="🔧 Update server configuration"
    elif echo "$changes" | grep -q "package.json"; then
        message="📦 Update dependencies"
    else
        message="🔄 General project update"
    fi
    
    # Add timestamp
    message="$message - $(date '+%Y-%m-%d %H:%M')"
    echo "$message"
}

# Function to create backup
create_backup() {
    local backup_name="backup-$(date '+%Y%m%d-%H%M%S')"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    log "INFO" "Creating backup: $backup_name"
    
    # Create backup of important files
    mkdir -p "$backup_path"
    cp -r "$REPO_DIR/markets.csv" "$backup_path/"
    cp -r "$REPO_DIR/src/predictions/" "$backup_path/" 2>/dev/null || true
    cp -r "$REPO_DIR/src/server.js" "$backup_path/"
    cp -r "$REPO_DIR/package.json" "$backup_path/"
    
    log "INFO" "Backup created at: $backup_path"
}

# Function to check git status and perform operations
check_and_commit() {
    log "INFO" "Checking for changes..."
    
    if ! has_changes; then
        log "INFO" "No changes to commit"
        return 0
    fi
    
    log "INFO" "Changes detected, preparing commit..."
    
    # Show what's changed
    log "INFO" "Changes:"
    git status --short | while read line; do
        log "INFO" "  $line"
    done
    
    # Create backup before committing
    create_backup
    
    # Add all changes
    git add .
    
    # Generate commit message
    local commit_msg=$(generate_commit_message)
    
    # Commit changes
    log "INFO" "Committing with message: $commit_msg"
    git commit -m "$commit_msg"
    
    # Push to remote
    log "INFO" "Pushing to remote repository..."
    if git push "$REMOTE_NAME" "$BRANCH_NAME"; then
        log "INFO" "Successfully pushed to remote"
    else
        log "ERROR" "Failed to push to remote"
        return 1
    fi
    
    log "INFO" "Git automation completed successfully"
}

# Function to sync with remote
sync_with_remote() {
    log "INFO" "Syncing with remote repository..."
    
    # Fetch latest changes
    git fetch "$REMOTE_NAME"
    
    # Check if we're behind remote
    local behind=$(git rev-list HEAD.."$REMOTE_NAME/$BRANCH_NAME" --count)
    if [ "$behind" -gt 0 ]; then
        log "WARN" "Local branch is $behind commits behind remote"
        log "INFO" "Pulling latest changes..."
        git pull "$REMOTE_NAME" "$BRANCH_NAME"
        log "INFO" "Successfully pulled latest changes"
    else
        log "INFO" "Local branch is up to date with remote"
    fi
}

# Function to show git statistics
show_stats() {
    log "INFO" "Git Statistics:"
    log "INFO" "  Current branch: $(git branch --show-current)"
    log "INFO" "  Last commit: $(git log -1 --format='%h - %s (%cr)')"
    log "INFO" "  Commits ahead: $(git rev-list "$REMOTE_NAME/$BRANCH_NAME"..HEAD --count)"
    log "INFO" "  Commits behind: $(git rev-list HEAD.."$REMOTE_NAME/$BRANCH_NAME" --count)"
    log "INFO" "  Total commits: $(git rev-list --count HEAD)"
}

# Function to clean old backups
cleanup_backups() {
    log "INFO" "Cleaning up old backups (keeping last 10)..."
    
    # Keep only the 10 most recent backups
    cd "$BACKUP_DIR"
    ls -t | tail -n +11 | xargs -r rm -rf
    cd "$REPO_DIR"
    
    log "INFO" "Backup cleanup completed"
}

# Main execution
main() {
    local action="${1:-auto}"
    
    log "INFO" "Starting git automation with action: $action"
    
    # Change to repository directory
    cd "$REPO_DIR"
    
    case "$action" in
        "auto")
            sync_with_remote
            check_and_commit
            cleanup_backups
            ;;
        "commit")
            check_and_commit
            ;;
        "sync")
            sync_with_remote
            ;;
        "stats")
            show_stats
            ;;
        "backup")
            create_backup
            ;;
        "cleanup")
            cleanup_backups
            ;;
        "help")
            echo "Usage: $0 [action]"
            echo "Actions:"
            echo "  auto     - Full automation (sync, commit, cleanup)"
            echo "  commit   - Commit and push changes only"
            echo "  sync     - Sync with remote only"
            echo "  stats    - Show git statistics"
            echo "  backup   - Create backup only"
            echo "  cleanup  - Clean up old backups"
            echo "  help     - Show this help"
            ;;
        *)
            log "ERROR" "Unknown action: $action"
            log "ERROR" "Use 'help' action to see available options"
            exit 1
            ;;
    esac
    
    log "INFO" "Git automation finished"
}

# Run main function with all arguments
main "$@" 