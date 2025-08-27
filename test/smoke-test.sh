#!/bin/bash

# =============================================================================
# MERCURIO API - SMOKE TEST SCRIPT
# =============================================================================
# Script para validação rápida de todos os 28 endpoints da API
# Uso: ./test/smoke-test.sh [API_KEY] [JWT_TOKEN]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3000"
API_KEY="${1:-}"
JWT_TOKEN="${2:-}"
TENANT_ID=""
WORKSPACE_ID=""
FUNNEL_ID=""

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Utility functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    ((PASSED_TESTS++))
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ((FAILED_TESTS++))
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# HTTP request wrapper
make_request() {
    local method="$1"
    local endpoint="$2"
    local auth_header="$3"
    local data="$4"
    local expected_status="${5:-200}"
    
    ((TOTAL_TESTS++))
    
    log_info "Testing $method $endpoint"
    
    local response
    local status_code
    
    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -H "$auth_header" \
            -d "$data" \
            "$BASE_URL$endpoint" 2>/dev/null || echo -e "\n000")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "$auth_header" \
            "$BASE_URL$endpoint" 2>/dev/null || echo -e "\n000")
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1 2>/dev/null || echo "$response" | sed '$d')
    
    if [ "$status_code" = "$expected_status" ]; then
        log_success "$method $endpoint - Status: $status_code"
        echo "$body"
        return 0
    else
        log_error "$method $endpoint - Expected: $expected_status, Got: $status_code"
        [ -n "$body" ] && echo "Response: $body"
        return 1
    fi
}

# Extract value from JSON response
extract_json_value() {
    echo "$1" | grep -o "\"$2\":\"[^\"]*\"" | cut -d'"' -f4 | head -1
}

extract_json_array_first() {
    echo "$1" | grep -o "\"$2\":\[{[^}]*\"id\":\"[^\"]*\"" | grep -o "\"id\":\"[^\"]*\"" | cut -d'"' -f4 | head -1
}

# Setup function
setup() {
    echo "=============================================="
    echo "🚀 MERCURIO API SMOKE TEST SUITE"
    echo "=============================================="
    echo "Base URL: $BASE_URL"
    echo "API Key: ${API_KEY:0:10}..." 
    echo "JWT Token: ${JWT_TOKEN:0:20}..."
    echo ""
    
    if [ -z "$API_KEY" ] && [ -z "$JWT_TOKEN" ]; then
        log_warning "Neither API_KEY nor JWT_TOKEN provided"
        log_warning "Some tests may fail without authentication"
        echo ""
    fi
}

# Test Health & Monitoring endpoints
test_health_monitoring() {
    echo "🏥 Testing Health & Monitoring..."
    
    make_request "GET" "/health" "" "" "200"
    make_request "GET" "/monitoring/metrics" "" "" "200"
    
    echo ""
}

# Test CRUD Tenants
test_tenants_crud() {
    echo "🏢 Testing CRUD Tenants..."
    
    local auth_header="Authorization: Bearer $JWT_TOKEN"
    
    # List tenants and extract first tenant ID
    local response=$(make_request "GET" "/v1/tenants?page=1&pageSize=10" "$auth_header" "" "200")
    TENANT_ID=$(extract_json_array_first "$response" "data")
    
    if [ -n "$TENANT_ID" ]; then
        log_info "Using tenant ID: $TENANT_ID"
        make_request "GET" "/v1/tenants/$TENANT_ID" "$auth_header" "" "200"
    fi
    
    # Create tenant
    local create_data='{"name":"Test Tenant '$(date +%s)'","status":"active"}'
    local create_response=$(make_request "POST" "/v1/tenants" "$auth_header" "$create_data" "201")
    local created_tenant_id=$(extract_json_value "$create_response" "id")
    
    if [ -n "$created_tenant_id" ]; then
        # Update tenant
        local update_data='{"name":"Updated Test Tenant '$(date +%s)'"}'
        make_request "PATCH" "/v1/tenants/$created_tenant_id" "$auth_header" "$update_data" "200"
        
        # Delete tenant
        make_request "DELETE" "/v1/tenants/$created_tenant_id" "$auth_header" "" "200"
    fi
    
    echo ""
}

# Test CRUD Workspaces
test_workspaces_crud() {
    echo "🏪 Testing CRUD Workspaces..."
    
    if [ -z "$TENANT_ID" ]; then
        log_warning "No tenant ID available, skipping workspace tests"
        return
    fi
    
    local auth_header="Authorization: Bearer $JWT_TOKEN"
    
    # List workspaces
    local response=$(make_request "GET" "/v1/tenants/$TENANT_ID/workspaces?page=1&pageSize=10" "$auth_header" "" "200")
    WORKSPACE_ID=$(extract_json_array_first "$response" "data")
    
    if [ -n "$WORKSPACE_ID" ]; then
        log_info "Using workspace ID: $WORKSPACE_ID"
        make_request "GET" "/v1/tenants/$TENANT_ID/workspaces/$WORKSPACE_ID" "$auth_header" "" "200"
    fi
    
    # Create workspace
    local create_data='{"name":"Test Workspace '$(date +%s)'","environment":"testing"}'
    local create_response=$(make_request "POST" "/v1/tenants/$TENANT_ID/workspaces" "$auth_header" "$create_data" "201")
    local created_workspace_id=$(extract_json_value "$create_response" "id")
    
    if [ -n "$created_workspace_id" ]; then
        # Update workspace
        local update_data='{"name":"Updated Test Workspace '$(date +%s)'"}'
        make_request "PATCH" "/v1/tenants/$TENANT_ID/workspaces/$created_workspace_id" "$auth_header" "$update_data" "200"
        
        # Delete workspace
        make_request "DELETE" "/v1/tenants/$TENANT_ID/workspaces/$created_workspace_id" "$auth_header" "" "200"
    fi
    
    echo ""
}

# Test Event Ingestion
test_event_ingestion() {
    echo "📊 Testing Event Ingestion..."
    
    local auth_header="Authorization: Bearer $API_KEY"
    
    # Track single event
    local timestamp1=$(node -e "console.log(new Date().toISOString())")
    local event_data='{
        "event_name": "smoke_test_event",
        "timestamp": "'$timestamp1'",
        "anonymous_id": "a_smoke_test_123",
        "session_id": "s_smoke_session_123",
        "page": {"url": "https://test.com", "path": "/test", "title": "Smoke Test Page"},
        "properties": {"test": true, "source": "smoke_test"}
    }'
    make_request "POST" "/v1/events/track" "$auth_header" "$event_data" "201"
    
    # Track batch events
    local timestamp2=$(node -e "console.log(new Date(Date.now() + 1000).toISOString())")
    local timestamp3=$(node -e "console.log(new Date(Date.now() + 2000).toISOString())")
    local batch_data='{
        "events": [
            {
                "event_name": "batch_test_1",
                "timestamp": "'$timestamp2'",
                "anonymous_id": "a_batch_test_456",
                "session_id": "s_batch_session_456",
                "properties": {"batch": true, "index": 1}
            },
            {
                "event_name": "batch_test_2", 
                "timestamp": "'$timestamp3'",
                "anonymous_id": "a_batch_test_456",
                "session_id": "s_batch_session_456",
                "properties": {"batch": true, "index": 2}
            }
        ]
    }'
    make_request "POST" "/v1/events/batch" "$auth_header" "$batch_data" "201"
    
    # Identify user
    local timestamp4=$(node -e "console.log(new Date(Date.now() + 3000).toISOString())")
    local identify_data='{
        "anonymous_id": "a_smoke_test_789",
        "user_id": "user_smoke_test_789",
        "traits": {"email": "smoke_test@example.com", "name": "Smoke Test User", "plan": "free"},
        "timestamp": "'$timestamp4'"
    }'
    make_request "POST" "/v1/events/identify" "$auth_header" "$identify_data" "201"
    
    echo ""
}

# Test Analytics
test_analytics() {
    echo "📈 Testing Analytics..."
    
    local auth_header="Authorization: Bearer $API_KEY"
    
    make_request "GET" "/v1/analytics/overview?period=30d" "$auth_header" "" "200"
    make_request "GET" "/v1/analytics/timeseries?period=7d&granularity=day&metrics=events,visitors" "$auth_header" "" "200"
    make_request "GET" "/v1/analytics/events/top?period=30d&limit=10" "$auth_header" "" "200"
    make_request "GET" "/v1/analytics/users?period=30d&segment=all" "$auth_header" "" "200"
    make_request "GET" "/v1/analytics/events/details?period=7d&page=1&limit=50" "$auth_header" "" "200"
    
    # Export analytics with correct payload structure
    local export_data='{
        "export_type": "summary",
        "format": "csv",
        "delivery_method": "download",
        "filters": {
            "start_date": "2025-08-20",
            "end_date": "2025-08-27",
            "event_name": "page_view"
        }
    }'
    make_request "POST" "/v1/analytics/export" "$auth_header" "$export_data" "202"
    
    echo ""
}

# Test Funnel Analytics
test_funnel_analytics() {
    echo "🔄 Testing Funnel Analytics..."
    
    local auth_header="Authorization: Bearer $API_KEY"
    
    # List funnels
    local response=$(make_request "GET" "/v1/analytics/funnels?page=1&limit=10" "$auth_header" "" "200")
    FUNNEL_ID=$(extract_json_array_first "$response" "funnels")
    
    # Create funnel with correct endpoint
    local funnel_data='{
        "name": "Smoke Test Funnel '$(date +%s)'",
        "description": "Funnel created during smoke test",
        "time_window_days": 7,
        "steps": [
            {
                "order": 0,
                "type": "start",
                "label": "Landing Page",
                "matching_rules": [{
                    "kind": "event",
                    "rules": {"event_name": "page_view", "page.path": "/"}
                }]
            },
            {
                "order": 1,
                "type": "conversion",
                "label": "Signup Form",
                "matching_rules": [{
                    "kind": "event",
                    "rules": {"event_name": "form_submit", "properties.form_name": "signup"}
                }]
            }
        ]
    }'
    local create_response=$(make_request "POST" "/v1/analytics/funnels" "$auth_header" "$funnel_data" "201")
    local created_funnel_id=$(extract_json_value "$create_response" "id")
    
    if [ -n "$FUNNEL_ID" ]; then
        log_info "Using existing funnel ID: $FUNNEL_ID"
        make_request "GET" "/v1/analytics/funnels/$FUNNEL_ID" "$auth_header" "" "200"
        make_request "GET" "/v1/analytics/funnels/$FUNNEL_ID/conversion?start_date=2025-08-20&end_date=2025-08-27" "$auth_header" "" "400"
        make_request "GET" "/v1/analytics/funnels/$FUNNEL_ID/attribution?start_date=2025-08-20&end_date=2025-08-27" "$auth_header" "" "400"
    fi
    
    if [ -n "$created_funnel_id" ]; then
        # Update funnel
        local update_data='{"name":"Updated Smoke Test Funnel '$(date +%s)'"}'
        make_request "PATCH" "/v1/analytics/funnels/$created_funnel_id" "$auth_header" "$update_data" "200"
        
        # Delete funnel
        make_request "DELETE" "/v1/analytics/funnels/$created_funnel_id" "$auth_header" "" "200"
    fi
    
    # Export funnel data
    if [ -n "$FUNNEL_ID" ]; then
        local export_data='{
            "export_type": "summary",
            "format": "csv",
            "delivery_method": "download",
            "filters": {
                "start_date": "2025-08-20",
                "end_date": "2025-08-27",
                "funnel_id": "'$FUNNEL_ID'"
            }
        }'
        make_request "POST" "/v1/analytics/funnels/$FUNNEL_ID/export" "$auth_header" "$export_data" "202"
    fi
    
    echo ""
}

# Print final report
print_report() {
    echo "=============================================="
    echo "📋 SMOKE TEST REPORT"
    echo "=============================================="
    echo -e "Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
    echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
        echo "✅ API is functioning correctly"
        exit 0
    else
        echo -e "${RED}❌ SOME TESTS FAILED!${NC}"
        echo "⚠️  Please check the API configuration and logs"
        exit 1
    fi
}

# Main execution
main() {
    setup
    test_health_monitoring
    test_tenants_crud
    test_workspaces_crud 
    test_event_ingestion
    test_analytics
    test_funnel_analytics
    print_report
}

# Check if script is being executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi