#!/bin/bash

# Setup Cron Jobs for MarketLore
# This script sets up automated cron jobs for data fetching and updates

set -e

# Configuration
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUTO_UPDATE_SCRIPT="$REPO_DIR/scripts/auto-update.sh"
CRON_LOG="$REPO_DIR/logs/cron.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Setting up MarketLore cron jobs...${NC}"

# Create logs directory
mkdir -p "$(dirname "$CRON_LOG")"

# Make scripts executable
chmod +x "$AUTO_UPDATE_SCRIPT"
chmod +x "$REPO_DIR/scripts/git-auto.sh"

# Function to add cron job
add_cron_job() {
    local schedule="$1"
    local command="$2"
    local description="$3"
    
    # Check if job already exists
    if crontab -l 2>/dev/null | grep -q "$command"; then
        echo -e "${YELLOW}⚠️  Cron job already exists: $description${NC}"
        return 0
    fi
    
    # Add the job
    (crontab -l 2>/dev/null; echo "$schedule $command") | crontab -
    echo -e "${GREEN}✅ Added cron job: $description${NC}"
}

# Function to remove cron job
remove_cron_job() {
    local pattern="$1"
    local description="$2"
    
    if crontab -l 2>/dev/null | grep -q "$pattern"; then
        crontab -l 2>/dev/null | grep -v "$pattern" | crontab -
        echo -e "${GREEN}✅ Removed cron job: $description${NC}"
    else
        echo -e "${YELLOW}⚠️  Cron job not found: $description${NC}"
    fi
}

# Function to list current cron jobs
list_cron_jobs() {
    echo -e "${BLUE}Current MarketLore cron jobs:${NC}"
    crontab -l 2>/dev/null | grep "marketlore\|auto-update" || echo "No MarketLore cron jobs found"
}

# Function to show cron job templates
show_templates() {
    echo -e "${BLUE}Available cron job templates:${NC}"
    echo ""
    echo "1. Hourly updates (every hour):"
    echo "   0 * * * * $AUTO_UPDATE_SCRIPT full >> $CRON_LOG 2>&1"
    echo ""
    echo "2. Daily updates (every day at 9 AM):"
    echo "   0 9 * * * $AUTO_UPDATE_SCRIPT full >> $CRON_LOG 2>&1"
    echo ""
    echo "3. Twice daily (9 AM and 6 PM):"
    echo "   0 9,18 * * * $AUTO_UPDATE_SCRIPT full >> $CRON_LOG 2>&1"
    echo ""
    echo "4. Weekdays only (Monday-Friday at 9 AM):"
    echo "   0 9 * * 1-5 $AUTO_UPDATE_SCRIPT full >> $CRON_LOG 2>&1"
    echo ""
    echo "5. Data fetch only (every 4 hours):"
    echo "   0 */4 * * * $AUTO_UPDATE_SCRIPT fetch >> $CRON_LOG 2>&1"
    echo ""
    echo "6. Cleanup (daily at 2 AM):"
    echo "   0 2 * * * $AUTO_UPDATE_SCRIPT cleanup >> $CRON_LOG 2>&1"
}

# Main execution
main() {
    local action="${1:-setup}"
    
    case "$action" in
        "setup")
            echo -e "${BLUE}Setting up default MarketLore cron jobs...${NC}"
            
            # Add daily update at 9 AM
            add_cron_job "0 9 * * *" "$AUTO_UPDATE_SCRIPT full >> $CRON_LOG 2>&1" "Daily update at 9 AM"
            
            # Add cleanup at 2 AM
            add_cron_job "0 2 * * *" "$AUTO_UPDATE_SCRIPT cleanup >> $CRON_LOG 2>&1" "Daily cleanup at 2 AM"
            
            # Add hourly data fetch (but don't commit unless there are changes)
            add_cron_job "0 * * * *" "$AUTO_UPDATE_SCRIPT fetch >> $CRON_LOG 2>&1" "Hourly data fetch"
            
            echo -e "${GREEN}✅ Default cron jobs set up successfully${NC}"
            echo -e "${BLUE}Logs will be written to: $CRON_LOG${NC}"
            ;;
        "hourly")
            echo -e "${BLUE}Setting up hourly updates...${NC}"
            add_cron_job "0 * * * *" "$AUTO_UPDATE_SCRIPT full >> $CRON_LOG 2>&1" "Hourly full update"
            ;;
        "daily")
            echo -e "${BLUE}Setting up daily updates...${NC}"
            add_cron_job "0 9 * * *" "$AUTO_UPDATE_SCRIPT full >> $CRON_LOG 2>&1" "Daily update at 9 AM"
            ;;
        "twice-daily")
            echo -e "${BLUE}Setting up twice daily updates...${NC}"
            add_cron_job "0 9,18 * * *" "$AUTO_UPDATE_SCRIPT full >> $CRON_LOG 2>&1" "Twice daily updates (9 AM, 6 PM)"
            ;;
        "weekdays")
            echo -e "${BLUE}Setting up weekday updates...${NC}"
            add_cron_job "0 9 * * 1-5" "$AUTO_UPDATE_SCRIPT full >> $CRON_LOG 2>&1" "Weekday updates at 9 AM"
            ;;
        "fetch-only")
            echo -e "${BLUE}Setting up data fetch only (every 4 hours)...${NC}"
            add_cron_job "0 */4 * * *" "$AUTO_UPDATE_SCRIPT fetch >> $CRON_LOG 2>&1" "Data fetch every 4 hours"
            ;;
        "cleanup")
            echo -e "${BLUE}Setting up daily cleanup...${NC}"
            add_cron_job "0 2 * * *" "$AUTO_UPDATE_SCRIPT cleanup >> $CRON_LOG 2>&1" "Daily cleanup at 2 AM"
            ;;
        "remove")
            echo -e "${BLUE}Removing all MarketLore cron jobs...${NC}"
            remove_cron_job "auto-update" "All auto-update jobs"
            remove_cron_job "marketlore" "All marketlore jobs"
            echo -e "${GREEN}✅ All MarketLore cron jobs removed${NC}"
            ;;
        "list")
            list_cron_jobs
            ;;
        "templates")
            show_templates
            ;;
        "test")
            echo -e "${BLUE}Testing auto-update script...${NC}"
            if "$AUTO_UPDATE_SCRIPT" test; then
                echo -e "${GREEN}✅ Test completed successfully${NC}"
            else
                echo -e "${RED}❌ Test failed${NC}"
                exit 1
            fi
            ;;
        "help")
            echo "Usage: $0 [action]"
            echo ""
            echo "Actions:"
            echo "  setup        - Set up default cron jobs (daily + cleanup + hourly fetch)"
            echo "  hourly       - Set up hourly full updates"
            echo "  daily        - Set up daily updates at 9 AM"
            echo "  twice-daily  - Set up twice daily updates (9 AM, 6 PM)"
            echo "  weekdays     - Set up weekday updates only"
            echo "  fetch-only   - Set up data fetch only (every 4 hours)"
            echo "  cleanup      - Set up daily cleanup at 2 AM"
            echo "  remove       - Remove all MarketLore cron jobs"
            echo "  list         - List current MarketLore cron jobs"
            echo "  templates    - Show available cron job templates"
            echo "  test         - Test the auto-update script"
            echo "  help         - Show this help"
            echo ""
            echo "Examples:"
            echo "  $0 setup          # Set up default jobs"
            echo "  $0 hourly         # Set up hourly updates"
            echo "  $0 list           # Show current jobs"
            echo "  $0 remove         # Remove all jobs"
            ;;
        *)
            echo -e "${RED}❌ Unknown action: $action${NC}"
            echo "Use '$0 help' to see available options"
            exit 1
            ;;
    esac
}

# Run main function
main "$@" 