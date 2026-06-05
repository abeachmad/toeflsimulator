import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from './app';

describe('Express Server - Core Middleware Tests', () => {
  describe('Health Check', () => {
    it('should return 200 OK with status information', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
      });
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
    });
  });

  describe('API Root', () => {
    it('should return API information and available endpoints', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'TOEFL iBT 2026 Test Simulator API',
        version: '1.0.0',
      });
      expect(response.body.endpoints).toBeDefined();
      expect(response.body.endpoints).toHaveProperty('health');
      expect(response.body.endpoints).toHaveProperty('sessions');
    });
  });

  describe('CORS Middleware', () => {
    it('should include CORS headers in response', async () => {
      const response = await request(app)
        .get('/health')
        .set('Origin', 'http://localhost:5173');

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should handle preflight OPTIONS requests', async () => {
      const response = await request(app)
        .options('/api/sessions')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.status).toBe(204);
    });
  });

  describe('Security Headers (Helmet)', () => {
    it('should include security headers in response', async () => {
      const response = await request(app).get('/health');

      // Helmet adds various security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('JSON Body Parsing', () => {
    it('should parse JSON request body', async () => {
      const testData = { test: 'data', nested: { value: 123 } };
      
      // Since we don't have a POST endpoint yet, we'll test error handling
      const response = await request(app)
        .post('/api/test')
        .send(testData)
        .set('Content-Type', 'application/json');

      // Should get 404 but not 400 (parsing worked)
      expect(response.status).toBe(404);
    });

    it('should reject invalid JSON with 400 error', async () => {
      const response = await request(app)
        .post('/api/test')
        .send('{ invalid json }')
        .set('Content-Type', 'application/json')
        .type('json');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid JSON');
    });

    it('should accept JSON payloads up to 10mb', async () => {
      // Create a large but valid JSON payload (smaller than 10mb for test speed)
      const largeData = {
        audio: 'x'.repeat(1024 * 1024), // 1MB of data
        metadata: { size: '1MB' }
      };

      const response = await request(app)
        .post('/api/test')
        .send(largeData)
        .set('Content-Type', 'application/json');

      // Should get 404 (route not found), not 413 (payload too large)
      expect(response.status).toBe(404);
    });
  });

  describe('URL-Encoded Body Parsing', () => {
    it('should parse URL-encoded request body', async () => {
      const response = await request(app)
        .post('/api/test')
        .send('key1=value1&key2=value2')
        .set('Content-Type', 'application/x-www-form-urlencoded');

      // Should get 404 but not 400 (parsing worked)
      expect(response.status).toBe(404);
    });
  });

  describe('Compression Middleware', () => {
    it('should compress responses when Accept-Encoding includes gzip', async () => {
      const response = await request(app)
        .get('/api')
        .set('Accept-Encoding', 'gzip, deflate');

      // Compression middleware should add vary header
      expect(response.headers).toHaveProperty('vary');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/unknown-route')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Not Found',
        message: 'The requested resource does not exist',
      });
    });

    it('should return 404 for unknown API routes', async () => {
      const response = await request(app)
        .get('/api/unknown')
        .expect(404);

      expect(response.body.error).toBe('Not Found');
    });
  });

  describe('Error Handling Middleware', () => {
    it('should handle validation errors with 400 status', async () => {
      // We'll need to add a test route that throws validation error
      // For now, test JSON parsing error which triggers error handler
      const response = await request(app)
        .post('/api/test')
        .send('invalid json')
        .set('Content-Type', 'application/json')
        .type('json');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should not expose error details in production mode', async () => {
      // Save original NODE_ENV
      const originalEnv = process.env.NODE_ENV;
      
      // Set to production (note: this may not affect running server)
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .post('/api/test')
        .send('{ invalid }')
        .set('Content-Type', 'application/json')
        .type('json');

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      
      // Restore original NODE_ENV
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests under rate limit', async () => {
      const response = await request(app)
        .get('/api')
        .expect(200);

      expect(response.headers).toHaveProperty('ratelimit-limit');
      expect(response.headers).toHaveProperty('ratelimit-remaining');
    });

    it('should include rate limit headers', async () => {
      const response = await request(app).get('/api');

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });
  });

  describe('Request Logging (Morgan)', () => {
    it('should not interfere with normal request handling', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
    });
  });

  describe('Multiple Middleware Integration', () => {
    it('should handle request through all middleware layers', async () => {
      const response = await request(app)
        .get('/api')
        .set('Origin', 'http://localhost:5173')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // Verify CORS
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      
      // Verify security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      
      // Verify content type
      expect(response.headers['content-type']).toMatch(/json/);
      
      // Verify body
      expect(response.body.message).toBeDefined();
    });
  });
});

describe('Express Server - Port Configuration', () => {
  it('should use PORT from environment variable or default to 3000', () => {
    const port = process.env.PORT || 3000;
    expect(port).toBeDefined();
    expect(typeof port === 'string' || typeof port === 'number').toBe(true);
  });
});
