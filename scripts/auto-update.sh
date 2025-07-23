#!/bin/bash

# MarketLore Auto-Update Script
# This script automates the entire workflow: fetch data → generate predictions → commit → push

set -e  # Exit on any error

# Configuration
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$REPO_DIR/logs/auto-update.log"
SERVER_URL="http://localhost:4000"
DATA_ENDPOINT="$SERVER_URL/api/markets"
PREDICTION_ENDPOINT="$SERVER_URL/api/hf-response"
MARKETS_FILE="$REPO_DIR/markets.csv"
BACKUP_DIR="$REPO_DIR/backups"

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

# Function to check if server is running
check_server() {
    log "INFO" "Checking if server is running..."
    
    if curl -s --max-time 5 "$SERVER_URL" >/dev/null 2>&1; then
        log "INFO" "Server is running at $SERVER_URL"
        return 0
    else
        log "ERROR" "Server is not running at $SERVER_URL"
        log "ERROR" "Please start the server with: node src/server.js"
        return 1
    fi
}

# Function to fetch latest market data
fetch_market_data() {
    log "INFO" "Fetching latest market data from Polymarket..."
    
    # Create backup of current data
    if [ -f "$MARKETS_FILE" ]; then
        cp "$MARKETS_FILE" "$BACKUP_DIR/markets-backup-$(date '+%Y%m%d-%H%M%S').csv"
    fi
    
    # Fetch new data
    local response
    if response=$(curl -s --max-time 30 "$DATA_ENDPOINT"); then
        if echo "$response" | grep -q "error"; then
            log "ERROR" "Failed to fetch market data: $response"
            return 1
        fi
        
        # Save to markets.csv
        echo "$response" > "$MARKETS_FILE"
        
        # Count lines to verify data
        local line_count=$(wc -l < "$MARKETS_FILE")
        log "INFO" "Successfully fetched market data: $line_count lines"
        
        return 0
    else
        log "ERROR" "Failed to fetch market data from $DATA_ENDPOINT"
        return 1
    fi
}

# Function to generate new prediction
generate_prediction() {
    log "INFO" "Generating new prediction..."
    
    local response
    if response=$(curl -s --max-time 60 "$PREDICTION_ENDPOINT"); then
        if echo "$response" | grep -q "error"; then
            log "ERROR" "Failed to generate prediction: $response"
            return 1
        fi
        
        # Extract anxiety score from response
        local anxiety_score=$(echo "$response" | grep -o '"anxietyScore":[0-9]*' | cut -d':' -f2)
        local date=$(echo "$response" | grep -o '"date":"[^"]*"' | cut -d'"' -f4)
        
        log "INFO" "Successfully generated prediction for $date with anxiety score: $anxiety_score"
        
        # Save prediction for static site
        if [ -n "$anxiety_score" ] && [ -n "$date" ]; then
            log "INFO" "Saving prediction for static site..."
            # Create a temporary JSON file to avoid shell escaping issues
            cat > /tmp/prediction_data.json << 'EOF'
{
    "anxietyScore": $anxiety_score,
    "date": "$date",
    "response": ""
}
EOF
            
            # Extract and save the response text properly using Node.js
            node -e "
                const fs = require('fs');
                const data = JSON.parse('$response');
                const predictionData = {
                    anxietyScore: data.anxietyScore,
                    date: data.date,
                    response: data.response || ''
                };
                fs.writeFileSync('/tmp/prediction_data.json', JSON.stringify(predictionData, null, 2));
            " 2>/dev/null
            node -e "
                const fs = require('fs');
                const { savePredictionForStaticSite } = require('./scripts/save-prediction.js');
                const data = JSON.parse(fs.readFileSync('/tmp/prediction_data.json', 'utf8'));
                savePredictionForStaticSite(data);
            " 2>/dev/null || log "WARNING" "Failed to save prediction for static site"
            rm -f /tmp/prediction_data.json
        fi
        
        return 0
    else
        log "ERROR" "Failed to generate prediction from $PREDICTION_ENDPOINT"
        return 1
    fi
}

# Function to check if there are meaningful changes
has_meaningful_changes() {
    # Check if markets.csv has changed
    if ! git diff --quiet "$MARKETS_FILE" 2>/dev/null; then
        log "INFO" "Market data has changed"
        return 0
    fi
    
    # Check if new predictions were generated
    local today=$(date '+%Y-%m-%d')
    local prediction_file="$REPO_DIR/src/predictions/$today.json"
    
    if [ -f "$prediction_file" ]; then
        local file_age=$(($(date +%s) - $(stat -f%m "$prediction_file" 2>/dev/null || stat -c%Y "$prediction_file" 2>/dev/null)))
        if [ "$file_age" -lt 3600 ]; then  # Less than 1 hour old
            log "INFO" "New prediction file generated recently"
            return 0
        fi
    fi
    
    # Check for other changes
    if ! git diff --quiet; then
        log "INFO" "Other changes detected"
        return 0
    fi
    
    log "INFO" "No meaningful changes detected"
    return 1
}

# Function to commit and push changes
commit_and_push() {
    log "INFO" "Committing and pushing changes..."
    
    # Add all changes
    git add .
    
    # Generate commit message
    local commit_msg=""
    local changes=$(git status --porcelain)
    
    if echo "$changes" | grep -q "markets.csv"; then
        commit_msg="📊 Update prediction markets data"
    elif echo "$changes" | grep -q "src/predictions/"; then
        commit_msg="📈 Update generated predictions"
    else
        commit_msg="🔄 General project update"
    fi
    
    # Add timestamp
    commit_msg="$commit_msg - $(date '+%Y-%m-%d %H:%M')"
    
    # Commit
    if git commit -m "$commit_msg"; then
        log "INFO" "Successfully committed: $commit_msg"
    else
        log "ERROR" "Failed to commit changes"
        return 1
    fi
    
    # Push to remote
    if git push origin main; then
        log "INFO" "Successfully pushed to remote repository"
    else
        log "ERROR" "Failed to push to remote repository"
        return 1
    fi
    
    return 0
}

# Function to show summary
show_summary() {
    log "INFO" "=== Auto-Update Summary ==="
    log "INFO" "Repository: $REPO_DIR"
    log "INFO" "Server URL: $SERVER_URL"
    log "INFO" "Markets file: $MARKETS_FILE"
    log "INFO" "Log file: $LOG_FILE"
    
    # Show git status
    log "INFO" "Git status:"
    git status --short | while read line; do
        log "INFO" "  $line"
    done
    
    # Show recent commits
    log "INFO" "Recent commits:"
    git log --oneline -3 | while read line; do
        log "INFO" "  $line"
    done
}

# Function to cleanup old files
cleanup_old_files() {
    log "INFO" "Cleaning up old files..."
    
    # Keep only last 10 backups
    cd "$BACKUP_DIR"
    ls -t | tail -n +11 | xargs -r rm -rf
    cd "$REPO_DIR"
    
    # Clean up old log files (keep last 7 days)
    find "$(dirname "$LOG_FILE")" -name "*.log" -mtime +7 -delete 2>/dev/null || true
    
    log "INFO" "Cleanup completed"
}

# Main execution function
main() {
    local action="${1:-full}"
    
    log "INFO" "Starting MarketLore auto-update with action: $action"
    
    # Change to repository directory
    cd "$REPO_DIR"
    
    case "$action" in
        "full")
            # Full workflow: check server → fetch data → generate prediction → commit → push
            if check_server; then
                if fetch_market_data; then
                    if generate_prediction; then
                        if has_meaningful_changes; then
                            if commit_and_push; then
                                log "INFO" "Full auto-update completed successfully"
                            else
                                log "ERROR" "Failed to commit and push changes"
                                exit 1
                            fi
                        else
                            log "INFO" "No meaningful changes to commit"
                        fi
                    else
                        log "ERROR" "Failed to generate prediction"
                        exit 1
                    fi
                else
                    log "ERROR" "Failed to fetch market data"
                    exit 1
                fi
            else
                log "ERROR" "Server check failed"
                exit 1
            fi
            ;;
        "fetch")
            # Only fetch market data
            if check_server && fetch_market_data; then
                log "INFO" "Market data fetch completed"
            else
                log "ERROR" "Market data fetch failed"
                exit 1
            fi
            ;;
        "predict")
            # Only generate prediction
            if check_server && generate_prediction; then
                log "INFO" "Prediction generation completed"
            else
                log "ERROR" "Prediction generation failed"
                exit 1
            fi
            ;;
        "commit")
            # Only commit and push
            if has_meaningful_changes && commit_and_push; then
                log "INFO" "Commit and push completed"
            else
                log "INFO" "No changes to commit"
            fi
            ;;
        "status")
            # Show status and summary
            show_summary
            ;;
        "cleanup")
            # Only cleanup
            cleanup_old_files
            ;;
        "test")
            # Test mode - don't actually commit
            log "INFO" "Running in test mode..."
            if check_server && fetch_market_data && generate_prediction; then
                log "INFO" "Test completed successfully"
                show_summary
            else
                log "ERROR" "Test failed"
                exit 1
            fi
            ;;
        "help")
            echo "Usage: $0 [action]"
            echo "Actions:"
            echo "  full     - Complete workflow (fetch + predict + commit + push)"
            echo "  fetch    - Fetch market data only"
            echo "  predict  - Generate prediction only"
            echo "  commit   - Commit and push changes only"
            echo "  status   - Show current status and summary"
            echo "  cleanup  - Clean up old files only"
            echo "  test     - Test mode (fetch + predict, no commit)"
            echo "  help     - Show this help"
            ;;
        *)
            log "ERROR" "Unknown action: $action"
            log "ERROR" "Use 'help' action to see available options"
            exit 1
            ;;
    esac
    
    # Always cleanup at the end
    cleanup_old_files
    
    log "INFO" "Auto-update finished"
}

# Run main function with all arguments
main "$@" 