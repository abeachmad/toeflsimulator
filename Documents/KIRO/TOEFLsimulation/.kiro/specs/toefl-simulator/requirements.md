# Requirements Document

## Introduction

The TOEFL iBT 2026 Test Simulator is a production-ready, full-stack web application that replicates the official ETS TOEFL iBT 2026 exam experience. The system implements a 90-minute timed adaptive test with four sections (Reading, Listening, Writing, Speaking) and uses a 2-stage multistage adaptive testing (MST) engine based on Item Response Theory (IRT) 3-parameter logistic (3PL) model. The system provides AI-powered automated grading using the Google Gemini API and dual scoring output (CEFR Band Scale 1-6 and Equivalent Score 0-30 per section).

## Glossary

- **Test_Simulator**: The complete TOEFL iBT 2026 web application system
- **MST_Engine**: The Multistage Adaptive Testing engine that selects test modules based on examinee ability
- **IRT_Scorer**: The Item Response Theory scoring component using the 3PL model
- **Ability_Estimator**: The component that calculates examinee ability (θ) using Maximum Likelihood Estimation
- **Gemini_Grader**: The AI-powered grading component using Google Gemini API
- **Session_Manager**: The component managing exam session state and persistence
- **Timer_Service**: The server-side component that validates exam timing
- **UI_Controller**: The frontend component managing the official ETS user interface
- **Data_Loader**: The component that parses and loads test items from external datasets
- **Review_Modal**: The interface component displaying question navigation and status
- **Gatekeeper**: The component that enforces passage reading completion before question access
- **Audio_Recorder**: The component that captures and processes speaking responses
- **Progress_Store**: The persistence layer using Zustand with persist middleware
- **Module**: A set of test items at a specific difficulty level (Easy, Medium, Hard)
- **Stage**: A phase in the adaptive test (Stage 1 or Stage 2)
- **CEFR**: Common European Framework of Reference for Languages
- **3PL_Model**: 3-Parameter Logistic IRT model with discrimination, difficulty, and guessing parameters

## Requirements

### Requirement 1: Exam Session Management

**User Story:** As a test taker, I want the system to manage my exam session reliably, so that my progress is preserved even if my browser crashes or power fails.

#### Acceptance Criteria

1. WHEN a test taker starts a new exam, THE Session_Manager SHALL create a unique session identifier and initialize session state
2. WHILE the exam is active, THE Session_Manager SHALL persist session state to local storage after each answer submission
3. WHEN a browser refresh or crash occurs, THE Session_Manager SHALL restore the exam session from persisted state
4. WHEN session restoration occurs, THE Session_Manager SHALL preserve the current section, module, question position, all submitted answers, and remaining time
5. THE Session_Manager SHALL prevent access to previously submitted modules
6. FOR ALL session state changes, persisting then restoring SHALL produce equivalent session state (round-trip property)

### Requirement 2: Timer Management and Validation

**User Story:** As a system administrator, I want exam timing to be validated server-side, so that test takers cannot manipulate the timer through client-side code.

#### Acceptance Criteria

1. WHEN an exam session starts, THE Timer_Service SHALL record the server timestamp and calculate the expiration time
2. WHILE the exam is active, THE UI_Controller SHALL display remaining time in HH:MM:SS format
3. WHEN the UI_Controller requests time validation, THE Timer_Service SHALL return the remaining time based on server-side calculation
4. WHEN the server-calculated time expires, THE Timer_Service SHALL automatically submit the current section
5. IF a submission timestamp does not exceed the expiration time, THEN THE Timer_Service SHALL accept the submission
6. IF a submission timestamp exceeds the expiration time, THEN THE Timer_Service SHALL reject the submission

### Requirement 3: Reading Section Implementation

**User Story:** As a test taker, I want to complete the Reading section with adaptive modules, so that the test matches my ability level.

#### Acceptance Criteria

1. THE Test_Simulator SHALL provide a maximum of 50 reading items across Complete Words, Daily Life, and Academic Passage question types
2. THE Test_Simulator SHALL allocate approximately 30 minutes for the Reading section
3. WHEN the Reading section begins, THE MST_Engine SHALL present a Stage 1 module with medium difficulty
4. WHEN Stage 1 is submitted, THE Ability_Estimator SHALL calculate the ability estimate (θ) using Maximum Likelihood Estimation
5. WHEN ability calculation completes, THE MST_Engine SHALL proceed with Stage 2 routing
6. WHEN θ < -0.8, THE MST_Engine SHALL route to an Easy Stage 2 module
7. WHEN -0.8 ≤ θ ≤ 0.8, THE MST_Engine SHALL route to a Medium Stage 2 module
8. WHEN θ > 0.8, THE MST_Engine SHALL route to a Hard Stage 2 module
9. THE UI_Controller SHALL display reading passages on the right side and questions on the left side in a split-screen layout

### Requirement 4: Listening Section Implementation

**User Story:** As a test taker, I want to complete the Listening section with adaptive modules, so that the test matches my ability level.

#### Acceptance Criteria

1. THE Test_Simulator SHALL provide up to 47 listening items across Choose Response, Conversations, and Academic Talks question types
2. THE Test_Simulator SHALL allocate approximately 29 minutes for the Listening section
3. WHEN the Listening section begins, THE MST_Engine SHALL present a Stage 1 module with medium difficulty
4. WHEN Stage 1 is submitted, THE Ability_Estimator SHALL calculate the ability estimate (θ) using Maximum Likelihood Estimation
5. WHEN θ < -0.8, THE MST_Engine SHALL route to an Easy Stage 2 module
6. WHEN -0.8 ≤ θ ≤ 0.8, THE MST_Engine SHALL route to a Medium Stage 2 module
7. WHEN θ > 0.8, THE MST_Engine SHALL route to a Hard Stage 2 module
8. THE UI_Controller SHALL provide audio playback controls with volume adjustment

### Requirement 5: Writing Section Implementation

**User Story:** As a test taker, I want to complete the Writing section with AI-powered grading, so that I receive accurate assessment of my writing ability.

#### Acceptance Criteria

1. THE Test_Simulator SHALL provide up to 12 writing items across Build Sentence, Email, and Academic Discussion task types
2. THE Test_Simulator SHALL allocate approximately 23 minutes for the Writing section
3. THE UI_Controller SHALL provide a textarea with real-time word count display
4. THE UI_Controller SHALL provide cut, paste, and undo controls for text editing
5. WHEN a writing response is submitted, THE Gemini_Grader SHALL analyze the text using the Google Gemini API
6. WHEN the Gemini_Grader returns CEFR band or scale score values outside valid ranges, THE IRT_Scorer SHALL clamp CEFR bands above 6 to 6 and scale scores above 30 to 30
7. WHEN the Gemini_Grader returns CEFR band or scale score values outside valid ranges, THE IRT_Scorer SHALL clamp CEFR bands below 1 to 1 and scale scores below 0 to 0
8. THE Gemini_Grader SHALL return structured JSON output containing CEFR band (1-6), scale score (0-30), grammar corrections, and lexical analysis
9. THE Gemini_Grader SHALL use the @google/genai SDK for API communication

### Requirement 6: Speaking Section Implementation

**User Story:** As a test taker, I want to complete the Speaking section with AI-powered pronunciation assessment, so that I receive accurate evaluation of my speaking ability.

#### Acceptance Criteria

1. THE Test_Simulator SHALL provide up to 11 speaking items across Listen & Repeat and Simulated Interview task types
2. THE Test_Simulator SHALL allocate approximately 8 minutes for the Speaking section
3. WHEN a speaking task begins, THE Audio_Recorder SHALL capture audio input from the test taker's microphone
4. WHEN recording completes, THE Audio_Recorder SHALL upload the audio file to the Gemini_Grader
5. THE Gemini_Grader SHALL extract accuracyScore, fluencyScore, prosodyScore, and completenessScore from the audio
6. THE Gemini_Grader SHALL use Gemini Flash Pronunciation API for audio analysis
7. THE Gemini_Grader SHALL return scores in a structured format for display

### Requirement 7: IRT 3PL Model Implementation

**User Story:** As a psychometrician, I want the system to use IRT 3PL model for item calibration and scoring, so that ability estimates are psychometrically sound.

#### Acceptance Criteria

1. THE IRT_Scorer SHALL implement the 3-Parameter Logistic model with discrimination (a), difficulty (b), and guessing (c) parameters
2. WHEN calculating response probability, THE IRT_Scorer SHALL apply the formula: P(θ) = c + (1-c) / (1 + exp(-a(θ-b)))
3. THE Ability_Estimator SHALL use Maximum Likelihood Estimation to calculate ability (θ) from response patterns
4. THE Data_Loader SHALL store item parameters (a, b, c) in PostgreSQL JSONB columns
5. FOR ALL items with known parameters, calculating probability then sampling responses then estimating ability SHALL produce ability estimates within expected tolerance of the true ability (metamorphic property)

### Requirement 8: Adaptive Routing Implementation

**User Story:** As a test designer, I want module-level adaptive routing based on ability estimates, so that test takers receive appropriately challenging content.

#### Acceptance Criteria

1. WHEN Stage 1 ability estimate (θ) is calculated, THE MST_Engine SHALL apply routing thresholds: θ < -0.8 (Easy), -0.8 ≤ θ ≤ 0.8 (Medium), θ > 0.8 (Hard)
2. THE MST_Engine SHALL select Stage 2 modules from the appropriate difficulty tier
3. WHEN module selection is required, THE MST_Engine SHALL allow override of routing decisions based on module availability or test design constraints
4. THE MST_Engine SHALL ensure Stage 2 modules have non-overlapping content with Stage 1 modules
5. WHEN database loading fails after module selection, THE MST_Engine SHALL attempt fallback to an alternative module of the same difficulty tier
6. IF no alternative module is available, THEN THE MST_Engine SHALL log the error and display an error message to the test taker
7. THE MST_Engine SHALL apply adaptive routing only to Reading and Listening sections

### Requirement 9: Dual Scoring System

**User Story:** As a test taker, I want to receive both CEFR band scores and equivalent scores, so that I understand my performance in multiple frameworks.

#### Acceptance Criteria

1. WHEN a section is completed, THE IRT_Scorer SHALL calculate a CEFR band score from 1 to 6
2. THE IRT_Scorer SHALL calculate an equivalent score from 0 to 30 for each section
3. THE IRT_Scorer SHALL apply the official ETS 2026 conversion table for mapping ability estimates to CEFR bands and equivalent scores
4. THE Test_Simulator SHALL display both CEFR band and equivalent score for each section
5. THE Test_Simulator SHALL calculate and display a total score (sum of four section equivalent scores, 0-120 range)

### Requirement 10: Official ETS UI Implementation

**User Story:** As a test taker, I want the interface to match the official ETS TOEFL iBT exam, so that my practice experience is realistic.

#### Acceptance Criteria

1. THE UI_Controller SHALL display a dark charcoal or navy header containing timer, volume control, help button, review button, and hide/next buttons
2. THE UI_Controller SHALL use the official ETS color scheme and typography
3. WHEN displaying reading passages with content, THE UI_Controller SHALL place passages on the right side and questions on the left side
4. THE UI_Controller SHALL provide inline text inputs for short answer questions
5. THE UI_Controller SHALL provide textarea with word count for essay questions
6. THE UI_Controller SHALL implement responsive layout that adapts to different screen sizes

### Requirement 11: Gatekeeper Rule Enforcement

**User Story:** As a test administrator, I want reading questions locked until passages are fully read, so that test takers engage with the content properly.

#### Acceptance Criteria

1. WHEN a reading passage with content height greater than zero is displayed, THE Gatekeeper SHALL lock all associated questions
2. WHILE the test taker scrolls the passage, THE Gatekeeper SHALL track scroll position
3. WHEN the test taker manually scrolls to the bottom of the passage, THE Gatekeeper SHALL unlock all associated questions
4. WHEN a reading passage has zero content height, THE Gatekeeper SHALL allow normal input for associated questions
5. THE Gatekeeper SHALL provide visual indication of locked question state
6. IF a test taker attempts to answer a locked question, THEN THE Gatekeeper SHALL prevent input and display a notification

### Requirement 12: Review Modal Implementation

**User Story:** As a test taker, I want to review all questions in the current module, so that I can check my answers before submission.

#### Acceptance Criteria

1. WHEN the test taker clicks the review button, THE UI_Controller SHALL display the Review_Modal
2. IF the Review_Modal fails to display, THEN THE Test_Simulator SHALL fail silently and allow the test taker to continue
3. THE Review_Modal SHALL show all questions with their answered, unanswered, or not seen status
4. WHEN the test taker clicks a question in the Review_Modal, THE UI_Controller SHALL navigate to that question
5. THE Review_Modal SHALL display a visual indicator for each question state using distinct colors or icons
6. THE Review_Modal SHALL allow the test taker to navigate to any question within the current active module

### Requirement 13: Navigation Rules

**User Story:** As a test taker, I want to navigate freely within the current module but not return to previous modules, so that the test follows official ETS rules.

#### Acceptance Criteria

1. WHILE a module is active, THE UI_Controller SHALL allow navigation to any question within that module
2. THE UI_Controller SHALL allow skipping questions and returning to them later within the same module
3. THE UI_Controller SHALL allow changing answers within the current module
4. WHEN the test taker submits a module, THE Session_Manager SHALL mark only the submitted module as completed
5. THE UI_Controller SHALL prevent navigation to previously completed modules
6. THE UI_Controller SHALL proceed with module submission without displaying explicit confirmation

### Requirement 14: Test Data Loading and Parsing

**User Story:** As a system administrator, I want to load test items from official datasets, so that the simulator contains authentic TOEFL content.

#### Acceptance Criteria

1. THE Data_Loader SHALL parse TOEFL-QA Dataset from GitHub or Hugging Face repositories
2. THE Data_Loader SHALL parse Sentence Insertion Dataset from EMNLP sources
3. THE Data_Loader SHALL parse Academic Discussion Dataset from official sources
4. THE Data_Loader SHALL parse Synonym Match Dataset (Wordlink) from official sources
5. THE Data_Loader SHALL parse TOEFL-Spell Dataset from ETS sources
6. THE Data_Loader SHALL extract item content, correct answers, distractors, and IRT parameters (a, b, c) from each dataset
7. THE Data_Loader SHALL store parsed items in PostgreSQL with JSONB columns for adaptive module metadata
8. WHEN parsing completes, THE Data_Loader SHALL validate that all required fields are present for each item
9. IF validation fails for any item in a batch, THEN THE Data_Loader SHALL reject the entire batch

### Requirement 15: Pretty Printer for Test Items

**User Story:** As a content manager, I want to export test items in a standardized format, so that I can review and validate item content.

#### Acceptance Criteria

1. THE Data_Loader SHALL format test items into a standardized JSON structure
2. THE Data_Loader SHALL include item ID, type, content, options, correct answer, IRT parameters, and metadata in the output
3. FOR ALL valid test item objects, parsing then printing then parsing SHALL produce an equivalent object (round-trip property)

### Requirement 16: Database Schema Implementation

**User Story:** As a backend developer, I want a well-structured database schema, so that test data is organized and queryable efficiently.

#### Acceptance Criteria

1. THE Test_Simulator SHALL use PostgreSQL as the primary database
2. THE Test_Simulator SHALL store item content in a table with columns: id, section, type, difficulty_level, content, options (JSONB), correct_answer, irt_parameters (JSONB), metadata (JSONB)
3. THE Test_Simulator SHALL store exam sessions in a table with columns: session_id, user_id, start_time, end_time, current_section, current_module, current_question, answers (JSONB), ability_estimates (JSONB), status
4. THE Test_Simulator SHALL create indexes on frequently queried fields: section, difficulty_level, session_id, user_id
5. THE Test_Simulator SHALL use JSONB columns for adaptive module configurations and response data

### Requirement 17: Gemini API Integration

**User Story:** As a test taker, I want my writing and speaking responses graded by AI, so that I receive immediate feedback.

#### Acceptance Criteria

1. THE Gemini_Grader SHALL use the @google/genai SDK for all API communications
2. THE Gemini_Grader SHALL authenticate using the Google Gemini API Free Tier credentials
3. WHEN analyzing writing responses, THE Gemini_Grader SHALL use the Gemini Flash model
4. WHEN analyzing speaking responses, THE Gemini_Grader SHALL use the Gemini Flash Pronunciation API
5. THE Gemini_Grader SHALL implement retry logic with exponential backoff for API failures
6. IF the API rate limit is exceeded, THEN THE Gemini_Grader SHALL queue requests and retry after the rate limit resets
7. THE Gemini_Grader SHALL log all API requests and responses for auditing purposes

### Requirement 18: Frontend State Management

**User Story:** As a frontend developer, I want centralized state management with persistence, so that application state is consistent and recoverable.

#### Acceptance Criteria

1. THE UI_Controller SHALL use Zustand for global state management
2. THE UI_Controller SHALL use Zustand persist middleware to save state to local storage
3. THE Progress_Store SHALL persist current section, module, question index, all answers, ability estimates, and timer state
4. WHEN the application loads, THE Progress_Store SHALL restore persisted state
5. WHEN an exam session is reset, THE Progress_Store SHALL clear persisted state and start fresh
6. WHEN an exam session is completed, THE Progress_Store SHALL clear persisted state
7. THE Progress_Store SHALL prevent restoration of state after a reset operation
8. THE Progress_Store SHALL use versioned state schema to handle state migration across application updates

### Requirement 19: Error Handling and Recovery

**User Story:** As a test taker, I want the system to handle errors gracefully, so that technical issues do not invalidate my exam session.

#### Acceptance Criteria

1. WHEN a network error occurs during answer submission, THE Session_Manager SHALL queue the submission for retry
2. WHEN the Gemini API returns an error, THE Gemini_Grader SHALL log the error and return a default score with error indication
3. WHEN the Timer_Service is unreachable, THE UI_Controller SHALL use local timer with warning indication
4. WHEN an actual error condition exists, THE Test_Simulator SHALL display a user-friendly error message
5. THE Test_Simulator SHALL provide a "Contact Support" option for unrecoverable errors
6. THE Test_Simulator SHALL log all errors to a centralized error tracking service

### Requirement 20: Audio Recording and Processing

**User Story:** As a test taker, I want to record my speaking responses reliably, so that they are submitted for grading.

#### Acceptance Criteria

1. WHEN a speaking task begins, THE Audio_Recorder SHALL request microphone permissions from the browser
2. THE Audio_Recorder SHALL display recording status (recording, paused, stopped) to the test taker
3. THE Audio_Recorder SHALL capture audio in a format compatible with Gemini Flash Pronunciation API (MP3 or WAV)
4. WHEN recording completes and file size exceeds 10MB, THE Audio_Recorder SHALL compress the audio
5. IF compression fails, THEN THE Audio_Recorder SHALL upload the original file or split into smaller chunks
6. WHEN compression or upload preparation succeeds, THE Audio_Recorder SHALL upload audio files to the backend API endpoint
7. WHEN microphone access is denied, THE Audio_Recorder SHALL display an error message and allow the test taker to skip the speaking section

### Requirement 21: Performance and Scalability

**User Story:** As a system administrator, I want the system to handle multiple concurrent users efficiently, so that test takers have a smooth experience.

#### Acceptance Criteria

1. THE Test_Simulator SHALL handle at least 100 concurrent exam sessions without performance degradation
2. WHEN loading a question, THE UI_Controller SHALL display content within 200 milliseconds
3. THE MST_Engine SHALL calculate ability estimates and select next modules within 500 milliseconds
4. THE Test_Simulator SHALL use database connection pooling to optimize query performance
5. THE Test_Simulator SHALL implement caching for frequently accessed test items
6. THE Test_Simulator SHALL compress API responses to reduce bandwidth usage

### Requirement 22: Security and Data Privacy

**User Story:** As a test taker, I want my exam data to be secure and private, so that my performance is protected.

#### Acceptance Criteria

1. THE Test_Simulator SHALL encrypt all data in transit using HTTPS/TLS
2. THE Test_Simulator SHALL hash and salt user passwords before storing in the database
3. THE Test_Simulator SHALL implement CORS policies to restrict API access to authorized domains
4. THE Test_Simulator SHALL validate and sanitize all user inputs to prevent injection attacks
5. THE Test_Simulator SHALL implement rate limiting on API endpoints to prevent abuse
6. THE Test_Simulator SHALL comply with GDPR and CCPA data privacy regulations

### Requirement 23: Accessibility Compliance

**User Story:** As a test taker with disabilities, I want the interface to be accessible, so that I can complete the exam using assistive technologies.

#### Acceptance Criteria

1. THE UI_Controller SHALL implement ARIA labels for all interactive elements
2. THE UI_Controller SHALL support keyboard navigation for all exam functions
3. THE UI_Controller SHALL provide sufficient color contrast (WCAG AA minimum 4.5:1 for text)
4. THE UI_Controller SHALL support screen readers for all content and navigation
5. THE UI_Controller SHALL provide text alternatives for all audio content in the Listening section
6. WHEN extended time is configured in the user profile, THE Test_Simulator SHALL allow extended time accommodations
