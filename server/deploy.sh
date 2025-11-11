#!/bin/bash

# Deployment script for automatic CI/CD
# This script pulls the latest code and rebuilds Docker containers

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if we're running inside Docker container (PROJECT_ROOT env var set)
if [ -n "$PROJECT_ROOT" ]; then
    # Running inside container, use mounted project path
    log "Running inside Docker container"
    PROJECT_ROOT="$PROJECT_ROOT"
else
    # Running on host, calculate from script location
    PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
fi

log "Starting deployment process..."
log "Script directory: $SCRIPT_DIR"
log "Project root: $PROJECT_ROOT"

# Change to project root
cd "$PROJECT_ROOT"

# Check if git is available
if ! command -v git &> /dev/null; then
    error "Git is not installed or not in PATH"
    exit 1
fi

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    error "Not a git repository. Cannot pull latest changes."
    exit 1
fi

# Check if docker compose is available
if ! command -v docker &> /dev/null; then
    error "Docker is not installed or not in PATH"
    exit 1
fi

# Check docker compose (try both 'docker compose' and 'docker-compose')
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
elif docker-compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
else
    error "Docker Compose is not installed or not in PATH"
    exit 1
fi

log "Using Docker Compose command: $DOCKER_COMPOSE_CMD"

# Step 1: Pull latest code from git
log "Step 1: Pulling latest code from git..."
cd "$PROJECT_ROOT"

# Fetch latest changes
git fetch origin main || {
    warn "Failed to fetch from origin. Continuing with local repository..."
}

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
log "Current branch: $CURRENT_BRANCH"

# Get current commit before pull
OLD_COMMIT=$(git rev-parse HEAD)
log "Current commit: $OLD_COMMIT"

# Pull latest changes (use merge strategy that won't fail on conflicts)
if git pull origin main --no-edit; then
    NEW_COMMIT=$(git rev-parse HEAD)
    if [ "$OLD_COMMIT" != "$NEW_COMMIT" ]; then
        log "Code updated successfully"
        log "Old commit: ${OLD_COMMIT:0:7}"
        log "New commit: ${NEW_COMMIT:0:7}"
    else
        log "Already up to date. No new changes."
    fi
else
    error "Failed to pull latest code"
    exit 1
fi

# Step 2: Change to server directory
log "Step 2: Changing to server directory..."
SERVER_DIR="$PROJECT_ROOT/server"
if [ ! -d "$SERVER_DIR" ]; then
    # Fallback to script directory if server dir doesn't exist
    SERVER_DIR="$SCRIPT_DIR"
fi
cd "$SERVER_DIR"
log "Changed to server directory: $(pwd)"

# Step 3: Rebuild and restart Docker containers
log "Step 3: Rebuilding and restarting Docker containers..."

# Stop existing containers gracefully
log "Stopping existing containers..."
$DOCKER_COMPOSE_CMD down || {
    warn "Some containers may not have stopped gracefully. Continuing..."
}

# Rebuild and start containers
log "Building and starting containers..."
if $DOCKER_COMPOSE_CMD up -d --build; then
    log "Docker containers rebuilt and started successfully"
else
    error "Failed to rebuild Docker containers"
    exit 1
fi

# Step 4: Wait for services to be healthy
log "Step 4: Waiting for services to be healthy..."
sleep 5

# Check container status
log "Checking container status..."
$DOCKER_COMPOSE_CMD ps

# Step 5: Verify deployment
log "Step 5: Verifying deployment..."

# Check if containers are running
if $DOCKER_COMPOSE_CMD ps | grep -q "Up"; then
    log "✅ Deployment successful! Containers are running."
else
    error "Deployment may have failed. Some containers are not running."
    $DOCKER_COMPOSE_CMD ps
    exit 1
fi

# Show recent logs
log "Recent container logs:"
$DOCKER_COMPOSE_CMD logs --tail=20

log "✅ Deployment completed successfully!"
log "Deployment finished at $(date)"

