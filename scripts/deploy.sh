#!/bin/bash

# Advanced Deployment Script for N8N MCP Platform
# Supports multiple environments, blue-green deployment, and automatic rollback

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Default values
ENVIRONMENT="${1:-staging}"
DEPLOY_TYPE="${2:-rolling}"
IMAGE_TAG="${3:-latest}"
FORCE_DEPLOY="${FORCE_DEPLOY:-false}"
DRY_RUN="${DRY_RUN:-false}"
SKIP_TESTS="${SKIP_TESTS:-false}"
BACKUP_BEFORE_DEPLOY="${BACKUP_BEFORE_DEPLOY:-true}"

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
Usage: $0 [ENVIRONMENT] [DEPLOY_TYPE] [IMAGE_TAG]

Arguments:
    ENVIRONMENT    Target environment (staging|production) [default: staging]
    DEPLOY_TYPE    Deployment type (rolling|blue-green|canary) [default: rolling]
    IMAGE_TAG      Docker image tag to deploy [default: latest]

Environment Variables:
    FORCE_DEPLOY=true           Skip safety checks and confirmations
    DRY_RUN=true               Show what would be deployed without executing
    SKIP_TESTS=true            Skip post-deployment tests
    BACKUP_BEFORE_DEPLOY=false Skip database backup before deployment

Examples:
    $0 staging rolling v1.2.3
    $0 production blue-green latest
    FORCE_DEPLOY=true $0 production rolling v1.2.3
    DRY_RUN=true $0 staging rolling latest

Deployment Types:
    rolling     - Rolling update with zero downtime
    blue-green  - Blue-green deployment with traffic switching
    canary      - Canary deployment with gradual traffic shift
EOF
    exit 1
}

# Validate inputs
validate_inputs() {
    log_step "Validating deployment inputs"
    
    case "$ENVIRONMENT" in
        staging|production)
            log_info "Environment: $ENVIRONMENT"
            ;;
        *)
            log_error "Invalid environment: $ENVIRONMENT. Must be 'staging' or 'production'"
            usage
            ;;
    esac
    
    case "$DEPLOY_TYPE" in
        rolling|blue-green|canary)
            log_info "Deployment type: $DEPLOY_TYPE"
            ;;
        *)
            log_error "Invalid deployment type: $DEPLOY_TYPE. Must be 'rolling', 'blue-green', or 'canary'"
            usage
            ;;
    esac
    
    if [[ -z "$IMAGE_TAG" ]]; then
        log_error "Image tag cannot be empty"
        exit 1
    fi
    
    log_info "Image tag: $IMAGE_TAG"
    log_success "Input validation completed"
}

# Check prerequisites
check_prerequisites() {
    log_step "Checking deployment prerequisites"
    
    # Check required tools
    local tools=("kubectl" "helm" "docker" "jq" "curl")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            log_error "$tool is not installed or not in PATH"
            exit 1
        fi
        log_info "✓ $tool is available"
    done
    
    # Check Kubernetes connection
    if ! kubectl cluster-info >/dev/null 2>&1; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    log_info "✓ Kubernetes cluster is accessible"
    
    # Check Helm repositories
    if ! helm repo list | grep -q "n8n-mcp"; then
        log_warning "n8n-mcp Helm repository not found, adding..."
        helm repo add n8n-mcp https://charts.n8n-mcp.com
        helm repo update
    fi
    log_info "✓ Helm repositories are configured"
    
    # Verify namespace exists
    if ! kubectl get namespace n8n-mcp >/dev/null 2>&1; then
        log_warning "Namespace 'n8n-mcp' does not exist, creating..."
        kubectl apply -f "${PROJECT_ROOT}/kubernetes/namespace.yaml"
    fi
    log_info "✓ Namespace 'n8n-mcp' exists"
    
    log_success "Prerequisites check completed"
}

# Get current deployment info
get_current_deployment() {
    log_step "Getting current deployment information"
    
    if helm list -n n8n-mcp | grep -q "n8n-mcp"; then
        CURRENT_REVISION=$(helm list -n n8n-mcp -o json | jq -r '.[] | select(.name=="n8n-mcp") | .revision')
        CURRENT_IMAGE=$(helm get values n8n-mcp -n n8n-mcp -o json | jq -r '.image.tag // "unknown"')
        
        log_info "Current revision: $CURRENT_REVISION"
        log_info "Current image: $CURRENT_IMAGE"
        
        # Store rollback information
        echo "REVISION=$CURRENT_REVISION" > "${PROJECT_ROOT}/.rollback_info"
        echo "IMAGE=$CURRENT_IMAGE" >> "${PROJECT_ROOT}/.rollback_info"
    else
        log_info "No existing deployment found"
        CURRENT_REVISION="0"
        CURRENT_IMAGE="none"
    fi
}

# Create backup
create_backup() {
    if [[ "$BACKUP_BEFORE_DEPLOY" != "true" ]]; then
        log_info "Skipping backup as requested"
        return 0
    fi
    
    log_step "Creating pre-deployment backup"
    
    local backup_dir="${PROJECT_ROOT}/backups"
    local backup_file="${backup_dir}/pre_deploy_${ENVIRONMENT}_${TIMESTAMP}.sql"
    
    mkdir -p "$backup_dir"
    
    # Create database backup
    log_info "Creating database backup..."
    if kubectl get pod -n n8n-mcp -l component=postgres >/dev/null 2>&1; then
        kubectl exec -n n8n-mcp deployment/postgres -- \
            pg_dump -U postgres n8n_mcp > "$backup_file"
        
        # Compress backup
        gzip "$backup_file"
        log_success "Backup created: ${backup_file}.gz"
        
        # Store backup location for rollback
        echo "BACKUP_FILE=${backup_file}.gz" >> "${PROJECT_ROOT}/.rollback_info"
    else
        log_warning "PostgreSQL pod not found, skipping database backup"
    fi
}

# Validate image exists
validate_image() {
    log_step "Validating Docker image"
    
    local image_name="ghcr.io/your-org/n8n-mcp:${IMAGE_TAG}"
    
    if docker manifest inspect "$image_name" >/dev/null 2>&1; then
        log_success "Image $image_name exists and is accessible"
    else
        log_error "Image $image_name not found or not accessible"
        exit 1
    fi
}

# Rolling deployment
deploy_rolling() {
    log_step "Executing rolling deployment"
    
    local values_file="${PROJECT_ROOT}/helm/n8n-mcp/values.${ENVIRONMENT}.yaml"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would execute rolling deployment"
        helm template n8n-mcp "${PROJECT_ROOT}/helm/n8n-mcp" \
            --namespace n8n-mcp \
            --values "$values_file" \
            --set image.tag="$IMAGE_TAG" \
            --set deployment.strategy="RollingUpdate"
        return 0
    fi
    
    helm upgrade --install n8n-mcp "${PROJECT_ROOT}/helm/n8n-mcp" \
        --namespace n8n-mcp \
        --create-namespace \
        --values "$values_file" \
        --set image.tag="$IMAGE_TAG" \
        --set deployment.strategy="RollingUpdate" \
        --set deployment.rollingUpdate.maxSurge=1 \
        --set deployment.rollingUpdate.maxUnavailable=0 \
        --wait \
        --timeout=600s
    
    log_success "Rolling deployment completed"
}

# Blue-green deployment
deploy_blue_green() {
    log_step "Executing blue-green deployment"
    
    local green_release="n8n-mcp-green"
    local values_file="${PROJECT_ROOT}/helm/n8n-mcp/values.${ENVIRONMENT}.yaml"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would execute blue-green deployment"
        return 0
    fi
    
    # Deploy green version
    log_info "Deploying green version..."
    helm upgrade --install "$green_release" "${PROJECT_ROOT}/helm/n8n-mcp" \
        --namespace n8n-mcp \
        --values "$values_file" \
        --set image.tag="$IMAGE_TAG" \
        --set nameOverride="n8n-mcp-green" \
        --set service.port=3002 \
        --wait \
        --timeout=600s
    
    # Test green version
    log_info "Testing green version..."
    if test_deployment "green"; then
        log_info "Green version tests passed, switching traffic..."
        
        # Switch service to green
        kubectl patch service n8n-mcp-api-service -n n8n-mcp \
            -p '{"spec":{"selector":{"app":"n8n-mcp-green"}}}'
        
        # Wait for traffic switch
        sleep 30
        
        # Test production traffic
        if test_deployment "production"; then
            log_success "Traffic switched to green version successfully"
            
            # Remove blue version
            helm uninstall n8n-mcp -n n8n-mcp || true
            
            # Rename green to main
            helm upgrade n8n-mcp "${PROJECT_ROOT}/helm/n8n-mcp" \
                --namespace n8n-mcp \
                --values "$values_file" \
                --set image.tag="$IMAGE_TAG" \
                --reuse-values
        else
            log_error "Production traffic test failed, rolling back..."
            rollback_blue_green
            exit 1
        fi
    else
        log_error "Green version tests failed, cleaning up..."
        helm uninstall "$green_release" -n n8n-mcp
        exit 1
    fi
}

# Canary deployment
deploy_canary() {
    log_step "Executing canary deployment"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN: Would execute canary deployment"
        return 0
    fi
    
    # Deploy canary version with 10% traffic
    log_info "Deploying canary with 10% traffic..."
    kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: n8n-mcp-canary
  namespace: n8n-mcp
spec:
  replicas: 3
  strategy:
    canary:
      steps:
      - setWeight: 10
      - pause: {duration: 10m}
      - setWeight: 30
      - pause: {duration: 10m}
      - setWeight: 50
      - pause: {duration: 10m}
      - setWeight: 100
  selector:
    matchLabels:
      app: n8n-mcp
  template:
    metadata:
      labels:
        app: n8n-mcp
    spec:
      containers:
      - name: api
        image: ghcr.io/your-org/n8n-mcp:${IMAGE_TAG}
        ports:
        - containerPort: 3001
EOF
    
    log_success "Canary deployment initiated"
}

# Test deployment
test_deployment() {
    local target="${1:-production}"
    log_step "Testing $target deployment"
    
    local endpoint
    case "$target" in
        "green")
            endpoint="http://n8n-mcp-green-service.n8n-mcp.svc.cluster.local:3002"
            ;;
        "production")
            endpoint="https://api.n8n-mcp.com"
            ;;
        *)
            endpoint="http://n8n-mcp-api-service.n8n-mcp.svc.cluster.local:3001"
            ;;
    esac
    
    # Health check
    log_info "Running health check..."
    if ! curl -f -s --max-time 30 "$endpoint/health" >/dev/null; then
        log_error "Health check failed for $target"
        return 1
    fi
    
    # API functionality test
    log_info "Testing API functionality..."
    if ! curl -f -s --max-time 30 "$endpoint/api/v1/health" >/dev/null; then
        log_error "API functionality test failed for $target"
        return 1
    fi
    
    # Database connectivity test
    log_info "Testing database connectivity..."
    if kubectl exec -n n8n-mcp deployment/postgres -- \
        psql -U postgres -d n8n_mcp -c "SELECT 1;" >/dev/null 2>&1; then
        log_info "✓ Database connectivity test passed"
    else
        log_error "Database connectivity test failed"
        return 1
    fi
    
    # Redis connectivity test
    log_info "Testing Redis connectivity..."
    if kubectl exec -n n8n-mcp deployment/redis -- \
        redis-cli ping >/dev/null 2>&1; then
        log_info "✓ Redis connectivity test passed"
    else
        log_error "Redis connectivity test failed"
        return 1
    fi
    
    log_success "$target deployment tests passed"
    return 0
}

# Rollback deployment
rollback_deployment() {
    log_step "Rolling back deployment"
    
    if [[ ! -f "${PROJECT_ROOT}/.rollback_info" ]]; then
        log_error "No rollback information found"
        exit 1
    fi
    
    source "${PROJECT_ROOT}/.rollback_info"
    
    if [[ "$CURRENT_REVISION" == "0" ]]; then
        log_error "Cannot rollback: no previous deployment found"
        exit 1
    fi
    
    log_info "Rolling back to revision $CURRENT_REVISION (image: $CURRENT_IMAGE)"
    
    helm rollback n8n-mcp "$CURRENT_REVISION" -n n8n-mcp --wait --timeout=300s
    
    # Test rollback
    if test_deployment; then
        log_success "Rollback completed successfully"
    else
        log_error "Rollback validation failed"
        exit 1
    fi
}

# Post-deployment tasks
post_deployment() {
    log_step "Executing post-deployment tasks"
    
    # Update deployment annotations
    kubectl annotate deployment n8n-mcp-api -n n8n-mcp \
        deployment.kubernetes.io/change-cause="Deployed $IMAGE_TAG at $(date)" \
        --overwrite
    
    # Clean up old images (keep last 5)
    log_info "Cleaning up old container images..."
    # This would integrate with your container registry API
    
    # Notify monitoring systems
    log_info "Notifying monitoring systems..."
    curl -X POST -H "Content-Type: application/json" \
        -d "{\"text\":\"Deployment completed: $ENVIRONMENT -> $IMAGE_TAG\"}" \
        "${SLACK_WEBHOOK_URL:-}" >/dev/null 2>&1 || true
    
    log_success "Post-deployment tasks completed"
}

# Main deployment workflow
main() {
    log_step "Starting N8N MCP deployment"
    log_info "Environment: $ENVIRONMENT"
    log_info "Deploy Type: $DEPLOY_TYPE"
    log_info "Image Tag: $IMAGE_TAG"
    log_info "Timestamp: $TIMESTAMP"
    
    # Pre-deployment checks
    validate_inputs
    check_prerequisites
    get_current_deployment
    validate_image
    
    # Confirmation (unless forced)
    if [[ "$FORCE_DEPLOY" != "true" && "$DRY_RUN" != "true" ]]; then
        echo
        log_warning "You are about to deploy to $ENVIRONMENT environment"
        log_warning "Current: $CURRENT_IMAGE -> New: $IMAGE_TAG"
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Deployment cancelled by user"
            exit 0
        fi
    fi
    
    # Create backup
    create_backup
    
    # Execute deployment
    case "$DEPLOY_TYPE" in
        "rolling")
            deploy_rolling
            ;;
        "blue-green")
            deploy_blue_green
            ;;
        "canary")
            deploy_canary
            ;;
    esac
    
    # Skip tests if requested or dry run
    if [[ "$SKIP_TESTS" != "true" && "$DRY_RUN" != "true" ]]; then
        if ! test_deployment; then
            log_error "Deployment validation failed, initiating rollback..."
            rollback_deployment
            exit 1
        fi
    fi
    
    # Post-deployment tasks
    if [[ "$DRY_RUN" != "true" ]]; then
        post_deployment
    fi
    
    log_success "Deployment completed successfully!"
    log_info "Environment: $ENVIRONMENT"
    log_info "Image Tag: $IMAGE_TAG"
    log_info "Deployment Type: $DEPLOY_TYPE"
    
    # Cleanup
    rm -f "${PROJECT_ROOT}/.rollback_info"
}

# Handle script arguments
case "${1:-help}" in
    "help"|"--help"|"-h")
        usage
        ;;
    "rollback")
        rollback_deployment
        ;;
    *)
        main "$@"
        ;;
esac