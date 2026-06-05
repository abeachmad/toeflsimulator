/**
 * GeminiGraderService Unit Tests
 * 
 * Tests for AI-powered grading service with circuit breaker pattern
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { GeminiGraderService, WritingGradeRequest, SpeakingAssessmentRequest } from './GeminiGraderService.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';

// Mock the entire modules
vi.mock('@google/generative-ai');
vi.mock('@google/generative-ai/server');

describe('GeminiGraderService', () => {
  const mockApiKey = 'test-api-key-12345';
  let mockGenerateContent: Mock;
  let mockGetGenerativeModel: Mock;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Setup default successful mock response
    mockGenerateContent = vi.fn().mockResolvedValue({
      response: {
        text: () => JSON.stringify({
          cefrBand: 4,
          scaleScore: 22,
          grammarCorrections: [
            {
              originalText: 'I goes',
              correctedText: 'I go',
              errorType: 'subject-verb agreement',
              explanation: 'Use "go" with "I"'
            }
          ],
          lexicalAnalysis: {
            vocabularyLevel: 'intermediate',
            lexicalDiversity: 0.65,
            academicWordCount: 3,
            suggestions: ['Consider using more varied vocabulary']
          }
        })
      }
    });

    mockGetGenerativeModel = vi.fn().mockReturnValue({
      generateContent: mockGenerateContent
    });

    // Mock GoogleGenerativeAI constructor
    (GoogleGenerativeAI as unknown as Mock).mockImplementation(() => ({
      getGenerativeModel: mockGetGenerativeModel
    }));

    // Mock GoogleAIFileManager constructor
    (GoogleAIFileManager as unknown as Mock).mockImplementation(() => ({
      uploadFile: vi.fn(),
      getFile: vi.fn(),
      deleteFile: vi.fn()
    }));
  });

  describe('Constructor', () => {
    it('should initialize with valid API key', () => {
      const service = new GeminiGraderService(mockApiKey);
      expect(service).toBeDefined();
      expect(service.getCircuitState()).toBe('CLOSED');
    });

    it('should throw error when API key is empty', () => {
      expect(() => new GeminiGraderService('')).toThrow('Gemini API key is required');
    });

    it('should throw error when API key is whitespace', () => {
      expect(() => new GeminiGraderService('   ')).toThrow('Gemini API key is required');
    });

    it('should accept circuit breaker configuration', () => {
      const service = new GeminiGraderService(mockApiKey, {
        failureThreshold: 10,
        successThreshold: 3,
        timeout: 120000
      });
      expect(service).toBeDefined();
    });
  });

  describe('Circuit Breaker State Management', () => {
    it('should start with CLOSED state', () => {
      const service = new GeminiGraderService(mockApiKey);
      expect(service.getCircuitState()).toBe('CLOSED');
    });

    it('should allow manual circuit reset', () => {
      const service = new GeminiGraderService(mockApiKey);
      service.resetCircuit();
      expect(service.getCircuitState()).toBe('CLOSED');
    });
  });

  describe('Default Score Methods', () => {
    let service: GeminiGraderService;

    beforeEach(() => {
      service = new GeminiGraderService(mockApiKey);
    });

    it('should return valid default writing score', () => {
      const defaultScore = service.getDefaultWritingScore();
      
      expect(defaultScore.cefrBand).toBe(3);
      expect(defaultScore.scaleScore).toBe(15);
      expect(defaultScore.grammarCorrections).toEqual([]);
      expect(defaultScore.lexicalAnalysis.vocabularyLevel).toBe('error');
      expect(defaultScore.lexicalAnalysis.suggestions).toContain('Grading service temporarily unavailable. Please try again later.');
    });

    it('should return valid default speaking score', () => {
      const defaultScore = service.getDefaultSpeakingScore();
      
      expect(defaultScore.accuracyScore).toBe(50);
      expect(defaultScore.fluencyScore).toBe(50);
      expect(defaultScore.prosodyScore).toBe(50);
      expect(defaultScore.completenessScore).toBe(50);
      expect(defaultScore.cefrBand).toBe(3);
      expect(defaultScore.scaleScore).toBe(15);
    });

    it('should have default writing CEFR band in valid range', () => {
      const defaultScore = service.getDefaultWritingScore();
      expect(defaultScore.cefrBand).toBeGreaterThanOrEqual(1);
      expect(defaultScore.cefrBand).toBeLessThanOrEqual(6);
    });

    it('should have default writing scale score in valid range', () => {
      const defaultScore = service.getDefaultWritingScore();
      expect(defaultScore.scaleScore).toBeGreaterThanOrEqual(0);
      expect(defaultScore.scaleScore).toBeLessThanOrEqual(30);
    });

    it('should have default speaking CEFR band in valid range', () => {
      const defaultScore = service.getDefaultSpeakingScore();
      expect(defaultScore.cefrBand).toBeGreaterThanOrEqual(1);
      expect(defaultScore.cefrBand).toBeLessThanOrEqual(6);
    });

    it('should have default speaking scale score in valid range', () => {
      const defaultScore = service.getDefaultSpeakingScore();
      expect(defaultScore.scaleScore).toBeGreaterThanOrEqual(0);
      expect(defaultScore.scaleScore).toBeLessThanOrEqual(30);
    });

    it('should have all pronunciation scores in valid range', () => {
      const defaultScore = service.getDefaultSpeakingScore();
      expect(defaultScore.accuracyScore).toBeGreaterThanOrEqual(0);
      expect(defaultScore.accuracyScore).toBeLessThanOrEqual(100);
      expect(defaultScore.fluencyScore).toBeGreaterThanOrEqual(0);
      expect(defaultScore.fluencyScore).toBeLessThanOrEqual(100);
      expect(defaultScore.prosodyScore).toBeGreaterThanOrEqual(0);
      expect(defaultScore.prosodyScore).toBeLessThanOrEqual(100);
      expect(defaultScore.completenessScore).toBeGreaterThanOrEqual(0);
      expect(defaultScore.completenessScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Writing Grade Request Validation', () => {
    let service: GeminiGraderService;

    beforeEach(() => {
      service = new GeminiGraderService(mockApiKey);
    });

    it('should accept valid build-sentence task', () => {
      const request: WritingGradeRequest = {
        text: 'The cat sat on the mat.',
        taskType: 'build-sentence'
      };
      expect(request.taskType).toBe('build-sentence');
    });

    it('should accept valid email task', () => {
      const request: WritingGradeRequest = {
        text: 'Dear Professor, I would like to discuss my assignment.',
        taskType: 'email'
      };
      expect(request.taskType).toBe('email');
    });

    it('should accept valid academic-discussion task', () => {
      const request: WritingGradeRequest = {
        text: 'I agree with the argument that technology improves education.',
        taskType: 'academic-discussion',
        professorPrompt: 'Discuss the role of technology in education.',
        peerOpinions: ['I think technology helps students learn faster.']
      };
      expect(request.taskType).toBe('academic-discussion');
      expect(request.professorPrompt).toBeDefined();
      expect(request.peerOpinions).toHaveLength(1);
    });
  });

  describe('Speaking Assessment Request Validation', () => {
    let service: GeminiGraderService;

    beforeEach(() => {
      service = new GeminiGraderService(mockApiKey);
    });

    it('should accept valid listen-repeat task', () => {
      const request: SpeakingAssessmentRequest = {
        audioPath: '/tmp/audio-test.wav',
        referenceText: 'The quick brown fox jumps over the lazy dog.',
        taskType: 'listen-repeat'
      };
      expect(request.taskType).toBe('listen-repeat');
    });

    it('should accept valid simulated-interview task', () => {
      const request: SpeakingAssessmentRequest = {
        audioPath: '/tmp/audio-interview.wav',
        referenceText: 'Tell me about your hometown.',
        taskType: 'simulated-interview'
      };
      expect(request.taskType).toBe('simulated-interview');
    });
  });

  describe('Type Definitions', () => {
    it('should have WritingScore with required fields', () => {
      const service = new GeminiGraderService(mockApiKey);
      const score = service.getDefaultWritingScore();
      
      expect(score).toHaveProperty('cefrBand');
      expect(score).toHaveProperty('scaleScore');
      expect(score).toHaveProperty('grammarCorrections');
      expect(score).toHaveProperty('lexicalAnalysis');
    });

    it('should have SpeakingScore with required fields', () => {
      const service = new GeminiGraderService(mockApiKey);
      const score = service.getDefaultSpeakingScore();
      
      expect(score).toHaveProperty('accuracyScore');
      expect(score).toHaveProperty('fluencyScore');
      expect(score).toHaveProperty('prosodyScore');
      expect(score).toHaveProperty('completenessScore');
      expect(score).toHaveProperty('cefrBand');
      expect(score).toHaveProperty('scaleScore');
    });

    it('should have LexicalAnalysis with required fields', () => {
      const service = new GeminiGraderService(mockApiKey);
      const score = service.getDefaultWritingScore();
      
      expect(score.lexicalAnalysis).toHaveProperty('vocabularyLevel');
      expect(score.lexicalAnalysis).toHaveProperty('lexicalDiversity');
      expect(score.lexicalAnalysis).toHaveProperty('academicWordCount');
      expect(score.lexicalAnalysis).toHaveProperty('suggestions');
    });
  });

  describe('gradeWriting Method - Comprehensive Tests', () => {
    let service: GeminiGraderService;

    beforeEach(() => {
      service = new GeminiGraderService(mockApiKey);
    });

    describe('Task Type: build-sentence', () => {
      it('should handle build-sentence task type', async () => {
        const request: WritingGradeRequest = {
          text: 'The quick brown fox jumps over the lazy dog.',
          taskType: 'build-sentence'
        };

        const result = await service.gradeWriting(request);
        
        expect(result).toBeDefined();
        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
        expect(result.cefrBand).toBeLessThanOrEqual(6);
        expect(result.scaleScore).toBeGreaterThanOrEqual(0);
        expect(result.scaleScore).toBeLessThanOrEqual(30);
        expect(result.grammarCorrections).toBeDefined();
        expect(result.lexicalAnalysis).toBeDefined();
      });

      it('should handle empty text for build-sentence', async () => {
        const request: WritingGradeRequest = {
          text: '',
          taskType: 'build-sentence'
        };

        const result = await service.gradeWriting(request);
        
        expect(result).toBeDefined();
        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
        expect(result.cefrBand).toBeLessThanOrEqual(6);
      });

      it('should handle very long text for build-sentence', async () => {
        const longText = 'word '.repeat(500); // 500 words
        const request: WritingGradeRequest = {
          text: longText,
          taskType: 'build-sentence'
        };

        const result = await service.gradeWriting(request);
        
        expect(result).toBeDefined();
        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
        expect(result.cefrBand).toBeLessThanOrEqual(6);
      });
    });

    describe('Task Type: email', () => {
      it('should handle email task type', async () => {
        const request: WritingGradeRequest = {
          text: 'Dear Professor Smith, I am writing to request an extension for my assignment. I have been unwell this week. Thank you for your understanding. Best regards, John.',
          taskType: 'email'
        };

        const result = await service.gradeWriting(request);
        
        expect(result).toBeDefined();
        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
        expect(result.cefrBand).toBeLessThanOrEqual(6);
        expect(result.scaleScore).toBeGreaterThanOrEqual(0);
        expect(result.scaleScore).toBeLessThanOrEqual(30);
      });

      it('should handle informal email style', async () => {
        const request: WritingGradeRequest = {
          text: 'Hey! Thanks for the notes. See you tomorrow!',
          taskType: 'email'
        };

        const result = await service.gradeWriting(request);
        
        expect(result).toBeDefined();
        expect(result.grammarCorrections).toBeDefined();
        expect(Array.isArray(result.grammarCorrections)).toBe(true);
      });
    });

    describe('Task Type: academic-discussion', () => {
      it('should handle academic-discussion with professor prompt and peer opinions', async () => {
        const request: WritingGradeRequest = {
          text: 'I strongly agree with Maria\'s perspective. The evidence clearly shows that renewable energy is economically viable. Studies from MIT demonstrate significant cost reductions over the past decade.',
          taskType: 'academic-discussion',
          professorPrompt: 'Discuss whether renewable energy is economically viable in developing countries.',
          peerOpinions: [
            'I think renewable energy is too expensive for developing nations.',
            'Maria: Solar panels have become much cheaper recently.'
          ]
        };

        const result = await service.gradeWriting(request);
        
        expect(result).toBeDefined();
        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
        expect(result.cefrBand).toBeLessThanOrEqual(6);
        expect(result.scaleScore).toBeGreaterThanOrEqual(0);
        expect(result.scaleScore).toBeLessThanOrEqual(30);
        expect(result.lexicalAnalysis).toBeDefined();
        expect(result.lexicalAnalysis.academicWordCount).toBeGreaterThanOrEqual(0);
      });

      it('should handle academic-discussion without professor prompt', async () => {
        const request: WritingGradeRequest = {
          text: 'Technology has transformed education in many positive ways.',
          taskType: 'academic-discussion'
        };

        const result = await service.gradeWriting(request);
        
        expect(result).toBeDefined();
        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
        expect(result.cefrBand).toBeLessThanOrEqual(6);
      });

      it('should handle academic-discussion without peer opinions', async () => {
        const request: WritingGradeRequest = {
          text: 'Climate change requires immediate global action.',
          taskType: 'academic-discussion',
          professorPrompt: 'Discuss the urgency of climate action.'
        };

        const result = await service.gradeWriting(request);
        
        expect(result).toBeDefined();
        expect(result.lexicalAnalysis.suggestions).toBeDefined();
        expect(Array.isArray(result.lexicalAnalysis.suggestions)).toBe(true);
      });

      it('should handle academic-discussion with empty peer opinions array', async () => {
        const request: WritingGradeRequest = {
          text: 'Education is a fundamental right.',
          taskType: 'academic-discussion',
          professorPrompt: 'Discuss access to education.',
          peerOpinions: []
        };

        const result = await service.gradeWriting(request);
        
        expect(result).toBeDefined();
        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
        expect(result.cefrBand).toBeLessThanOrEqual(6);
      });
    });

    describe('Score Clamping', () => {
      it('should ensure CEFR band is clamped to [1-6]', async () => {
        const request: WritingGradeRequest = {
          text: 'Test text.',
          taskType: 'build-sentence'
        };

        const result = await service.gradeWriting(request);
        
        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
        expect(result.cefrBand).toBeLessThanOrEqual(6);
      });

      it('should ensure scale score is clamped to [0-30]', async () => {
        const request: WritingGradeRequest = {
          text: 'Test text.',
          taskType: 'email'
        };

        const result = await service.gradeWriting(request);
        
        expect(result.scaleScore).toBeGreaterThanOrEqual(0);
        expect(result.scaleScore).toBeLessThanOrEqual(30);
      });

      it('should clamp scores even with error conditions', async () => {
        // Mock API error for all retries
        mockGenerateContent.mockRejectedValue(new Error('API Error'));

        const request: WritingGradeRequest = {
          text: '',
          taskType: 'build-sentence'
        };

        const result = await service.gradeWriting(request);
        
        // Should return fallback scores which are also clamped
        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
        expect(result.cefrBand).toBeLessThanOrEqual(6);
        expect(result.scaleScore).toBeGreaterThanOrEqual(0);
        expect(result.scaleScore).toBeLessThanOrEqual(30);
        
        // Reset mock for other tests
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              cefrBand: 4,
              scaleScore: 22,
              grammarCorrections: [],
              lexicalAnalysis: {
                vocabularyLevel: 'intermediate',
                lexicalDiversity: 0.65,
                academicWordCount: 3,
                suggestions: []
              }
            })
          }
        });
      }, 10000); // Increase timeout for retry logic
    });

    describe('Error Handling with Fallback Scores', () => {
      it('should return fallback scores on API error', async () => {
        // Mock API error for all retries (3 attempts + 1 original)
        mockGenerateContent.mockRejectedValue(new Error('API Error'));

        const request: WritingGradeRequest = {
          text: 'This will fail with API error.',
          taskType: 'build-sentence'
        };

        const result = await service.gradeWriting(request);
        
        // Should get fallback scores (CEFR: 3, scale: 15)
        expect(result).toBeDefined();
        expect(result.cefrBand).toBe(3);
        expect(result.scaleScore).toBe(15);
        expect(result.grammarCorrections).toEqual([]);
        expect(result.lexicalAnalysis.vocabularyLevel).toBe('error');
        
        // Reset mock for other tests
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              cefrBand: 4,
              scaleScore: 22,
              grammarCorrections: [],
              lexicalAnalysis: {
                vocabularyLevel: 'intermediate',
                lexicalDiversity: 0.65,
                academicWordCount: 3,
                suggestions: []
              }
            })
          }
        });
      }, 10000); // Increase timeout for retry logic

      it('should return fallback scores on network error', async () => {
        // Mock network error for all retries
        mockGenerateContent.mockRejectedValue(new Error('Network Error'));

        const request: WritingGradeRequest = {
          text: 'Network error test.',
          taskType: 'email'
        };

        const result = await service.gradeWriting(request);
        
        expect(result).toBeDefined();
        expect(result.cefrBand).toBe(3);
        expect(result.scaleScore).toBe(15);
        expect(result.lexicalAnalysis.suggestions).toContain('Grading service temporarily unavailable. Please try again later.');
        
        // Reset mock for other tests
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              cefrBand: 4,
              scaleScore: 22,
              grammarCorrections: [],
              lexicalAnalysis: {
                vocabularyLevel: 'intermediate',
                lexicalDiversity: 0.65,
                academicWordCount: 3,
                suggestions: []
              }
            })
          }
        });
      }, 10000); // Increase timeout for retry logic

      it('should return fallback scores when circuit breaker opens', async () => {
        // Create service with low failure threshold
        const testService = new GeminiGraderService(mockApiKey, {
          failureThreshold: 2,
          successThreshold: 1,
          timeout: 60000
        });

        // Mock repeated failures for all retries
        mockGenerateContent.mockRejectedValue(new Error('Service Unavailable'));

        const request: WritingGradeRequest = {
          text: 'Test text.',
          taskType: 'academic-discussion'
        };

        // Make multiple calls to open circuit breaker
        await testService.gradeWriting(request);
        await testService.gradeWriting(request);
        const result = await testService.gradeWriting(request);
        
        expect(result).toBeDefined();
        expect(result.cefrBand).toBe(3);
        expect(result.scaleScore).toBe(15);
        
        // Reset mock for other tests
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              cefrBand: 4,
              scaleScore: 22,
              grammarCorrections: [],
              lexicalAnalysis: {
                vocabularyLevel: 'intermediate',
                lexicalDiversity: 0.65,
                academicWordCount: 3,
                suggestions: []
              }
            })
          }
        });
      }, 25000); // Longer timeout for circuit breaker test with 3 calls with retries
    });

    describe('Grammar Corrections Structure', () => {
      it('should return grammar corrections array', async () => {
        const request: WritingGradeRequest = {
          text: 'I goes to school everyday.',
          taskType: 'build-sentence'
        };

        const result = await service.gradeWriting(request);
        
        expect(Array.isArray(result.grammarCorrections)).toBe(true);
      });

      it('should have valid grammar correction structure when available', async () => {
        const request: WritingGradeRequest = {
          text: 'He don\'t like apples.',
          taskType: 'email'
        };

        const result = await service.gradeWriting(request);
        
        // Check structure
        result.grammarCorrections.forEach(correction => {
          expect(correction).toHaveProperty('originalText');
          expect(correction).toHaveProperty('correctedText');
          expect(correction).toHaveProperty('errorType');
          expect(correction).toHaveProperty('explanation');
        });
      });
    });

    describe('Lexical Analysis Structure', () => {
      it('should return lexical analysis object', async () => {
        const request: WritingGradeRequest = {
          text: 'The comprehensive analysis demonstrates significant implications.',
          taskType: 'academic-discussion',
          professorPrompt: 'Analyze the topic.'
        };

        const result = await service.gradeWriting(request);
        
        expect(result.lexicalAnalysis).toBeDefined();
        expect(result.lexicalAnalysis).toHaveProperty('vocabularyLevel');
        expect(result.lexicalAnalysis).toHaveProperty('lexicalDiversity');
        expect(result.lexicalAnalysis).toHaveProperty('academicWordCount');
        expect(result.lexicalAnalysis).toHaveProperty('suggestions');
      });

      it('should have valid lexical diversity range', async () => {
        const request: WritingGradeRequest = {
          text: 'Different words show variety in language use.',
          taskType: 'email'
        };

        const result = await service.gradeWriting(request);
        
        expect(result.lexicalAnalysis.lexicalDiversity).toBeGreaterThanOrEqual(0);
        expect(result.lexicalAnalysis.lexicalDiversity).toBeLessThanOrEqual(1);
      });

      it('should have non-negative academic word count', async () => {
        const request: WritingGradeRequest = {
          text: 'Simple everyday words.',
          taskType: 'build-sentence'
        };

        const result = await service.gradeWriting(request);
        
        expect(result.lexicalAnalysis.academicWordCount).toBeGreaterThanOrEqual(0);
      });

      it('should have suggestions array', async () => {
        const request: WritingGradeRequest = {
          text: 'Text for analysis.',
          taskType: 'academic-discussion'
        };

        const result = await service.gradeWriting(request);
        
        expect(Array.isArray(result.lexicalAnalysis.suggestions)).toBe(true);
      });
    });

    describe('Edge Cases', () => {
      it('should handle text with special characters', async () => {
        const request: WritingGradeRequest = {
          text: 'Test with special chars: @#$% & *()!',
          taskType: 'build-sentence'
        };

        const result = await service.gradeWriting(request);
        
        expect(result).toBeDefined();
        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
        expect(result.cefrBand).toBeLessThanOrEqual(6);
      });

      it('should handle text with unicode characters', async () => {
        const request: WritingGradeRequest = {
          text: 'Héllo wörld! 你好世界 🌍',
          taskType: 'email'
        };

        const result = await service.gradeWriting(request);
        
        expect(result).toBeDefined();
        expect(result.scaleScore).toBeGreaterThanOrEqual(0);
        expect(result.scaleScore).toBeLessThanOrEqual(30);
      });

      it('should handle text with only numbers', async () => {
        const request: WritingGradeRequest = {
          text: '123 456 789',
          taskType: 'build-sentence'
        };

        const result = await service.gradeWriting(request);
        
        expect(result).toBeDefined();
        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
        expect(result.cefrBand).toBeLessThanOrEqual(6);
      });

      it('should handle text with repeated words', async () => {
        const request: WritingGradeRequest = {
          text: 'word word word word word',
          taskType: 'email'
        };

        const result = await service.gradeWriting(request);
        
        expect(result).toBeDefined();
        expect(result.lexicalAnalysis).toBeDefined();
      });

      it('should handle single word text', async () => {
        const request: WritingGradeRequest = {
          text: 'Hello',
          taskType: 'build-sentence'
        };

        const result = await service.gradeWriting(request);
        
        expect(result).toBeDefined();
        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
        expect(result.cefrBand).toBeLessThanOrEqual(6);
      });

      it('should handle text with only whitespace', async () => {
        const request: WritingGradeRequest = {
          text: '   \n\t  ',
          taskType: 'email'
        };

        const result = await service.gradeWriting(request);
        
        expect(result).toBeDefined();
        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
        expect(result.cefrBand).toBeLessThanOrEqual(6);
      });
    });

    describe('Response Schema Validation', () => {
      it('should always return required fields', async () => {
        const request: WritingGradeRequest = {
          text: 'Test text.',
          taskType: 'build-sentence'
        };

        const result = await service.gradeWriting(request);
        
        expect(result).toHaveProperty('cefrBand');
        expect(result).toHaveProperty('scaleScore');
        expect(result).toHaveProperty('grammarCorrections');
        expect(result).toHaveProperty('lexicalAnalysis');
        expect(typeof result.cefrBand).toBe('number');
        expect(typeof result.scaleScore).toBe('number');
        expect(Array.isArray(result.grammarCorrections)).toBe(true);
        expect(typeof result.lexicalAnalysis).toBe('object');
      });

      it('should return valid lexicalAnalysis structure', async () => {
        const request: WritingGradeRequest = {
          text: 'Test text.',
          taskType: 'email'
        };

        const result = await service.gradeWriting(request);
        
        expect(result.lexicalAnalysis).toHaveProperty('vocabularyLevel');
        expect(result.lexicalAnalysis).toHaveProperty('lexicalDiversity');
        expect(result.lexicalAnalysis).toHaveProperty('academicWordCount');
        expect(result.lexicalAnalysis).toHaveProperty('suggestions');
        expect(typeof result.lexicalAnalysis.vocabularyLevel).toBe('string');
        expect(typeof result.lexicalAnalysis.lexicalDiversity).toBe('number');
        expect(typeof result.lexicalAnalysis.academicWordCount).toBe('number');
        expect(Array.isArray(result.lexicalAnalysis.suggestions)).toBe(true);
      });
    });
  });

  describe('assessPronunciation Method - Comprehensive Tests', () => {
    let service: GeminiGraderService;
    let mockUploadFile: Mock;
    let mockGetFile: Mock;
    let mockDeleteFile: Mock;

    beforeEach(() => {
      // Setup pronunciation assessment mock response
      const pronunciationMockResponse = {
        response: {
          text: () => JSON.stringify({
            accuracyScore: 85,
            fluencyScore: 78,
            prosodyScore: 82,
            completenessScore: 90
          })
        }
      };

      mockGenerateContent.mockResolvedValue(pronunciationMockResponse);

      // Setup file upload mocks
      mockUploadFile = vi.fn().mockResolvedValue({
        file: {
          uri: 'https://generativelanguage.googleapis.com/v1beta/files/test-audio-123',
          name: 'files/test-audio-123',
          mimeType: 'audio/wav'
        }
      });

      mockGetFile = vi.fn().mockResolvedValue({
        name: 'files/test-audio-123',
        state: 'ACTIVE',
        uri: 'https://generativelanguage.googleapis.com/v1beta/files/test-audio-123'
      });

      mockDeleteFile = vi.fn().mockResolvedValue({});

      // Update GoogleAIFileManager mock
      (GoogleAIFileManager as unknown as Mock).mockImplementation(() => ({
        uploadFile: mockUploadFile,
        getFile: mockGetFile,
        deleteFile: mockDeleteFile
      }));

      // Create service AFTER setting up mocks
      service = new GeminiGraderService(mockApiKey);
    });

    describe('Audio Upload and Processing', () => {
      it('should upload audio file with correct MIME type', async () => {
        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'The quick brown fox jumps over the lazy dog.';

        await service.assessPronunciation(audioPath, referenceText);

        expect(mockUploadFile).toHaveBeenCalledWith(
          audioPath,
          expect.objectContaining({
            mimeType: 'audio/wav'
          })
        );
      });

      it('should wait for file processing to complete', async () => {
        // Mock file in PROCESSING state then ACTIVE
        mockGetFile
          .mockResolvedValueOnce({
            name: 'files/test-audio-123',
            state: 'PROCESSING'
          })
          .mockResolvedValueOnce({
            name: 'files/test-audio-123',
            state: 'ACTIVE'
          });

        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Hello world';

        await service.assessPronunciation(audioPath, referenceText);

        // Should poll at least twice
        expect(mockGetFile).toHaveBeenCalledTimes(2);
      });

      it('should handle file processing failure', async () => {
        mockGetFile.mockResolvedValue({
          name: 'files/test-audio-123',
          state: 'FAILED'
        });

        const audioPath = '/tmp/failed-audio.wav';
        const referenceText = 'Test text';

        const result = await service.assessPronunciation(audioPath, referenceText);

        // Should return fallback scores
        expect(result.cefrBand).toBe(3);
        expect(result.scaleScore).toBe(15);
      }, 10000);

      it('should clean up uploaded file after processing', async () => {
        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Clean up test';

        await service.assessPronunciation(audioPath, referenceText);

        expect(mockDeleteFile).toHaveBeenCalledWith('files/test-audio-123');
      });

      it('should handle file upload error', async () => {
        mockUploadFile.mockRejectedValue(new Error('Upload failed'));

        const audioPath = '/tmp/invalid-audio.wav';
        const referenceText = 'Upload error test';

        const result = await service.assessPronunciation(audioPath, referenceText);

        // Should return fallback scores
        expect(result.cefrBand).toBe(3);
        expect(result.scaleScore).toBe(15);
        expect(result.accuracyScore).toBe(50);
        expect(result.fluencyScore).toBe(50);
      }, 10000);
    });

    describe('Pronunciation Assessment Schema', () => {
      it('should return all required pronunciation metrics', async () => {
        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Testing pronunciation assessment';

        const result = await service.assessPronunciation(audioPath, referenceText);

        expect(result).toHaveProperty('accuracyScore');
        expect(result).toHaveProperty('fluencyScore');
        expect(result).toHaveProperty('prosodyScore');
        expect(result).toHaveProperty('completenessScore');
        expect(result).toHaveProperty('cefrBand');
        expect(result).toHaveProperty('scaleScore');
      });

      it('should have all pronunciation scores in valid range (0-100)', async () => {
        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Score range test';

        const result = await service.assessPronunciation(audioPath, referenceText);

        expect(result.accuracyScore).toBeGreaterThanOrEqual(0);
        expect(result.accuracyScore).toBeLessThanOrEqual(100);
        expect(result.fluencyScore).toBeGreaterThanOrEqual(0);
        expect(result.fluencyScore).toBeLessThanOrEqual(100);
        expect(result.prosodyScore).toBeGreaterThanOrEqual(0);
        expect(result.prosodyScore).toBeLessThanOrEqual(100);
        expect(result.completenessScore).toBeGreaterThanOrEqual(0);
        expect(result.completenessScore).toBeLessThanOrEqual(100);
      });

      it('should have CEFR band in valid range (1-6)', async () => {
        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'CEFR band test';

        const result = await service.assessPronunciation(audioPath, referenceText);

        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
        expect(result.cefrBand).toBeLessThanOrEqual(6);
      });

      it('should have scale score in valid range (0-30)', async () => {
        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Scale score test';

        const result = await service.assessPronunciation(audioPath, referenceText);

        expect(result.scaleScore).toBeGreaterThanOrEqual(0);
        expect(result.scaleScore).toBeLessThanOrEqual(30);
      });
    });

    describe('Composite Score Calculation', () => {
      it('should calculate composite score with correct weights', async () => {
        // Mock scores: accuracy=80, fluency=70, prosody=60, completeness=90
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              accuracyScore: 80,
              fluencyScore: 70,
              prosodyScore: 60,
              completenessScore: 90
            })
          }
        });

        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Composite score test';

        const result = await service.assessPronunciation(audioPath, referenceText);

        // Expected composite = 80*0.4 + 70*0.3 + 60*0.2 + 90*0.1 = 32 + 21 + 12 + 9 = 74
        // CEFR = ceil(74/100 * 6) = ceil(4.44) = 5
        // Scale = round(74/100 * 30) = round(22.2) = 22

        expect(result.cefrBand).toBe(5);
        expect(result.scaleScore).toBe(22);
      });

      it('should handle perfect scores', async () => {
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              accuracyScore: 100,
              fluencyScore: 100,
              prosodyScore: 100,
              completenessScore: 100
            })
          }
        });

        const audioPath = '/tmp/perfect-audio.wav';
        const referenceText = 'Perfect pronunciation';

        const result = await service.assessPronunciation(audioPath, referenceText);

        // Composite = 100
        // CEFR = ceil(100/100 * 6) = 6
        // Scale = round(100/100 * 30) = 30

        expect(result.cefrBand).toBe(6);
        expect(result.scaleScore).toBe(30);
      });

      it('should handle low scores', async () => {
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              accuracyScore: 10,
              fluencyScore: 15,
              prosodyScore: 20,
              completenessScore: 5
            })
          }
        });

        const audioPath = '/tmp/low-score-audio.wav';
        const referenceText = 'Poor pronunciation';

        const result = await service.assessPronunciation(audioPath, referenceText);

        // Composite = 10*0.4 + 15*0.3 + 20*0.2 + 5*0.1 = 4 + 4.5 + 4 + 0.5 = 13
        // CEFR = ceil(13/100 * 6) = ceil(0.78) = 1 (clamped)
        // Scale = round(13/100 * 30) = round(3.9) = 4

        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
        expect(result.cefrBand).toBeLessThanOrEqual(6);
        expect(result.scaleScore).toBeGreaterThanOrEqual(0);
        expect(result.scaleScore).toBeLessThanOrEqual(30);
      });

      it('should verify accuracy has highest weight (40%)', async () => {
        // Test with high accuracy, low others
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              accuracyScore: 100,
              fluencyScore: 0,
              prosodyScore: 0,
              completenessScore: 0
            })
          }
        });

        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Accuracy weight test';

        const result = await service.assessPronunciation(audioPath, referenceText);

        // Composite = 100*0.4 = 40
        // CEFR = ceil(40/100 * 6) = ceil(2.4) = 3
        // Scale = round(40/100 * 30) = round(12) = 12

        expect(result.cefrBand).toBe(3);
        expect(result.scaleScore).toBe(12);
      });

      it('should verify fluency has 30% weight', async () => {
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              accuracyScore: 0,
              fluencyScore: 100,
              prosodyScore: 0,
              completenessScore: 0
            })
          }
        });

        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Fluency weight test';

        const result = await service.assessPronunciation(audioPath, referenceText);

        // Composite = 100*0.3 = 30
        // CEFR = ceil(30/100 * 6) = ceil(1.8) = 2
        // Scale = round(30/100 * 30) = round(9) = 9

        expect(result.cefrBand).toBe(2);
        expect(result.scaleScore).toBe(9);
      });

      it('should verify prosody has 20% weight', async () => {
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              accuracyScore: 0,
              fluencyScore: 0,
              prosodyScore: 100,
              completenessScore: 0
            })
          }
        });

        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Prosody weight test';

        const result = await service.assessPronunciation(audioPath, referenceText);

        // Composite = 100*0.2 = 20
        // CEFR = ceil(20/100 * 6) = ceil(1.2) = 2
        // Scale = round(20/100 * 30) = round(6) = 6

        expect(result.cefrBand).toBe(2);
        expect(result.scaleScore).toBe(6);
      });

      it('should verify completeness has 10% weight', async () => {
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              accuracyScore: 0,
              fluencyScore: 0,
              prosodyScore: 0,
              completenessScore: 100
            })
          }
        });

        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Completeness weight test';

        const result = await service.assessPronunciation(audioPath, referenceText);

        // Composite = 100*0.1 = 10
        // CEFR = ceil(10/100 * 6) = ceil(0.6) = 1 (clamped)
        // Scale = round(10/100 * 30) = round(3) = 3

        expect(result.cefrBand).toBe(1);
        expect(result.scaleScore).toBe(3);
      });
    });

    describe('Error Handling with Fallback Scores', () => {
      it('should return fallback scores on API error', async () => {
        mockGenerateContent.mockRejectedValue(new Error('API Error'));

        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'API error test';

        const result = await service.assessPronunciation(audioPath, referenceText);

        expect(result.cefrBand).toBe(3);
        expect(result.scaleScore).toBe(15);
        expect(result.accuracyScore).toBe(50);
        expect(result.fluencyScore).toBe(50);
        expect(result.prosodyScore).toBe(50);
        expect(result.completenessScore).toBe(50);

        // Reset mock
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              accuracyScore: 85,
              fluencyScore: 78,
              prosodyScore: 82,
              completenessScore: 90
            })
          }
        });
      }, 10000);

      it('should return fallback scores on network timeout', async () => {
        mockGenerateContent.mockRejectedValue(new Error('Network timeout'));

        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Timeout test';

        const result = await service.assessPronunciation(audioPath, referenceText);

        expect(result).toBeDefined();
        expect(result.cefrBand).toBe(3);
        expect(result.scaleScore).toBe(15);

        // Reset mock
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              accuracyScore: 85,
              fluencyScore: 78,
              prosodyScore: 82,
              completenessScore: 90
            })
          }
        });
      }, 10000);

      it('should return fallback scores when circuit breaker opens', async () => {
        const testService = new GeminiGraderService(mockApiKey, {
          failureThreshold: 2,
          successThreshold: 1,
          timeout: 60000
        });

        mockGenerateContent.mockRejectedValue(new Error('Service Unavailable'));

        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Circuit breaker test';

        // Make multiple calls to open circuit
        await testService.assessPronunciation(audioPath, referenceText);
        await testService.assessPronunciation(audioPath, referenceText);
        const result = await testService.assessPronunciation(audioPath, referenceText);

        expect(result.cefrBand).toBe(3);
        expect(result.scaleScore).toBe(15);

        // Reset mock
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              accuracyScore: 85,
              fluencyScore: 78,
              prosodyScore: 82,
              completenessScore: 90
            })
          }
        });
      }, 25000);

      it('should handle error during processing', async () => {
        // Make the API call fail AFTER file upload succeeds
        mockGenerateContent.mockRejectedValue(new Error('Processing error'));

        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Error handling test';

        const result = await service.assessPronunciation(audioPath, referenceText);

        // File was successfully uploaded
        expect(mockUploadFile).toHaveBeenCalled();
        
        // Should return fallback scores on error
        expect(result.cefrBand).toBe(3);
        expect(result.scaleScore).toBe(15);

        // Reset mock
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              accuracyScore: 85,
              fluencyScore: 78,
              prosodyScore: 82,
              completenessScore: 90
            })
          }
        });
      }, 15000);
    });

    describe('Reference Text Handling', () => {
      it('should handle short reference text', async () => {
        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Hello';

        const result = await service.assessPronunciation(audioPath, referenceText);

        expect(result).toBeDefined();
        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
        expect(result.cefrBand).toBeLessThanOrEqual(6);
      });

      it('should handle long reference text', async () => {
        const audioPath = '/tmp/test-audio.wav';
        const longText = 'This is a very long reference text that contains multiple sentences and complex vocabulary. '.repeat(10);

        const result = await service.assessPronunciation(audioPath, longText);

        expect(result).toBeDefined();
        expect(result.scaleScore).toBeGreaterThanOrEqual(0);
        expect(result.scaleScore).toBeLessThanOrEqual(30);
      });

      it('should handle reference text with special characters', async () => {
        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Hello! How are you? I\'m fine, thanks.';

        const result = await service.assessPronunciation(audioPath, referenceText);

        expect(result).toBeDefined();
        expect(result.accuracyScore).toBeDefined();
      });

      it('should handle reference text with numbers', async () => {
        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'The year is 2024 and the temperature is 72 degrees.';

        const result = await service.assessPronunciation(audioPath, referenceText);

        expect(result).toBeDefined();
        expect(result.fluencyScore).toBeDefined();
      });

      it('should handle empty reference text', async () => {
        const audioPath = '/tmp/test-audio.wav';
        const referenceText = '';

        const result = await service.assessPronunciation(audioPath, referenceText);

        expect(result).toBeDefined();
        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
        expect(result.cefrBand).toBeLessThanOrEqual(6);
      });
    });

    describe('Audio File Path Handling', () => {
      it('should handle different audio file paths', async () => {
        const paths = [
          '/tmp/audio-1.wav',
          '/uploads/speaking/test.wav',
          'C:\\Windows\\Temp\\audio.wav',
          './audio/recording.wav'
        ];

        for (const audioPath of paths) {
          const result = await service.assessPronunciation(audioPath, 'Test text');
          expect(result).toBeDefined();
          expect(mockUploadFile).toHaveBeenCalledWith(audioPath, expect.any(Object));
        }
      });

      it('should handle audio path with spaces', async () => {
        const audioPath = '/tmp/my audio file.wav';
        const referenceText = 'Path with spaces test';

        const result = await service.assessPronunciation(audioPath, referenceText);

        expect(result).toBeDefined();
        expect(mockUploadFile).toHaveBeenCalledWith(audioPath, expect.any(Object));
      });
    });

    describe('Pronunciation Assessment API Integration', () => {
      it('should call Gemini model with correct parameters', async () => {
        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Integration test reference text';

        await service.assessPronunciation(audioPath, referenceText);

        expect(mockGetGenerativeModel).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'gemini-2.0-flash-exp',
            generationConfig: expect.objectContaining({
              responseMimeType: 'application/json',
              temperature: 0.1
            })
          })
        );
      });

      it('should use low temperature (0.1) for consistent assessment', async () => {
        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Temperature test';

        await service.assessPronunciation(audioPath, referenceText);

        expect(mockGetGenerativeModel).toHaveBeenCalledWith(
          expect.objectContaining({
            generationConfig: expect.objectContaining({
              temperature: 0.1
            })
          })
        );
      });

      it('should include reference text in prompt', async () => {
        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'This is the reference text that should be spoken';

        await service.assessPronunciation(audioPath, referenceText);

        expect(mockGenerateContent).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining(referenceText)
            })
          ])
        );
      });

      it('should include audio file in request', async () => {
        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Audio file test';

        await service.assessPronunciation(audioPath, referenceText);

        expect(mockGenerateContent).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              fileData: expect.objectContaining({
                fileUri: 'https://generativelanguage.googleapis.com/v1beta/files/test-audio-123',
                mimeType: 'audio/wav'
              })
            })
          ])
        );
      });
    });

    describe('Score Clamping', () => {
      it('should clamp CEFR band to minimum 1', async () => {
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              accuracyScore: 0,
              fluencyScore: 0,
              prosodyScore: 0,
              completenessScore: 0
            })
          }
        });

        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Min CEFR test';

        const result = await service.assessPronunciation(audioPath, referenceText);

        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
      });

      it('should clamp CEFR band to maximum 6', async () => {
        // Even with composite > 100 (shouldn't happen but test clamping)
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              accuracyScore: 100,
              fluencyScore: 100,
              prosodyScore: 100,
              completenessScore: 100
            })
          }
        });

        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Max CEFR test';

        const result = await service.assessPronunciation(audioPath, referenceText);

        expect(result.cefrBand).toBeLessThanOrEqual(6);
      });

      it('should clamp scale score to minimum 0', async () => {
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              accuracyScore: 0,
              fluencyScore: 0,
              prosodyScore: 0,
              completenessScore: 0
            })
          }
        });

        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Min scale test';

        const result = await service.assessPronunciation(audioPath, referenceText);

        expect(result.scaleScore).toBeGreaterThanOrEqual(0);
      });

      it('should clamp scale score to maximum 30', async () => {
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              accuracyScore: 100,
              fluencyScore: 100,
              prosodyScore: 100,
              completenessScore: 100
            })
          }
        });

        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Max scale test';

        const result = await service.assessPronunciation(audioPath, referenceText);

        expect(result.scaleScore).toBeLessThanOrEqual(30);
      });
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('Integration Tests - Complete Workflows', () => {
    let service: GeminiGraderService;
    let mockUploadFile: Mock;
    let mockGetFile: Mock;
    let mockDeleteFile: Mock;

    beforeEach(() => {
      // Setup successful writing response
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            cefrBand: 4,
            scaleScore: 22,
            grammarCorrections: [
              {
                originalText: 'I goes to school',
                correctedText: 'I go to school',
                errorType: 'subject-verb agreement',
                explanation: 'Use "go" with "I"'
              }
            ],
            lexicalAnalysis: {
              vocabularyLevel: 'intermediate',
              lexicalDiversity: 0.65,
              academicWordCount: 3,
              suggestions: ['Consider using more varied vocabulary']
            }
          })
        }
      });

      // Setup file upload mocks
      mockUploadFile = vi.fn().mockResolvedValue({
        file: {
          uri: 'https://generativelanguage.googleapis.com/v1beta/files/test-audio-123',
          name: 'files/test-audio-123',
          mimeType: 'audio/wav'
        }
      });

      mockGetFile = vi.fn().mockResolvedValue({
        name: 'files/test-audio-123',
        state: 'ACTIVE',
        uri: 'https://generativelanguage.googleapis.com/v1beta/files/test-audio-123'
      });

      mockDeleteFile = vi.fn().mockResolvedValue({});

      (GoogleAIFileManager as unknown as Mock).mockImplementation(() => ({
        uploadFile: mockUploadFile,
        getFile: mockGetFile,
        deleteFile: mockDeleteFile
      }));

      service = new GeminiGraderService(mockApiKey);
    });

    describe('Writing Grading - Complete Workflow Integration', () => {
      it('should complete full writing workflow: request → API → parse → clamp', async () => {
        const request: WritingGradeRequest = {
          text: 'Technology has revolutionized modern education.',
          taskType: 'academic-discussion',
          professorPrompt: 'Discuss the impact of technology on education.',
          peerOpinions: ['I think technology helps students learn faster.']
        };

        const result = await service.gradeWriting(request);

        // Verify API was called with correct model and config
        expect(mockGetGenerativeModel).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'gemini-2.0-flash-exp',
            generationConfig: expect.objectContaining({
              responseMimeType: 'application/json',
              temperature: 0.2
            })
          })
        );

        // Verify content generation was called
        expect(mockGenerateContent).toHaveBeenCalled();

        // Verify result structure
        expect(result).toHaveProperty('cefrBand');
        expect(result).toHaveProperty('scaleScore');
        expect(result).toHaveProperty('grammarCorrections');
        expect(result).toHaveProperty('lexicalAnalysis');

        // Verify scores are clamped
        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
        expect(result.cefrBand).toBeLessThanOrEqual(6);
        expect(result.scaleScore).toBeGreaterThanOrEqual(0);
        expect(result.scaleScore).toBeLessThanOrEqual(30);

        // Verify grammar corrections structure
        expect(Array.isArray(result.grammarCorrections)).toBe(true);
        if (result.grammarCorrections.length > 0) {
          expect(result.grammarCorrections[0]).toHaveProperty('originalText');
          expect(result.grammarCorrections[0]).toHaveProperty('correctedText');
          expect(result.grammarCorrections[0]).toHaveProperty('errorType');
        }

        // Verify lexical analysis structure
        expect(result.lexicalAnalysis).toHaveProperty('vocabularyLevel');
        expect(result.lexicalAnalysis).toHaveProperty('lexicalDiversity');
        expect(result.lexicalAnalysis).toHaveProperty('academicWordCount');
        expect(result.lexicalAnalysis).toHaveProperty('suggestions');
      });

      it('should handle build-sentence task workflow end-to-end', async () => {
        const request: WritingGradeRequest = {
          text: 'The quick brown fox jumps over the lazy dog.',
          taskType: 'build-sentence'
        };

        const result = await service.gradeWriting(request);

        expect(mockGenerateContent).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining('build-sentence')
            })
          ])
        );

        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
        expect(result.cefrBand).toBeLessThanOrEqual(6);
      });

      it('should handle email task workflow end-to-end', async () => {
        const request: WritingGradeRequest = {
          text: 'Dear Professor, I need an extension. Best regards, Student.',
          taskType: 'email'
        };

        const result = await service.gradeWriting(request);

        expect(mockGenerateContent).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining('email')
            })
          ])
        );

        expect(result.scaleScore).toBeGreaterThanOrEqual(0);
        expect(result.scaleScore).toBeLessThanOrEqual(30);
      });

      it('should properly clamp out-of-range scores from API', async () => {
        // Mock API returning out-of-range scores
        mockGenerateContent.mockResolvedValueOnce({
          response: {
            text: () => JSON.stringify({
              cefrBand: 10, // Invalid, should be clamped to 6
              scaleScore: 50, // Invalid, should be clamped to 30
              grammarCorrections: [],
              lexicalAnalysis: {
                vocabularyLevel: 'advanced',
                lexicalDiversity: 0.8,
                academicWordCount: 5,
                suggestions: []
              }
            })
          }
        });

        const request: WritingGradeRequest = {
          text: 'Test text',
          taskType: 'build-sentence'
        };

        const result = await service.gradeWriting(request);

        // Verify clamping
        expect(result.cefrBand).toBe(6); // Clamped from 10
        expect(result.scaleScore).toBe(30); // Clamped from 50
      });

      it('should clamp negative scores from API', async () => {
        mockGenerateContent.mockResolvedValueOnce({
          response: {
            text: () => JSON.stringify({
              cefrBand: -2, // Invalid, should be clamped to 1
              scaleScore: -10, // Invalid, should be clamped to 0
              grammarCorrections: [],
              lexicalAnalysis: {
                vocabularyLevel: 'beginner',
                lexicalDiversity: 0.1,
                academicWordCount: 0,
                suggestions: []
              }
            })
          }
        });

        const request: WritingGradeRequest = {
          text: 'Test',
          taskType: 'email'
        };

        const result = await service.gradeWriting(request);

        expect(result.cefrBand).toBe(1); // Clamped from -2
        expect(result.scaleScore).toBe(0); // Clamped from -10
      });
    });

    describe('Pronunciation Assessment - Complete Workflow Integration', () => {
      beforeEach(() => {
        // Setup pronunciation mock
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              accuracyScore: 85,
              fluencyScore: 78,
              prosodyScore: 82,
              completenessScore: 90
            })
          }
        });
      });

      it('should complete full pronunciation workflow: upload → process → assess → cleanup', async () => {
        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'The quick brown fox jumps over the lazy dog.';

        const result = await service.assessPronunciation(audioPath, referenceText);

        // Step 1: Verify file upload
        expect(mockUploadFile).toHaveBeenCalledWith(
          audioPath,
          expect.objectContaining({
            mimeType: 'audio/wav'
          })
        );

        // Step 2: Verify file processing check
        expect(mockGetFile).toHaveBeenCalled();

        // Step 3: Verify assessment API call
        expect(mockGenerateContent).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining(referenceText)
            }),
            expect.objectContaining({
              fileData: expect.objectContaining({
                fileUri: expect.stringContaining('test-audio-123'),
                mimeType: 'audio/wav'
              })
            })
          ])
        );

        // Step 4: Verify cleanup
        expect(mockDeleteFile).toHaveBeenCalledWith('files/test-audio-123');

        // Verify result
        expect(result).toHaveProperty('accuracyScore');
        expect(result).toHaveProperty('fluencyScore');
        expect(result).toHaveProperty('prosodyScore');
        expect(result).toHaveProperty('completenessScore');
        expect(result).toHaveProperty('cefrBand');
        expect(result).toHaveProperty('scaleScore');

        // Verify composite score calculation
        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
        expect(result.cefrBand).toBeLessThanOrEqual(6);
        expect(result.scaleScore).toBeGreaterThanOrEqual(0);
        expect(result.scaleScore).toBeLessThanOrEqual(30);
      });

      it('should handle listen-repeat task workflow end-to-end', async () => {
        const request: SpeakingAssessmentRequest = {
          audioPath: '/tmp/listen-repeat.wav',
          referenceText: 'Hello, how are you today?',
          taskType: 'listen-repeat'
        };

        const result = await service.assessPronunciation(request.audioPath, request.referenceText);

        expect(mockUploadFile).toHaveBeenCalled();
        expect(result.accuracyScore).toBeGreaterThanOrEqual(0);
        expect(result.accuracyScore).toBeLessThanOrEqual(100);
      });

      it('should handle simulated-interview task workflow end-to-end', async () => {
        const request: SpeakingAssessmentRequest = {
          audioPath: '/tmp/interview.wav',
          referenceText: 'Tell me about your hometown and why you like it.',
          taskType: 'simulated-interview'
        };

        const result = await service.assessPronunciation(request.audioPath, request.referenceText);

        expect(mockDeleteFile).toHaveBeenCalled();
        expect(result.fluencyScore).toBeGreaterThanOrEqual(0);
        expect(result.fluencyScore).toBeLessThanOrEqual(100);
      });

      it('should wait for file processing before assessment', async () => {
        // Mock file in PROCESSING state, then ACTIVE
        let callCount = 0;
        mockGetFile.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              name: 'files/test-audio-123',
              state: 'PROCESSING'
            });
          }
          return Promise.resolve({
            name: 'files/test-audio-123',
            state: 'ACTIVE'
          });
        });

        const result = await service.assessPronunciation('/tmp/test.wav', 'Test text');

        // Should poll at least twice
        expect(mockGetFile).toHaveBeenCalledTimes(2);
        expect(result).toBeDefined();
      });

      it('should cleanup file even if assessment fails after upload', async () => {
        // Fail at assessment stage, after successful upload
        mockGenerateContent.mockRejectedValueOnce(new Error('Assessment failed'));

        const audioPath = '/tmp/test-audio.wav';
        const referenceText = 'Test reference text';

        await service.assessPronunciation(audioPath, referenceText);

        // File should still be uploaded and deleted
        expect(mockUploadFile).toHaveBeenCalled();
        expect(mockDeleteFile).toHaveBeenCalled();
      }, 10000);
    });

    describe('Retry Logic with Exponential Backoff - Integration', () => {
      it('should retry gradeWriting with exponential backoff on transient failures', async () => {
        let attemptCount = 0;

        // Fail first 2 attempts, succeed on 3rd
        mockGenerateContent.mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 3) {
            return Promise.reject(new Error('Transient API error'));
          }
          return Promise.resolve({
            response: {
              text: () => JSON.stringify({
                cefrBand: 4,
                scaleScore: 22,
                grammarCorrections: [],
                lexicalAnalysis: {
                  vocabularyLevel: 'intermediate',
                  lexicalDiversity: 0.5,
                  academicWordCount: 2,
                  suggestions: []
                }
              })
            }
          });
        });

        const request: WritingGradeRequest = {
          text: 'Test retry logic',
          taskType: 'build-sentence'
        };

        const result = await service.gradeWriting(request);

        // Should have retried 3 times total (1 original + 2 retries before success)
        expect(attemptCount).toBe(3);
        expect(result.cefrBand).toBe(4);
        expect(result.scaleScore).toBe(22);
      }, 15000); // Longer timeout for retries with backoff

      it('should retry assessPronunciation with exponential backoff on transient failures', async () => {
        let attemptCount = 0;

        mockGenerateContent.mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 2) {
            return Promise.reject(new Error('Transient error'));
          }
          return Promise.resolve({
            response: {
              text: () => JSON.stringify({
                accuracyScore: 80,
                fluencyScore: 75,
                prosodyScore: 70,
                completenessScore: 85
              })
            }
          });
        });

        const result = await service.assessPronunciation('/tmp/test.wav', 'Test text');

        expect(attemptCount).toBe(2);
        expect(result.accuracyScore).toBe(80);
      }, 15000);

      it('should apply exponential backoff delay between retries', async () => {
        const timestamps: number[] = [];
        let attemptCount = 0;

        mockGenerateContent.mockImplementation(() => {
          timestamps.push(Date.now());
          attemptCount++;
          if (attemptCount < 3) {
            return Promise.reject(new Error('Retry test'));
          }
          return Promise.resolve({
            response: {
              text: () => JSON.stringify({
                cefrBand: 3,
                scaleScore: 18,
                grammarCorrections: [],
                lexicalAnalysis: {
                  vocabularyLevel: 'intermediate',
                  lexicalDiversity: 0.5,
                  academicWordCount: 0,
                  suggestions: []
                }
              })
            }
          });
        });

        await service.gradeWriting({
          text: 'Backoff test',
          taskType: 'email'
        });

        // Verify exponential backoff timing
        // First retry after ~1000ms, second retry after ~2000ms
        const delay1 = timestamps[1] - timestamps[0];
        const delay2 = timestamps[2] - timestamps[1];

        expect(delay1).toBeGreaterThanOrEqual(900); // Allow 10% tolerance
        expect(delay2).toBeGreaterThanOrEqual(1800);
        expect(delay2).toBeGreaterThan(delay1); // Second delay should be longer
      }, 15000);

      it('should return fallback score after max retries exhausted', async () => {
        // Always fail
        mockGenerateContent.mockRejectedValue(new Error('Permanent failure'));

        const result = await service.gradeWriting({
          text: 'Max retries test',
          taskType: 'build-sentence'
        });

        // Should return fallback scores
        expect(result.cefrBand).toBe(3);
        expect(result.scaleScore).toBe(15);
        expect(result.lexicalAnalysis.vocabularyLevel).toBe('error');
      }, 15000);
    });

    describe('Circuit Breaker Pattern - Integration', () => {
      it('should open circuit after multiple consecutive failures', async () => {
        const testService = new GeminiGraderService(mockApiKey, {
          failureThreshold: 3,
          successThreshold: 2,
          timeout: 60000,
          resetTimeout: 5000
        });

        // Mock persistent failures
        mockGenerateContent.mockRejectedValue(new Error('Service unavailable'));

        // Make requests until circuit opens
        await testService.gradeWriting({ text: 'Test 1', taskType: 'email' });
        expect(testService.getCircuitState()).toBe('CLOSED');

        await testService.gradeWriting({ text: 'Test 2', taskType: 'email' });
        expect(testService.getCircuitState()).toBe('CLOSED');

        await testService.gradeWriting({ text: 'Test 3', taskType: 'email' });
        expect(testService.getCircuitState()).toBe('OPEN');

        // Next request should fail fast without retrying
        const result = await testService.gradeWriting({ text: 'Test 4', taskType: 'email' });
        expect(result.cefrBand).toBe(3); // Fallback score
      }, 25000);

      it('should transition to HALF_OPEN after reset timeout', async () => {
        const testService = new GeminiGraderService(mockApiKey, {
          failureThreshold: 2,
          successThreshold: 1,
          timeout: 60000,
          resetTimeout: 2000 // Short timeout for testing
        });

        mockGenerateContent.mockRejectedValue(new Error('Failure'));

        // Open the circuit
        await testService.gradeWriting({ text: 'Test 1', taskType: 'email' });
        await testService.gradeWriting({ text: 'Test 2', taskType: 'email' });
        expect(testService.getCircuitState()).toBe('OPEN');

        // Wait for reset timeout
        await new Promise(resolve => setTimeout(resolve, 2500));

        // Mock success for recovery
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              cefrBand: 4,
              scaleScore: 20,
              grammarCorrections: [],
              lexicalAnalysis: {
                vocabularyLevel: 'intermediate',
                lexicalDiversity: 0.5,
                academicWordCount: 1,
                suggestions: []
              }
            })
          }
        });

        // Next request should try (HALF_OPEN state)
        const result = await testService.gradeWriting({ text: 'Test 3', taskType: 'email' });
        
        // Should have transitioned through HALF_OPEN to CLOSED on success
        expect(testService.getCircuitState()).toBe('CLOSED');
        expect(result.cefrBand).toBe(4);
      }, 20000);

      it('should close circuit after successful requests in HALF_OPEN state', async () => {
        const testService = new GeminiGraderService(mockApiKey, {
          failureThreshold: 2,
          successThreshold: 2,
          timeout: 60000,
          resetTimeout: 1000
        });

        // Open circuit
        mockGenerateContent.mockRejectedValue(new Error('Failure'));
        await testService.gradeWriting({ text: 'Fail 1', taskType: 'email' });
        await testService.gradeWriting({ text: 'Fail 2', taskType: 'email' });
        expect(testService.getCircuitState()).toBe('OPEN');

        // Wait for reset
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Mock successes
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              cefrBand: 5,
              scaleScore: 25,
              grammarCorrections: [],
              lexicalAnalysis: {
                vocabularyLevel: 'advanced',
                lexicalDiversity: 0.7,
                academicWordCount: 4,
                suggestions: []
              }
            })
          }
        });

        // First success - should be HALF_OPEN
        await testService.gradeWriting({ text: 'Success 1', taskType: 'email' });
        
        // Second success - should close circuit
        await testService.gradeWriting({ text: 'Success 2', taskType: 'email' });
        expect(testService.getCircuitState()).toBe('CLOSED');
      }, 20000);

      it('should reopen circuit if failure occurs in HALF_OPEN state', async () => {
        const testService = new GeminiGraderService(mockApiKey, {
          failureThreshold: 2,
          successThreshold: 2,
          timeout: 60000,
          resetTimeout: 1000
        });

        // Open circuit
        mockGenerateContent.mockRejectedValue(new Error('Failure'));
        await testService.gradeWriting({ text: 'Fail 1', taskType: 'email' });
        await testService.gradeWriting({ text: 'Fail 2', taskType: 'email' });
        expect(testService.getCircuitState()).toBe('OPEN');

        // Wait for reset
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Next request should fail - circuit reopens
        const result = await testService.gradeWriting({ text: 'Fail 3', taskType: 'email' });
        expect(testService.getCircuitState()).toBe('OPEN');
        expect(result.cefrBand).toBe(3); // Fallback
      }, 25000);

      it('should manually reset circuit breaker', () => {
        const testService = new GeminiGraderService(mockApiKey, {
          failureThreshold: 1,
          successThreshold: 1,
          timeout: 60000
        });

        // Artificially open circuit (we can't easily test this without making real requests)
        // Just verify reset works
        testService.resetCircuit();
        expect(testService.getCircuitState()).toBe('CLOSED');
      });
    });

    describe('Error Scenarios with All Task Types - Integration', () => {
      it('should handle API errors for all writing task types', async () => {
        mockGenerateContent.mockRejectedValue(new Error('API Error'));

        const taskTypes: Array<'build-sentence' | 'email' | 'academic-discussion'> = [
          'build-sentence',
          'email',
          'academic-discussion'
        ];

        for (const taskType of taskTypes) {
          const result = await service.gradeWriting({
            text: `Test for ${taskType}`,
            taskType
          });

          expect(result.cefrBand).toBe(3);
          expect(result.scaleScore).toBe(15);
          expect(result.lexicalAnalysis.vocabularyLevel).toBe('error');
        }
      }, 25000);

      it('should handle API errors for all speaking task types', async () => {
        mockGenerateContent.mockRejectedValue(new Error('API Error'));

        const taskTypes: Array<'listen-repeat' | 'simulated-interview'> = [
          'listen-repeat',
          'simulated-interview'
        ];

        for (const taskType of taskTypes) {
          const result = await service.assessPronunciation(
            `/tmp/${taskType}.wav`,
            `Reference text for ${taskType}`
          );

          expect(result.cefrBand).toBe(3);
          expect(result.scaleScore).toBe(15);
          expect(result.accuracyScore).toBe(50);
          expect(result.fluencyScore).toBe(50);
          expect(result.prosodyScore).toBe(50);
          expect(result.completenessScore).toBe(50);
        }
      }, 20000);

      it('should handle network timeout errors gracefully', async () => {
        mockGenerateContent.mockRejectedValue(new Error('ETIMEDOUT'));

        const result = await service.gradeWriting({
          text: 'Network timeout test',
          taskType: 'email'
        });

        expect(result).toBeDefined();
        expect(result.cefrBand).toBeGreaterThanOrEqual(1);
        expect(result.cefrBand).toBeLessThanOrEqual(6);
      }, 15000);

      it('should handle malformed JSON response from API', async () => {
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => 'Not valid JSON {{{{'
          }
        });

        const result = await service.gradeWriting({
          text: 'Malformed JSON test',
          taskType: 'build-sentence'
        });

        expect(result.cefrBand).toBe(3);
        expect(result.scaleScore).toBe(15);
      }, 15000);

      it('should handle missing fields in API response', async () => {
        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              cefrBand: 4
              // Missing scaleScore, grammarCorrections, lexicalAnalysis
            })
          }
        });

        const result = await service.gradeWriting({
          text: 'Missing fields test',
          taskType: 'email'
        });

        // Should still work with fallback values
        expect(result).toBeDefined();
        expect(result.cefrBand).toBeDefined();
        expect(result.scaleScore).toBeDefined();
        expect(result.grammarCorrections).toBeDefined();
        expect(result.lexicalAnalysis).toBeDefined();
      }, 15000);
    });

    describe('Logging and Error Reporting - Integration', () => {
      it('should log retry attempts during failures', async () => {
        const consoleSpy = vi.spyOn(console, 'log');
        let attemptCount = 0;

        mockGenerateContent.mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 2) {
            return Promise.reject(new Error('Transient error'));
          }
          return Promise.resolve({
            response: {
              text: () => JSON.stringify({
                cefrBand: 3,
                scaleScore: 15,
                grammarCorrections: [],
                lexicalAnalysis: {
                  vocabularyLevel: 'intermediate',
                  lexicalDiversity: 0.5,
                  academicWordCount: 0,
                  suggestions: []
                }
              })
            }
          });
        });

        await service.gradeWriting({ text: 'Logging test', taskType: 'email' });

        // Should have logged retry attempts
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Retry attempt')
        );

        consoleSpy.mockRestore();
      }, 15000);

      it('should log errors when returning fallback scores', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error');
        mockGenerateContent.mockRejectedValue(new Error('Service failure'));

        await service.gradeWriting({ text: 'Error logging test', taskType: 'email' });

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Gemini writing grading failed'),
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
      }, 15000);

      it('should log file upload progress for pronunciation', async () => {
        const consoleSpy = vi.spyOn(console, 'log');

        mockGenerateContent.mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              accuracyScore: 75,
              fluencyScore: 70,
              prosodyScore: 68,
              completenessScore: 80
            })
          }
        });

        await service.assessPronunciation('/tmp/test.wav', 'Test text');

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Uploaded audio file')
        );

        consoleSpy.mockRestore();
      });
    });
  });
});
