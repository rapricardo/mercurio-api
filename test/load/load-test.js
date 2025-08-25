#!/usr/bin/env node

/**
 * Load testing script for Mercurio API
 * Tests 95% success rate requirement under concurrent load
 */

const http = require('http');
const { randomUUID } = require('crypto');

// Test configuration
const CONFIG = {
  baseUrl: 'http://localhost:3000',
  concurrency: 10,        // Number of concurrent workers
  requestsPerWorker: 100, // Requests per worker
  totalRequests: 1000,    // Total requests to send
  apiKey: process.env.TEST_API_KEY || '',
  timeout: 5000,          // Request timeout in ms
};

// Test results tracking
const results = {
  total: 0,
  success: 0,
  errors: 0,
  timeouts: 0,
  latencies: [],
  errorTypes: new Map(),
  startTime: 0,
  endTime: 0,
};

/**
 * Generate test event payload
 */
function generateTestEvent() {
  return {
    event_name: 'load_test_event',
    anonymous_id: randomUUID(),
    timestamp: new Date().toISOString(),
    properties: {
      test_id: randomUUID(),
      worker_id: process.pid,
      timestamp: Date.now(),
      random_data: Math.random().toString(36).substring(7)
    },
    page: {
      url: `https://example.com/page-${Math.floor(Math.random() * 100)}`,
      title: `Load Test Page ${Math.floor(Math.random() * 100)}`,
      referrer: 'https://loadtest.example.com'
    }
  };
}

/**
 * Make HTTP request to API
 */
function makeRequest(endpoint, payload, method = 'POST') {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const postData = JSON.stringify(payload);

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${CONFIG.apiKey}`,
        'X-Event-Schema-Version': '1.0.0',
        'User-Agent': 'LoadTest/1.0'
      },
      timeout: CONFIG.timeout
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        const latency = Date.now() - startTime;
        const statusCode = res.statusCode;

        resolve({
          statusCode,
          latency,
          success: statusCode >= 200 && statusCode < 400,
          data: data
        });
      });
    });

    req.on('error', (err) => {
      const latency = Date.now() - startTime;
      reject({
        error: err.message,
        latency,
        success: false
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const latency = Date.now() - startTime;
      reject({
        error: 'timeout',
        latency,
        success: false
      });
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Worker function that sends requests
 */
async function worker(workerId, requestCount) {
  console.log(`Worker ${workerId}: Starting with ${requestCount} requests`);
  const workerResults = {
    success: 0,
    errors: 0,
    latencies: []
  };

  for (let i = 0; i < requestCount; i++) {
    try {
      const event = generateTestEvent();
      const result = await makeRequest('/events/track', event);
      
      results.total++;
      workerResults.latencies.push(result.latency);
      
      if (result.success) {
        results.success++;
        workerResults.success++;
      } else {
        results.errors++;
        workerResults.errors++;
        
        const errorType = `HTTP_${result.statusCode}`;
        results.errorTypes.set(errorType, (results.errorTypes.get(errorType) || 0) + 1);
      }
      
      results.latencies.push(result.latency);
      
    } catch (error) {
      results.total++;
      results.errors++;
      workerResults.errors++;
      
      if (error.error === 'timeout') {
        results.timeouts++;
        results.errorTypes.set('TIMEOUT', (results.errorTypes.get('TIMEOUT') || 0) + 1);
      } else {
        results.errorTypes.set('CONNECTION_ERROR', (results.errorTypes.get('CONNECTION_ERROR') || 0) + 1);
      }
      
      if (error.latency) {
        results.latencies.push(error.latency);
        workerResults.latencies.push(error.latency);
      }
    }

    // Progress indication
    if (i % 10 === 0) {
      process.stdout.write(`Worker ${workerId}: ${i}/${requestCount} `);
    }
  }

  console.log(`\\nWorker ${workerId}: Completed - ${workerResults.success} success, ${workerResults.errors} errors`);
  return workerResults;
}

/**
 * Calculate percentiles from latency array
 */
function calculatePercentile(latencies, percentile) {
  if (latencies.length === 0) return 0;
  
  const sorted = [...latencies].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Run load test with concurrent workers
 */
async function runLoadTest() {
  console.log('🚀 Starting Mercurio API Load Test');
  console.log(`Configuration:`);
  console.log(`  - Total requests: ${CONFIG.totalRequests}`);
  console.log(`  - Concurrency: ${CONFIG.concurrency}`);
  console.log(`  - Requests per worker: ${Math.ceil(CONFIG.totalRequests / CONFIG.concurrency)}`);
  console.log(`  - API Key: ${CONFIG.apiKey ? 'PROVIDED' : 'MISSING'}`);
  console.log('');

  if (!CONFIG.apiKey) {
    console.error('❌ ERROR: TEST_API_KEY environment variable is required');
    console.log('Run: export TEST_API_KEY="your-api-key-here"');
    process.exit(1);
  }

  // Test connectivity first
  try {
    console.log('🔍 Testing API connectivity...');
    const healthCheck = await makeRequest('/health', null, 'GET');
    console.log(`✅ API is responding (${healthCheck.statusCode})`);
  } catch (error) {
    console.error('❌ API connectivity test failed:', error.error || error);
    process.exit(1);
  }

  results.startTime = Date.now();

  // Start concurrent workers
  const requestsPerWorker = Math.ceil(CONFIG.totalRequests / CONFIG.concurrency);
  const workers = [];

  for (let i = 0; i < CONFIG.concurrency; i++) {
    workers.push(worker(i + 1, requestsPerWorker));
  }

  console.log(`\\n🏃 Running ${CONFIG.concurrency} concurrent workers...\\n`);

  // Wait for all workers to complete
  await Promise.all(workers);

  results.endTime = Date.now();

  // Calculate results
  const duration = (results.endTime - results.startTime) / 1000;
  const successRate = (results.success / results.total) * 100;
  const requestsPerSecond = results.total / duration;
  
  const p50 = calculatePercentile(results.latencies, 50);
  const p90 = calculatePercentile(results.latencies, 90);
  const p95 = calculatePercentile(results.latencies, 95);
  const p99 = calculatePercentile(results.latencies, 99);

  // Display results
  console.log('\\n\\n📊 LOAD TEST RESULTS');
  console.log('='.repeat(50));
  console.log(`Total Requests:    ${results.total}`);
  console.log(`Successful:        ${results.success} (${successRate.toFixed(2)}%)`);
  console.log(`Failed:            ${results.errors}`);
  console.log(`Timeouts:          ${results.timeouts}`);
  console.log(`Duration:          ${duration.toFixed(2)}s`);
  console.log(`Requests/sec:      ${requestsPerSecond.toFixed(2)}`);
  console.log('');
  console.log('📈 LATENCY PERCENTILES');
  console.log(`P50:               ${p50}ms`);
  console.log(`P90:               ${p90}ms`);
  console.log(`P95:               ${p95}ms`);
  console.log(`P99:               ${p99}ms`);
  console.log('');

  if (results.errorTypes.size > 0) {
    console.log('❌ ERROR BREAKDOWN');
    for (const [type, count] of results.errorTypes.entries()) {
      console.log(`${type}:           ${count}`);
    }
    console.log('');
  }

  // Check requirements
  console.log('✅ REQUIREMENT VALIDATION');
  console.log('='.repeat(50));
  
  const successRateRequirement = 95.0;
  const p50Requirement = 50; // ms
  
  const successRatePassed = successRate >= successRateRequirement;
  const p50Passed = p50 <= p50Requirement;
  
  console.log(`Success Rate (≥${successRateRequirement}%):  ${successRatePassed ? '✅' : '❌'} ${successRate.toFixed(2)}%`);
  console.log(`P50 Latency (≤${p50Requirement}ms):   ${p50Passed ? '✅' : '❌'} ${p50}ms`);
  
  const allPassed = successRatePassed && p50Passed;
  console.log('');
  console.log(`Overall Result:    ${allPassed ? '✅ PASSED' : '❌ FAILED'}`);

  if (!allPassed) {
    console.log('');
    console.log('🔧 RECOMMENDATIONS:');
    if (!successRatePassed) {
      console.log('  - Investigate error causes and improve error handling');
      console.log('  - Check database connection pooling and capacity');
      console.log('  - Review application logs for bottlenecks');
    }
    if (!p50Passed) {
      console.log('  - Optimize database queries and indexing');
      console.log('  - Enable API key caching');
      console.log('  - Review middleware performance');
    }
  }

  process.exit(allPassed ? 0 : 1);
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\\n\\n⚠️  Load test interrupted by user');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('\\n\\n💥 Uncaught exception:', error);
  process.exit(1);
});

// Run the load test
if (require.main === module) {
  runLoadTest().catch(error => {
    console.error('\\n\\n💥 Load test failed:', error);
    process.exit(1);
  });
}

module.exports = { runLoadTest };