#!/bin/bash

# Final integration and end-to-end testing script for Sprint 1
# This script runs all tests to validate Sprint 1 requirements

set -e

echo "🚀 Starting Sprint 1 Final Integration Tests"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
UNIT_TESTS_PASSED=false
INTEGRATION_TESTS_PASSED=false
E2E_TESTS_PASSED=false
LOAD_TESTS_PASSED=false

# Function to print colored output
print_status() {
    local status=$1
    local message=$2
    if [ "$status" = "SUCCESS" ]; then
        echo -e "${GREEN}✅ $message${NC}"
    elif [ "$status" = "FAILURE" ]; then
        echo -e "${RED}❌ $message${NC}"
    elif [ "$status" = "WARNING" ]; then
        echo -e "${YELLOW}⚠️  $message${NC}"
    else
        echo -e "${BLUE}ℹ️  $message${NC}"
    fi
}

# Function to run tests with error handling
run_test_suite() {
    local test_name=$1
    local test_command=$2
    local required=$3

    echo ""
    print_status "INFO" "Running $test_name..."
    echo "Command: $test_command"
    
    if eval "$test_command"; then
        print_status "SUCCESS" "$test_name passed"
        return 0
    else
        if [ "$required" = "true" ]; then
            print_status "FAILURE" "$test_name failed (REQUIRED)"
            return 1
        else
            print_status "WARNING" "$test_name failed (optional)"
            return 0
        fi
    fi
}

# Check prerequisites
echo ""
print_status "INFO" "Checking prerequisites..."

if [ ! -f "package.json" ]; then
    print_status "FAILURE" "package.json not found. Run from apps/api directory."
    exit 1
fi

if [ ! -f ".env" ] && [ ! -f ".env.example" ]; then
    print_status "WARNING" "No .env file found. Using environment defaults."
fi

# Check if Docker is available for integration tests
if command -v docker >/dev/null 2>&1; then
    print_status "SUCCESS" "Docker is available"
else
    print_status "WARNING" "Docker not available - some integration tests may fail"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "INFO" "Installing dependencies..."
    npm install
fi

# Set up test database
print_status "INFO" "Setting up test database..."
export NODE_ENV=test
export DATABASE_URL=${TEST_DATABASE_URL:-"postgresql://mercurio:mercurio_dev_password@localhost:5432/mercurio_test?schema=public"}

# Run database migrations for testing
print_status "INFO" "Running database migrations..."
npx prisma migrate dev --name test_migration || true

# Generate Prisma client
npx prisma generate

echo ""
echo "============================================="
print_status "INFO" "Starting Test Execution"
echo "============================================="

# 1. Unit Tests
echo ""
print_status "INFO" "Phase 1: Unit Tests"
echo "-------------------"
if run_test_suite "Unit Tests" "npm run test -- --testPathPattern='src.*\\.spec\\.ts$'" true; then
    UNIT_TESTS_PASSED=true
fi

# 2. Integration Tests (Sprint 1 Requirements)
echo ""
print_status "INFO" "Phase 2: Integration Tests"
echo "-------------------------"
if run_test_suite "Sprint 1 Requirements Tests" "npm run test -- --testPathPattern='test/integration/sprint1-requirements\\.test\\.ts$'" true; then
    INTEGRATION_TESTS_PASSED=true
fi

# 3. End-to-End Tests
echo ""
print_status "INFO" "Phase 3: End-to-End Tests"
echo "------------------------"
if run_test_suite "Complete Flow E2E Tests" "npm run test:e2e -- --testPathPattern='test/e2e/complete-flow\\.e2e\\.test\\.ts$'" true; then
    E2E_TESTS_PASSED=true
fi

# 4. Load Tests (if API key provided)
echo ""
print_status "INFO" "Phase 4: Load Tests"
echo "------------------"
if [ -n "$TEST_API_KEY" ]; then
    if run_test_suite "Load Tests" "node test/load/load-test.js" false; then
        LOAD_TESTS_PASSED=true
    fi
else
    print_status "WARNING" "TEST_API_KEY not set - skipping load tests"
    print_status "INFO" "To run load tests: export TEST_API_KEY=your-api-key"
fi

# 5. Documentation Tests
echo ""
print_status "INFO" "Phase 5: Documentation Validation"
echo "--------------------------------"
run_test_suite "API Documentation Check" "test -f ../../../docs/api/ingestion.md" true

# 6. Docker Environment Tests
echo ""
print_status "INFO" "Phase 6: Docker Environment"
echo "--------------------------"
run_test_suite "Docker Compose Validation" "docker-compose config -q" false

echo ""
echo "============================================="
print_status "INFO" "Test Results Summary"
echo "============================================="

# Display results summary
echo ""
echo "Test Suite Results:"
echo "-------------------"

if [ "$UNIT_TESTS_PASSED" = true ]; then
    print_status "SUCCESS" "Unit Tests"
else
    print_status "FAILURE" "Unit Tests"
fi

if [ "$INTEGRATION_TESTS_PASSED" = true ]; then
    print_status "SUCCESS" "Integration Tests (Sprint 1 Requirements)"
else
    print_status "FAILURE" "Integration Tests (Sprint 1 Requirements)"
fi

if [ "$E2E_TESTS_PASSED" = true ]; then
    print_status "SUCCESS" "End-to-End Tests"
else
    print_status "FAILURE" "End-to-End Tests"
fi

if [ "$LOAD_TESTS_PASSED" = true ]; then
    print_status "SUCCESS" "Load Tests"
elif [ -n "$TEST_API_KEY" ]; then
    print_status "FAILURE" "Load Tests"
else
    print_status "WARNING" "Load Tests (skipped - no API key)"
fi

echo ""
echo "Sprint 1 Requirements Validation:"
echo "--------------------------------"

# Check which requirements are validated
requirements_met=0
total_requirements=7

if [ "$UNIT_TESTS_PASSED" = true ] && [ "$INTEGRATION_TESTS_PASSED" = true ]; then
    print_status "SUCCESS" "Req 1: Tenant Management and Provisioning"
    requirements_met=$((requirements_met + 1))
else
    print_status "FAILURE" "Req 1: Tenant Management and Provisioning"
fi

if [ "$INTEGRATION_TESTS_PASSED" = true ]; then
    print_status "SUCCESS" "Req 2: Enhanced Payload Validation"
    requirements_met=$((requirements_met + 1))
    
    print_status "SUCCESS" "Req 3: Event Deduplication"
    requirements_met=$((requirements_met + 1))
    
    print_status "SUCCESS" "Req 4: Infrastructure Setup"
    requirements_met=$((requirements_met + 1))
    
    print_status "SUCCESS" "Req 5: Enhanced Logging and Monitoring"
    requirements_met=$((requirements_met + 1))
    
    print_status "SUCCESS" "Req 6: Documentation"
    requirements_met=$((requirements_met + 1))
else
    print_status "FAILURE" "Req 2-6: Various requirements failed"
fi

if [ "$E2E_TESTS_PASSED" = true ] && [ "$LOAD_TESTS_PASSED" = true ]; then
    print_status "SUCCESS" "Req 7: Performance and Testing"
    requirements_met=$((requirements_met + 1))
elif [ "$E2E_TESTS_PASSED" = true ]; then
    print_status "WARNING" "Req 7: Performance and Testing (partial - no load tests)"
else
    print_status "FAILURE" "Req 7: Performance and Testing"
fi

echo ""
echo "============================================="

# Final result
if [ $requirements_met -eq $total_requirements ]; then
    print_status "SUCCESS" "ALL SPRINT 1 REQUIREMENTS MET ($requirements_met/$total_requirements)"
    echo ""
    print_status "SUCCESS" "🎉 Sprint 1 is ready for production!"
    echo ""
    echo "Next steps:"
    echo "1. Deploy to staging environment"
    echo "2. Run load tests with production API keys"
    echo "3. Monitor performance metrics"
    echo "4. Begin Sprint 2 planning"
    exit 0
elif [ $requirements_met -ge 5 ]; then
    print_status "WARNING" "MOST REQUIREMENTS MET ($requirements_met/$total_requirements)"
    echo ""
    print_status "WARNING" "Sprint 1 needs minor fixes before production"
    echo ""
    echo "Recommended actions:"
    echo "1. Fix failing test suites"
    echo "2. Re-run this script"
    echo "3. Review error logs above"
    exit 1
else
    print_status "FAILURE" "INSUFFICIENT REQUIREMENTS MET ($requirements_met/$total_requirements)"
    echo ""
    print_status "FAILURE" "Sprint 1 is not ready - significant issues found"
    echo ""
    echo "Required actions:"
    echo "1. Review all failing tests above"
    echo "2. Fix implementation issues"
    echo "3. Re-run individual test suites"
    echo "4. Re-run this comprehensive test"
    exit 2
fi