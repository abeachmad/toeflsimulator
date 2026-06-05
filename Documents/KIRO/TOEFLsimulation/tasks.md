# Implementation Plan: TOEFL iBT 2026 Test Simulator

## Overview

This implementation plan breaks down the TOEFL iBT 2026 Test Simulator into discrete coding tasks. The system is a full-stack web application using React/TypeScript frontend, Node.js/Express backend, PostgreSQL database, and Google Gemini API for AI-powered grading. The implementation follows a bottom-up approach: database schema → backend services → API endpoints → frontend components → integration → testing.

## Tasks

### Phase 1: Project Setup and Database Foundation

- [x] 1. Initialize project structure and dependencies
  - Create monorepo structure with frontend and backend workspaces
  - Initialize React 18 + TypeScript + Vite frontend project
  - Initialize Node.js 20+ + TypeScript + Express backend project
  - Install core dependencies: Zustand, TailwindCSS, PostgreSQL client (pg), @google/genai SDK
  - Configure TypeScript strict mode for both projects
  - Set up Vitest and React Testing Library
  - Create Docker Compose configuration for PostgreSQL 16+ and Redis
  - _Requirements: Technology Stack (Design Overview)_

- [x] 2. Implement database schema and migrations
  - Create PostgreSQL schema with `test_items` table (id, section, type, difficulty_level, content, options JSONB, correct_answer, irt_parameters JSONB, metadata JSONB)
  - Create `exam_sessions` table (session_id, user_id, start_time, end_time, expiration_time, current_section, current_module, current_question, answers JSONB, ability_estimates JSONB, status, completed_modules JSONB)
  - Create `cefr_conversion` table (section, theta_min, theta_max, cefr_band, scale_score)
  - Create indexes on section, difficulty_level, session_id, user_id
  - Write migration scripts using node-pg-migrate or similar
  - _Requirements: 16.2, 16.3, 16.4, 16.5_

- [x] 2.1 Write unit tests for database connection and schema
  - Test database connection pooling setup
  - Test schema creation and rollback
  - Test index creation
  - _Requirements: 16.2, 21.4_

### Phase 2: Core Backend Services - IRT Scoring Engine

- [x] 3. Implement IRT 3PL Scorer Service
  - [x] 3.1 Create `IRT3PLScorer` class with database pool injection
    - Implement `calculate3PLProbability(theta, a, b, c)` using formula: P(θ) = c + (1-c) / (1 + exp(-1.702*a*(θ-b)))
    - Implement `estimateAbilityMLE(responses, items)` using Newton-Raphson method (max 50 iterations, convergence 0.001)
    - Implement `convertToCEFR(theta, section)` with database lookup and fallback
    - Implement `convertToScaleScore(theta, section)` with database lookup and fallback
    - Implement `clampScores(scores)` to enforce CEFR [1-6] and scale [0-30] ranges
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 5.6, 5.7, 9.1, 9.2, 9.3_

  - [x] 3.2 Write property test for IRT 3PL probability calculation
    - **Property 2: IRT 3PL Probability Calculation**
    - **Validates: Requirements 7.1, 7.2**
    - Use fast-check with parameters: theta [-3, 3], a [0.5, 2.5], b [-3, 3], c [0, 0.3]
    - Verify calculated probability matches mathematical formula within 6 decimal places
    - Run 100 iterations with seed logging
    - _Requirements: 7.1, 7.2_

  - [x] 3.3 Write property test for IRT metamorphic ability estimation
    - **Property 3: IRT Metamorphic Ability Estimation**
    - **Validates: Requirements 7.3, 7.5**
    - Generate response patterns using known θ and 3PL model, estimate ability, verify within ±0.5 logits
    - Test with 10-50 items, multiple ability levels
    - _Requirements: 7.3, 7.5_

  - [x] 3.4 Write property test for score clamping
    - **Property 5: Score Clamping Correctness**
    - **Validates: Requirements 5.6, 5.7**
    - Generate invalid CEFR bands [-10, 20] and scale scores [-50, 100]
    - Verify all clamped values are within valid ranges [1-6] and [0-30]
    - _Requirements: 5.6, 5.7_

  - [x] 3.5 Write property test for CEFR/scale score conversion
    - **Property 7: CEFR and Scale Score Conversion**
    - **Validates: Requirements 9.1, 9.2, 9.3**
    - Verify conversion produces valid ranges and monotonically increasing functions
    - Test with theta values across full [-3, 3] range
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 3.6 Write unit tests for IRT scorer edge cases
    - Test with empty response arrays
    - Test with extreme ability values (-3, 0, +3)
    - Test with boundary IRT parameters
    - Test database fallback logic when conversion table lookup fails
    - _Requirements: 7.1, 7.2, 7.3, 9.1, 9.2_

### Phase 3: Backend Services - MST Engine and Timer

- [x] 4. Implement MST (Multistage Adaptive Testing) Engine
  - [x] 4.1 Create `MSTEngine` class with routing logic
    - Define routing thresholds: EASY_UPPER_BOUND = -0.8, MEDIUM_LOWER/UPPER = -0.8/0.8, HARD_LOWER = 0.8
    - Implement `routeToModule(ability, section)` with threshold-based routing
    - Implement `selectNextModule(stage, difficulty)` with database query for module items
    - Implement fallback logic for module unavailability
    - Add logging for routing decisions
    - _Requirements: 3.4, 3.6, 3.7, 3.8, 4.4, 4.5, 4.6, 4.7, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 4.2 Write property test for MST routing threshold correctness
    - **Property 4: MST Routing Threshold Correctness**
    - **Validates: Requirements 3.4, 3.6, 3.7, 3.8, 4.4, 4.5, 4.6, 4.7, 8.1**
    - Generate theta values [-3, 3], verify correct difficulty module selected
    - Test boundary conditions: θ = -0.8, 0.8
    - _Requirements: 3.6, 3.7, 3.8, 4.5, 4.6, 4.7, 8.1_

  - [x] 4.3 Write unit tests for MST engine
    - Test module selection with different difficulty tiers
    - Test fallback behavior when module not available
    - Test error handling for database failures
    - _Requirements: 8.2, 8.3, 8.5, 8.6_

- [x] 5. Implement Timer Service with heartbeat mechanism
  - [x] 5.1 Create `TimerService` class extending EventEmitter
    - Implement `initializeTimer(sessionId, durationMinutes)` with database persistence and setTimeout
    - Implement `getRemainingTime(sessionId)` with server-side calculation from expiration_time
    - Implement `validateSubmission(sessionId, submissionTimestamp)` comparing against expiration time
    - Implement `autoSubmit(sessionId)` with status update and event emission
    - Implement `heartbeat(sessionId, clientTimestamp)` with drift detection (threshold 5 seconds)
    - Implement `clearTimer(sessionId)` for cleanup
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 5.2 Write property test for timer submission validation
    - **Property 6: Timer Submission Validation**
    - **Validates: Requirements 2.5, 2.6**
    - Generate expiration times and submission timestamps
    - Verify S ≤ T accepts, S > T rejects
    - _Requirements: 2.5, 2.6_

  - [x] 5.3 Write property test for time format display
    - **Property 12: Time Format Display**
    - **Validates: Requirements 2.2**
    - Generate time values [0, 5400] seconds
    - Verify HH:MM:SS format with valid ranges
    - _Requirements: 2.2_

  - [x] 5.4 Write unit tests for timer service
    - Test timer initialization and auto-submit trigger
    - Test heartbeat drift detection
    - Test cleanup on session completion
    - _Requirements: 2.1, 2.4_

- [x] 6. Checkpoint - Core backend services complete
  - Ensure all tests pass, ask the user if questions arise.

### Phase 4: Backend Services - Gemini Grader and Session Manager

- [x] 7. Implement Gemini Grader Service for Writing and Speaking
  - [x] 7.1 Create `GeminiGraderService` class with @google/genai SDK
    - Initialize GoogleGenerativeAI and GoogleAIFileManager with API key
    - Configure model name: 'gemini-2.0-flash-exp'
    - Implement error handling with circuit breaker pattern
    - _Requirements: 17.1, 17.2, 17.3, 17.5_

  - [x] 7.2 Implement `gradeWriting(request)` method
    - Define responseSchema with JSONB structure for CEFR band, scale score, grammar corrections, lexical analysis
    - Build prompts for 'build-sentence', 'email', 'academic-discussion' task types
    - Call Gemini model with temperature 0.2, maxOutputTokens 2048
    - Parse JSON response and clamp scores using IRT scorer
    - Implement error handling with fallback scores (CEFR: 3, scale: 15)
    - _Requirements: 5.3, 5.5, 5.6, 5.7, 5.8, 5.9, 17.3, 19.2_

  - [x] 7.3 Implement `assessPronunciation(audioPath, referenceText)` method
    - Upload audio file using FileManager with mimeType detection
    - Wait for file processing with polling (2-second intervals)
    - Define pronunciation assessment schema (accuracyScore, fluencyScore, prosodyScore, completenessScore)
    - Call Gemini model with audio fileData and reference text prompt
    - Calculate composite score with weights (accuracy 0.4, fluency 0.3, prosody 0.2, completeness 0.1)
    - Map composite score to CEFR and scale score
    - Clean up uploaded file after processing
    - Implement error handling with fallback scores
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 6.7, 17.4, 19.2_

  - [x] 7.4 Write integration tests for Gemini grader with mocks
    - Mock Gemini API responses for writing grading
    - Mock Gemini API responses for pronunciation assessment
    - Test error handling and fallback behavior
    - Test circuit breaker activation after failures
    - _Requirements: 17.5, 17.6, 19.2_

- [x] 8. Implement Session Manager with state persistence
  - [x] 8.1 Create `SessionManager` class with PostgreSQL integration
    - Implement `createSession(userId)` with unique session ID generation
    - Implement `persistSession(sessionId, state)` updating exam_sessions table
    - Implement `restoreSession(sessionId)` retrieving full session state
    - Implement `markModuleCompleted(sessionId, moduleId)` adding to completed_modules
    - Implement `updateAbilityEstimate(sessionId, section, theta)` updating ability_estimates JSONB
    - Implement validation for state restoration (schema version, required fields)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 13.4, 18.3, 18.4_

  - [x] 8.2 Write property test for session state round-trip preservation
    - **Property 1: Session State Round-Trip Preservation**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.6**
    - Generate arbitrary session state objects with all fields
    - Persist to database and restore, verify equivalence
    - Test with 100 iterations
    - _Requirements: 1.6_

  - [x] 8.3 Write property test for module completion prevention
    - **Property 13: Module Completion Prevention of Access**
    - **Validates: Requirements 1.5, 13.5**
    - Mark modules as completed, attempt navigation, verify rejection
    - _Requirements: 1.5, 13.5_

  - [x] 8.4 Write unit tests for session manager
    - Test session creation with unique IDs
    - Test state validation on restoration
    - Test handling of corrupted state data
    - _Requirements: 1.1, 18.4, 19.6_

### Phase 5: Backend API Endpoints

- [ ] 9. Implement Express API server with middleware
  - [x] 9.1 Create Express app with core middleware
    - Configure CORS with whitelist for authorized domains
    - Add body-parser for JSON payloads
    - Add helmet for security headers
    - Add rate limiting middleware (100 requests/minute per IP)
    - Add request logging with morgan
    - Add error handling middleware with standardized error responses
    - _Requirements: 22.3, 22.4, 22.5_

  - [x] 9.2 Implement session management endpoints
    - POST /api/sessions - Create new exam session
    - GET /api/sessions/:id - Retrieve session state
    - PATCH /api/sessions/:id - Update session state
    - POST /api/sessions/:id/submit - Submit section/module
    - Add validation for session IDs and request bodies
    - _Requirements: 1.1, 1.3, 1.4_

  - [x] 9.3 Implement timer validation endpoints
    - GET /api/sessions/:id/timer - Get server-calculated remaining time
    - POST /api/sessions/:id/heartbeat - Timestamp validation with drift detection
    - _Requirements: 2.3, 2.4_

  - [x] 9.4 Implement adaptive testing endpoints
    - POST /api/mst/route - Calculate ability and route to next module
    - GET /api/modules/:difficulty - Fetch module items
    - _Requirements: 3.4, 8.1, 8.2_

  - [x] 9.5 Implement AI grading endpoints
    - POST /api/grade/writing - Submit writing for Gemini grading (validate text, taskType)
    - POST /api/grade/speaking - Submit audio for pronunciation assessment (use multer for file upload)
    - Add 10MB file size limit for audio uploads
    - _Requirements: 5.5, 6.4, 20.4_

  - [x] 9.6 Implement test content endpoints
    - GET /api/items/:section/:type - Retrieve test items with pagination
    - GET /api/passages/:id - Retrieve reading/listening passages
    - Add Redis caching for frequently accessed items
    - _Requirements: 21.5_

  - [x] 9.7 Write property test for input validation and sanitization
    - **Property 11: Input Validation and Sanitization**
    - **Validates: Requirements 22.4**
    - Generate malicious input strings (SQL injection, XSS)
    - Verify validation rejects dangerous inputs
    - _Requirements: 22.4_

  - [x] 9.8 Write integration tests for API endpoints
    - Test session lifecycle (create → update → submit → retrieve)
    - Test timer validation flow with heartbeat
    - Test MST routing with mocked IRT scorer
    - Test error responses for invalid requests
    - _Requirements: 1.1, 2.3, 8.1_

- [x] 10. Checkpoint - Backend API complete
  - Ensure all tests pass, ask the user if questions arise.

### Phase 6: Data Loading and Test Content Management

- [x] 11. Implement Data Loader for test items
  - [x] 11.1 Create `DataLoader` class with dataset parsers
    - Implement parser for TOEFL-QA Dataset (GitHub/Hugging Face format)
    - Implement parser for Sentence Insertion Dataset (EMNLP format)
    - Implement parser for Academic Discussion Dataset
    - Implement parser for Synonym Match Dataset (Wordlink)
    - Implement parser for TOEFL-Spell Dataset (ETS format)
    - Extract item content, correct answers, distractors, IRT parameters (a, b, c)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 11.2 Implement batch loading with validation
    - Validate all required fields present for each item
    - Store parsed items in PostgreSQL with JSONB columns
    - Implement batch transaction with rollback on validation failure
    - Add progress logging for large datasets
    - _Requirements: 14.7, 14.8, 14.9_

  - [x] 11.3 Implement Pretty Printer for test items
    - Format test items into standardized JSON structure
    - Include id, type, content, options, correct answer, IRT parameters, metadata
    - _Requirements: 15.1, 15.2_

  - [x] 11.4 Write property test for test item serialization round-trip
    - **Property 10: Test Item Serialization Round-Trip**
    - **Validates: Requirements 15.3**
    - Generate valid test item objects
    - Format to JSON, parse back, verify equivalence
    - _Requirements: 15.3_

  - [x] 11.5 Write unit tests for data loader
    - Test each dataset parser with sample data
    - Test batch validation and rollback
    - Test error handling for malformed datasets
    - _Requirements: 14.8, 14.9_

- [x] 12. Seed database with test content
  - Download official TOEFL datasets from sources
  - Run data loader to populate test_items table (50+ items per section for MVP)
  - Populate cefr_conversion table with official ETS 2026 conversion data
  - Verify item distribution across difficulty levels and sections
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 9.3_

### Phase 7: Frontend State Management (Zustand Stores)

- [ ] 13. Implement Zustand stores with persistence
  - [ ] 13.1 Create `examStore` with persist middleware
    - Define state: sessionId, currentSection, currentModule, currentQuestionIndex, answers (Map), completedModules (Set)
    - Implement actions: setSession, updateAnswer, nextQuestion, prevQuestion, submitModule, markModuleComplete
    - Configure Zustand persist to local storage with state versioning
    - Implement state migration logic for version changes
    - _Requirements: 18.1, 18.2, 18.3, 18.8_

  - [ ] 13.2 Create `timerStore` with server sync
    - Define state: remainingTime (seconds), expirationTime (timestamp), driftDetected, serverTime
    - Implement actions: initializeTimer, updateRemainingTime, syncWithServer, handleExpiration
    - Implement countdown logic with setInterval
    - Implement heartbeat polling (every 30 seconds)
    - _Requirements: 2.2, 2.3, 19.3_

  - [ ] 13.3 Create `abilityStore` for IRT parameters
    - Define state: abilityEstimates (by section), irtParameters (by item), routingDecisions
    - Implement actions: updateAbility, recordRouting
    - _Requirements: 3.4, 8.1_

  - [ ] 13.4 Create `uiStore` for UI state
    - Define state: isReviewModalOpen, isGatekeeperActive, lockedQuestions (Set), navigationHistory
    - Implement actions: openReviewModal, closeReviewModal, lockQuestion, unlockQuestion, unlockAllQuestions
    - _Requirements: 11.1, 11.3, 12.1_

  - [ ] 13.5 Write unit tests for Zustand stores
    - Test store actions update state correctly
    - Test persistence to localStorage
    - Test state restoration on app load
    - Test state version migration
    - _Requirements: 18.3, 18.4, 18.5, 18.8_

### Phase 8: Frontend Core Components - Layout and Navigation

- [ ] 14. Implement core layout components
  - [ ] 14.1 Create `ExamShell` top-level container
    - Implement React Router with routes: /, /exam/start, /exam/section/:id, /exam/review, /exam/score
    - Implement session initialization on /exam/start
    - Implement state restoration from localStorage on mount
    - Implement error boundary with fallback UI
    - _Requirements: 18.4, 19.4_

  - [ ] 14.2 Create `Header` component
    - Display timer in HH:MM:SS format with countdown
    - Add volume control button (for listening section)
    - Add help button (opens help modal)
    - Add review button (opens ReviewModal)
    - Add hide/next navigation buttons
    - Style with dark charcoal/navy background and official ETS color scheme
    - _Requirements: 10.1, 10.2, 2.2_

  - [ ] 14.3 Write unit tests for Header component
    - Test timer display updates correctly
    - Test button click handlers
    - Test accessibility (ARIA labels, keyboard navigation)
    - _Requirements: 10.1, 23.1, 23.2_

- [ ] 15. Implement navigation and review modal
  - [ ] 15.1 Create `ReviewModal` component
    - Display grid of all questions in current module
    - Show status indicators: answered (green), unanswered (yellow), not seen (gray)
    - Implement click handler to navigate to selected question
    - Add close button to dismiss modal
    - Style with official ETS design
    - _Requirements: 12.1, 12.3, 12.4, 12.5, 12.6_

  - [ ] 15.2 Write property test for navigation module boundary enforcement
    - **Property 9: Navigation Module Boundary Enforcement**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.5**
    - Generate session states with completed modules
    - Verify navigation within current module allowed, navigation to completed modules blocked
    - _Requirements: 13.1, 13.2, 13.3, 13.5_

  - [ ] 15.3 Write unit tests for ReviewModal
    - Test question status display
    - Test navigation on question click
    - Test modal open/close behavior
    - Test error handling when modal fails to display (silent failure per Req 12.2)
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

### Phase 9: Frontend Components - Reading Section

- [ ] 16. Implement Reading section components
  - [ ] 16.1 Create `PassageViewer` component with split-screen layout
    - Display reading passage on right side with scrollable container
    - Display questions on left side
    - Track scroll position using onScroll event
    - Implement scroll-to-bottom detection (scrollTop + clientHeight >= scrollHeight)
    - Emit event when passage is fully scrolled
    - Style with official ETS split-screen design
    - _Requirements: 3.9, 10.3, 11.2_

  - [ ] 16.2 Implement Gatekeeper logic in PassageViewer
    - Lock all questions when passage is displayed (contentHeight > 0)
    - Listen for scroll-to-bottom event
    - Unlock all questions when bottom reached
    - Handle passages with contentHeight = 0 (no locking)
    - Display visual lock indicator on questions
    - Prevent input on locked questions with notification
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ] 16.3 Write property test for gatekeeper lock-unlock behavior
    - **Property 8: Gatekeeper Lock-Unlock Behavior**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4**
    - Generate passage content heights and scroll positions
    - Verify locking/unlocking logic based on scroll state
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [ ] 16.4 Create `QuestionDisplay` component for reading questions
    - Render question types: Complete Words, Daily Life, Academic Passage
    - Implement multiple choice radio buttons
    - Implement inline text inputs for short answers
    - Handle locked state from Gatekeeper
    - Update examStore on answer selection
    - _Requirements: 3.1, 10.4, 13.3_

  - [ ] 16.5 Write unit tests for Reading section components
    - Test PassageViewer scroll tracking
    - Test Gatekeeper locking/unlocking
    - Test QuestionDisplay rendering for each question type
    - Test answer submission to store
    - _Requirements: 3.1, 11.1, 11.2_

### Phase 10: Frontend Components - Listening Section

- [ ] 17. Implement Listening section components
  - [ ] 17.1 Create `AudioPlayer` component
    - Use HTML5 audio element with custom controls
    - Implement play/pause, volume adjustment, progress bar
    - Display audio duration and current time
    - Disable seek functionality (per official TOEFL rules)
    - Style with official ETS audio player design
    - _Requirements: 4.8, 10.2_

  - [ ] 17.2 Create `QuestionDisplay` variant for listening questions
    - Render question types: Choose Response, Conversations, Academic Talks
    - Implement multiple choice radio buttons
    - Unlock questions after audio completes (no gatekeeper locking for listening)
    - Update examStore on answer selection
    - _Requirements: 4.1, 13.3_

  - [ ] 17.3 Write unit tests for Listening section components
    - Test AudioPlayer controls
    - Test question unlocking after audio completion
    - Test answer submission
    - _Requirements: 4.1, 4.8_

### Phase 11: Frontend Components - Writing Section

- [ ] 18. Implement Writing section components
  - [ ] 18.1 Create `TextEditor` component
    - Use textarea with controlled input
    - Implement real-time word count display
    - Add cut, paste, undo controls (browser native)
    - Style with official ETS text editor design
    - _Requirements: 5.3, 5.4, 10.5_

  - [ ] 18.2 Implement writing submission flow
    - Capture textarea content on module submit
    - Send to backend API POST /api/grade/writing
    - Display loading state during grading
    - Store returned scores in examStore
    - Handle API errors gracefully (display fallback scores)
    - _Requirements: 5.5, 5.6, 5.7, 5.8, 19.2_

  - [ ] 18.3 Write unit tests for Writing section components
    - Test TextEditor word count calculation
    - Test writing submission API call
    - Test error handling for API failures
    - _Requirements: 5.3, 5.5, 19.2_

### Phase 12: Frontend Components - Speaking Section

- [ ] 19. Implement Speaking section components
  - [ ] 19.1 Create `AudioRecorder` component
    - Request microphone permissions using navigator.mediaDevices.getUserMedia
    - Display recording status (recording, paused, stopped)
    - Implement start/stop recording controls
    - Use MediaRecorder API to capture audio in WAV or MP3 format
    - Display recording duration timer
    - _Requirements: 6.3, 20.1, 20.2, 20.3_

  - [ ] 19.2 Implement audio processing and upload
    - Check file size after recording completes
    - Compress audio if size > 10MB using Web Audio API or external library
    - Upload audio to POST /api/grade/speaking using FormData
    - Display loading state during grading
    - Store pronunciation scores in examStore
    - Handle microphone access denial (display error, allow section skip)
    - _Requirements: 20.4, 20.5, 20.6, 20.7_

  - [ ] 19.3 Write unit tests for Speaking section components
    - Mock MediaRecorder API
    - Test recording start/stop
    - Test audio upload flow
    - Test error handling for microphone denial
    - _Requirements: 6.3, 20.1, 20.7_

### Phase 13: Frontend Components - Score Report

- [ ] 20. Implement score report and final display
  - [ ] 20.1 Create `ScoreReport` component
    - Display dual scoring: CEFR band [1-6] and Equivalent score [0-30] per section
    - Calculate and display total score (sum of four section equivalent scores, 0-120 range)
    - Display section-by-section breakdown
    - Style with official ETS score report design
    - _Requirements: 9.1, 9.2, 9.4, 9.5_

  - [ ] 20.2 Write unit tests for ScoreReport
    - Test score display for all sections
    - Test total score calculation
    - Test rendering with missing scores (handle gracefully)
    - _Requirements: 9.4, 9.5_

### Phase 14: Integration and Error Handling

- [ ] 21. Implement comprehensive error handling
  - [ ] 21.1 Implement network error recovery
    - Queue failed API requests in IndexedDB
    - Implement exponential backoff retry (initial 1s, max 30s)
    - Display connectivity status indicator in UI
    - Sync queued requests when connection restored
    - _Requirements: 19.1_

  - [ ] 21.2 Implement Gemini API error handling
    - Implement circuit breaker pattern (5 failures → 30s cooldown)
    - Return fallback scores on API errors
    - Display warning about manual review
    - Queue responses for retry batch processing
    - _Requirements: 17.5, 19.2_

  - [ ] 21.3 Implement timer service fallback
    - Fall back to client-side timer if server unreachable
    - Display warning icon for local timer mode
    - Attempt server sync every 30 seconds
    - Flag session for manual review
    - _Requirements: 19.3_

  - [ ] 21.4 Implement error logging
    - Create error logging service with structured logs
    - Log all errors with sessionId, userId, error category, severity, context
    - Send error logs to backend for centralized tracking
    - _Requirements: 19.6_

  - [ ] 21.5 Implement React error boundaries
    - Create `ExamErrorBoundary` component
    - Display user-friendly error fallback UI
    - Log errors with component stack trace
    - Provide "Contact Support" option
    - _Requirements: 19.4, 19.5_

  - [ ] 21.6 Write integration tests for error handling
    - Test network failure recovery
    - Test API error fallback
    - Test error boundary rendering
    - _Requirements: 19.1, 19.2, 19.4_

- [ ] 22. Checkpoint - Error handling and integration complete
  - Ensure all tests pass, ask the user if questions arise.

### Phase 15: Styling and Accessibility

- [ ] 23. Implement official ETS UI styling with TailwindCSS
  - [ ] 23.1 Configure TailwindCSS theme
    - Define color palette (dark charcoal/navy header, official ETS colors)
    - Define typography (official ETS fonts)
    - Define spacing and layout utilities
    - Configure responsive breakpoints
    - _Requirements: 10.1, 10.2, 10.6_

  - [ ] 23.2 Style all components with official ETS design
    - Apply header styling (dark background, white text)
    - Apply split-screen layout for reading passages
    - Apply question styling (radio buttons, text inputs, textareas)
    - Apply modal styling (ReviewModal, help modal)
    - Apply score report styling
    - Ensure responsive layout for different screen sizes
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [ ] 23.3 Write snapshot tests for UI components
    - Capture snapshots of all major components
    - Verify consistent rendering across updates
    - _Requirements: 10.1, 10.2_

- [ ] 24. Implement accessibility features (WCAG 2.1 AA compliance)
  - [ ] 24.1 Add ARIA labels and roles
    - Add ARIA labels to all interactive elements (buttons, inputs, modals)
    - Add ARIA roles for semantic structure (navigation, main, complementary)
    - Add ARIA live regions for dynamic content (timer, status messages)
    - Add ARIA descriptions for complex components
    - _Requirements: 23.1, 23.4_

  - [ ] 24.2 Implement keyboard navigation
    - Enable Tab navigation through all interactive elements
    - Add keyboard shortcuts for common actions (submit, review, next/prev)
    - Ensure focus indicators are visible (outline or custom styling)
    - Trap focus within modals when open
    - _Requirements: 23.2, 23.4_

  - [ ] 24.3 Ensure color contrast and text alternatives
    - Verify color contrast ratios meet WCAG AA (4.5:1 for normal text, 3:1 for large text)
    - Add text alternatives for audio content in listening section
    - Provide alternative text for all images and icons
    - _Requirements: 23.3, 23.5_

  - [ ] 24.4 Implement extended time accommodations
    - Add extended time configuration in user profile
    - Adjust timer duration based on accommodation settings
    - _Requirements: 23.6_

  - [ ] 24.5 Write accessibility tests
    - Run axe-core automated scanning
    - Test keyboard-only navigation flows
    - Test screen reader announcements (manual testing notes)
    - _Requirements: 23.1, 23.2, 23.3, 23.4_

### Phase 16: Performance Optimization and Caching

- [ ] 25. Implement performance optimizations
  - [ ] 25.1 Optimize database queries
    - Implement connection pooling (pg Pool)
    - Add database indexes on frequently queried fields (verify existing indexes)
    - Optimize JSONB queries with GIN indexes
    - _Requirements: 21.4_

  - [ ] 25.2 Implement Redis caching
    - Configure Redis client with connection pooling
    - Cache frequently accessed test items (TTL 1 hour)
    - Cache CEFR conversion table (TTL 24 hours)
    - Implement cache invalidation strategy
    - _Requirements: 21.5_

  - [ ] 25.3 Optimize frontend performance
    - Implement React.memo for expensive components
    - Use React.lazy for code splitting (route-based splitting)
    - Optimize bundle size with Vite build optimization
    - Implement image lazy loading (if applicable)
    - _Requirements: 21.2_

  - [ ] 25.4 Compress API responses
    - Enable gzip/brotli compression in Express
    - Compress JSON responses over 1KB
    - _Requirements: 21.6_

  - [ ] 25.5 Write performance tests
    - Test database query performance (verify <500ms for ability calculation)
    - Test API response times (verify <500ms p95)
    - Test frontend rendering (verify <200ms question load)
    - _Requirements: 21.2, 21.3, 21.4_

### Phase 17: Security Hardening

- [ ] 26. Implement security features
  - [ ] 26.1 Add input validation and sanitization
    - Create validation middleware for all API endpoints
    - Sanitize user inputs (text editor, text inputs) to prevent XSS
    - Validate request bodies against JSON schemas
    - Reject SQL injection patterns
    - _Requirements: 22.4_

  - [ ] 26.2 Implement authentication and authorization (placeholder for MVP)
    - Hash and salt passwords using bcrypt
    - Implement JWT-based session authentication
    - Add authentication middleware to protected routes
    - _Requirements: 22.2_

  - [ ] 26.3 Configure HTTPS/TLS
    - Generate SSL certificates for development (self-signed)
    - Configure Express to use HTTPS
    - Enforce HTTPS redirect (if applicable)
    - _Requirements: 22.1_

  - [ ] 26.4 Add CORS and rate limiting
    - Configure CORS whitelist for authorized domains
    - Implement rate limiting (100 requests/minute per IP)
    - Add rate limiting for API endpoints (separate limits for grading endpoints)
    - _Requirements: 22.3, 22.5_

  - [ ] 26.5 Write security tests
    - Test input validation rejects malicious inputs
    - Test rate limiting enforcement
    - Test CORS policy
    - _Requirements: 22.4, 22.5_

### Phase 18: End-to-End Testing and Deployment

- [ ] 27. Implement end-to-end tests with Playwright
  - [ ] 27.1 Set up Playwright test environment
    - Configure Playwright with browsers (Chromium, Firefox, WebKit)
    - Set up test database seeding
    - Configure test environment variables
    - _Requirements: Testing Strategy (Design Document)_

  - [ ] 27.2 Write E2E tests for complete exam flows
    - Test user registration and login
    - Test complete 90-minute exam with all sections (use shortened timer for test)
    - Test browser refresh during exam (state restoration)
    - Test timer expiration handling
    - Test review modal navigation
    - Test score report display
    - _Requirements: 1.3, 2.4, 12.1, 9.4_

  - [ ] 27.3 Write E2E tests for adaptive routing
    - Test Stage 1 module completion triggers ability calculation
    - Test routing to Easy, Medium, Hard Stage 2 modules based on ability
    - Test module navigation restrictions
    - _Requirements: 3.4, 3.6, 3.7, 3.8, 8.1, 13.1, 13.5_

  - [ ] 27.4 Write E2E tests for error scenarios
    - Test network disconnection and recovery
    - Test API failures with fallback behavior
    - Test microphone access denial
    - _Requirements: 19.1, 19.2, 20.7_

- [ ] 28. Create Docker deployment configuration
  - [ ] 28.1 Create Dockerfile for backend
    - Use Node.js 20+ base image
    - Copy package files and install dependencies
    - Copy source code and build TypeScript
    - Expose API port (e.g., 3000)
    - Set environment variables (database URL, Gemini API key, Redis URL)
    - _Requirements: Deployment (Design Overview)_

  - [ ] 28.2 Create Dockerfile for frontend
    - Use Node.js base image for build stage
    - Build React app with Vite
    - Use Nginx base image for serve stage
    - Copy build output to Nginx
    - Configure Nginx reverse proxy to backend API
    - _Requirements: Deployment (Design Overview)_

  - [ ] 28.3 Create Docker Compose configuration
    - Define services: frontend, backend, PostgreSQL, Redis
    - Configure networking between services
    - Set up volume mounts for database persistence
    - Configure health checks
    - _Requirements: Deployment (Design Overview)_

  - [ ] 28.4 Write deployment documentation
    - Document environment variables required
    - Document database migration steps
    - Document data seeding process
    - Document scaling considerations
    - _Requirements: 21.1_

- [ ] 29. Final checkpoint - End-to-end testing complete
  - Ensure all tests pass, ask the user if questions arise.

### Phase 19: Load Testing and Production Readiness

- [ ] 30. Implement load testing
  - [ ] 30.1 Create load test scenarios with Artillery or k6
    - Test 100 concurrent exam sessions
    - Test database query performance under load
    - Test Gemini API rate limiting behavior
    - Test Redis cache hit rates
    - Measure response time percentiles (p50, p95, p99)
    - _Requirements: 21.1, 21.2, 21.3_

  - [ ] 30.2 Analyze and optimize bottlenecks
    - Identify slow database queries and optimize
    - Identify API endpoints with high latency
    - Optimize Gemini API retry logic and batching
    - Scale Redis cache if needed
    - _Requirements: 21.1, 21.4, 21.5_

  - [ ] 30.3 Verify performance targets met
    - Page load < 2 seconds
    - Question display < 200ms
    - API response < 500ms (p95)
    - Ability calculation < 500ms
    - 100+ concurrent users without degradation
    - _Requirements: 21.2, 21.3_

- [ ] 31. Final production readiness checklist
  - Verify all 13 property-based tests passing with 100 iterations each
  - Verify unit test coverage ≥ 80%
  - Verify integration tests cover all critical flows
  - Verify E2E tests cover complete exam flows
  - Verify accessibility compliance (WCAG 2.1 AA)
  - Verify security hardening (HTTPS, input validation, rate limiting, CORS)
  - Verify error handling and recovery mechanisms
  - Verify performance targets met under load
  - Verify deployment configuration and documentation complete
  - _Requirements: All requirements validated_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements from the requirements document for traceability
- Checkpoints ensure incremental validation and allow for user feedback
- Property-based tests validate universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- Integration tests validate cross-component interactions
- E2E tests validate complete user flows
- The implementation uses TypeScript throughout (frontend and backend)
- Backend services are built before frontend to enable API-driven development
- State management (Zustand stores) is implemented before UI components
- Error handling is comprehensive with fallback strategies for all failure modes
- Performance optimization includes database indexing, Redis caching, and frontend code splitting
- Security hardening includes input validation, HTTPS, CORS, and rate limiting
- Accessibility compliance targets WCAG 2.1 AA standard
- Load testing verifies system can handle 100+ concurrent users
- Docker deployment enables production-ready containerized deployment

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "3.4", "3.5", "3.6"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "5.4"] },
    { "id": 6, "tasks": ["7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 8, "tasks": ["7.4", "8.2", "8.3", "8.4"] },
    { "id": 9, "tasks": ["9.1"] },
    { "id": 10, "tasks": ["9.2", "9.3", "9.4", "9.5", "9.6"] },
    { "id": 11, "tasks": ["9.7", "9.8", "11.1"] },
    { "id": 12, "tasks": ["11.2", "11.3"] },
    { "id": 13, "tasks": ["11.4", "11.5", "12"] },
    { "id": 14, "tasks": ["13.1", "13.2", "13.3", "13.4"] },
    { "id": 15, "tasks": ["13.5", "14.1"] },
    { "id": 16, "tasks": ["14.2"] },
    { "id": 17, "tasks": ["14.3", "15.1"] },
    { "id": 18, "tasks": ["15.2", "15.3", "16.1"] },
    { "id": 19, "tasks": ["16.2"] },
    { "id": 20, "tasks": ["16.3", "16.4"] },
    { "id": 21, "tasks": ["16.5", "17.1"] },
    { "id": 22, "tasks": ["17.2"] },
    { "id": 23, "tasks": ["17.3", "18.1"] },
    { "id": 24, "tasks": ["18.2"] },
    { "id": 25, "tasks": ["18.3", "19.1"] },
    { "id": 26, "tasks": ["19.2"] },
    { "id": 27, "tasks": ["19.3", "20.1"] },
    { "id": 28, "tasks": ["20.2", "21.1", "21.2", "21.3", "21.4", "21.5"] },
    { "id": 29, "tasks": ["21.6"] },
    { "id": 30, "tasks": ["23.1"] },
    { "id": 31, "tasks": ["23.2"] },
    { "id": 32, "tasks": ["23.3", "24.1", "24.2", "24.3", "24.4"] },
    { "id": 33, "tasks": ["24.5", "25.1", "25.2", "25.3", "25.4"] },
    { "id": 34, "tasks": ["25.5", "26.1", "26.2", "26.3", "26.4"] },
    { "id": 35, "tasks": ["26.5", "27.1"] },
    { "id": 36, "tasks": ["27.2", "27.3", "27.4", "28.1", "28.2", "28.3"] },
    { "id": 37, "tasks": ["28.4", "30.1"] },
    { "id": 38, "tasks": ["30.2"] },
    { "id": 39, "tasks": ["30.3", "31"] }
  ]
}
```
