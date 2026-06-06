# Testing Guide - Critical Bug Fixes

## Quick Test Steps

After Railway deployment completes, test these fixes:

---

## 🏠 Test 1: Homepage (30 seconds)

**URL**: https://toeflsimulator.up.railway.app/

**Expected**:
```
Reading Section    → 20 questions, 35 minutes
Listening Section  → 28 questions, 36 minutes
Writing Section    → 2 tasks, 29 minutes
Speaking Section   → 4 tasks, 16 minutes
Total test time    → ~116 minutes
```

**Pass**: All times match above ✅  
**Fail**: Old times still showing (~50 items, 30 min, etc.) ❌

---

## 🎧 Test 2: Listening Section Audio (2 minutes)

**Steps**:
1. Click "Start Practice Test"
2. Navigate through Reading section (or skip if possible)
3. Enter Listening section

**For Questions with Audio** (27 out of 169 items):
- ✅ Should see audio player with play button
- ✅ Click play → audio plays
- ✅ Progress bar moves
- ✅ Can pause/resume
- ✅ Volume slider works

**For Questions without Audio** (142 items):
- ✅ Should see transcript with note "No audio available"
- ✅ Can still answer questions

**Quick Check**: Look for question with "magoosh" or "archive-org" in item_id - these definitely have audio.

---

## ✍️ Test 3: Writing Section Answer Persistence (3 minutes)

**Steps**:
1. Navigate to Writing section
2. **Question 1**:
   - Verify prompt text is visible (not blank)
   - Type some text, e.g., "This is my answer to question 1"
   - Click Next (or navigate to Question 2)
3. **Question 2**:
   - Verify different prompt appears
   - Verify text area is EMPTY (not showing Q1's answer)
   - Type different text, e.g., "This is my answer to question 2"
   - Go back to Question 1
4. **Back to Question 1**:
   - Verify your original text "This is my answer to question 1" is still there

**Pass**: Each question has independent, persistent answers ✅  
**Fail**: Q2 shows Q1's answer, or answers don't persist ❌

---

## 🎤 Test 4: Speaking Section Microphone (2 minutes)

**Steps**:
1. Navigate to Speaking section
2. **Question 1**:
   - Click "Start Recording"
   - Grant microphone permission if prompted
   - Record for 5 seconds
   - Click "Stop Recording"
   - Click "Submit Response"
   - Wait for grading/score display
3. **Navigate to Question 2**:
   - Verify you see "Start Recording" button (not "Retry Recording")
   - Verify NO red "Microphone Access Required" warning
   - Verify the page is ready for a fresh recording

**Pass**: Clean state for each question, no persistent warnings ✅  
**Fail**: Warning shows even after successful recording ❌

---

## ⏰ Test 5: Timer Countdown (1-2 minutes per section)

**What to Watch**:
1. Timer shows at top right of each section
2. Timer counts DOWN (e.g., 35:00 → 34:59 → 34:58)
3. At 5 minutes remaining: Timer turns ORANGE
4. At 1 minute remaining: Timer turns RED
5. At 00:00: Section auto-submits

**Quick Test** (Reading section, 35 min):
- Start test
- Watch timer for 10-20 seconds
- Verify it decreases (35:00 → 34:50 → 34:40)

**Pass**: Timer counts down continuously ✅  
**Fail**: Timer stuck at 35:00 or doesn't decrease ❌

⚠️ **Note**: If timer is stuck, this is a backend API issue that needs separate debugging.

---

## 🔍 Quick Visual Checklist

### Homepage
- [ ] Shows correct times (35, 36, 29, 16 minutes)
- [ ] Shows correct question counts (20, 28, 2, 4)

### Listening
- [ ] Audio player visible (at least on some questions)
- [ ] Play button works
- [ ] Can hear audio

### Writing
- [ ] Question 1 has visible prompt
- [ ] Question 2 has different prompt
- [ ] Answers persist independently

### Speaking
- [ ] Can record in Question 1
- [ ] Question 2 shows clean "Start Recording" state
- [ ] No persistent error messages

### Timer
- [ ] Counts down from start time
- [ ] Updates every second
- [ ] Changes color at 5 min and 1 min

---

## 🐛 If Issues Found

### Audio Not Playing
**Check**:
1. Open browser console (F12)
2. Look for 404 errors on `/audio/*` URLs
3. Verify audio files exist on Railway server

**Likely cause**: Audio files not deployed to Railway (they're gitignored)

**Fix**: May need to manually upload audio files to Railway volume

### Timer Stuck
**Check**:
1. Browser console for API errors
2. Network tab: Is `/api/timers/*` being called?
3. Response from timer API

**Likely cause**: Backend timer API not starting/polling correctly

### Writing Answers Not Persisting
**Check**:
1. Browser console for zustand store updates
2. localStorage for session data

**Likely cause**: examStore not properly updating

---

## 📊 Expected Results Summary

| Test | Status | Time Required |
|------|--------|---------------|
| Homepage Times | ✅ Fixed | 30 sec |
| Audio Player | ✅ Fixed | 2 min |
| Writing Persistence | ✅ Fixed | 3 min |
| Microphone Warning | ✅ Fixed | 2 min |
| Timer Countdown | ⚠️ Needs Testing | 2 min |

**Total Testing Time**: ~10 minutes

---

## 🚀 Deployment URL

**Production**: https://toeflsimulator.up.railway.app/

**GitHub**: https://github.com/abeachmad/toeflsimulator

**Latest Commit**: c073153

---

## 📝 Report Issues

If any test fails, note:
1. Which test failed
2. Browser used (Chrome, Firefox, Safari, Edge)
3. Error messages in browser console (F12)
4. Screenshots if possible

Share these details for rapid debugging.
