# Fixes Deployed - June 6, 2026

## ✅ Fixed Issues

### 1. Timer Working ✅
**Problem**: Timer showed 240 minutes for all sections  
**Cause**: Session created with 4-hour global timer, sections were reading that instead of using section-specific durations  
**Fix**: Timer now starts fresh for each section with correct durations:
- Reading: 35 minutes ✅
- Listening: 36 minutes ✅
- Writing: 29 minutes ✅
- Speaking: 16 minutes ✅

**Commits**:
- `51b2dba` - Fixed sessionId retrieval from Zustand store
- `85de5ba` - Timer starts fresh for each section
- `a7b2119` - Removed unused function

---

### 2. Listening Audio Playback ✅
**Problem**: No audio playing in listening section  
**Cause**: Database had 211 listening items but only 67 had real audio files. Others had fake URLs like `/audio/listening-1.mp3`  
**Fix**: API now filters listening items to only return those with `audio_filename` (real MP3 files)  
**Result**: Now serving 67 listening questions with working audio from 22 MP3 files

**Commit**: `6b80217`

---

### 3. Writing Section Missing Prompt ✅
**Problem**: First writing question showed instructions but no actual prompt text  
**Cause**: Academic-discussion type uses `professorPrompt` field instead of `prompt` field  
**Fix**: Added parsing logic to handle `professorPrompt` and map it to `prompt`  
**Result**: Writing prompts now display correctly

**Commit**: `4feef85`

---

## ⚠️ Remaining Issues

### 4. Listening Questions Have Generic Options
**Problem**: Many listening questions show placeholder text:
- "First answer option"
- "Second answer option"  
- "Third answer option"
- "Fourth answer option"

**Affected Items**:
- marksentence questions (2 items)
- archive-org-sampler questions (18 items)
- archive-org-exercise questions (42 items)

**Good Items** (with real options):
- magoosh questions (5 items with real options) ✅

**Current Status**: 
- 67 total listening items with audio
- Only 5 have real, meaningful answer options
- 62 have placeholder options

**Solution Needed**: Either:
1. **Regenerate options** for these 62 items using the audio transcripts
2. **Filter them out** like we did with fake audio (only show the 5 Magoosh items)
3. **Manually create options** based on audio content

**Recommendation**: Filter out items with placeholder options for now, leaving only 5 working listening questions until proper options can be generated.

---

### 5. Scoring Issues
**Problem**: You mentioned scoring is "very wrong"

**Need More Info**:
- What scores are you seeing?
- What scores should you be seeing?
- Which sections have wrong scores?

**Current Scoring System**:
- Reading/Listening: IRT 3PL model calculates theta, converts to CEFR (0-6) and scale score (0-30)
- Writing/Speaking: Gemini AI grades and provides CEFR + scale score

Please provide specific examples of wrong scores so I can fix them.

---

## 📊 Current Working Status

### Fully Working
- ✅ Timer system (all sections)
- ✅ Session management
- ✅ Answer persistence
- ✅ Navigation between sections
- ✅ Writing section display
- ✅ Reading section (50 items)

### Partially Working
- ⚠️ Listening section (5 questions with real options, 62 with placeholders)
- ⚠️ Scoring (need specific examples of issues)

### Deployment Status
All fixes deployed to Railway and live in production.

---

## 🚀 Next Actions

### Immediate
1. **Confirm** which specific scoring issues need fixing
2. **Decide** on listening questions:
   - Option A: Filter to only 5 Magoosh questions (quick)
   - Option B: Generate proper options for all 67 items (takes time)

### Quality
- Add more audio files (currently 22, target 50+)
- Improve question variety
- Add proper answer options for all listening items

---

**Status**: 3 of 5 reported issues fixed ✅  
**Remaining**: Placeholder options in listening + scoring verification needed
