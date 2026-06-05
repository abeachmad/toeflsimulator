# Requirements Document

## Introduction

The TOEFL Exam Completion feature completes the TOEFL iBT 2026 simulator by integrating existing components and implementing missing functionality to provide an authentic exam experience. The system must deliver proper question counts per section, visible countdown timers, specialized input methods for writing and speaking sections, automatic section transitions, and comprehensive score reporting aligned with official TOEFL iBT 2026 format.

## Glossary

- **Section**: One of the four major test components (Reading, Listening, Writing, Speaking)
- **Item**: A single test question or task within a section
- **Session**: A single exam attempt with unique identifier
- **Section_Timer**: Component that displays countdown and manages time limits
- **Scale_Score**: Numeric score from 0-30 for each section
- **CEFR_Band**: Common European Framework of Reference level (A1, A2, B1, B2, C1, C2)
- **IRT**: Item Response Theory, used for scoring Reading and Listening sections
- **Gemini_API**: AI service used for grading Writing and Speaking responses
- **Section_Display**: Main container component for displaying section content
- **Audio_Recorder**: Component for recording and submitting speaking responses
- **Writing_Section**: Component for text input and essay submission
- **Score_Report**: Component displaying final exam results

## Requirements

### Requirement 1: Section Question Limits

**User Story:** As a test taker, I want each section to display the correct number of questions according to official TOEFL iBT 2026 format, so that I have an authentic exam experience.

#### Acceptance Criteria

1. WHEN the Reading section loads, THE Section_Display SHALL fetch exactly 20 items from the API
2. WHEN the Listening section loads, THE Section_Display SHALL fetch exactly 28 items from the API
3. WHEN the Writing section loads, THE Section_Display SHALL fetch exactly 2 items from the API
4. WHEN the Speaking section loads, THE Section_Display SHALL fetch exactly 4 items from the API

### Requirement 2: Section Time Limits

**User Story:** As a test taker, I want to see a countdown timer for each section, so that I can manage my time effectively during the exam.

#### Acceptance Criteria

1. WHEN the Reading section loads, THE Section_Timer SHALL display a countdown starting from 35 minutes
2. WHEN the Listening section loads, THE Section_Timer SHALL display a countdown starting from 36 minutes
3. WHEN the Writing section loads, THE Section_Timer SHALL display a countdown starting from 29 minutes
4. WHEN the Speaking section loads, THE Section_Timer SHALL display a countdown starting from 16 minutes
5. WHILE the timer is running, THE Section_Timer SHALL update the display every second in MM:SS format
6. WHEN the timer reaches 00:00, THE Section_Timer SHALL stop updating and prevent further countdown
7. WHEN the timer reaches 5 minutes remaining, THE Section_Timer SHALL change the display color to orange
8. WHEN the timer reaches 1 minute remaining, THE Section_Timer SHALL change the display color to red

### Requirement 3: Timer Expiry and Auto-Submit

**User Story:** As a test taker, I want the system to automatically submit my answers when time expires, so that I don't lose my work.

#### Acceptance Criteria

1. WHEN the Section_Timer reaches 00:00, THE Section_Display SHALL invoke the section completion handler
2. WHEN the section completion handler is invoked, THE Section_Display SHALL submit all current answers to the backend API
3. WHEN answers are submitted successfully AND navigation succeeds, THE Section_Display SHALL navigate to the next section in sequence
4. IF navigation fails after successful answer submission, THEN THE Section_Display SHALL leave the user on the current section
5. WHEN the Speaking section completes, THE Section_Display SHALL navigate to the results page

### Requirement 4: Section Navigation Sequence

**User Story:** As a test taker, I want to progress through sections in the correct order, so that I follow the official TOEFL exam structure.

#### Acceptance Criteria

1. WHEN the Reading section completes, THE Section_Display SHALL navigate to the Listening section
2. WHEN the Listening section completes, THE Section_Display SHALL navigate to the Writing section
3. WHEN the Writing section completes, THE Section_Display SHALL navigate to the Speaking section
4. WHEN the Speaking section completes, THE Section_Display SHALL navigate to the Score Report page

### Requirement 5: Writing Section Input Interface

**User Story:** As a test taker, I want to type my essay responses in a proper text editor, so that I can compose and edit my writing effectively.

#### Acceptance Criteria

1. WHEN the Writing section loads, THE Section_Display SHALL render the Writing_Section component
2. WHEN a writing task is displayed, THE Writing_Section SHALL provide a text editor with rich text formatting capabilities
3. WHEN the test taker types in the editor, THE Writing_Section SHALL display a live word count
4. WHEN the word count is below the minimum requirement, THE Writing_Section SHALL disable the submit button and prevent all submission attempts including keyboard shortcuts
5. WHEN the word count is below the minimum requirement, THE Writing_Section SHALL block API calls to the grading service
6. WHEN the test taker submits an essay, THE Writing_Section SHALL send the text to the Gemini_API for grading
7. WHEN grading completes, THE Writing_Section SHALL return a Scale_Score and CEFR_Band to the parent component

### Requirement 6: Speaking Section Recording Interface

**User Story:** As a test taker, I want to record my speaking responses with proper preparation and response times, so that I can demonstrate my speaking ability.

#### Acceptance Criteria

1. WHEN the Speaking section loads, THE Section_Display SHALL render the Audio_Recorder component
2. WHEN a speaking task is displayed, THE Audio_Recorder SHALL request microphone permission from the browser
3. WHEN the recording interface starts, THE Audio_Recorder SHALL display a preparation timer counting down from the task-specific prep time
4. WHEN the preparation timer reaches 00:00, THE Audio_Recorder SHALL automatically start recording audio
5. WHEN recording starts, THE Audio_Recorder SHALL display a response timer counting down from the task-specific response time
6. WHEN the response timer reaches 00:00, THE Audio_Recorder SHALL automatically stop recording
7. WHEN recording completes, THE Audio_Recorder SHALL send the audio file to the Gemini_API for grading
8. WHEN grading completes, THE Audio_Recorder SHALL return a Scale_Score and CEFR_Band to the parent component

### Requirement 7: Score Report Display

**User Story:** As a test taker, I want to see my scores for all sections after completing the exam, so that I can understand my performance.

#### Acceptance Criteria

1. WHEN the Score_Report loads AND at least one section has been completed, THE Score_Report SHALL display the Scale_Score for each completed section
2. WHEN the Score_Report loads AND at least one section has been completed, THE Score_Report SHALL display the CEFR_Band for each completed section
3. WHEN the Score_Report loads AND at least one section has been completed, THE Score_Report SHALL calculate and display the total score as the sum of all four section scores
4. WHEN the Score_Report loads AND at least one section has been completed, THE Score_Report SHALL display a completion badge indicating how many sections were completed
5. WHEN the Score_Report loads AND at least one section has been completed, THE Score_Report SHALL display AI-generated feedback for each completed section

### Requirement 8: Answer Submission Persistence

**User Story:** As a system administrator, I want all test taker answers to be saved to the database, so that responses are preserved for scoring and review.

#### Acceptance Criteria

1. WHEN a section completes, THE Backend_API SHALL receive all answers for that section
2. WHEN the Backend_API receives answers, THE Backend_API SHALL save each answer to the responses table with session_id and item_id
3. IF an answer already exists for a given session_id and item_id, THEN THE Backend_API SHALL update the existing response_text
4. WHEN answers are saved successfully, THE Backend_API SHALL return a success confirmation to the frontend

### Requirement 9: Reading and Listening Auto-Scoring

**User Story:** As a test taker, I want my Reading and Listening sections to be scored immediately, so that I can see my results without delay.

#### Acceptance Criteria

1. WHEN Reading section answers are submitted, THE Backend_API SHALL calculate the Scale_Score using IRT parameters
2. WHEN Listening section answers are submitted, THE Backend_API SHALL calculate the Scale_Score using IRT parameters
3. WHEN the IRT score is calculated, THE Backend_API SHALL map the theta value to a Scale_Score between 0 and 30
4. WHEN the Scale_Score is calculated, THE Backend_API SHALL map the Scale_Score to a CEFR_Band

### Requirement 10: Writing Task Requirements

**User Story:** As a test taker, I want to complete two different types of writing tasks, so that I can demonstrate my writing ability in multiple contexts.

#### Acceptance Criteria

1. WHEN Writing Task 1 loads, THE Writing_Section SHALL display an Integrated Writing task with reading passage and audio lecture
2. WHEN Writing Task 2 loads, THE Writing_Section SHALL display an Academic Discussion task with professor question and student responses
3. WHEN a writing task is displayed, THE Writing_Section SHALL ensure only one task type is displayed at a time
4. WHEN Task 1 is displayed, THE Writing_Section SHALL enforce a minimum word count of 150 words
5. WHEN Task 2 is displayed, THE Writing_Section SHALL enforce a minimum word count of 100 words

### Requirement 11: Speaking Task Requirements

**User Story:** As a test taker, I want to complete four different types of speaking tasks with appropriate timing, so that I can demonstrate my speaking ability across various formats.

#### Acceptance Criteria

1. WHEN Speaking Task 1 loads, THE Audio_Recorder SHALL use a preparation time of exactly 15 seconds and response time of exactly 45 seconds
2. WHEN Speaking Task 2 loads, THE Audio_Recorder SHALL use a preparation time of exactly 30 seconds and response time of exactly 60 seconds
3. WHEN Speaking Task 3 loads, THE Audio_Recorder SHALL use a preparation time of exactly 20 seconds and response time of exactly 60 seconds
4. WHEN Speaking Task 4 loads, THE Audio_Recorder SHALL use a preparation time of exactly 20 seconds and response time of exactly 60 seconds

### Requirement 12: Timer State Persistence

**User Story:** As a test taker, I want my timer state to be preserved if I refresh the page, so that I don't lose time on my exam.

#### Acceptance Criteria

1. WHEN a section timer starts, THE Section_Timer SHALL call the backend API to record the start time
2. WHEN the Section_Display loads, THE Section_Timer SHALL call the backend API to retrieve the current timer state
3. WHEN timer state is retrieved AND remaining time would be negative, THE Section_Timer SHALL clamp the remaining time to zero
4. WHEN timer state is retrieved AND remaining time is positive, THE Section_Timer SHALL calculate remaining time based on start time and current time
5. WHEN a section timer stops, THE Section_Timer SHALL call the backend API to record the stop time

### Requirement 13: Microphone Permission Handling

**User Story:** As a test taker, I want clear feedback if my microphone is not available, so that I understand why I cannot record my speaking responses.

#### Acceptance Criteria

1. WHEN the Audio_Recorder requests microphone permission, THE Audio_Recorder SHALL detect if permission is denied by the browser
2. IF microphone permission is denied, THEN THE Audio_Recorder SHALL display an error message explaining the issue
3. IF microphone permission is denied, THEN THE Audio_Recorder SHALL display instructions for enabling microphone access

### Requirement 14: Grading API Failure Handling

**User Story:** As a test taker, I want to receive a score even if the AI grading service fails, so that I can still see my results.

#### Acceptance Criteria

1. WHEN the Gemini_API fails to respond within 30 seconds, THE Backend_API SHALL return a fallback score
2. WHEN a fallback score is returned, THE Backend_API SHALL flag the response for manual review in the database
3. WHEN a fallback score is returned, THE Score_Report SHALL display a message indicating the score is preliminary

### Requirement 15: Audio File Validation

**User Story:** As a system administrator, I want to validate audio files before processing, so that the system handles only appropriate files.

#### Acceptance Criteria

1. WHEN an audio file is submitted, THE Backend_API SHALL validate that the file size is less than 10 megabytes
2. WHEN an audio file is submitted, THE Backend_API SHALL validate that the file format is WAV
3. IF the audio file exceeds 10 megabytes, THEN THE Backend_API SHALL return an error message and reject the submission
4. IF the audio file is not WAV format, THEN THE Backend_API SHALL return an error message and reject the submission
5. IF the audio file violates both size and format requirements, THEN THE Backend_API SHALL return separate error messages for each validation failure

### Requirement 16: Section Data Caching

**User Story:** As a system administrator, I want section items to be cached in memory, so that the system performs efficiently under load.

#### Acceptance Criteria

1. WHEN a section is requested for the first time, THE Backend_API SHALL fetch items from the database and store them in memory cache
2. WHEN the same section is requested again AND cache is available, THE Backend_API SHALL retrieve items from memory cache instead of querying the database
3. WHEN the same section is requested again AND cache is unavailable or expired, THE Backend_API SHALL fetch items from the database
4. WHEN section items are cached, THE Backend_API SHALL set a cache expiration time of 1 hour

### Requirement 17: Rate Limiting for Grading

**User Story:** As a system administrator, I want to rate limit grading API calls, so that the system is protected from abuse and excessive costs.

#### Acceptance Criteria

1. WHEN a grading request is received, THE Backend_API SHALL check the number of requests from that session in the last minute
2. IF the session has made more than 10 grading requests in the last minute, THEN THE Backend_API SHALL reject the request with a rate limit error
3. IF the rejection mechanism fails when rate limit is exceeded, THEN THE Backend_API SHALL allow the request to proceed
4. WHEN a rate limit error occurs, THE Backend_API SHALL return a 429 status code with retry-after header

### Requirement 18: Accessibility Support

**User Story:** As a test taker using assistive technology, I want the timer and controls to be accessible, so that I can navigate the exam independently.

#### Acceptance Criteria

1. WHEN the Section_Timer updates, THE Section_Timer SHALL use aria-live="polite" to announce time changes to screen readers at meaningful intervals
2. WHEN the Audio_Recorder is active, THE Audio_Recorder SHALL support keyboard shortcuts for starting and stopping recording
3. WHEN the Score_Report is displayed, THE Score_Report SHALL use semantic HTML and ARIA labels for all score elements
