import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const generateImageDuration = new Trend('generate_image_duration');
const getStylesDuration = new Trend('get_styles_duration');
const getAspectRatiosDuration = new Trend('get_aspect_ratios_duration');

// Configuration: Max 20 hits total
export const options = {
  scenarios: {
    stress_test: {
      executor: 'shared-iterations',
      vus: 4,              // 4 virtual users
      iterations: 20,      // Total 20 requests (hits)
      maxDuration: '2m',   // Max 2 minutes
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<30000'], // 95% requests under 30s (image generation is slow)
    errors: ['rate<0.3'],               // Error rate below 30%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Sample prompts for testing
const prompts = [
  'a cute anime girl with blue hair',
  'a samurai warrior in battle stance',
  'a magical forest with spirits',
  'a cyberpunk cityscape at night',
  'a dragon flying over mountains',
];

const styles = [
  'modern anime style',
  'studio ghibli style',
  'chibi anime style',
  'classic 90s anime style',
  'semi-realistic anime style',
];

// Helper function to get random item from array
function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Test: GET /api/images/styles
function testGetStyles() {
  const res = http.get(`${BASE_URL}/api/images/styles`);

  getStylesDuration.add(res.timings.duration);

  const success = check(res, {
    'GET /styles - status 200': (r) => r.status === 200,
    'GET /styles - has styles property': (r) => {
      const body = JSON.parse(r.body);
      return body.styles !== undefined;
    },
  });

  errorRate.add(!success);
  return success;
}

// Test: GET /api/images/aspect-ratios
function testGetAspectRatios() {
  const res = http.get(`${BASE_URL}/api/images/aspect-ratios`);

  getAspectRatiosDuration.add(res.timings.duration);

  const success = check(res, {
    'GET /aspect-ratios - status 200': (r) => r.status === 200,
    'GET /aspect-ratios - has aspectRatios property': (r) => {
      const body = JSON.parse(r.body);
      return body.aspectRatios !== undefined;
    },
  });

  errorRate.add(!success);
  return success;
}

// Test: POST /api/images/generate
function testGenerateImage() {
  const payload = JSON.stringify({
    prompt: getRandomItem(prompts),
    style: getRandomItem(styles),
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: '60s', // Image generation can take time
  };

  const res = http.post(`${BASE_URL}/api/images/generate`, payload, params);

  generateImageDuration.add(res.timings.duration);

  const success = check(res, {
    'POST /generate - status 200 or 201': (r) => r.status === 200 || r.status === 201,
    'POST /generate - has success property': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success !== undefined;
      } catch {
        return false;
      }
    },
    'POST /generate - has data with base64': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.base64 !== undefined;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!success);
  return success;
}

// Test: GET /api/images/:filename (404 expected for non-existent file)
function testGetImageNotFound() {
  const res = http.get(`${BASE_URL}/api/images/nonexistent_12345.png`);

  const success = check(res, {
    'GET /image - returns 404 for non-existent': (r) => r.status === 404,
  });

  errorRate.add(!success);
  return success;
}

// Main test function
export default function () {
  const iteration = __ITER;

  // Distribute 20 hits across different endpoints:
  // - 4 hits: GET /styles (lightweight)
  // - 4 hits: GET /aspect-ratios (lightweight)
  // - 10 hits: POST /generate (main functionality)
  // - 2 hits: GET /:filename 404 test

  if (iteration < 4) {
    // First 4 iterations: test styles endpoint
    testGetStyles();
  } else if (iteration < 8) {
    // Next 4 iterations: test aspect-ratios endpoint
    testGetAspectRatios();
  } else if (iteration < 18) {
    // Next 10 iterations: test image generation
    testGenerateImage();
  } else {
    // Last 2 iterations: test 404 handling
    testGetImageNotFound();
  }

  // Small delay between requests
  sleep(0.5);
}

// Setup function - runs once before test
export function setup() {
  console.log(`Starting stress test against ${BASE_URL}`);
  console.log('Total iterations: 20 hits');
  console.log('Distribution: 4 styles + 4 aspect-ratios + 10 generate + 2 not-found');

  // Verify server is running
  const res = http.get(`${BASE_URL}/api/images/styles`);
  if (res.status !== 200) {
    throw new Error(`Server not reachable at ${BASE_URL}. Status: ${res.status}`);
  }

  return { startTime: new Date().toISOString() };
}

// Teardown function - runs once after test
export function teardown(data) {
  console.log(`\nStress test completed`);
  console.log(`Started at: ${data.startTime}`);
  console.log(`Finished at: ${new Date().toISOString()}`);
}
