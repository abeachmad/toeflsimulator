# Critical Bugs - TOEFL Simulator

## Issues Reported - 2026-06-06

### 1. ✅ Homepage - Wrong Time Limits
**Current**: Shows old adaptive testing times (~50 items, 30 min, etc.)
**Should Be**: TOEFL iBT 2026 format:
- Reading: 35 minutes, 20 questions (2 passages × 10)
- Listening: 36 minutes, 28 questions (3 lectures + 2 conversations)  
- Speaking: 16 minutes, 4 tasks
- Writing: 29 minutes, 2 tasks

**File**: `frontend/src/components/LandingPage.tsx`

### 2. ❌ Timer - Stuck at 35:00, No Countdown
**Issue**: Timer displays "35:00" but doesn't count down
**Should**: 
- Count down from time limit to 00:00
- Auto-submit when reaches 00:00
- Change color at 5 min (orange) and 1 min (red)

**Files**: 
- `frontend/src/components/SectionTimer.tsx` (polling logic exists but may not work)
- Backend timer API endpoints

### 3. ❌ Listening Section - No Audio Playing
**Issue**: No audio player shown, only transcripts displayed
**Should**:
- Display audio player with play/pause/seek controls
- Play actual MP3 files from `/audio/{filename}` endpoint
- Questions related to audio content (already have 27 items with real audio)

**Files**:
- `frontend/src/components/ListeningQuestionDisplay.tsx` (shows transcript, no audio player)
- Need to add `<audio>` element or audio player component
- Use `metadata.audio_url` from question data

### 4. ❌ Writing Section - Missing First Question
**Issue**: 
- Question 1 shows no prompt text
- Question 2 shows correct prompt
- Text area shows answer from Question 1 when navigating to Question 2
- Answers not saving properly between questions

**Should**:
- Both questions show prompts
- Each question has separate text area
- Answers persist independently

**Files**:
- `frontend/src/components/WritingSection.tsx`
- `frontend/src/stores/examStore.ts` (answer persistence)

### 5. ❌ Speaking Section - Microphone Warning Persists
**Issue**:
- After recording and submitting, microphone warning still shows
- "Microphone Access Required" displayed even after permission granted
- Record button missing for next question

**Should**:
- Clear microphone warning after successful recording
- Show record button for all questions
- Maintain microphone permission state

**Files**:
- `frontend/src/components/AudioRecorder.tsx`

---

## Priority Order

1. **HIGH**: Fix timer countdown (affects all sections)
2. **HIGH**: Add audio player to listening section (core functionality)
3. **MEDIUM**: Fix writing section answer persistence
4. **MEDIUM**: Fix speaking section microphone warning
5. **LOW**: Update homepage time limits (cosmetic)

---

## Technical Notes

### Timer Issue
- SectionTimer component has polling logic
- Backend API: `/api/timers/{sessionId}`
- May be timing/race condition issue
- Check: Is timer being initialized? Is polling happening?

### Audio Player
- Need to add `<audio>` element to ListeningQuestionDisplay
- Audio URL available in `question.metadata.audio_url`
- Backend serves files at `/audio/{filename}`
- Need play/pause controls, progress bar

### Writing Persistence
- ExamStore has `updateAnswer()` method
- Check if WritingSection properly keys answers by question ID
- May be using wrong key or not clearing previous answer

### Microphone State
- AudioRecorder may not be resetting state after submission
- Check permission state management
- Ensure state clears between questions

---

## Files to Modify

1. `frontend/src/components/LandingPage.tsx` - Update time limits
2. `frontend/src/components/SectionTimer.tsx` - Fix countdown
3. `frontend/src/components/ListeningQuestionDisplay.tsx` - Add audio player
4. `frontend/src/components/WritingSection.tsx` - Fix answer persistence
5. `frontend/src/components/AudioRecorder.tsx` - Fix microphone warning

---

## Testing Checklist

After fixes:
- [ ] Homepage shows correct TOEFL iBT 2026 times
- [ ] Timer counts down in all sections
- [ ] Timer auto-submits at 00:00
- [ ] Timer changes color at 5 min and 1 min
- [ ] Listening section plays audio
- [ ] Listening audio controls work (play/pause/seek)
- [ ] Writing question 1 shows prompt
- [ ] Writing answers persist independently
- [ ] Speaking microphone warning clears after recording
- [ ] Speaking record button shows for all questions
