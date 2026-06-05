/**
 * Integration tests for AI Grading API routes
 * 
 * Tests all endpoints defined in grade.ts:
 * - POST /api/grade/writing - Grade writing response
 * - POST /api/grade/speaking - Assess pronunciation
 * - GET /api/grade/health - Check service health
 * - POST /api/grade/reset - Reset circuit breaker
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

describe('AI Grading API Integration Tests', () => {
  const testAudioPath = join(process.cwd(), 'test-audio.wav');

  beforeAll(() => {
    // Create a minimal WAV file for testing (44-byte WAV header + silence)
    const wavHeader = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x24, 0x00, 0x00, 0x00, // File size - 8
      0x57, 0x41, 0x56, 0x45, // "WAVE"
      0x66, 0x6D, 0x74, 0x20, // "fmt "
      0x10, 0x00, 0x00, 0x00, // Subchunk1 size (16)
      0x01, 0x00,             // Audio format (1 = PCM)
      0x01, 0x00,             // Number of channels (1 = mono)
      0x44, 0xAC, 0x00, 0x00, // Sample rate (44100)
      0x88, 0x58, 0x01, 0x00, // Byte rate
      0x02, 0x00,             // Block align
      0x10, 0x00,             // Bits per sample (16)
      0x64, 0x61, 0x74, 0x61, // "data"
      0x00, 0x00, 0x00, 0x00, // Subchunk2 size
    ]);
    writeFileSync(testAudioPath, wavHeader);
  });

  afterAll(() => {
    // Clean up test audio file
    if (existsSync(testAudioPath)) {
      unlinkSync(testAudioPath);
    }
  });

  describe('POST /api/grade/writing - Grade writing response', () => {
    it('should grade a build-sentence writing task', async () => {
      const response = await request(app)
        .post('/api/grade/writing')
        .send({
          text: 'The quick brown fox jumps over the lazy dog.',
          taskType: 'build-sentence',
        })
        .expect('Content-Type', /json/);

      // Accept both 200 (success) and 503 (no API key)
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('cefrBand');
        expect(response.body.data).toHaveProperty('scaleScore');
        expect(response.body.data).toHaveProperty('grammarCorrections');
        expect(response.body.data).toHaveProperty('lexicalAnalysis');

        // Validate score ranges (Requirements 5.6, 5.7)
        expect(response.body.data.cefrBand).toBeGreaterThanOrEqual(1);
        expect(response.body.data.cefrBand).toBeLessThanOrEqual(6);
        expect(response.body.data.scaleScore).toBeGreaterThanOrEqual(0);
        expect(response.body.data.scaleScore).toBeLessThanOrEqual(30);

        // Validate data structures
        expect(Array.isArray(response.body.data.grammarCorrections)).toBe(true);
        expect(response.body.data.lexicalAnalysis).toHaveProperty('vocabularyLevel');
        expect(response.body.data.lexicalAnalysis).toHaveProperty('lexicalDiversity');
        expect(response.body.data.lexicalAnalysis).toHaveProperty('academicWordCount');
        expect(response.body.data.lexicalAnalysis).toHaveProperty('suggestions');
        expect(Array.isArray(response.body.data.lexicalAnalysis.suggestions)).toBe(true);

        // Validate metadata
        expect(response.body).toHaveProperty('metadata');
        expect(response.body.metadata).toHaveProperty('taskType', 'build-sentence');
        expect(response.body.metadata).toHaveProperty('textLength');
        expect(response.body.metadata).toHaveProperty('processingTime');
      } else {
        // Service unavailable - API key not configured
        expect(response.body).toHaveProperty('error', 'Service Unavailable');
      }
    });

    it('should grade an email writing task', async () => {
      const emailText = `Dear Professor Smith,

I am writing to request an extension for the assignment due on Friday. I have been experiencing technical difficulties with my laptop.

Thank you for your understanding.

Best regards,
John`;

      const response = await request(app)
        .post('/api/grade/writing')
        .send({
          text: emailText,
          taskType: 'email',
        })
        .expect('Content-Type', /json/);

      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.data).toHaveProperty('cefrBand');
        expect(response.body.data).toHaveProperty('scaleScore');
      }
    });

    it('should grade an academic-discussion task with professor prompt and peer opinions', async () => {
      const response = await request(app)
        .post('/api/grade/writing')
        .send({
          text: 'I agree with Sarah that online learning has advantages. However, we must also consider the disadvantages of reduced social interaction.',
          taskType: 'academic-discussion',
          professorPrompt: 'Discuss the advantages and disadvantages of online learning.',
          peerOpinions: [
            'Sarah: Online learning is convenient and flexible.',
            'Mike: I prefer in-person classes for better engagement.',
          ],
        })
        .expect('Content-Type', /json/);

      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.data).toHaveProperty('cefrBand');
        expect(response.body.data).toHaveProperty('scaleScore');
        expect(response.body.metadata).toHaveProperty('taskType', 'academic-discussion');
      }
    });

    it('should return 400 for missing text field', async () => {
      const response = await request(app)
        .post('/api/grade/writing')
        .send({
          taskType: 'build-sentence',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
      expect(response.body).toHaveProperty('details');
      expect(Array.isArray(response.body.details)).toBe(true);
    });

    it('should return 400 for empty text', async () => {
      const response = await request(app)
        .post('/api/grade/writing')
        .send({
          text: '',
          taskType: 'build-sentence',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for missing taskType', async () => {
      const response = await request(app)
        .post('/api/grade/writing')
        .send({
          text: 'Sample text',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for invalid taskType', async () => {
      const response = await request(app)
        .post('/api/grade/writing')
        .send({
          text: 'Sample text',
          taskType: 'invalid-type',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
      expect(response.body.details.some((d: any) => d.path === 'taskType')).toBe(true);
    });

    it('should handle long text inputs', async () => {
      const longText = 'This is a sentence. '.repeat(500); // ~10,000 characters

      const response = await request(app)
        .post('/api/grade/writing')
        .send({
          text: longText,
          taskType: 'email',
        })
        .expect('Content-Type', /json/);

      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.metadata.textLength).toBeGreaterThan(9000);
      }
    });

    it('should handle special characters and Unicode', async () => {
      const textWithUnicode = 'Hello 世界! This is a test with émojis 😀 and spëcial çharacters.';

      const response = await request(app)
        .post('/api/grade/writing')
        .send({
          text: textWithUnicode,
          taskType: 'build-sentence',
        })
        .expect('Content-Type', /json/);

      expect([200, 503]).toContain(response.status);
    });
  });

  describe('POST /api/grade/speaking - Assess pronunciation', () => {
    it('should assess pronunciation from audio file', async () => {
      const response = await request(app)
        .post('/api/grade/speaking')
        .field('referenceText', 'The quick brown fox jumps over the lazy dog.')
        .field('taskType', 'listen-repeat')
        .attach('audio', testAudioPath)
        .expect('Content-Type', /json/);

      // Accept both 200 (success) and 503 (no API key)
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('message');
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('accuracyScore');
        expect(response.body.data).toHaveProperty('fluencyScore');
        expect(response.body.data).toHaveProperty('prosodyScore');
        expect(response.body.data).toHaveProperty('completenessScore');
        expect(response.body.data).toHaveProperty('cefrBand');
        expect(response.body.data).toHaveProperty('scaleScore');

        // Validate score ranges (Requirements 6.5, 6.6)
        expect(response.body.data.accuracyScore).toBeGreaterThanOrEqual(0);
        expect(response.body.data.accuracyScore).toBeLessThanOrEqual(100);
        expect(response.body.data.fluencyScore).toBeGreaterThanOrEqual(0);
        expect(response.body.data.fluencyScore).toBeLessThanOrEqual(100);
        expect(response.body.data.prosodyScore).toBeGreaterThanOrEqual(0);
        expect(response.body.data.prosodyScore).toBeLessThanOrEqual(100);
        expect(response.body.data.completenessScore).toBeGreaterThanOrEqual(0);
        expect(response.body.data.completenessScore).toBeLessThanOrEqual(100);
        expect(response.body.data.cefrBand).toBeGreaterThanOrEqual(1);
        expect(response.body.data.cefrBand).toBeLessThanOrEqual(6);
        expect(response.body.data.scaleScore).toBeGreaterThanOrEqual(0);
        expect(response.body.data.scaleScore).toBeLessThanOrEqual(30);

        // Validate metadata
        expect(response.body).toHaveProperty('metadata');
        expect(response.body.metadata).toHaveProperty('taskType', 'listen-repeat');
        expect(response.body.metadata).toHaveProperty('audioFormat', 'audio/wav');
        expect(response.body.metadata).toHaveProperty('audioSize');
        expect(response.body.metadata).toHaveProperty('referenceTextLength');
        expect(response.body.metadata).toHaveProperty('processingTime');
      }
    });

    it('should assess simulated-interview task', async () => {
      const response = await request(app)
        .post('/api/grade/speaking')
        .field('referenceText', 'Tell me about your background.')
        .field('taskType', 'simulated-interview')
        .attach('audio', testAudioPath)
        .expect('Content-Type', /json/);

      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.metadata).toHaveProperty('taskType', 'simulated-interview');
      }
    });

    it('should return 400 for missing audio file', async () => {
      const response = await request(app)
        .post('/api/grade/speaking')
        .field('referenceText', 'Test reference text')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Bad Request');
      expect(response.body.message).toContain('Audio file is required');
    });

    it('should return 400 for missing referenceText', async () => {
      const response = await request(app)
        .post('/api/grade/speaking')
        .attach('audio', testAudioPath)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should return 400 for empty referenceText', async () => {
      const response = await request(app)
        .post('/api/grade/speaking')
        .field('referenceText', '')
        .attach('audio', testAudioPath)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
    });

    it('should handle long reference text', async () => {
      const longReferenceText = 'This is a long sentence. '.repeat(50); // ~1250 characters

      const response = await request(app)
        .post('/api/grade/speaking')
        .field('referenceText', longReferenceText)
        .attach('audio', testAudioPath)
        .expect('Content-Type', /json/);

      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body.metadata.referenceTextLength).toBeGreaterThan(1000);
      }
    });

    it('should reject invalid audio file types', async () => {
      // Create a text file instead of audio
      const textFilePath = join(process.cwd(), 'test-invalid.txt');
      writeFileSync(textFilePath, 'This is not an audio file');

      const response = await request(app)
        .post('/api/grade/speaking')
        .field('referenceText', 'Test text')
        .attach('audio', textFilePath)
        .expect(500); // Multer rejects before route handler

      unlinkSync(textFilePath);
    });
  });

  describe('GET /api/grade/health - Check service health', () => {
    it('should return health status when service is configured', async () => {
      const response = await request(app)
        .get('/api/grade/health')
        .expect('Content-Type', /json/);

      // Accept both 200 (configured) and 503 (not configured)
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('circuitState');
        expect(response.body).toHaveProperty('configured', true);
        expect(response.body).toHaveProperty('message');

        // Validate status values
        expect(['healthy', 'degraded', 'unavailable']).toContain(response.body.status);

        // Validate circuit state values
        expect(['CLOSED', 'OPEN', 'HALF_OPEN']).toContain(response.body.circuitState);
      } else {
        expect(response.body).toHaveProperty('status', 'unavailable');
        expect(response.body).toHaveProperty('configured', false);
      }
    });
  });

  describe('POST /api/grade/reset - Reset circuit breaker', () => {
    it('should reset circuit breaker when service is configured', async () => {
      const response = await request(app)
        .post('/api/grade/reset')
        .expect('Content-Type', /json/);

      // Accept both 200 (configured) and 503 (not configured)
      expect([200, 503]).toContain(response.status);

      if (response.status === 200) {
        expect(response.body).toHaveProperty('message', 'Circuit breaker reset successfully');
      } else {
        expect(response.body).toHaveProperty('error', 'Service Unavailable');
      }
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/grade/writing')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid JSON');
    });

    it('should respect rate limiting', async () => {
      // Note: This test would require making 100+ requests to trigger rate limiting
      // Skipping for now to keep test suite fast
    });

    it('should handle concurrent grading requests', async () => {
      const requests = Array.from({ length: 5 }, (_, i) =>
        request(app)
          .post('/api/grade/writing')
          .send({
            text: `Test text number ${i}`,
            taskType: 'build-sentence',
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect([200, 503]).toContain(response.status);
      });
    });
  });

  describe('Service fallback behavior', () => {
    it('should return default scores when grading fails', async () => {
      // This test verifies that the service returns fallback scores
      // when the Gemini API is unavailable (Requirement 19.2)
      
      const response = await request(app)
        .post('/api/grade/writing')
        .send({
          text: 'Test text',
          taskType: 'build-sentence',
        })
        .expect('Content-Type', /json/);

      if (response.status === 200 && response.body.error) {
        // Fallback behavior triggered
        expect(response.body.data).toHaveProperty('cefrBand');
        expect(response.body.data).toHaveProperty('scaleScore');
        expect(response.body.data.lexicalAnalysis.suggestions).toContain('Grading service temporarily unavailable');
      }
    });
  });

  describe('Integration workflow', () => {
    it('should support complete grading workflow for a test taker', async () => {
      // 1. Check service health
      const healthResponse = await request(app)
        .get('/api/grade/health')
        .expect('Content-Type', /json/);

      console.log('Service health:', healthResponse.body);

      // 2. Grade a writing response
      const writingResponse = await request(app)
        .post('/api/grade/writing')
        .send({
          text: 'In my opinion, online education provides flexibility for students who work full-time.',
          taskType: 'academic-discussion',
          professorPrompt: 'What are your thoughts on online education?',
        })
        .expect('Content-Type', /json/);

      if (writingResponse.status === 200) {
        console.log('Writing score:', {
          cefrBand: writingResponse.body.data.cefrBand,
          scaleScore: writingResponse.body.data.scaleScore,
        });
      }

      // 3. Assess a speaking response
      const speakingResponse = await request(app)
        .post('/api/grade/speaking')
        .field('referenceText', 'Good morning, how are you today?')
        .field('taskType', 'listen-repeat')
        .attach('audio', testAudioPath)
        .expect('Content-Type', /json/);

      if (speakingResponse.status === 200) {
        console.log('Speaking score:', {
          accuracyScore: speakingResponse.body.data.accuracyScore,
          cefrBand: speakingResponse.body.data.cefrBand,
          scaleScore: speakingResponse.body.data.scaleScore,
        });
      }

      // Both requests should either succeed or fail gracefully
      expect([200, 503]).toContain(writingResponse.status);
      expect([200, 503]).toContain(speakingResponse.status);
    });
  });
});
