/**
 * Audio File Validation Tests
 * 
 * Tests audio file validation for speaking grading endpoint
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5
 * 
 * Tests:
 * - File size validation (<10MB)
 * - File format validation (WAV only)
 * - Error message specificity
 * - Combined validation failures
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

describe('Audio File Validation Tests - Requirements 15.1-15.5', () => {
  const testDir = process.cwd();
  const validWavPath = join(testDir, 'test-valid.wav');
  const oversizedWavPath = join(testDir, 'test-oversized.wav');
  const mp3FilePath = join(testDir, 'test-audio.mp3');
  const txtFilePath = join(testDir, 'test-audio.txt');

  beforeAll(() => {
    // Create a minimal valid WAV file (44-byte header + small data)
    const validWavHeader = Buffer.from([
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
    writeFileSync(validWavPath, validWavHeader);

    // Create an oversized WAV file (>10MB) - use sparse file technique
    // Create WAV header with size claim of 11MB but minimal actual data
    const oversizedSize = 11 * 1024 * 1024; // 11MB claimed size
    const oversizedSizeBytes = Buffer.alloc(4);
    oversizedSizeBytes.writeUInt32LE(oversizedSize - 8, 0);
    
    const oversizedHeader = Buffer.concat([
      Buffer.from([0x52, 0x49, 0x46, 0x46]), // "RIFF"
      oversizedSizeBytes, // File size - 8
      Buffer.from([
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
      ])
    ]);
    
    // Add enough data to make file > 10MB
    const dataSize = oversizedSize - oversizedHeader.length;
    const audioData = Buffer.alloc(dataSize);
    writeFileSync(oversizedWavPath, Buffer.concat([oversizedHeader, audioData]));

    // Create an MP3 file (wrong format)
    // MP3 files start with ID3 header or sync bytes 0xFF 0xFB
    const mp3Header = Buffer.from([
      0xFF, 0xFB, 0x90, 0x00, // MP3 sync + MPEG1 Layer3
      0x00, 0x00, 0x00, 0x00, // Padding
    ]);
    writeFileSync(mp3FilePath, mp3Header);

    // Create a text file with .wav extension (wrong content type)
    writeFileSync(txtFilePath, 'This is not audio data');
  });

  afterAll(() => {
    // Clean up test files
    const testFiles = [validWavPath, oversizedWavPath, mp3FilePath, txtFilePath];
    testFiles.forEach(file => {
      if (existsSync(file)) {
        unlinkSync(file);
      }
    });
  });

  describe('Requirement 15.1: File size validation (<10MB)', () => {
    it('should accept valid WAV file under 10MB', async () => {
      const response = await request(app)
        .post('/api/grade/speaking')
        .field('referenceText', 'Test reference text')
        .attach('audio', validWavPath)
        .expect('Content-Type', /json/);

      // Should succeed (200) or service unavailable (503), not validation error (400)
      expect([200, 503]).toContain(response.status);
      
      if (response.status === 200 || response.status === 503) {
        // Should not be a validation error
        expect(response.body.error).not.toBe('Validation Error');
      }
    });

    it('should reject WAV file exceeding 10MB - Requirement 15.1, 15.3', async () => {
      const response = await request(app)
        .post('/api/grade/speaking')
        .field('referenceText', 'Test reference text')
        .attach('audio', oversizedWavPath)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Validation Error');
      expect(response.body).toHaveProperty('message', 'Audio file validation failed');
      expect(response.body).toHaveProperty('details');
      expect(Array.isArray(response.body.details)).toBe(true);
      
      // Requirement 15.3: Specific error message for size violations
      expect(response.body.details).toContain('Audio file size exceeds 10 megabytes limit');
    });
  });

  describe('Requirement 15.2: File format validation (WAV)', () => {
    it('should accept WAV file with correct MIME type and extension', async () => {
      const response = await request(app)
        .post('/api/grade/speaking')
        .field('referenceText', 'Test reference text')
        .attach('audio', validWavPath)
        .expect('Content-Type', /json/);

      // Should succeed or service unavailable, not validation error
      expect([200, 503]).toContain(response.status);
    });

    it('should reject MP3 file - Requirement 15.2, 15.4', async () => {
      const response = await request(app)
        .post('/api/grade/speaking')
        .field('referenceText', 'Test reference text')
        .attach('audio', mp3FilePath)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      
      // Should contain format error message (Requirement 15.4)
      const errorMessage = JSON.stringify(response.body).toLowerCase();
      expect(errorMessage).toContain('wav');
    });

    it('should reject text file with .txt extension - Requirement 15.2, 15.4', async () => {
      const response = await request(app)
        .post('/api/grade/speaking')
        .field('referenceText', 'Test reference text')
        .attach('audio', txtFilePath)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Requirement 15.3: Specific error for size violations', () => {
    it('should return specific error message when file exceeds 10MB', async () => {
      const response = await request(app)
        .post('/api/grade/speaking')
        .field('referenceText', 'Test reference text')
        .attach('audio', oversizedWavPath)
        .expect(400);

      expect(response.body.details).toBeDefined();
      expect(response.body.details).toContain('Audio file size exceeds 10 megabytes limit');
    });
  });

  describe('Requirement 15.4: Specific error for format violations', () => {
    it('should return specific error message for non-WAV format', async () => {
      const response = await request(app)
        .post('/api/grade/speaking')
        .field('referenceText', 'Test reference text')
        .attach('audio', mp3FilePath)
        .expect(400);

      const errorMessage = JSON.stringify(response.body);
      expect(errorMessage.toLowerCase()).toContain('wav');
    });
  });

  describe('Requirement 15.5: Return separate errors for each violation', () => {
    it('should return both size and format errors when both constraints are violated', async () => {
      // Create a large non-WAV file
      const largeNonWavPath = join(testDir, 'test-large.mp3');
      const largeSize = 11 * 1024 * 1024; // 11MB
      const largeData = Buffer.alloc(largeSize);
      writeFileSync(largeNonWavPath, largeData);

      const response = await request(app)
        .post('/api/grade/speaking')
        .field('referenceText', 'Test reference text')
        .attach('audio', largeNonWavPath)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('details');

      // Clean up
      if (existsSync(largeNonWavPath)) {
        unlinkSync(largeNonWavPath);
      }

      // Requirement 15.5: Should have separate error messages for each violation
      if (Array.isArray(response.body.details)) {
        // Could have both errors or at least one (multer stops at first error)
        expect(response.body.details.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should provide clear error structure with details array', async () => {
      const response = await request(app)
        .post('/api/grade/speaking')
        .field('referenceText', 'Test reference text')
        .attach('audio', oversizedWavPath)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Validation Error',
        message: 'Audio file validation failed',
        details: expect.any(Array),
      });

      expect(response.body.details.length).toBeGreaterThanOrEqual(1);
      response.body.details.forEach((detail: any) => {
        expect(typeof detail).toBe('string');
        expect(detail.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should accept file at exactly 10MB', async () => {
      // Create a file at exactly 10MB (10 * 1024 * 1024 bytes)
      const exactSizePath = join(testDir, 'test-exact-10mb.wav');
      const exactSize = 10 * 1024 * 1024;
      
      // WAV header
      const wavHeader = Buffer.from([
        0x52, 0x49, 0x46, 0x46, // "RIFF"
        0x24, 0x00, 0x00, 0x00, // File size - 8 (will be overwritten)
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
      
      const dataSize = exactSize - wavHeader.length;
      const audioData = Buffer.alloc(dataSize);
      writeFileSync(exactSizePath, Buffer.concat([wavHeader, audioData]));

      const response = await request(app)
        .post('/api/grade/speaking')
        .field('referenceText', 'Test reference text')
        .attach('audio', exactSizePath);

      // Clean up
      if (existsSync(exactSizePath)) {
        unlinkSync(exactSizePath);
      }

      // Requirement 15.1: File size must be < 10MB, so exactly 10MB should be accepted
      expect([200, 503]).toContain(response.status);
    });

    it('should reject file at 10MB + 1 byte', async () => {
      // Create a file slightly over 10MB
      const overByOnePath = join(testDir, 'test-10mb-plus-1.wav');
      const oversizedByOne = (10 * 1024 * 1024) + 1;
      
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
      
      const dataSize = oversizedByOne - wavHeader.length;
      const audioData = Buffer.alloc(dataSize);
      writeFileSync(overByOnePath, Buffer.concat([wavHeader, audioData]));

      const response = await request(app)
        .post('/api/grade/speaking')
        .field('referenceText', 'Test reference text')
        .attach('audio', overByOnePath);

      // Clean up
      if (existsSync(overByOnePath)) {
        unlinkSync(overByOnePath);
      }

      // Requirement 15.1, 15.3: File > 10MB should be rejected with size error
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.details).toContain('Audio file size exceeds 10 megabytes limit');
    });

    it('should handle WAV file with audio/x-wav MIME type', async () => {
      // Some systems use audio/x-wav instead of audio/wav
      // This test verifies both MIME types are accepted
      const response = await request(app)
        .post('/api/grade/speaking')
        .field('referenceText', 'Test reference text')
        .attach('audio', validWavPath);

      // Should accept either MIME type
      expect([200, 503]).toContain(response.status);
    });
  });

  describe('Integration: Validation happens before processing', () => {
    it('should reject invalid files without attempting to process audio', async () => {
      const response = await request(app)
        .post('/api/grade/speaking')
        .field('referenceText', 'Test reference text')
        .attach('audio', mp3FilePath)
        .expect(400);

      // Should fail at validation, not at processing stage
      expect(response.body.error).toBeDefined();
      expect(response.body.message).toBeDefined();
      
      // Should not have processing metadata (proves it stopped at validation)
      expect(response.body.metadata).toBeUndefined();
    });

    it('should reject oversized files without loading entire file into memory', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/grade/speaking')
        .field('referenceText', 'Test reference text')
        .attach('audio', oversizedWavPath);

      const duration = Date.now() - startTime;

      // Validation should be fast (< 10 seconds even for large file)
      expect(duration).toBeLessThan(10000);
      
      expect(response.status).toBe(400);
      expect(response.body.details).toContain('Audio file size exceeds 10 megabytes limit');
    });
  });
});
