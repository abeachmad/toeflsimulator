/**
 * k6 Load Test — Task 30.1
 *
 * Tests 100 concurrent exam sessions against the backend API.
 * Run with: k6 run load-tests/exam-sessions.k6.js
 *
 * Requirements: 21.1, 21.2, 21.3
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const abilityCalcDuration = new Trend('ability_calc_duration');
const apiResponseTime = new Trend('api_response_time');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    // Ramp up to 100 concurrent users over 30 seconds
    { duration: '30s', target: 100 },
    // Hold at 100 for 2 minutes
    { duration: '2m', target: 100 },
    // Ramp down
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    // Requirement 21.2: API response time p95 < 500ms
    http_req_duration: ['p(95)<500'],
    // Requirement 21.3: Error rate < 1%
    error_rate: ['rate<0.01'],
    api_response_time: ['p(95)<500'],
    ability_calc_duration: ['p(95)<500'],
  },
};

const headers = {
  'Content-Type': 'application/json',
};

/**
 * Create a new exam session
 */
function createSession() {
  const payload = JSON.stringify({ userId: `load-test-user-${__VU}` });
  const res = http.post(`${BASE_URL}/api/sessions`, payload, { headers });

  apiResponseTime.add(res.timings.duration);
  errorRate.add(res.status !== 201 && res.status !== 200);

  check(res, {
    'session created': (r) => r.status === 201 || r.status === 200,
  });

  if (res.status === 200 || res.status === 201) {
    return JSON.parse(res.body).sessionId || JSON.parse(res.body).session_id;
  }
  return null;
}

/**
 * Get timer for a session
 */
function getTimer(sessionId) {
  const res = http.get(`${BASE_URL}/api/timers/${sessionId}`, { headers });
  apiResponseTime.add(res.timings.duration);
  errorRate.add(res.status !== 200);

  check(res, {
    'timer returned': (r) => r.status === 200,
    'remaining_time present': (r) => JSON.parse(r.body).remainingTime !== undefined,
  });
}

/**
 * MST routing — simulate ability estimation
 */
function routeToModule(sessionId, theta = 0.0) {
  const payload = JSON.stringify({
    sessionId,
    section: 'reading',
    stage: 1,
    theta,
  });
  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/mst/route`, payload, { headers });
  abilityCalcDuration.add(Date.now() - start);

  errorRate.add(res.status !== 200);
  check(res, { 'mst route successful': (r) => r.status === 200 });
}

export default function () {
  // 1. Create session
  const sessionId = createSession();
  if (!sessionId) {
    sleep(1);
    return;
  }

  sleep(0.5);

  // 2. Get timer
  getTimer(sessionId);
  sleep(0.5);

  // 3. Simulate MST routing with random ability value
  const theta = (Math.random() * 6 - 3).toFixed(2);
  routeToModule(sessionId, parseFloat(theta));

  sleep(1);
}
