#!/bin/bash

# Deployment script for N8N MCP Platform
# Handles production deployment with monitoring and rollback capabilities

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_DIR="${PROJECT_ROOT}/infrastructure/docker"
ENV_FILE="${PROJECT_ROOT}/.env.production"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Usage function
usage() {
    cat << EOF
Usage: $0 [COMMAND] [OPTIONS]

Commands:
    deploy      Deploy the application stack
    monitoring  Deploy monitoring stack only
    stop        Stop all services
    restart     Restart all services
    rollback    Rollback to previous version
    status      Show service status
    logs        Show service logs
    backup      Create database backup
    help        Show this help message

Options:
    --env FILE      Environment file (default: .env.production)
    --no-backup     Skip backup before deployment
    --force         Force deployment without confirmation
    --pull          Pull latest images before deployment

Examples:
    $0 deploy --pull
    $0 monitoring
    $0 logs api
    $0 backup
EOF
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if docker-compose is available
    if ! command -v docker-compose >/dev/null 2>&1; then
        log_error "docker-compose is not installed"
        exit 1
    fi
    
    # Check if environment file exists
    if [[ ! -f "${ENV_FILE}" ]]; then
        log_error "Environment file not found: ${ENV_FILE}"
        log_info "Please create the environment file with required variables"
        exit 1
    fi
    
    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Create backup
create_backup() {
    if [[ "${SKIP_BACKUP}" == "true" ]]; then
        log_warning "Skipping backup as requested"
        return 0
    fi
    
    log_info "Creating database backup..."
    
    local backup_dir="${PROJECT_ROOT}/backups"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${backup_dir}/n8n_mcp_${timestamp}.sql"
    
    mkdir -p "${backup_dir}"
    
    # Source environment variables
    source "${ENV_FILE}"
    
    # Create backup using docker-compose
    docker-compose -f "${COMPOSE_DIR}/docker-compose.production.yml" \
        --env-file "${ENV_FILE}" \
        exec -T postgres pg_dump \
        -U "${POSTGRES_USER}" \
        -d "${POSTGRES_DB}" > "${backup_file}" || {
        log_error "Backup failed"
        return 1
    }
    
    log_success "Backup created: ${backup_file}"
}

# Deploy application stack
deploy_application() {
    log_info "Deploying application stack..."
    
    cd "${COMPOSE_DIR}"
    
    # Pull images if requested
    if [[ "${PULL_IMAGES}" == "true" ]]; then
        log_info "Pulling latest images..."
        docker-compose -f docker-compose.production.yml \
            --env-file "${ENV_FILE}" \
            pull
    fi
    
    # Build and start services
    log_info "Starting services..."
    docker-compose -f docker-compose.production.yml \
        --env-file "${ENV_FILE}" \
        up -d --build
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 30
    
    # Health check
    if ! "${SCRIPT_DIR}/health-check.sh"; then
        log_error "Health check failed after deployment"
        return 1
    fi
    
    log_success "Application deployed successfully"
}

# Deploy monitoring stack
deploy_monitoring() {
    log_info "Deploying monitoring stack..."
    
    cd "${COMPOSE_DIR}"
    
    # Start monitoring services
    docker-compose -f docker-compose.monitoring.yml \
        --env-file "${ENV_FILE}" \
        up -d
    
    log_success "Monitoring stack deployed successfully"
    log_info "Grafana: http://localhost:3003"
    log_info "Prometheus: http://localhost:9090"
    log_info "Alertmanager: http://localhost:9093"
}

# Stop services
stop_services() {
    log_info "Stopping services..."
    
    cd "${COMPOSE_DIR}"
    
    # Stop application stack
    if docker-compose -f docker-compose.production.yml ps -q >/dev/null 2>&1; then
        docker-compose -f docker-compose.production.yml \
            --env-file "${ENV_FILE}" \
            down
    fi
    
    # Stop monitoring stack
    if docker-compose -f docker-compose.monitoring.yml ps -q >/dev/null 2>&1; then
        docker-compose -f docker-compose.monitoring.yml \
            --env-file "${ENV_FILE}" \
            down
    fi
    
    log_success "Services stopped"
}

# Restart services
restart_services() {
    log_info "Restarting services..."
    stop_services
    sleep 5
    deploy_application
    deploy_monitoring
    log_success "Services restarted"
}

# Show status
show_status() {
    log_info "Service status:"
    
    cd "${COMPOSE_DIR}"
    
    echo
    echo "Application Services:"
    docker-compose -f docker-compose.production.yml \
        --env-file "${ENV_FILE}" \
        ps
    
    echo
    echo "Monitoring Services:"
    docker-compose -f docker-compose.monitoring.yml \
        --env-file "${ENV_FILE}" \
        ps
}

# Show logs
show_logs() {
    local service="${1:-}"
    
    cd "${COMPOSE_DIR}"
    
    if [[ -n "${service}" ]]; then
        log_info "Showing logs for service: ${service}"
        docker-compose -f docker-compose.production.yml \
            --env-file "${ENV_FILE}" \
            logs -f "${service}"
    else
        log_info "Showing logs for all services"
        docker-compose -f docker-compose.production.yml \
            --env-file "${ENV_FILE}" \
            logs -f
    fi
}

# Rollback deployment
rollback_deployment() {
    log_warning "Rolling back deployment..."
    
    # Stop current services
    stop_services
    
    # Restore from latest backup
    local backup_dir="${PROJECT_ROOT}/backups"
    local latest_backup=$(ls -t "${backup_dir}"/n8n_mcp_*.sql 2>/dev/null | head -n1)
    
    if [[ -n "${latest_backup}" ]]; then
        log_info "Restoring from backup: ${latest_backup}"
        
        # Start database only
        cd "${COMPOSE_DIR}"
        docker-compose -f docker-compose.production.yml \
            --env-file "${ENV_FILE}" \
            up -d postgres
        
        sleep 10
        
        # Restore backup
        source "${ENV_FILE}"
        cat "${latest_backup}" | docker-compose -f docker-compose.production.yml \
            --env-file "${ENV_FILE}" \
            exec -T postgres psql \
            -U "${POSTGRES_USER}" \
            -d "${POSTGRES_DB}"
        
        log_success "Database restored from backup"
    else
        log_warning "No backup found for rollback"
    fi
    
    # Restart services with previous version
    deploy_application
    log_success "Rollback completed"
}

# Confirmation prompt
confirm_action() {
    local action="$1"
    
    if [[ "${FORCE}" == "true" ]]; then
        return 0
    fi
    
    echo -n "Are you sure you want to ${action}? [y/N]: "
    read -r response
    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        *)
            log_info "Operation cancelled"
            exit 0
            ;;
    esac
}

# Main function
main() {
    local command="${1:-help}"
    shift || true
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --env)
                ENV_FILE="$2"
                shift 2
                ;;
            --no-backup)
                SKIP_BACKUP="true"
                shift
                ;;
            --force)
                FORCE="true"
                shift
                ;;
            --pull)
                PULL_IMAGES="true"
                shift
                ;;
            *)
                # For logs command, treat as service name
                if [[ "${command}" == "logs" ]]; then
                    SERVICE_NAME="$1"
                fi
                shift
                ;;
        esac
    done
    
    case "${command}" in
        deploy)
            check_prerequisites
            confirm_action "deploy the application"
            create_backup
            deploy_application
            deploy_monitoring
            ;;
        monitoring)
            check_prerequisites
            deploy_monitoring
            ;;
        stop)
            confirm_action "stop all services"
            stop_services
            ;;
        restart)
            check_prerequisites
            confirm_action "restart all services"
            restart_services
            ;;
        rollback)
            confirm_action "rollback the deployment"
            rollback_deployment
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "${SERVICE_NAME:-}"
            ;;
        backup)
            check_prerequisites
            create_backup
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            log_error "Unknown command: ${command}"
            usage
            exit 1
            ;;
    esac
}

# Handle signals
trap 'echo "Deployment interrupted"; exit 1' INT TERM

# Run main function
main "$@"