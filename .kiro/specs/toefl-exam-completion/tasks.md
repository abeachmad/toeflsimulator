# Implementation Plan: TOEFL Exam Completion

## Overview

This implementation plan completes the TOEFL iBT 2026 simulator by integrating existing components (SectionTimer, WritingSection, AudioRecorder) and implementing missing functionality for proper question counts, timer expiry handling, section navigation, answer submission, and score reporting. The plan follows the official TOEFL iBT 2026 format with 4 sections: Reading (20 questions, 35 min), Listening (28 questions, 36 min), Writing (2 tasks, 29 min), and Speaking (4 tasks, 16 min).

## Tasks

- [x] 1. Configure section question limits and time limits
  - Add `SECTION_LIMITS` constant mapping section names to official question counts (reading: 20, listening: 28, writing: 2, speaking: 4)
  - Add `SECTION_TIME_LIMITS` constant mapping section names to official time limits in minutes (reading: 35, listening: 36, writing: 29, speaking: 16)
  - Update API fetch call in `SectionDisplay.tsx` to use dynamic limit based on section type
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

- [ ]* 1.1 Write unit tests for section configuration constants
  - Test that `SECTION_LIMITS` returns correct counts for all four sections
  - Test that `SECTION_TIME_LIMITS` returns correct durations for all four sections
  - Test that invalid section names have appropriate fallback values
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

- [x] 2. Integrate SectionTimer component into section header
  - Import `SectionTimer` component into `SectionDisplay.tsx`
  - Add timer display to section header with section ID and time limit props
  - Implement `handleTimerExpire` callback function
  - Pass `onExpire` callback to `SectionTimer` component
  - _Requirements: 2.5, 2.6, 2.7, 2.8_

- [ ]* 2.1 Write property test for timer display format
  - **Property 1: Timer Display Format Consistency**
  - **Validates: Requirements 2.5**
  - Generate random valid timer states with remaining time from 0 to 3600 seconds
  - Verify timer displays in MM:SS format with zero-padded minutes and seconds
  - _Requirements: 2.5_

- [ ] 3. Implement section completion and auto-submit logic
  - Create `handleSectionComplete` function in `SectionDisplay.tsx`
  - Collect all answers from current section into submission payload
  - Make POST request to backend submission endpoint with session ID, section ID, and answers
  - Add error handling for failed submissions with console logging
  - _Requirements: 3.1, 3.2, 3.3, 8.1, 8.2_

- [ ]* 3.1 Write property test for answer submission completeness
  - **Property 2: Answer Submission Completeness**
  - **Validates: Requirements 3.2**
  - Generate random sets of answers with various item IDs and response values
  - Verify all answers in the set are included in the submission payload
  - _Requirements: 3.2_

- [ ] 4. Implement section navigation sequence
  - Create `getNextSection` helper function with hardcoded order (reading → listening → writing → speaking → results)
  - Update `handleSectionComplete` to call `getNextSection` and navigate to next section or results page
  - Handle navigation failure by keeping user on current section
  - Add special case for Speaking section to navigate to `/exam/results`
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 3.4, 3.5_

- [ ]* 4.1 Write unit tests for section navigation logic
  - Test `getNextSection` returns correct next section for each section
  - Test that speaking section returns null (indicating results page)
  - Test navigation sequence completes in correct order
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [~] 5. Checkpoint - Verify timer and navigation integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Integrate WritingSection component
  - Import `WritingSection` component into `SectionDisplay.tsx`
  - Add conditional rendering for `id === 'writing'` to display `WritingSection` instead of default question display
  - Pass current writing task as `question` prop with proper type casting
  - Implement `onSubmit` callback to store writing score and navigate to next task or section
  - Handle word count validation (150 words for Task 1, 100 words for Task 2)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ]* 6.1 Write property test for word count accuracy
  - **Property 3: Word Count Accuracy**
  - **Validates: Requirements 5.3**
  - Generate random text inputs with varying word counts (0 to 500 words)
  - Verify displayed word count equals actual whitespace-separated token count
  - Test with edge cases like multiple spaces, tabs, newlines
  - _Requirements: 5.3_

- [ ]* 6.2 Write unit tests for writing task requirements
  - Test that Integrated Writing task enforces 150-word minimum
  - Test that Academic Discussion task enforces 100-word minimum
  - Test that submit button is disabled when word count is below minimum
  - Test that only one task type displays at a time
  - _Requirements: 5.4, 10.3, 10.4, 10.5_

- [ ] 7. Integrate AudioRecorder component for Speaking section
  - Import `AudioRecorder` component into `SectionDisplay.tsx`
  - Add conditional rendering for `id === 'speaking'` to display task prompt and `AudioRecorder`
  - Create task prompt display showing task number and content
  - Pass speaking task with preparation time and response time from item metadata
  - Implement `onSubmit` callback to store speaking score and navigate to next task or results
  - Add navigation controls (Previous button, Skip Task button)
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 11.1, 11.2, 11.3, 11.4_

- [ ]* 7.1 Write unit tests for speaking task timing requirements
  - Test Task 1 uses 15s prep time and 45s response time
  - Test Task 2 uses 30s prep time and 60s response time
  - Test Task 3 uses 20s prep time and 60s response time
  - Test Task 4 uses 20s prep time and 60s response time
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ] 8. Implement backend submission endpoint
  - Create POST route `/api/sessions/:sessionId/sections/:section/submit` in `backend/src/routes/sessions.ts`
  - Parse `answers` array from request body containing `{itemId, answer}` objects
  - Save each answer to `responses` table with INSERT...ON CONFLICT UPDATE pattern
  - For reading/listening sections, calculate IRT score using existing scoring service
  - Return score object with `scaleScore`, `cefrBand`, `correct`, and `total` properties
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4_

- [ ]* 8.1 Write property test for answer persistence
  - **Property 7: Answer Persistence Completeness**
  - **Validates: Requirements 8.1, 8.2**
  - Generate random answer submissions with session IDs and item IDs
  - Verify corresponding records exist in responses table after submission
  - _Requirements: 8.1, 8.2_

- [ ]* 8.2 Write property tests for IRT scoring
  - **Property 8: IRT Score Calculation Validity**
  - **Validates: Requirements 9.1, 9.2**
  - Generate random answer sets for reading/listening sections
  - Verify IRT algorithm produces numeric scale scores
  - **Property 9: Scale Score Range Constraint**
  - **Validates: Requirements 9.3**
  - Generate random theta values from IRT calculations
  - Verify mapped scale scores are between 0 and 30 inclusive
  - **Property 10: CEFR Band Mapping Existence**
  - **Validates: Requirements 9.4**
  - Generate random scale scores from 0 to 30
  - Verify mapping returns valid CEFR band from {A1, A2, B1, B2, C1, C2}
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [~] 9. Checkpoint - Verify submission and scoring pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [~] 10. Implement score storage in frontend exam state
  - Create or update `setSectionScore` function in exam store (`frontend/src/stores/examStore.ts`)
  - Store `SectionScore` objects with `cefrBand`, `scaleScore`, and `feedback` properties
  - Call `setSectionScore` after receiving score from backend (reading/listening) or grading API (writing/speaking)
  - Persist scores to localStorage or session storage for resilience
  - _Requirements: 7.1, 7.2, 7.5_

- [ ] 11. Implement ScoreReport display components
  - Verify `ScoreReport` component exists at `frontend/src/components/ScoreReport.tsx`
  - Implement section score display with scale score (0-30) and CEFR band for each section
  - Implement total score calculation as sum of four section scale scores
  - Implement completion badge showing count of completed sections (e.g., "3/4 sections")
  - Add AI-generated feedback display for each completed section
  - Add "Return to Home" navigation button
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ]* 11.1 Write property tests for score report calculations
  - **Property 4: Score Component Display Completeness**
  - **Validates: Requirements 7.1, 7.2, 7.5**
  - Generate random completed sections with score data
  - Verify all three components (scaleScore, cefrBand, feedback) display for each section
  - **Property 5: Total Score Calculation**
  - **Validates: Requirements 7.3**
  - Generate random sets of section scores
  - Verify total score equals arithmetic sum of scale scores
  - **Property 6: Completion Count Accuracy**
  - **Validates: Requirements 7.4**
  - Generate random exam states with varying completion levels
  - Verify completion badge count equals number of sections with submitted scores
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 12. Implement timer state persistence
  - Update `SectionTimer` component to call backend timer API on start
  - Implement timer state retrieval on component mount via GET `/api/timers/:sessionId/:section`
  - Calculate remaining time from start time and current time when state is retrieved
  - Clamp remaining time to zero if calculated value is negative
  - Call backend timer stop API when timer reaches zero or section completes
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ]* 12.1 Write property test for remaining time calculation
  - **Property 12: Remaining Time Calculation Accuracy**
  - **Validates: Requirements 12.4**
  - Generate random timer states with start times and current times
  - Verify remaining time equals (time_limit - (current_time - start_time)) when positive
  - Test that negative values are clamped to zero
  - _Requirements: 12.4_

- [ ] 13. Implement microphone permission error handling
  - Add permission request logic in `AudioRecorder` component
  - Detect permission denial from browser API
  - Display error message explaining microphone access is required
  - Display instructions for enabling microphone in browser settings
  - Prevent recording interface from activating when permission is denied
  - _Requirements: 13.1, 13.2, 13.3_

- [ ]* 13.1 Write unit tests for microphone permission handling
  - Mock browser permission API to simulate denial
  - Verify error message displays when permission is denied
  - Verify instructions display when permission is denied
  - Verify recording cannot start when permission is denied
  - _Requirements: 13.1, 13.2, 13.3_

- [ ] 14. Implement grading API failure handling with fallback scores
  - Add 30-second timeout to Gemini API grading calls in backend
  - Return fallback score when API fails or times out
  - Flag response for manual review in database by adding `needs_review` column or status field
  - Return preliminary score indicator in response payload
  - Display preliminary score message in `ScoreReport` component when flag is present
  - _Requirements: 14.1, 14.2, 14.3_

- [ ]* 14.1 Write integration tests for grading failure scenarios
  - Mock Gemini API to simulate timeout (>30 seconds)
  - Verify fallback score is returned
  - Verify database record is flagged for manual review
  - Verify preliminary message displays in score report
  - _Requirements: 14.1, 14.2, 14.3_

- [ ] 15. Implement audio file validation
  - Add validation logic in backend submission endpoint before processing audio
  - Check file size is less than 10 megabytes
  - Check file format is WAV using file extension and MIME type
  - Return specific error messages for size violations, format violations, or both
  - Reject submission and return 400 status code when validation fails
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ]* 15.1 Write property tests for audio file validation
  - **Property 13: Audio File Size Validation**
  - **Validates: Requirements 15.1**
  - Generate test files with sizes below, at, and above 10MB threshold
  - Verify validation correctly identifies files under 10MB
  - **Property 14: Audio File Format Validation**
  - **Validates: Requirements 15.2**
  - Generate test files with various formats (WAV, MP3, OGG, etc.)
  - Verify validation correctly identifies WAV format files
  - _Requirements: 15.1, 15.2_

- [ ]* 15.2 Write unit tests for audio validation error messages
  - Test that oversized files return appropriate error message
  - Test that non-WAV files return appropriate error message
  - Test that files violating both constraints return both error messages
  - _Requirements: 15.3, 15.4, 15.5_

- [ ] 16. Implement section data caching
  - Add in-memory cache for section items in backend (using Map or similar)
  - Set cache expiration time of 1 hour per cached section
  - Fetch from cache when available and not expired
  - Fetch from database when cache is unavailable or expired
  - Store fetched items in cache after database retrieval
  - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [ ]* 16.1 Write unit tests for caching behavior
  - Test that first request fetches from database and stores in cache
  - Test that subsequent requests use cache when available
  - Test that cache misses fetch from database
  - Test that expired cache entries trigger database fetch
  - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [ ] 17. Implement rate limiting for grading endpoints
  - Add rate limiting middleware to grading endpoints in backend
  - Track requests per session ID with sliding window of 1 minute
  - Reject requests exceeding 10 requests per minute with 429 status code
  - Include `retry-after` header in rate limit responses
  - Allow request to proceed if rejection mechanism fails (fail-open behavior)
  - _Requirements: 17.1, 17.2, 17.3, 17.4_

- [ ]* 17.1 Write integration tests for rate limiting
  - Make 11 rapid requests from same session within 1 minute
  - Verify first 10 succeed and 11th returns 429 status
  - Verify retry-after header is present in 429 response
  - Test that requests after window resets are allowed
  - _Requirements: 17.1, 17.2, 17.4_

- [ ] 18. Implement accessibility features
  - Add `aria-live="polite"` to timer display in `SectionTimer` component
  - Announce time at meaningful intervals (every 5 minutes, last minute, time expired)
  - Add keyboard shortcuts to `AudioRecorder` (Space bar for start/stop recording)
  - Use semantic HTML elements and ARIA labels in `ScoreReport` component
  - Test with screen reader to verify announcements and navigation
  - _Requirements: 18.1, 18.2, 18.3_

- [ ]* 18.1 Write accessibility compliance tests
  - Verify timer has aria-live attribute
  - Verify audio recorder responds to keyboard shortcuts
  - Verify score report uses semantic HTML (headers, lists, sections)
  - Verify ARIA labels are present on interactive elements
  - _Requirements: 18.1, 18.2, 18.3_

- [~] 19. Final checkpoint - End-to-end integration testing
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The implementation leverages three existing components: `SectionTimer`, `WritingSection`, and `AudioRecorder` - integration only required
- Backend already has grading endpoints (`/api/grade/writing`, `/api/grade/speaking`) and timer endpoints - only submission endpoint needs creation
- Database schema already exists - no migrations required
- IRT scoring service already exists in backend - reuse for reading/listening sections
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples and edge cases
- Each task references specific requirements for traceability

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1", "1.1"]
    },
    {
      "id": 1,
      "tasks": ["2", "2.1"]
    },
    {
      "id": 2,
      "tasks": ["3", "3.1", "4", "4.1"]
    },
    {
      "id": 3,
      "tasks": ["6", "6.1", "6.2"]
    },
    {
      "id": 4,
      "tasks": ["7", "7.1"]
    },
    {
      "id": 5,
      "tasks": ["8", "8.1", "8.2", "10"]
    },
    {
      "id": 6,
      "tasks": ["11", "11.1"]
    },
    {
      "id": 7,
      "tasks": ["12", "12.1", "13", "13.1"]
    },
    {
      "id": 8,
      "tasks": ["14", "14.1", "15", "15.1", "15.2", "16", "16.1"]
    },
    {
      "id": 9,
      "tasks": ["17", "17.1", "18", "18.1"]
    }
  ]
}
```
