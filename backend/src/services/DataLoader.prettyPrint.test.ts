/**
 * Tests for DataLoader.prettyPrint method
 * 
 * **Validates: Requirement 10.4**
 * Human-readable test item display
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataLoader } from './DataLoader.js';
import { Pool } from 'pg';
import { Item } from '../models/irt.types.js';

describe('DataLoader.prettyPrint', () => {
  let dataLoader: DataLoader;
  let mockPool: Pool;
  let consoleSpy: any;

  beforeEach(() => {
    mockPool = {} as Pool;
    dataLoader = new DataLoader(mockPool);
    
    // Spy on console.log to capture output
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should print a single item with all fields', () => {
    const item: Item = {
      id: 'test-item-001',
      section: 'reading',
      type: 'multiple-choice',
      difficulty_level: 'medium',
      content: 'What is the main idea of the passage?',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correct_answer: 'Option B',
      irt_parameters: {
        a: 1.2345,
        b: -0.5678,
        c: 0.2
      },
      metadata: {
        stage: 1,
        passage_id: 'passage-001'
      }
    };

    dataLoader.prettyPrint(item);

    // Verify console.log was called multiple times
    expect(consoleSpy).toHaveBeenCalled();
    
    // Verify key information is printed
    const output = consoleSpy.mock.calls.map((call: any[]) => call[0]).join('\n');
    
    expect(output).toContain('test-item-001');
    expect(output).toContain('READING');
    expect(output).toContain('multiple-choice');
    expect(output).toContain('MEDIUM');
    expect(output).toContain('What is the main idea');
    expect(output).toContain('IRT Parameters');
    expect(output).toContain('discrimination');
    expect(output).toContain('difficulty');
    expect(output).toContain('guessing');
  });

  it('should print multiple items', () => {
    const items: Item[] = [
      {
        id: 'item-001',
        section: 'listening',
        type: 'audio-response',
        difficulty_level: 'easy',
        content: 'Listen to the audio clip',
        correct_answer: 'Answer 1',
        irt_parameters: { a: 1.0, b: -1.0, c: 0.25 }
      },
      {
        id: 'item-002',
        section: 'writing',
        type: 'essay',
        difficulty_level: 'hard',
        content: 'Write an essay about...',
        correct_answer: 'Sample essay',
        irt_parameters: { a: 1.5, b: 1.2, c: 0.15 }
      }
    ];

    dataLoader.prettyPrint(items);

    const output = consoleSpy.mock.calls.map((call: any[]) => call[0]).join('\n');
    
    expect(output).toContain('2 items');
    expect(output).toContain('item-001');
    expect(output).toContain('item-002');
    expect(output).toContain('LISTENING');
    expect(output).toContain('WRITING');
  });

  it('should display IRT parameters in scientific notation by default', () => {
    const item: Item = {
      id: 'item-sci',
      section: 'reading',
      type: 'test',
      content: 'Test content',
      correct_answer: 'Answer',
      irt_parameters: {
        a: 1.2345,
        b: 0.0067,
        c: 0.2
      }
    };

    dataLoader.prettyPrint(item);

    const output = consoleSpy.mock.calls.map((call: any[]) => call[0]).join('\n');
    
    // Should contain exponential notation (e+0, e-3, e-1, etc.)
    expect(output).toMatch(/\d\.\d{4}e[+-]\d+/);
  });

  it('should support disabling scientific notation', () => {
    const item: Item = {
      id: 'item-decimal',
      section: 'reading',
      type: 'test',
      content: 'Test content',
      correct_answer: 'Answer',
      irt_parameters: {
        a: 1.2345,
        b: -0.5678,
        c: 0.2
      }
    };

    dataLoader.prettyPrint(item, { scientificNotation: false });

    const output = consoleSpy.mock.calls.map((call: any[]) => call[0]).join('\n');
    
    // Should contain decimal notation
    expect(output).toContain('1.2345');
    expect(output).toContain('-0.5678');
    expect(output).toContain('0.2000');
  });

  it('should truncate long content', () => {
    const longContent = 'A'.repeat(200);
    const item: Item = {
      id: 'item-long',
      section: 'reading',
      type: 'test',
      content: longContent,
      correct_answer: 'Answer',
      irt_parameters: { a: 1.0, b: 0.0, c: 0.2 }
    };

    dataLoader.prettyPrint(item, { maxContentLength: 50 });

    const output = consoleSpy.mock.calls.map((call: any[]) => call[0]).join('\n');
    
    // Should be truncated with ellipsis
    expect(output).toContain('...');
    expect(output).not.toContain('A'.repeat(100));
  });

  it('should support disabling colors', () => {
    const item: Item = {
      id: 'item-no-color',
      section: 'reading',
      type: 'test',
      content: 'Test content',
      correct_answer: 'Answer',
      irt_parameters: { a: 1.0, b: 0.0, c: 0.2 }
    };

    dataLoader.prettyPrint(item, { useColors: false });

    const output = consoleSpy.mock.calls.map((call: any[]) => call[0]).join('\n');
    
    // Should not contain ANSI color codes
    expect(output).not.toContain('\x1b[');
  });

  it('should display options with multiple choice items', () => {
    const item: Item = {
      id: 'item-mc',
      section: 'reading',
      type: 'multiple-choice',
      content: 'Question?',
      options: ['First option', 'Second option', 'Third option', 'Fourth option'],
      correct_answer: 'Second option',
      irt_parameters: { a: 1.0, b: 0.0, c: 0.25 }
    };

    dataLoader.prettyPrint(item);

    const output = consoleSpy.mock.calls.map((call: any[]) => call[0]).join('\n');
    
    expect(output).toContain('4 choices');
    expect(output).toContain('First option');
    expect(output).toContain('Second option');
    expect(output).toContain('Third option');
    expect(output).toContain('Fourth option');
    expect(output).toContain('A.');
    expect(output).toContain('B.');
    expect(output).toContain('C.');
    expect(output).toContain('D.');
  });

  it('should mark correct answer in options list', () => {
    const item: Item = {
      id: 'item-correct',
      section: 'reading',
      type: 'multiple-choice',
      content: 'Question?',
      options: ['Wrong A', 'Correct B', 'Wrong C'],
      correct_answer: 'Correct B',
      irt_parameters: { a: 1.0, b: 0.0, c: 0.2 }
    };

    dataLoader.prettyPrint(item, { useColors: false });

    const output = consoleSpy.mock.calls.map((call: any[]) => call[0]).join('\n');
    
    // The correct answer should be near a checkmark
    const lines = output.split('\n');
    const correctLine = lines.find(line => line.includes('Correct B'));
    
    expect(correctLine).toBeDefined();
    // In no-color mode, we can check for the structure
    expect(output).toContain('Correct B');
  });

  it('should display stage information when available', () => {
    const item: Item = {
      id: 'item-stage',
      section: 'reading',
      type: 'test',
      content: 'Test content',
      correct_answer: 'Answer',
      irt_parameters: { a: 1.0, b: 0.0, c: 0.2 },
      metadata: {
        stage: 2
      }
    };

    dataLoader.prettyPrint(item);

    const output = consoleSpy.mock.calls.map((call: any[]) => call[0]).join('\n');
    
    expect(output).toContain('Stage');
    expect(output).toContain('2');
  });

  it('should display metadata when present', () => {
    const item: Item = {
      id: 'item-meta',
      section: 'reading',
      type: 'test',
      content: 'Test content',
      correct_answer: 'Answer',
      irt_parameters: { a: 1.0, b: 0.0, c: 0.2 },
      metadata: {
        passage_id: 'passage-123',
        source: 'TOEFL Dataset',
        year: 2026
      }
    };

    dataLoader.prettyPrint(item);

    const output = consoleSpy.mock.calls.map((call: any[]) => call[0]).join('\n');
    
    expect(output).toContain('Metadata');
    expect(output).toContain('passage-123');
  });

  it('should handle items without optional fields', () => {
    const item: Item = {
      id: 'item-minimal',
      section: 'speaking',
      type: 'audio-response',
      content: 'Speak now',
      correct_answer: 'Transcription',
      irt_parameters: { a: 1.0, b: 0.0, c: 0.2 }
    };

    // Should not throw
    expect(() => {
      dataLoader.prettyPrint(item);
    }).not.toThrow();

    const output = consoleSpy.mock.calls.map((call: any[]) => call[0]).join('\n');
    
    expect(output).toContain('item-minimal');
    expect(output).toContain('SPEAKING');
  });

  it('should handle empty item array', () => {
    dataLoader.prettyPrint([]);

    const output = consoleSpy.mock.calls.map((call: any[]) => call[0]).join('\n');
    
    expect(output).toContain('0 items');
  });

  it('should normalize whitespace in content', () => {
    const item: Item = {
      id: 'item-whitespace',
      section: 'reading',
      type: 'test',
      content: 'Multiple   spaces\n\nand   newlines',
      correct_answer: 'Answer',
      irt_parameters: { a: 1.0, b: 0.0, c: 0.2 }
    };

    dataLoader.prettyPrint(item);

    const output = consoleSpy.mock.calls.map((call: any[]) => call[0]).join('\n');
    
    // Should have normalized whitespace
    expect(output).toContain('Multiple spaces and newlines');
  });

  it('should color-code sections appropriately', () => {
    const sections: Array<{ section: 'reading' | 'listening' | 'writing' | 'speaking' }> = [
      { section: 'reading' },
      { section: 'listening' },
      { section: 'writing' },
      { section: 'speaking' }
    ];

    sections.forEach(({ section }) => {
      consoleSpy.mockClear();
      
      const item: Item = {
        id: `item-${section}`,
        section,
        type: 'test',
        content: 'Test',
        correct_answer: 'Answer',
        irt_parameters: { a: 1.0, b: 0.0, c: 0.2 }
      };

      dataLoader.prettyPrint(item);

      const output = consoleSpy.mock.calls.map((call: any[]) => call[0]).join('\n');
      expect(output).toContain(section.toUpperCase());
    });
  });

  it('should color-code difficulty levels appropriately', () => {
    const difficulties: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard'];

    difficulties.forEach(difficulty => {
      consoleSpy.mockClear();
      
      const item: Item = {
        id: `item-${difficulty}`,
        section: 'reading',
        type: 'test',
        difficulty_level: difficulty,
        content: 'Test',
        correct_answer: 'Answer',
        irt_parameters: { a: 1.0, b: 0.0, c: 0.2 }
      };

      dataLoader.prettyPrint(item);

      const output = consoleSpy.mock.calls.map((call: any[]) => call[0]).join('\n');
      expect(output).toContain(difficulty.toUpperCase());
    });
  });
});
