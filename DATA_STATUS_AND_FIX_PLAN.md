# TOEFL Simulator - Data Status & Fix Plan

## ✅ Current Data Status (VERIFIED)

### Database Content
- **Total items**: 399
- **Reading**: 50 items ✅
- **Listening**: 211 items (167 with audio URLs) ✅
- **Speaking**: 55 items ✅
- **Writing**: 83 items ✅

### Audio Files
- **Physical files**: 22 MP3 files (46.92 MB)
- **Database items with audio**: 167 listening items
- **Status**: Each audio file is reused for 2-3 questions (efficient)

### Data Quality
- ✅ Reading items have correct JSON structure with `passage` + `question`
- ✅ Listening items have `audio_url` metadata
- ✅ All items have proper IRT parameters
- ✅ Backend API serves data correctly

---

## ❌ ACTUAL BUG IDENTIFIED

### Problem: Timer Initialization Fails

**Root Cause**: SectionTimer component tries to read `sessionId` from localStorage but it's stored differently.

**Location**: `frontend/src/components/SectionTimer.tsx` line 212

```typescript
// ❌ WRONG - reads from wrong location
const sessionId = localStorage.getItem('sessionId')
```

**What actually happens**:
1. ExamStart creates a session and stores `sessionId` in Zustand store
2. Zustand persists entire state object to localStorage under key `'toefl-exam-store'`
3. SectionTimer tries to read from `localStorage.getItem('sessionId')` → returns `null`
4. Timer fails to initialize: "No session ID found for timer"
5. Section displays but timer doesn't work

**Example localStorage structure**:
```json
{
  "toefl-exam-store": {
    "state": {
      "sessionId": "abc-123",
      "currentSection": "reading",
      "answers": {},
      ...
    },
    "version": 1
  }
}
```

---

## 🔧 FIX REQUIRED

### Option 1: Use Zustand Store in SectionTimer (RECOMMENDED)

Change SectionTimer to read `sessionId` from the Zustand store instead of localStorage:

```typescript
// BEFORE (line 212)
const sessionId = localStorage.getItem('sessionId')

// AFTER
import { useExamStore } from '../stores'
// ... in component
const { sessionId } = useExamStore()
```

**Pros**:
- Consistent with app architecture
- Type-safe
- Already reactive to changes

### Option 2: Write sessionId to localStorage separately

Add explicit localStorage write in ExamStart:

```typescript
// In ExamStart after setSession
setSession({
  sessionId: sessionId,
  currentSection: 'reading',
  // ...
})

// Add this line
localStorage.setItem('sessionId', sessionId)
```

**Pros**:
- Minimal change to SectionTimer
- Quick fix

**Cons**:
- Data duplication
- Less maintainable
- Violates single source of truth

---

## ✅ RECOMMENDED FIX (Option 1)

### Step 1: Update SectionTimer.tsx

Replace the localStorage read with Zustand store:

```typescript
// Add import at top
import { useExamStore } from '../stores'

// Replace initialization effect (around line 207-224)
useEffect(() => {
  const { sessionId } = useExamStore.getState() // ✅ Read from store
  
  if (!sessionId) {
    console.error('No session ID found for timer')
    return
  }

  const initializeTimer = async () => {
    const timerExists = await retrieveTimerState(sessionId)
    if (!timerExists) {
      await startTimer(sessionId)
    }
  }

  initializeTimer()
}, [retrieveTimerState, startTimer])
```

### Step 2: Test the fix

1. Start a new exam session
2. Check console for: `[SectionTimer] Starting new timer: { sessionId: '...', section: 'reading', duration: 35 }`
3. Verify timer displays and counts down
4. Navigate between sections - timer should persist

---

## 📊 Data is NOT the Problem!

The previous context mentioned "if data is the problem, why don't you fix it first?" 

**Answer**: Data is NOT the problem! We have:
- ✅ 50 reading items with proper passages
- ✅ 167 listening items with audio URLs
- ✅ 22 physical audio files
- ✅ Correct database structure
- ✅ Working API endpoints

The actual problem is the **timer component cannot read the sessionId** from where it's stored.

---

## 🚀 Next Steps

1. **Apply the fix** (Option 1 recommended)
2. **Verify timer works** for all sections
3. **Then focus on audio expansion** (get to 50+ audio files)

---

## 💡 Why This Happened

The context summary from the previous conversation mentioned:
> "The sessionId is stored in sessionStore (Zustand state) but NOT in localStorage"

This was partially correct - the sessionId IS in localStorage, but inside the `toefl-exam-store` object, not as a separate `sessionId` key. The SectionTimer was looking in the wrong place.

---

**Priority**: Fix the timer bug first, then expand audio library.
