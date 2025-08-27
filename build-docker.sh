#!/bin/bash

# 🚀 Mercurio API - Docker Build Script
# Cria imagem Docker otimizada apenas da API (sem banco ou serviços externos)

set -e

# Configuration
IMAGE_NAME="mercurio-api"
IMAGE_TAG="${1:-latest}"
REGISTRY="${DOCKER_REGISTRY:-}"
FULL_IMAGE_NAME="${REGISTRY}${REGISTRY:+/}${IMAGE_NAME}:${IMAGE_TAG}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}🔧 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Validate environment
print_step "Validating environment..."

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed or not in PATH"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed or not in PATH"
    exit 1
fi

print_success "Environment validation passed"

# Pre-build checks
print_step "Running pre-build checks..."

# Check if package.json exists
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Run this script from the project root."
    exit 1
fi

# Check if Dockerfile exists
if [ ! -f "Dockerfile" ]; then
    print_error "Dockerfile not found. Run this script from the project root."
    exit 1
fi

# Validate package.json
if ! npm list --depth=0 > /dev/null 2>&1; then
    print_warning "Package dependencies may have issues. Building anyway..."
else
    print_success "Package.json validation passed"
fi

# Clean up previous build artifacts (optional)
print_step "Cleaning up previous build artifacts..."
rm -rf dist/ || true
rm -rf node_modules/.cache || true
print_success "Cleanup completed"

# Build Docker image
print_step "Building Docker image: ${FULL_IMAGE_NAME}"
echo "This may take a few minutes..."

# Build with BuildKit for better performance
DOCKER_BUILDKIT=1 docker build \
    --file Dockerfile \
    --tag "${FULL_IMAGE_NAME}" \
    --label "version=$(date +%Y%m%d-%H%M%S)" \
    --label "git-commit=$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" \
    --label "build-date=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    --target production \
    .

# Verify build success
if [ $? -eq 0 ]; then
    print_success "Docker image built successfully!"
else
    print_error "Docker build failed!"
    exit 1
fi

# Get image info
print_step "Getting image information..."
IMAGE_SIZE=$(docker images "${FULL_IMAGE_NAME}" --format "table {{.Size}}" | tail -n 1)
IMAGE_ID=$(docker images "${FULL_IMAGE_NAME}" --format "table {{.ID}}" | tail -n 1)

echo ""
echo "📊 BUILD SUMMARY"
echo "=================="
echo "Image Name: ${FULL_IMAGE_NAME}"
echo "Image ID: ${IMAGE_ID}"
echo "Image Size: ${IMAGE_SIZE}"
echo "Build Date: $(date)"
echo "Git Commit: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
echo ""

# Test the image (optional health check)
print_step "Testing image health check..."
if docker run --rm --name mercurio-test -d -p 3001:3000 "${FULL_IMAGE_NAME}" > /dev/null; then
    sleep 10
    
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        print_success "Health check passed!"
        docker stop mercurio-test > /dev/null 2>&1
    else
        print_warning "Health check failed or took too long"
        docker stop mercurio-test > /dev/null 2>&1
    fi
else
    print_warning "Could not run test container (port might be in use)"
fi

# Usage instructions
echo ""
echo "🚀 USAGE INSTRUCTIONS"
echo "====================="
echo ""
echo "1. Run locally:"
echo "   docker run -d -p 3000:3000 --name mercurio-api \\"
echo "     -e DATABASE_URL='your_database_url' \\"
echo "     -e ENCRYPTION_KEK_SECRET='your_encryption_key' \\"
echo "     ${FULL_IMAGE_NAME}"
echo ""
echo "2. Run with environment file:"
echo "   docker run -d -p 3000:3000 --name mercurio-api \\"
echo "     --env-file .env.production \\"
echo "     ${FULL_IMAGE_NAME}"
echo ""
echo "3. Check health:"
echo "   curl http://localhost:3000/health"
echo ""
echo "4. View logs:"
echo "   docker logs mercurio-api"
echo ""
echo "5. Stop container:"
echo "   docker stop mercurio-api && docker rm mercurio-api"
echo ""

# Push to registry (optional)
if [ -n "${DOCKER_REGISTRY}" ] && [ "${PUSH_TO_REGISTRY:-false}" = "true" ]; then
    print_step "Pushing to registry: ${DOCKER_REGISTRY}"
    docker push "${FULL_IMAGE_NAME}"
    
    if [ $? -eq 0 ]; then
        print_success "Image pushed successfully to ${DOCKER_REGISTRY}"
    else
        print_error "Failed to push image to registry"
        exit 1
    fi
fi

print_success "Docker build completed successfully! 🎉"

# Additional image analysis (optional)
if command -v dive &> /dev/null; then
    echo ""
    echo "💡 TIP: You can analyze the image layers with:"
    echo "   dive ${FULL_IMAGE_NAME}"
fi

if command -v docker &> /dev/null; then
    echo ""
    echo "🔍 IMAGE DETAILS:"
    docker inspect "${FULL_IMAGE_NAME}" --format='{{json .Config.Labels}}' | jq '.' 2>/dev/null || echo "Labels: $(docker inspect "${FULL_IMAGE_NAME}" --format='{{.Config.Labels}}')"
fi