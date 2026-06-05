/**
 * Property-Based Tests for Time Formatting Utilities
 * 
 * Tests the time formatting function to ensure correct HH:MM:SS display
 * 
 * **Validates: Requirement 2.2**
 * WHILE the exam is active, THE UI_Controller SHALL display remaining time in HH:MM:SS format
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatTime } from './timeFormat.js';

describe('Time Formatting Utilities', () => {
  describe('formatTime', () => {
    it('should format specific time values correctly', () => {
      // **Validates: Requirement 2.2**
      expect(formatTime(0)).toBe('00:00:00');
      expect(formatTime(1)).toBe('00:00:01');
      expect(formatTime(59)).toBe('00:00:59');
      expect(formatTime(60)).toBe('00:01:00');
      expect(formatTime(61)).toBe('00:01:01');
      expect(formatTime(3599)).toBe('00:59:59');
      expect(formatTime(3600)).toBe('01:00:00');
      expect(formatTime(3661)).toBe('01:01:01');
      expect(formatTime(5400)).toBe('01:30:00'); // 90 minutes (max exam duration)
    });

    it('should handle edge cases', () => {
      // **Validates: Requirement 2.2**
      expect(formatTime(-1)).toBe('00:00:00'); // Negative should become 0
      expect(formatTime(-100)).toBe('00:00:00'); // Negative should become 0
      expect(formatTime(0.5)).toBe('00:00:00'); // Fractional should floor to 0
      expect(formatTime(1.9)).toBe('00:00:01'); // Fractional should floor to 1
    });

    it('should pad single digits with leading zeros', () => {
      // **Validates: Requirement 2.2**
      expect(formatTime(5)).toBe('00:00:05');
      expect(formatTime(65)).toBe('00:01:05');
      expect(formatTime(3665)).toBe('01:01:05');
    });

    it('should handle boundary values for 90-minute exam', () => {
      // **Validates: Requirement 2.2**
      // 30 minutes for Reading section
      expect(formatTime(30 * 60)).toBe('00:30:00');
      
      // 29 minutes for Listening section
      expect(formatTime(29 * 60)).toBe('00:29:00');
      
      // 23 minutes for Writing section
      expect(formatTime(23 * 60)).toBe('00:23:00');
      
      // 8 minutes for Speaking section
      expect(formatTime(8 * 60)).toBe('00:08:00');
      
      // Total 90 minutes
      expect(formatTime(90 * 60)).toBe('01:30:00');
    });
  });

  describe('Property 12: Time Format Display', () => {
    /**
     * **Validates: Requirement 2.2**
     * WHILE the exam is active, THE UI_Controller SHALL display remaining time in HH:MM:SS format
     * 
     * Property: For any time value in seconds [0, 5400]:
     * 1. The output format must match HH:MM:SS pattern (two digits for each component)
     * 2. Hours must be in valid range [0, 1] for 90-minute exam
     * 3. Minutes must be in valid range [0, 59]
     * 4. Seconds must be in valid range [0, 59]
     * 5. Parsing the formatted string back should reconstruct the original time
     */
    it('should format time values [0, 5400] seconds with valid HH:MM:SS format', () => {
      fc.assert(
        fc.property(
          // Generate time values from 0 to 5400 seconds (0 to 90 minutes)
          fc.integer({ min: 0, max: 5400 }),
          (seconds: number) => {
            const formatted = formatTime(seconds);
            
            // Property 1: Format must match HH:MM:SS pattern
            const formatRegex = /^(\d{2}):(\d{2}):(\d{2})$/;
            const match = formatted.match(formatRegex);
            
            expect(match).not.toBeNull();
            
            if (!match) {
              throw new Error(`Format does not match HH:MM:SS: ${formatted}`);
            }
            
            const [, hoursStr, minutesStr, secondsStr] = match;
            const hours = parseInt(hoursStr, 10);
            const minutes = parseInt(minutesStr, 10);
            const secs = parseInt(secondsStr, 10);
            
            // Property 2: Hours must be valid [0, 1] for 90-minute exam (5400 seconds max)
            expect(hours).toBeGreaterThanOrEqual(0);
            expect(hours).toBeLessThanOrEqual(1);
            
            // Property 3: Minutes must be valid [0, 59]
            expect(minutes).toBeGreaterThanOrEqual(0);
            expect(minutes).toBeLessThanOrEqual(59);
            
            // Property 4: Seconds must be valid [0, 59]
            expect(secs).toBeGreaterThanOrEqual(0);
            expect(secs).toBeLessThanOrEqual(59);
            
            // Property 5: Parsing back should reconstruct original time
            const reconstructedSeconds = hours * 3600 + minutes * 60 + secs;
            expect(reconstructedSeconds).toBe(seconds);
          }
        ),
        { numRuns: 1000, seed: 42 } // Run 1000 iterations with seed for reproducibility
      );
    });

    it('should always produce exactly 8 characters (HH:MM:SS)', () => {
      /**
       * **Validates: Requirement 2.2**
       * 
       * Property: Output length is always 8 characters (2 + 1 + 2 + 1 + 2)
       * This ensures consistent display width in the UI
       */
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5400 }),
          (seconds: number) => {
            const formatted = formatTime(seconds);
            expect(formatted).toHaveLength(8);
          }
        ),
        { numRuns: 1000 }
      );
    });

    it('should handle fractional and negative values safely', () => {
      /**
       * **Validates: Requirement 2.2**
       * 
       * Property: Non-integer and negative values should be handled gracefully
       * - Negative values should be treated as 0
       * - Fractional values should be floored to nearest integer
       */
      fc.assert(
        fc.property(
          fc.double({ min: -1000, max: 5400 }),
          (seconds: number) => {
            const formatted = formatTime(seconds);
            
            // Should always produce valid HH:MM:SS format
            const formatRegex = /^(\d{2}):(\d{2}):(\d{2})$/;
            expect(formatted).toMatch(formatRegex);
            
            // Negative values should result in "00:00:00"
            if (seconds < 0) {
              expect(formatted).toBe('00:00:00');
            }
            
            // Result should be consistent with floored positive value
            const expectedSeconds = Math.max(0, Math.floor(seconds));
            const [, hoursStr, minutesStr, secondsStr] = formatted.match(formatRegex)!;
            const reconstructed = 
              parseInt(hoursStr, 10) * 3600 + 
              parseInt(minutesStr, 10) * 60 + 
              parseInt(secondsStr, 10);
            
            expect(reconstructed).toBe(expectedSeconds);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('should produce monotonically increasing formatted values for increasing seconds', () => {
      /**
       * **Validates: Requirement 2.2**
       * 
       * Property: For any two time values t1 < t2, the formatted strings should
       * represent times where t1 comes before t2 chronologically
       */
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5399 }),
          fc.integer({ min: 1, max: 1000 }),
          (baseSeconds: number, increment: number) => {
            const t1 = baseSeconds;
            const t2 = Math.min(5400, baseSeconds + increment);
            
            // Skip if t1 === t2
            if (t1 === t2) return;
            
            const formatted1 = formatTime(t1);
            const formatted2 = formatTime(t2);
            
            // Parse both formatted times
            const [, h1, m1, s1] = formatted1.match(/^(\d{2}):(\d{2}):(\d{2})$/)!;
            const [, h2, m2, s2] = formatted2.match(/^(\d{2}):(\d{2}):(\d{2})$/)!;
            
            const time1 = parseInt(h1, 10) * 3600 + parseInt(m1, 10) * 60 + parseInt(s1, 10);
            const time2 = parseInt(h2, 10) * 3600 + parseInt(m2, 10) * 60 + parseInt(s2, 10);
            
            // Property: Ordering is preserved
            expect(time1).toBeLessThan(time2);
          }
        ),
        { numRuns: 500 }
      );
    });

    it('should handle all section durations correctly', () => {
      /**
       * **Validates: Requirement 2.2**
       * 
       * Property: All section durations (Reading 30min, Listening 29min, 
       * Writing 23min, Speaking 8min) should format correctly
       */
      fc.assert(
        fc.property(
          fc.constantFrom(
            30 * 60,  // Reading section
            29 * 60,  // Listening section
            23 * 60,  // Writing section
            8 * 60,   // Speaking section
            90 * 60   // Total exam
          ),
          fc.integer({ min: 0, max: 59 }), // Add random seconds
          (baseDuration: number, additionalSeconds: number) => {
            const totalSeconds = Math.min(5400, baseDuration + additionalSeconds);
            const formatted = formatTime(totalSeconds);
            
            // Should always produce valid format
            expect(formatted).toMatch(/^(\d{2}):(\d{2}):(\d{2})$/);
            
            // Parse and verify
            const [, hoursStr, minutesStr, secondsStr] = formatted.match(/^(\d{2}):(\d{2}):(\d{2})$/)!;
            const reconstructed = 
              parseInt(hoursStr, 10) * 3600 + 
              parseInt(minutesStr, 10) * 60 + 
              parseInt(secondsStr, 10);
            
            expect(reconstructed).toBe(totalSeconds);
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});
