#!/bin/bash

# Rollback Script for N8N MCP Platform
# Supports intelligent rollback with health checks and data restoration

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Default values
ENVIRONMENT="${1:-production}"
ROLLBACK_TYPE="${2:-auto}"
TARGET_REVISION="${3:-}"
FORCE_ROLLBACK="${FORCE_ROLLBACK:-false}"
DRY_RUN="${DRY_RUN:-false}"
RESTORE_DATA="${RESTORE_DATA:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Usage function
usage() {
    cat << EOF
Usage: $0 [ENVIRONMENT] [ROLLBACK_TYPE] [TARGET_REVISION]

Arguments:
    ENVIRONMENT      Target environment (staging|production) [default: production]
    ROLLBACK_TYPE    Rollback type (auto|manual|emergency) [default: auto]
    TARGET_REVISION  Specific revision to rollback to (optional)

Environment Variables:
    FORCE_ROLLBACK=true    Skip safety checks and confirmations
    DRY_RUN=true          Show what would be rolled back without executing
    RESTORE_DATA=true     Restore database from backup during rollback

Rollback Types:
    auto      - Automatic rollback to previous stable version
    manual    - Manual rollback to specified revision
    emergency - Emergency rollback with minimal checks

Examples:
    $0 production auto
    $0 staging manual 5
    FORCE_ROLLBACK=true $0 production emergency
    RESTORE_DATA=true $0 production auto

Commands:
    $0 list [ENVIRONMENT]     - List available rollback targets
    $0 status [ENVIRONMENT]   - Show current deployment status
    $0 validate [ENVIRONMENT] - Validate rollback prerequisites
EOF
    exit 1
}

# Check prerequisites
check_prerequisites() {
    log_step "Checking rollback prerequisites"
    
    # Check required tools
    local tools=("kubectl" "helm" "jq" "curl")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            log_error "$tool is not installed or not in PATH"
            exit 1
        fi
    done
    
    # Check Kubernetes connection
    if ! kubectl cluster-info >/dev/null 2>&1; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Check namespace exists
    if ! kubectl get namespace n8n-mcp >/dev/null 2>&1; then
        log_error "Namespace 'n8n-mcp' does not exist"
        exit 1
    fi
    
    # Check deployment exists
    if ! helm list -n n8n-mcp | grep -q "n8n-mcp"; then
        log_error "No n8n-mcp deployment found"
        exit 1
    fi
    
    log_success "Prerequisites check completed"
}

# Get current deployment status
get_deployment_status() {
    log_step "Getting current deployment status"
    
    # Helm deployment info
    CURRENT_REVISION=$(helm list -n n8n-mcp -o json | jq -r '.[] | select(.name=="n8n-mcp") | .revision')
    CURRENT_CHART=$(helm list -n n8n-mcp -o json | jq -r '.[] | select(.name=="n8n-mcp") | .chart')
    CURRENT_STATUS=$(helm list -n n8n-mcp -o json | jq -r '.[] | select(.name=="n8n-mcp") | .status')
    CURRENT_IMAGE=$(helm get values n8n-mcp -n n8n-mcp -o json | jq -r '.image.tag // "unknown"' 2>/dev/null || echo "unknown")
    
    # Kubernetes deployment info
    DEPLOYMENT_READY=$(kubectl get deployment n8n-mcp-api -n n8n-mcp -o jsonpath='{.status.readyReplicas}/{.status.replicas}' 2>/dev/null || echo "0/0")
    DEPLOYMENT_AVAILABLE=$(kubectl get deployment n8n-mcp-api -n n8n-mcp -o jsonpath='{.status.conditions[?(@.type=="Available")].status}' 2>/dev/null || echo "False")
    
    log_info "Current revision: $CURRENT_REVISION"
    log_info "Current chart: $CURRENT_CHART"
    log_info "Current status: $CURRENT_STATUS"
    log_info "Current image: $CURRENT_IMAGE"
    log_info "Pods ready: $DEPLOYMENT_READY"
    log_info "Deployment available: $DEPLOYMENT_AVAILABLE"
    
    # Check if deployment is healthy
    if [[ "$CURRENT_STATUS" != "deployed" ]] || [[ "$DEPLOYMENT_AVAILABLE" != "True" ]]; then
        log_warning "Current deployment appears to be unhealthy"
        DEPLOYMENT_HEALTHY="false"
    else
        log_success "Current deployment appears healthy"
        DEPLOYMENT_HEALTHY="true"
    fi
}

# List rollback targets
list_rollback_targets() {
    log_step "Listing available rollback targets"
    
    echo
    echo "Available Helm revisions:"
    helm history n8n-mcp -n n8n-mcp --max 10
    
    echo
    echo "Recent deployment annotations:"
    kubectl get deployment n8n-mcp-api -n n8n-mcp -o jsonpath='{.metadata.annotations.deployment\.kubernetes\.io/change-cause}' 2>/dev/null || echo "No annotations found"
    
    echo
    echo "Available backups:"
    if [[ -d "${PROJECT_ROOT}/backups" ]]; then
        ls -la "${PROJECT_ROOT}/backups/"*.sql.gz 2>/dev/null || echo "No backups found"
    else
        echo "No backup directory found"
    fi
}

# Determine rollback target
determine_rollback_target() {
    log_step "Determining rollback target"
    
    case "$ROLLBACK_TYPE" in
        "auto")
            # Find last successful deployment
            ROLLBACK_REVISION=$(helm history n8n-mcp -n n8n-mcp -o json | \
                jq -r '.[] | select(.status=="superseded" or .status=="deployed") | .revision' | \
                sort -nr | head -n 2 | tail -n 1)
            
            if [[ -z "$ROLLBACK_REVISION" || "$ROLLBACK_REVISION" == "null" ]]; then
                log_error "No previous revision found for automatic rollback"
                exit 1
            fi
            
            log_info "Auto-selected rollback target: revision $ROLLBACK_REVISION"
            ;;
            
        "manual")
            if [[ -z "$TARGET_REVISION" ]]; then
                log_error "Manual rollback requires target revision"
                list_rollback_targets
                exit 1
            fi
            
            # Validate target revision exists
            if ! helm history n8n-mcp -n n8n-mcp | grep -q "^$TARGET_REVISION"; then
                log_error "Target revision $TARGET_REVISION not found"
                list_rollback_targets
                exit 1
            fi
            
            ROLLBACK_REVISION="$TARGET_REVISION"
            log_info "Manual rollback target: revision $ROLLBACK_REVISION"
            ;;
            
        "emergency")
            # Emergency rollback to last known good state
            ROLLBACK_REVISION=$(helm history n8n-mcp -n n8n-mcp -o json | \
                jq -r '.[] | select(.status=="superseded") | .revision' | \
                sort -nr | head -n 1)
            
            if [[ -z "$ROLLBACK_REVISION" || "$ROLLBACK_REVISION" == "null" ]]; then
                log_error "No superseded revision found for emergency rollback"
                exit 1
            fi
            
            log_warning "Emergency rollback target: revision $ROLLBACK_REVISION"
            ;;
            
        *)
            log_error "Invalid rollback type: $ROLLBACK_TYPE"
            usage
            ;;
    esac
    
    # Get target deployment details
    TARGET_CHART=$(helm history n8n-mcp -n n8n-mcp -o json | \
        jq -r ".[] | select(.revision==$ROLLBACK_REVISION) | .chart")
    TARGET_STATUS=$(helm history n8n-mcp -n n8n-mcp -o json | \
        jq -r ".[] | select(.revision==$ROLLBACK_REVISION) | .status")
    
    log_info "Target chart: $TARGET_CHART"
    log_info "Target status: $TARGET_STATUS"
}

# Pre-rollback checks
pre_rollback_checks() {
    log_step "Performing pre-rollback checks"
    
    # Check if current deployment is really failing
    if [[ "$ROLLBACK_TYPE" == "auto" && "$DEPLOYMENT_HEALTHY" == "true" ]]; then
        if [[ "$FORCE_ROLLBACK" != "true" ]]; then
            log_warning "Current deployment appears healthy"
            read -p "Continue with rollback anyway? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_info "Rollback cancelled by user"
                exit 0
            fi
        fi
    fi
    
    # Check cluster resources
    log_info "Checking cluster resources..."
    kubectl top nodes >/dev/null 2>&1 || log_warning "Unable to get node metrics"
    
    # Check for ongoing operations
    if kubectl get events -n n8n-mcp --field-selector type=Warning | grep -q "FailedScheduling\|Unhealthy"; then
        log_warning "Warning events detected in namespace"
    fi
    
    # Check dependencies
    log_info "Checking dependencies..."
    if ! kubectl get pod -n n8n-mcp -l component=postgres | grep -q "Running"; then
        log_error "PostgreSQL is not running"
        exit 1
    fi
    
    if ! kubectl get pod -n n8n-mcp -l component=redis | grep -q "Running"; then
        log_error "Redis is not running"
        exit 1
    fi
    
    log_success "Pre-rollback checks completed"
}

# Create rollback backup
create_rollback_backup() {
    log_step "Creating rollback backup"
    
    local backup_dir="${PROJECT_ROOT}/backups"
    local backup_file="${backup_dir}/rollback_${ENVIRONMENT}_${TIMESTAMP}.sql"
    
    mkdir -p "$backup_dir"
    
    # Create current state backup
    log_info "Backing up current database state..."
    kubectl exec -n n8n-mcp deployment/postgres -- \
        pg_dump -U postgres n8n_mcp > "$backup_file"
    
    # Compress backup
    gzip "$backup_file"
    log_success "Rollback backup created: ${backup_file}.gz"
    
    # Store backup info
    echo "ROLLBACK_BACKUP=${backup_file}.gz" > "${PROJECT_ROOT}/.rollback_backup_info"
}

# Execute rollback
execute_rollback() {
    log_step "Executing rollback"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would rollback to revision $ROLLBACK_REVISION"
        helm get values n8n-mcp -n n8n-mcp --revision "$ROLLBACK_REVISION"
        return 0
    fi
    
    log_info "Rolling back from revision $CURRENT_REVISION to $ROLLBACK_REVISION"
    
    # Set rollback timeout based on type
    local timeout="300s"
    if [[ "$ROLLBACK_TYPE" == "emergency" ]]; then
        timeout="180s"
    fi
    
    # Execute Helm rollback
    helm rollback n8n-mcp "$ROLLBACK_REVISION" -n n8n-mcp \
        --wait \
        --timeout="$timeout" \
        --debug
    
    log_success "Helm rollback completed"
    
    # Wait for deployment to stabilize
    log_info "Waiting for deployment to stabilize..."
    kubectl rollout status deployment/n8n-mcp-api -n n8n-mcp --timeout=300s
    
    # Update deployment annotation
    kubectl annotate deployment n8n-mcp-api -n n8n-mcp \
        deployment.kubernetes.io/change-cause="Rolled back from $CURRENT_REVISION to $ROLLBACK_REVISION at $(date)" \
        --overwrite
}

# Restore data from backup
restore_data_from_backup() {
    if [[ "$RESTORE_DATA" != "true" ]]; then
        log_info "Skipping data restoration"
        return 0
    fi
    
    log_step "Restoring data from backup"
    
    # Find appropriate backup
    local backup_file
    if [[ -n "${BACKUP_FILE:-}" ]]; then
        backup_file="$BACKUP_FILE"
    else
        # Find latest backup before rollback target
        backup_file=$(ls -t "${PROJECT_ROOT}/backups/"*.sql.gz 2>/dev/null | head -n 1)
    fi
    
    if [[ -z "$backup_file" || ! -f "$backup_file" ]]; then
        log_error "No backup file found for data restoration"
        return 1
    fi
    
    log_info "Restoring data from: $backup_file"
    
    # Stop application pods
    kubectl scale deployment n8n-mcp-api -n n8n-mcp --replicas=0
    kubectl wait --for=delete pod -l app=n8n-mcp,component=api -n n8n-mcp --timeout=120s
    
    # Restore database
    zcat "$backup_file" | kubectl exec -i -n n8n-mcp deployment/postgres -- \
        psql -U postgres -d n8n_mcp
    
    # Restart application pods
    kubectl scale deployment n8n-mcp-api -n n8n-mcp --replicas=3
    kubectl rollout status deployment/n8n-mcp-api -n n8n-mcp --timeout=300s
    
    log_success "Data restoration completed"
}

# Post-rollback validation
post_rollback_validation() {
    log_step "Performing post-rollback validation"
    
    # Health check
    log_info "Running health checks..."
    local max_attempts=10
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if kubectl exec -n n8n-mcp deployment/n8n-mcp-api -- \
            curl -f -s http://localhost:3001/health >/dev/null 2>&1; then
            log_success "Health check passed"
            break
        fi
        
        ((attempt++))
        log_info "Health check attempt $attempt/$max_attempts failed, retrying..."
        sleep 10
    done
    
    if [[ $attempt -eq $max_attempts ]]; then
        log_error "Health check failed after $max_attempts attempts"
        return 1
    fi
    
    # Database connectivity test
    log_info "Testing database connectivity..."
    if kubectl exec -n n8n-mcp deployment/postgres -- \
        psql -U postgres -d n8n_mcp -c "SELECT 1;" >/dev/null 2>&1; then
        log_success "Database connectivity test passed"
    else
        log_error "Database connectivity test failed"
        return 1
    fi
    
    # API functionality test
    log_info "Testing API functionality..."
    if kubectl exec -n n8n-mcp deployment/n8n-mcp-api -- \
        curl -f -s http://localhost:3001/api/v1/health >/dev/null 2>&1; then
        log_success "API functionality test passed"
    else
        log_error "API functionality test failed"
        return 1
    fi
    
    # Check pod status
    log_info "Checking pod status..."
    kubectl get pods -n n8n-mcp -l app=n8n-mcp
    
    local unhealthy_pods=$(kubectl get pods -n n8n-mcp -l app=n8n-mcp \
        --field-selector=status.phase!=Running --no-headers | wc -l)
    
    if [[ $unhealthy_pods -gt 0 ]]; then
        log_warning "$unhealthy_pods pods are not in Running state"
    else
        log_success "All pods are running"
    fi
    
    log_success "Post-rollback validation completed"
}

# Notification
send_notification() {
    local status="$1"
    local message="$2"
    
    log_step "Sending rollback notification"
    
    # Slack notification
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local emoji="✅"
        local color="good"
        
        if [[ "$status" == "failed" ]]; then
            emoji="❌"
            color="danger"
        fi
        
        curl -X POST -H "Content-Type: application/json" \
            -d "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"$emoji Rollback $status - $ENVIRONMENT\",
                    \"text\": \"$message\",
                    \"fields\": [
                        {\"title\": \"Environment\", \"value\": \"$ENVIRONMENT\", \"short\": true},
                        {\"title\": \"From Revision\", \"value\": \"$CURRENT_REVISION\", \"short\": true},
                        {\"title\": \"To Revision\", \"value\": \"$ROLLBACK_REVISION\", \"short\": true},
                        {\"title\": \"Type\", \"value\": \"$ROLLBACK_TYPE\", \"short\": true}
                    ],
                    \"footer\": \"N8N MCP Rollback\",
                    \"ts\": $(date +%s)
                }]
            }" \
            "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || true
    fi
    
    log_info "Notification sent"
}

# Main rollback workflow
main() {
    log_step "Starting N8N MCP rollback"
    log_info "Environment: $ENVIRONMENT"
    log_info "Rollback Type: $ROLLBACK_TYPE"
    log_info "Timestamp: $TIMESTAMP"
    
    # Pre-rollback phase
    check_prerequisites
    get_deployment_status
    determine_rollback_target
    pre_rollback_checks
    
    # Confirmation (unless forced)
    if [[ "$FORCE_ROLLBACK" != "true" && "$DRY_RUN" != "true" ]]; then
        echo
        log_warning "You are about to rollback $ENVIRONMENT deployment"
        log_warning "From: revision $CURRENT_REVISION -> To: revision $ROLLBACK_REVISION"
        log_warning "Rollback type: $ROLLBACK_TYPE"
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Rollback cancelled by user"
            exit 0
        fi
    fi
    
    # Create backup before rollback
    if [[ "$DRY_RUN" != "true" ]]; then
        create_rollback_backup
    fi
    
    # Execute rollback
    execute_rollback
    
    # Restore data if requested
    if [[ "$DRY_RUN" != "true" ]]; then
        restore_data_from_backup
    fi
    
    # Validation
    if [[ "$DRY_RUN" != "true" ]]; then
        if post_rollback_validation; then
            log_success "Rollback completed successfully!"
            send_notification "completed" "Rollback from revision $CURRENT_REVISION to $ROLLBACK_REVISION completed successfully"
        else
            log_error "Rollback validation failed!"
            send_notification "failed" "Rollback from revision $CURRENT_REVISION to $ROLLBACK_REVISION validation failed"
            exit 1
        fi
    else
        log_success "Dry run completed!"
    fi
    
    # Final status
    log_info "Environment: $ENVIRONMENT"
    log_info "Rollback Type: $ROLLBACK_TYPE"
    log_info "From Revision: $CURRENT_REVISION"
    log_info "To Revision: $ROLLBACK_REVISION"
    
    # Cleanup
    rm -f "${PROJECT_ROOT}/.rollback_backup_info"
}

# Handle script commands
case "${1:-help}" in
    "help"|"--help"|"-h")
        usage
        ;;
    "list")
        ENVIRONMENT="${2:-production}"
        check_prerequisites
        list_rollback_targets
        ;;
    "status")
        ENVIRONMENT="${2:-production}"
        check_prerequisites
        get_deployment_status
        ;;
    "validate")
        ENVIRONMENT="${2:-production}"
        check_prerequisites
        pre_rollback_checks
        log_success "Rollback prerequisites validation passed"
        ;;
    *)
        main "$@"
        ;;
esac