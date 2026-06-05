# Technical Design: TOEFL Exam Completion

## Overview

Complete the TOEFL iBT 2026 simulator by integrating existing components and implementing missing functionality to provide authentic exam experience with proper question counts, timers, input methods, and score reporting.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Timer Display Format Consistency

*For any* valid timer state with remaining time, the Section_Timer SHALL display the time in MM:SS format where MM is zero-padded minutes and SS is zero-padded seconds.

**Validates: Requirements 2.5**

### Property 2: Answer Submission Completeness

*For any* set of answers collected during a section, when the section completion handler is invoked, all answers in that set SHALL be included in the submission payload sent to the backend API.

**Validates: Requirements 3.2**

### Property 3: Word Count Accuracy

*For any* text input in the Writing_Section editor, the displayed word count SHALL equal the actual number of words in the text, where words are defined as whitespace-separated tokens.

**Validates: Requirements 5.3**

### Property 4: Score Component Display Completeness

*For any* completed section with score data (Scale_Score, CEFR_Band, and feedback), the Score_Report SHALL display all three score components for that section.

**Validates: Requirements 7.1, 7.2, 7.5**

### Property 5: Total Score Calculation

*For any* set of section scores, the total score displayed by Score_Report SHALL equal the arithmetic sum of all individual section Scale_Scores.

**Validates: Requirements 7.3**

### Property 6: Completion Count Accuracy

*For any* exam state, the completion badge SHALL display a count that equals the number of sections with submitted scores.

**Validates: Requirements 7.4**

### Property 7: Answer Persistence Completeness

*For any* answer submitted to the Backend_API with a valid session_id and item_id, a corresponding record SHALL exist in the responses table containing that session_id, item_id, and response_text.

**Validates: Requirements 8.1, 8.2**

### Property 8: IRT Score Calculation Validity

*For any* Reading or Listening section answer set submitted to the Backend_API, the IRT scoring algorithm SHALL produce a Scale_Score that is a numeric value.

**Validates: Requirements 9.1, 9.2**

### Property 9: Scale Score Range Constraint

*For any* theta value calculated by the IRT scoring algorithm, the mapped Scale_Score SHALL be a value between 0 and 30 inclusive.

**Validates: Requirements 9.3**

### Property 10: CEFR Band Mapping Existence

*For any* valid Scale_Score between 0 and 30, the mapping function SHALL return a valid CEFR_Band value from the set {A1, A2, B1, B2, C1, C2}.

**Validates: Requirements 9.4**

### Property 11: Writing Task Mutual Exclusivity

*For any* state of the Writing_Section component, at most one task type (Integrated Writing or Academic Discussion) SHALL be visible in the user interface.

**Validates: Requirements 10.3**

### Property 12: Remaining Time Calculation Accuracy

*For any* timer state with a recorded start time and current time where remaining time is positive, the calculated remaining time SHALL equal (time_limit - (current_time - start_time)).

**Validates: Requirements 12.4**

### Property 13: Audio File Size Validation

*For any* audio file submitted to the Backend_API, the validation logic SHALL correctly identify whether the file size is less than 10 megabytes.

**Validates: Requirements 15.1**

### Property 14: Audio File Format Validation

*For any* audio file submitted to the Backend_API, the validation logic SHALL correctly identify whether the file format is WAV.

**Validates: Requirements 15.2**

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      TOEFL Exam Flow                            │
├─────────────────────────────────────────────────────────────────┤
│  Start → Reading (20Q) → Listening (28Q) → Writing (2T) →      │
│          Speaking (4T) → Results (Score Report)                 │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ SectionDisplay   │───▶│ SectionTimer     │───▶│ Timer Service   │
│ (Container)      │    │ (Visual + Logic) │    │ (Backend Track) │
└──────────────────┘    └──────────────────┘    └─────────────────┘
         │
         ├─────────▶ ReadingQuestion (PassageViewer + QuestionDisplay)
         ├─────────▶ ListeningQuestion (Audio + Questions)
         ├─────────▶ WritingSection (TextEditor + Grading)
         └─────────▶ SpeakingSection (AudioRecorder + Prompts)

┌──────────────────┐    ┌──────────────────┐
│ Exam Complete    │───▶│ ScoreReport      │
│ Handler          │    │ (Results Page)   │
└──────────────────┘    └──────────────────┘
```

## Design Details

### 1. Correct Question Counts Per Section

**Problem**: Currently fetches 50 questions for all sections via `?limit=50`

**Solution**: Dynamic limits based on section type

#### Frontend Changes

**File**: `frontend/src/components/SectionDisplay.tsx`

```typescript
// Define official TOEFL iBT question counts
const SECTION_LIMITS: Record<string, number> = {
  reading: 20,      // 2 passages × 10 questions
  listening: 28,    // 3 conversations (5Q each) + 3 lectures (6Q each)
  writing: 2,       // 2 tasks (Integrated + Academic Discussion)
  speaking: 4       // 4 tasks (1 independent + 3 integrated)
}

// Update API call
const limit = SECTION_LIMITS[id] || 50
const response = await fetch(
  `${API_URL}/api/items/section/${id}?limit=${limit}`,
  ...
)
```

**Validation**: Database already has sufficient items:
- Reading: 50 available (need 20) ✓
- Listening: 142 available (need 28) ✓
- Writing: 83 available (need 2) ✓
- Speaking: 55 available (need 4) ✓

### 2. Visible Section Timer

**Problem**: `SectionTimer` component exists but not displayed in `SectionDisplay`

**Solution**: Integrate timer component in header

#### Component Integration

**File**: `frontend/src/components/SectionDisplay.tsx`

```typescript
import { SectionTimer } from './SectionTimer'

// Official TOEFL iBT time limits (minutes)
const SECTION_TIME_LIMITS: Record<string, number> = {
  reading: 35,
  listening: 36,
  writing: 29,
  speaking: 16
}

export function SectionDisplay() {
  const timeLimit = SECTION_TIME_LIMITS[id] || 60
  
  const handleTimerExpire = () => {
    // Auto-submit and navigate to next section
    handleSectionComplete()
  }

  return (
    <div>
      <header className="bg-gray-50 border-b border-gray-300 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1>...Section Title...</h1>
          
          {/* Add Timer Display */}
          <SectionTimer
            section={id as 'reading' | 'listening' | 'writing' | 'speaking'}
            timeLimit={timeLimit}
            onExpire={handleTimerExpire}
          />
        </div>
      </header>
      ...
    </div>
  )
}
```

**Timer Component** (Already exists at `SectionTimer.tsx`):
- Displays countdown in MM:SS format
- Changes color when < 5 minutes (orange) and < 1 minute (red)
- Calls `onExpire` callback when reaching 00:00

### 3. Timer Expiry Handling

**Problem**: No auto-submit when timer expires

**Solution**: Implement `handleSectionComplete` function

#### Auto-Submit Logic

**File**: `frontend/src/components/SectionDisplay.tsx`

```typescript
const handleSectionComplete = async () => {
  // 1. Submit all answers to backend
  const sectionAnswers = Array.from(answers.entries())
    .filter(([itemId]) => items.some(item => item.id === itemId))
    .map(([itemId, answer]) => ({ itemId, answer }))

  try {
    await fetch(`${API_URL}/api/sessions/${sessionId}/sections/${id}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: sectionAnswers })
    })
  } catch (error) {
    console.error('Failed to submit section:', error)
  }

  // 2. Navigate to next section
  const nextSection = getNextSection(id)
  if (nextSection) {
    navigate(`/exam/section/${nextSection}`)
  } else {
    navigate('/exam/results')
  }
}

const getNextSection = (current: string): string | null => {
  const order = ['reading', 'listening', 'writing', 'speaking']
  const currentIndex = order.indexOf(current)
  return currentIndex < order.length - 1 ? order[currentIndex + 1] : null
}
```

### 4. Writing Section Input

**Problem**: Writing section shows placeholder text instead of textarea

**Solution**: Integrate `WritingSection` component

#### Writing Component Integration

**File**: `frontend/src/components/SectionDisplay.tsx`

```typescript
import { WritingSection } from './WritingSection'

// Inside render logic
{id === 'writing' && (
  <WritingSection
    question={currentItem as WritingQuestion}
    onSubmit={(score) => {
      // Store score and navigate
      setSectionScore('writing', score)
      if (!isLastQuestion) {
        setCurrentItemIndex(currentItemIndex + 1)
      } else {
        handleSectionComplete()
      }
    }}
  />
)}
```

**WritingSection Component** (Already exists):
- TextEditor with rich text formatting
- Word count display (min 150 for Task 1, 100 for Task 2)
- Submit button (disabled until min word count met)
- Sends essay to Gemini API for grading
- Returns CEFR band + scale score (0-30)

#### Writing Task Types

**Task 1: Integrated Writing** (3 min read + 20 min write)
- Read passage
- Listen to lecture
- Write response (150-225 words)

**Task 2: Academic Discussion** (10 min write)
- Read professor's question + 2 student responses
- Write own response (100+ words)

### 5. Speaking Section Recorder

**Problem**: No audio recording interface

**Solution**: Integrate `AudioRecorder` component

#### Speaking Component Integration

**File**: `frontend/src/components/SectionDisplay.tsx`

```typescript
import { AudioRecorder } from './AudioRecorder'

// Inside render logic
{id === 'speaking' && (
  <div className="max-w-4xl mx-auto">
    {/* Task Prompt */}
    <div className="bg-white rounded-lg p-6 mb-6 border border-gray-300">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">
        Speaking Task {currentItemIndex + 1}
      </h3>
      <p className="text-gray-700 whitespace-pre-wrap">
        {currentItem.content}
      </p>
    </div>

    {/* Audio Recorder */}
    <AudioRecorder
      question={{
        id: currentItem.id,
        type: currentItem.type,
        content: currentItem.content,
        prepTime: currentItem.metadata?.prepTime || 15,
        responseTime: currentItem.metadata?.responseTime || 45
      }}
      onSubmit={(score) => {
        setSectionScore('speaking', score)
        if (!isLastQuestion) {
          setCurrentItemIndex(currentItemIndex + 1)
        } else {
          handleSectionComplete()
        }
      }}
    />

    {/* Navigation */}
    <div className="mt-6 flex justify-between">
      <button onClick={prevQuestion}>← Previous</button>
      {!isLastQuestion && (
        <button onClick={nextQuestion}>Skip Task →</button>
      )}
    </div>
  </div>
)}
```

**AudioRecorder Component** (Already exists):
- Requests microphone permission
- Shows prep timer (15s countdown)
- Shows response timer (45s/60s countdown)
- Records audio as WAV blob
- Auto-stops recording when time expires
- Sends audio to Gemini API for grading
- Returns CEFR band + scale score

#### Speaking Task Types

1. **Task 1: Independent** (Prep: 15s, Response: 45s)
2. **Task 2: Integrated (Read+Listen+Speak)** (Prep: 30s, Response: 60s)
3. **Task 3: Integrated (Listen+Speak)** (Prep: 20s, Response: 60s)
4. **Task 4: Academic Lecture** (Prep: 20s, Response: 60s)

### 6. Score Report Navigation

**Problem**: After completing speaking section, redirects to home instead of results

**Solution**: Already implemented! Route to `/exam/results` exists

#### Score Report Flow

**Current Implementation** (Already correct):

```typescript
// In SectionDisplay.tsx - handleNext() or handleSectionComplete()
if (isLastQuestion && id === 'speaking') {
  navigate('/exam/results')
}
```

**Route Configuration** (Already exists in `App.tsx`):
```typescript
<Route path="/exam/results" element={<ScoreReport />} />
```

**ScoreReport Component** (Already exists):
- Displays all 4 section scores
- Shows CEFR bands (A1-C2)
- Shows scale scores (0-30 per section)
- Shows total score (0-120)
- Shows completion badge (e.g., "3/4 sections completed")
- Shows AI feedback per section
- "Return to Home" button

**Issue**: The score calculation happens in `handleSectionComplete` - need to ensure scores are set before navigation.

#### Score Storage Fix

**File**: `frontend/src/stores/examStore.ts`

Verify `setSectionScore` is called for Reading/Listening:

```typescript
// After grading logic in each section
const score: SectionScore = {
  cefrBand: calculatedBand,
  scaleScore: calculatedScore,
  feedback: 'Auto-graded based on IRT parameters'
}
setSectionScore(section, score)
```

**Note**: Reading and Listening are multiple-choice, so scoring can be instant (IRT-based). Writing and Speaking use Gemini API.

## Data Models

### Section Configuration

```typescript
interface SectionConfig {
  questionLimit: number
  timeLimit: number // minutes
  component: 'reading' | 'listening' | 'writing' | 'speaking'
}

const SECTION_CONFIGS: Record<string, SectionConfig> = {
  reading: { questionLimit: 20, timeLimit: 35, component: 'reading' },
  listening: { questionLimit: 28, timeLimit: 36, component: 'listening' },
  writing: { questionLimit: 2, timeLimit: 29, component: 'writing' },
  speaking: { questionLimit: 4, timeLimit: 16, component: 'speaking' }
}
```

### Score Calculation

```typescript
interface SectionScore {
  cefrBand: number    // 1-6 (A1, A2, B1, B2, C1, C2)
  scaleScore: number  // 0-30
  feedback?: string
  details?: Record<string, unknown>
}
```

**Reading/Listening Scoring** (IRT-based):
- Calculate theta (ability) from answers + IRT parameters
- Map theta to scale score (0-30)
- Map scale score to CEFR band

**Writing/Speaking Scoring** (Gemini API):
- Send text/audio to backend grading endpoint
- Receive CEFR band + scale score
- Display feedback

## API Endpoints

### Existing Endpoints (Already Implemented)

```
GET  /api/items/section/:section?limit=N  - Fetch section items
POST /api/grade/writing                    - Grade essay
POST /api/grade/speaking                   - Grade audio
GET  /api/timers/:sessionId/:section       - Get timer state
POST /api/timers/:sessionId/:section/start - Start timer
POST /api/timers/:sessionId/:section/stop  - Stop timer
```

### New Endpoint Needed

```
POST /api/sessions/:sessionId/sections/:section/submit
Request Body: { answers: Array<{itemId: string, answer: string}> }
Response: { score: SectionScore, correct: number, total: number }
```

**Implementation**:
```typescript
// backend/src/routes/sessions.ts
router.post('/:sessionId/sections/:section/submit', async (req, res) => {
  const { sessionId, section } = req.params
  const { answers } = req.body

  // 1. Save answers to database
  for (const { itemId, answer } of answers) {
    await pool.query(
      `INSERT INTO responses (session_id, item_id, response_text)
       VALUES ($1, $2, $3)
       ON CONFLICT (session_id, item_id) DO UPDATE SET response_text = $3`,
      [sessionId, itemId, answer]
    )
  }

  // 2. Calculate score (for reading/listening only)
  if (section === 'reading' || section === 'listening') {
    const score = await calculateIRTScore(sessionId, section, answers)
    return res.json({ score, correct: score.correct, total: score.total })
  }

  // Writing/Speaking are graded separately via Gemini API
  res.json({ message: 'Answers saved' })
})
```

## Implementation Plan

### Phase 1: Question Counts & Timer Display
1. Update `SECTION_LIMITS` constant in `SectionDisplay.tsx`
2. Add `SECTION_TIME_LIMITS` constant
3. Import and render `SectionTimer` component in header
4. Test: Verify correct question counts and timer display

### Phase 2: Timer Expiry Logic
1. Implement `handleSectionComplete()` function
2. Implement `getNextSection()` helper
3. Connect timer `onExpire` to `handleSectionComplete`
4. Test: Verify auto-navigation when timer expires

### Phase 3: Writing Integration
1. Import `WritingSection` component
2. Add conditional rendering for `id === 'writing'`
3. Connect `onSubmit` callback to score storage
4. Test: Write essay, submit, verify score

### Phase 4: Speaking Integration
1. Import `AudioRecorder` component
2. Add conditional rendering for `id === 'speaking'`
3. Add task prompt display
4. Connect `onSubmit` callback to score storage
5. Test: Record audio, submit, verify score

### Phase 5: Score Report Navigation
1. Verify `/exam/results` route configuration
2. Ensure `navigate('/exam/results')` after speaking
3. Implement reading/listening auto-scoring
4. Test: Complete all 4 sections, verify results page

### Phase 6: Backend Submission Endpoint
1. Create `POST /api/sessions/:sessionId/sections/:section/submit`
2. Implement IRT scoring for reading/listening
3. Save responses to database
4. Return score object
5. Test: API endpoint with sample answers

## Testing Strategy

### Unit Tests
- `SectionDisplay`: Test question limits
- `SectionTimer`: Test countdown and expiry
- `handleSectionComplete`: Test navigation logic

### Integration Tests
- Complete section flow (timer → answers → submit → next)
- Writing submission → grading → score display
- Speaking recording → grading → score display
- Full exam flow (4 sections → results)

### Manual Testing Checklist
- [ ] Reading shows 20 questions, 35 min timer
- [ ] Listening shows 28 questions, 36 min timer
- [ ] Writing shows 2 tasks, 29 min timer, textarea input
- [ ] Speaking shows 4 tasks, 16 min timer, record button
- [ ] Timer auto-submits at 00:00
- [ ] Score report shows all 4 sections
- [ ] Total score = sum of 4 section scores
- [ ] CEFR bands display correctly

## Edge Cases

1. **Timer expires mid-answer**: Save current state, submit automatically
2. **Microphone denied**: Show error, allow text fallback
3. **Grading API failure**: Show fallback score, save for manual review
4. **Incomplete sections**: Score report shows partial completion
5. **Navigation refresh**: Restore timer state from backend

## Security Considerations

- Validate session ID on all API calls
- Rate limit grading endpoints (max 10 requests/min per session)
- Sanitize essay text before sending to Gemini API
- Validate audio file size (<10MB) and format (WAV)

## Performance Considerations

- Cache section items in memory (avoid repeated DB queries)
- Lazy load AudioRecorder component (reduce initial bundle)
- Debounce essay auto-save (every 30 seconds)
- Compress audio before upload (reduce bandwidth)

## Accessibility

- Timer has `aria-live="polite"` for screen reader announcements
- Audio recorder has keyboard shortcuts (Space = record)
- Score report uses semantic HTML and ARIA labels
- High contrast mode support for timer colors

## Migration Notes

**No database migrations needed** - all schema already exists.

**No breaking changes** - additive changes only.

**Deployment**: Frontend rebuild required, backend restart optional (if adding submission endpoint).
