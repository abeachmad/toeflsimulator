/**
 * Time Formatting Utilities
 * 
 * Provides utilities for formatting time values for display in the TOEFL simulator
 * 
 * **Validates: Requirement 2.2**
 * WHILE the exam is active, THE UI_Controller SHALL display remaining time in HH:MM:SS format
 */

/**
 * Format seconds into HH:MM:SS format
 * 
 * **Validates: Requirement 2.2**
 * 
 * @param seconds - Total seconds to format (0 to 5400 for 90-minute exam)
 * @returns Formatted time string in HH:MM:SS format
 * 
 * @example
 * formatTime(3661) // returns "01:01:01"
 * formatTime(90) // returns "00:01:30"
 * formatTime(0) // returns "00:00:00"
 */
export function formatTime(seconds: number): string {
  // Ensure non-negative value
  const totalSeconds = Math.max(0, Math.floor(seconds));
  
  // Calculate hours, minutes, and remaining seconds
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  
  // Pad with leading zeros to ensure HH:MM:SS format
  const hoursStr = String(hours).padStart(2, '0');
  const minutesStr = String(minutes).padStart(2, '0');
  const secsStr = String(secs).padStart(2, '0');
  
  return `${hoursStr}:${minutesStr}:${secsStr}`;
}
