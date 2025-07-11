#!/bin/bash

# Health check script for N8N MCP API
# Returns 0 if healthy, 1 if unhealthy

set -e

# Configuration
API_HOST=${API_HOST:-localhost}
API_PORT=${API_PORT:-3001}
TIMEOUT=${TIMEOUT:-10}
MAX_RETRIES=${MAX_RETRIES:-3}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Check if service is responding
check_health_endpoint() {
    local url="http://${API_HOST}:${API_PORT}/health"
    local response
    local status_code
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" --max-time "${TIMEOUT}" "${url}" 2>/dev/null) || return 1
    status_code=$(echo "${response}" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [[ "${status_code}" -eq 200 ]]; then
        return 0
    else
        log "Health endpoint returned status: ${status_code}"
        return 1
    fi
}

# Check readiness endpoint
check_readiness_endpoint() {
    local url="http://${API_HOST}:${API_PORT}/ready"
    local response
    local status_code
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" --max-time "${TIMEOUT}" "${url}" 2>/dev/null) || return 1
    status_code=$(echo "${response}" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [[ "${status_code}" -eq 200 ]]; then
        return 0
    else
        log "Readiness endpoint returned status: ${status_code}"
        return 1
    fi
}

# Check if port is open
check_port() {
    if command -v nc >/dev/null 2>&1; then
        nc -z "${API_HOST}" "${API_PORT}" 2>/dev/null
    elif command -v telnet >/dev/null 2>&1; then
        timeout 3 telnet "${API_HOST}" "${API_PORT}" </dev/null >/dev/null 2>&1
    else
        # Fallback using /dev/tcp
        timeout 3 bash -c "cat < /dev/null > /dev/tcp/${API_HOST}/${API_PORT}" 2>/dev/null
    fi
}

# Main health check function
main() {
    local retries=0
    local health_ok=false
    
    log "Starting health check for ${API_HOST}:${API_PORT}"
    
    while [[ ${retries} -lt ${MAX_RETRIES} ]]; do
        # Check if port is open
        if ! check_port; then
            log "Port ${API_PORT} is not accessible on ${API_HOST}"
            ((retries++))
            sleep 2
            continue
        fi
        
        # Check health endpoint
        if check_health_endpoint; then
            log "Health endpoint check passed"
            health_ok=true
            break
        else
            log "Health endpoint check failed"
        fi
        
        # Check readiness endpoint as fallback
        if check_readiness_endpoint; then
            log "Readiness endpoint check passed"
            health_ok=true
            break
        else
            log "Readiness endpoint check failed"
        fi
        
        ((retries++))
        if [[ ${retries} -lt ${MAX_RETRIES} ]]; then
            log "Retrying in 2 seconds... (${retries}/${MAX_RETRIES})"
            sleep 2
        fi
    done
    
    if [[ ${health_ok} == true ]]; then
        echo -e "${GREEN}✓ Health check passed${NC}"
        exit 0
    else
        echo -e "${RED}✗ Health check failed after ${MAX_RETRIES} retries${NC}"
        exit 1
    fi
}

# Handle signals
trap 'echo "Health check interrupted"; exit 1' INT TERM

# Run main function
main "$@"