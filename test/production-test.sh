#!/bin/bash

# Test against production API
BASE_URL="https://mercurio-api.ricardotocha.com.br"
API_KEY="ak_test_production_2025"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL_TESTS=0
PASSED=0
FAILED=0

# Test function
test_endpoint() {
    local method="$1"
    local endpoint="$2"
    local headers="$3"
    local body="$4"
    local expected_status="$5"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [[ -n "$body" ]]; then
        if [[ -n "$headers" ]]; then
            response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
                "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -H "$headers" \
                -d "$body")
        else
            response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
                "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$body")
        fi
    else
        if [[ -n "$headers" ]]; then
            response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
                "$BASE_URL$endpoint" \
                -H "$headers")
        else
            response=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
                "$BASE_URL$endpoint")
        fi
    fi
    
    if [[ "$response" == "$expected_status" ]]; then
        echo -e "${GREEN}✓${NC} $method $endpoint - Expected: $expected_status, Got: $response"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌${NC} $method $endpoint - Expected: $expected_status, Got: $response"
        FAILED=$((FAILED + 1))
    fi
}

echo "🚀 PRODUCTION API TEST - mercurio-api.ricardotocha.com.br"
echo "================================"

# Health check
test_endpoint "GET" "/health" "" "" "200"

# Monitoring
test_endpoint "GET" "/monitoring/metrics" "" "" "200"

# Tenant Management (should be unauthorized without proper auth)
test_endpoint "GET" "/v1/tenants" "" "" "401"
test_endpoint "GET" "/v1/tenants/1" "" "" "401"
test_endpoint "POST" "/v1/tenants" "" '{"name":"Test Tenant"}' "401"
test_endpoint "PATCH" "/v1/tenants/1" "" '{"name":"Updated Tenant"}' "401"
test_endpoint "DELETE" "/v1/tenants/1" "" "" "401"

# Workspace Management (should be unauthorized without proper auth)
test_endpoint "GET" "/v1/tenants/1/workspaces" "" "" "401"
test_endpoint "GET" "/v1/tenants/1/workspaces/1" "" "" "401"
test_endpoint "POST" "/v1/tenants/1/workspaces" "" '{"name":"Test Workspace"}' "401"
test_endpoint "PATCH" "/v1/tenants/1/workspaces/1" "" '{"name":"Updated Workspace"}' "401"
test_endpoint "DELETE" "/v1/tenants/1/workspaces/1" "" "" "401"

# Events (with API key)
test_endpoint "POST" "/v1/events/track" "Authorization: Bearer $API_KEY" "{\"event_name\":\"page_view\",\"timestamp\":\"$(node -e 'console.log(new Date().toISOString())')\",\"anonymous_id\":\"a_prod_test_$(date +%s)\",\"page\":{\"url\":\"https://test.com/page\",\"path\":\"/page\",\"title\":\"Test Page\"},\"properties\":{\"test\":true}}" "200"

test_endpoint "POST" "/v1/events/batch" "Authorization: Bearer $API_KEY" "{\"events\":[{\"event_name\":\"page_view\",\"timestamp\":\"$(node -e 'console.log(new Date().toISOString())')\",\"anonymous_id\":\"a_prod_batch_$(date +%s)\",\"page\":{\"url\":\"https://test.com/batch1\",\"path\":\"/batch1\",\"title\":\"Batch Test 1\"},\"properties\":{\"batch\":true,\"index\":1}},{\"event_name\":\"button_click\",\"timestamp\":\"$(node -e 'console.log(new Date().toISOString())')\",\"anonymous_id\":\"a_prod_batch_$(date +%s)\",\"page\":{\"url\":\"https://test.com/batch2\",\"path\":\"/batch2\",\"title\":\"Batch Test 2\"},\"properties\":{\"batch\":true,\"index\":2}}]}" "200"

# Analytics endpoints (with API key)
test_endpoint "GET" "/v1/analytics/overview?period=30d" "Authorization: Bearer $API_KEY" "" "200"
test_endpoint "GET" "/v1/analytics/timeseries?period=7d&granularity=day&metrics=events,visitors" "Authorization: Bearer $API_KEY" "" "200"
test_endpoint "GET" "/v1/analytics/events/top?period=30d&limit=10" "Authorization: Bearer $API_KEY" "" "200"
test_endpoint "GET" "/v1/analytics/users?period=30d&segment=all" "Authorization: Bearer $API_KEY" "" "200"
test_endpoint "GET" "/v1/analytics/events/details?period=7d&page=1&limit=50" "Authorization: Bearer $API_KEY" "" "200"

# Funnel analytics
test_endpoint "GET" "/v1/analytics/funnels" "Authorization: Bearer $API_KEY" "" "200"

echo
echo "📋 RESULTS:"
echo "==========="
echo -e "Total Tests: ${BLUE}$TOTAL_TESTS${NC}"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo

if [[ $FAILED -eq 0 ]]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    exit 0
else
    echo -e "${RED}❌ $FAILED TESTS FAILED${NC}"
    exit 1
fi