import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// =============================================================================
// Custom Metrics
// =============================================================================

// Error rate tracking
const errorRate = new Rate('error_rate');

// Response time metrics
const healthCheckDuration = new Trend('health_check_duration', true);

// Request counters
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// =============================================================================
// Test Configuration
// =============================================================================

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const HEALTH_ENDPOINT = `${BASE_URL}/api/images/health`;

/**
 * k6 Options Configuration
 *
 * Stress test stages:
 * 1. Ramp-up: Gradually increase users from 0 to 50 over 30 seconds
 * 2. Sustained load: Maintain 50 users for 1 minute
 * 3. Spike test: Quickly ramp up to 100 users for 30 seconds
 * 4. Recovery: Scale back to 50 users for 30 seconds
 * 5. Ramp-down: Gradually decrease to 0 users over 30 seconds
 */
export const options = {
  stages: [
    // Stage 1: Ramp-up phase
    { duration: '30s', target: 50 },

    // Stage 2: Sustained load phase
    { duration: '1m', target: 50 },

    // Stage 3: Spike test phase
    { duration: '30s', target: 100 },

    // Stage 4: Recovery phase
    { duration: '30s', target: 50 },

    // Stage 5: Ramp-down phase
    { duration: '30s', target: 0 },
  ],

  // Thresholds define pass/fail criteria for the test
  thresholds: {
    // Response time thresholds
    'http_req_duration': [
      'p(50)<200',   // 50% of requests should complete under 200ms
      'p(90)<500',   // 90% of requests should complete under 500ms
      'p(95)<1000',  // 95% of requests should complete under 1000ms
      'p(99)<2000',  // 99% of requests should complete under 2000ms
    ],

    // Custom health check duration thresholds
    'health_check_duration': [
      'p(95)<1500',  // 95% of health checks should complete under 1500ms
      'avg<500',     // Average response time should be under 500ms
    ],

    // Error rate threshold
    'error_rate': [
      'rate<0.01',   // Error rate should be less than 1%
    ],

    // Request success rate
    'http_req_failed': [
      'rate<0.01',   // Less than 1% of requests should fail
    ],

    // Throughput threshold (requests per second)
    'http_reqs': [
      'rate>10',     // Should handle at least 10 requests per second
    ],
  },
};

// =============================================================================
// Test Functions
// =============================================================================

/**
 * Test the health check endpoint
 * Validates response status, structure, and records metrics
 */
function testHealthCheck() {
  const startTime = Date.now();

  const response = http.get(HEALTH_ENDPOINT, {
    headers: {
      'Accept': 'application/json',
    },
    timeout: '10s',
  });

  const duration = Date.now() - startTime;
  healthCheckDuration.add(duration);

  // Perform checks on the response
  const checkResult = check(response, {
    // Status code check
    'status is 200': (r) => r.status === 200,

    // Response has valid JSON
    'response is valid JSON': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },

    // Response structure validation
    'has status field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status !== undefined;
      } catch {
        return false;
      }
    },

    'has geminiApi field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.geminiApi !== undefined;
      } catch {
        return false;
      }
    },

    'has timestamp field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.timestamp !== undefined;
      } catch {
        return false;
      }
    },

    // Health status validation
    'status is healthy or unhealthy': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'healthy' || body.status === 'unhealthy';
      } catch {
        return false;
      }
    },

    // Response time check
    'response time under 2s': (r) => r.timings.duration < 2000,
  });

  // Track success/failure metrics
  if (checkResult) {
    successfulRequests.add(1);
    errorRate.add(false);
  } else {
    failedRequests.add(1);
    errorRate.add(true);
  }

  return checkResult;
}

// =============================================================================
// Main Test Execution
// =============================================================================

/**
 * Default function - executed by each virtual user
 * This runs repeatedly during the test duration
 */
export default function () {
  testHealthCheck();

  // Small random sleep between requests (100-300ms)
  // This simulates realistic user behavior
  sleep(Math.random() * 0.2 + 0.1);
}

// =============================================================================
// Lifecycle Hooks
// =============================================================================

/**
 * Setup function - runs once before the test starts
 * Used to verify the server is reachable and log test configuration
 */
export function setup() {
  console.log('='.repeat(60));
  console.log('Health Check Endpoint Stress Test');
  console.log('='.repeat(60));
  console.log(`Target URL: ${HEALTH_ENDPOINT}`);
  console.log(`Start time: ${new Date().toISOString()}`);
  console.log('');
  console.log('Test Stages:');
  console.log('  1. Ramp-up:       0 -> 50 VUs  (30s)');
  console.log('  2. Sustained:     50 VUs       (1m)');
  console.log('  3. Spike:         50 -> 100 VUs (30s)');
  console.log('  4. Recovery:      100 -> 50 VUs (30s)');
  console.log('  5. Ramp-down:     50 -> 0 VUs  (30s)');
  console.log('');
  console.log('Thresholds:');
  console.log('  - p(95) response time < 1000ms');
  console.log('  - Error rate < 1%');
  console.log('  - Throughput > 10 req/s');
  console.log('='.repeat(60));

  // Verify server is reachable before starting the test
  const healthCheck = http.get(HEALTH_ENDPOINT, { timeout: '10s' });

  if (healthCheck.status !== 200) {
    console.error(`Server health check failed! Status: ${healthCheck.status}`);
    console.error(`Response: ${healthCheck.body}`);
    throw new Error(`Server not reachable at ${HEALTH_ENDPOINT}. Status: ${healthCheck.status}`);
  }

  console.log('Server is reachable. Starting stress test...');
  console.log('');

  return {
    startTime: new Date().toISOString(),
    targetUrl: HEALTH_ENDPOINT,
  };
}

/**
 * Teardown function - runs once after the test completes
 * Used to log final summary and test duration
 */
export function teardown(data) {
  const endTime = new Date().toISOString();
  const startTime = new Date(data.startTime);
  const duration = (new Date(endTime) - startTime) / 1000;

  console.log('');
  console.log('='.repeat(60));
  console.log('Test Completed');
  console.log('='.repeat(60));
  console.log(`Target URL: ${data.targetUrl}`);
  console.log(`Start time: ${data.startTime}`);
  console.log(`End time:   ${endTime}`);
  console.log(`Duration:   ${duration.toFixed(2)} seconds`);
  console.log('='.repeat(60));
}

// =============================================================================
// Custom Summary Handler
// =============================================================================

/**
 * Handle summary - generates custom output format
 * This function is called after the test completes with all metrics
 */
export function handleSummary(data) {
  const summary = {
    testName: 'Health Check Endpoint Stress Test',
    endpoint: HEALTH_ENDPOINT,
    timestamp: new Date().toISOString(),
    duration: data.state.testRunDurationMs,
    metrics: {
      requests: {
        total: data.metrics.http_reqs?.values?.count || 0,
        rate: data.metrics.http_reqs?.values?.rate || 0,
      },
      responseTime: {
        avg: data.metrics.http_req_duration?.values?.avg || 0,
        min: data.metrics.http_req_duration?.values?.min || 0,
        max: data.metrics.http_req_duration?.values?.max || 0,
        p50: data.metrics.http_req_duration?.values?.['p(50)'] || 0,
        p90: data.metrics.http_req_duration?.values?.['p(90)'] || 0,
        p95: data.metrics.http_req_duration?.values?.['p(95)'] || 0,
        p99: data.metrics.http_req_duration?.values?.['p(99)'] || 0,
      },
      errors: {
        rate: data.metrics.error_rate?.values?.rate || 0,
        httpFailures: data.metrics.http_req_failed?.values?.rate || 0,
      },
      customMetrics: {
        successfulRequests: data.metrics.successful_requests?.values?.count || 0,
        failedRequests: data.metrics.failed_requests?.values?.count || 0,
        healthCheckDurationAvg: data.metrics.health_check_duration?.values?.avg || 0,
        healthCheckDurationP95: data.metrics.health_check_duration?.values?.['p(95)'] || 0,
      },
    },
    thresholds: data.thresholds,
  };

  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'tests/stress/health-check-results.json': JSON.stringify(summary, null, 2),
  };
}

/**
 * Generate text summary (using k6's built-in summary)
 */
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';
