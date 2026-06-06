# Deploy Timer Fix - Quick Guide

## What Was Fixed

The section timer wasn't initializing because it was reading `sessionId` from the wrong location.

**File Changed**: `frontend/src/components/SectionTimer.tsx`

**Change**: Read `sessionId` from Zustand store instead of localStorage directly

---

## 🚀 Deployment Steps

### 1. Commit the Fix

```bash
# Navigate to project root
cd c:\Users\Admin\Documents\KIRO\toeflsimulator

# Check status
git status

# Add the changed file
git add frontend/src/components/SectionTimer.tsx

# Commit with descriptive message
git commit -m "fix: timer sessionId retrieval from Zustand store

- Fixed timer initialization failure
- Now reads sessionId from useExamStore instead of localStorage
- Ensures timer starts correctly for all sections
- Resolves 'No session ID found for timer' error"

# Push to GitHub
git push origin main
```

### 2. Verify Railway Auto-Deploy

1. Go to https://railway.app/project/your-project
2. Check "Deployments" tab
3. Wait for deployment to complete (~2-3 minutes)
4. Check deployment logs for any errors

### 3. Test in Production

Visit your app URL and test:

**Test 1: Timer Initialization**
```
1. Go to: https://your-app.railway.app
2. Click "Begin Test"
3. Check: Timer should show "35:00"
4. Observe: Timer counts down "34:59", "34:58"...
```

**Test 2: Console Logs**
```
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for: "[SectionTimer] Initializing timer with sessionId: ..."
4. Should NOT see: "[SectionTimer] No session ID found for timer"
```

**Test 3: Section Navigation**
```
1. Complete reading section
2. Navigate to listening
3. Check: Timer should reset to "36:00"
4. Navigate to writing
5. Check: Timer should reset to "29:00"
```

**Test 4: Timer Persistence**
```
1. Start a section
2. Wait for timer to count down (e.g., to 34:30)
3. Refresh the page (F5)
4. Check: Timer should resume from ~34:30 (not restart at 35:00)
```

---

## ✅ Expected Results

### Before Fix
```
Console: "[SectionTimer] No session ID found for timer"
Timer Display: "00:00" (or blank)
Result: Timer never starts
```

### After Fix
```
Console: "[SectionTimer] Initializing timer with sessionId: abc123..."
Console: "[SectionTimer] Starting new timer: { sessionId: 'abc123', section: 'reading', duration: 35 }"
Timer Display: "35:00" → "34:59" → "34:58" ...
Result: Timer works correctly ✅
```

---

## 🐛 Troubleshooting

### Issue: Git push fails
**Solution**: Check if you have uncommitted changes from previous work
```bash
git status
git add .
git commit -m "Previous changes"
git push
```

### Issue: Railway deployment fails
**Solution**: Check Railway logs
```bash
# In Railway dashboard
Deployments → Click latest deployment → View Logs
```

### Issue: Timer still not working
**Solution**: Hard refresh the browser
```bash
# Clear cache and reload
Ctrl + Shift + R (Windows/Linux)
Cmd + Shift + R (Mac)

# Or clear localStorage manually
DevTools → Application → Local Storage → Clear
```

### Issue: "No session ID" error persists
**Solution**: Check store setup
```javascript
// In browser console
console.log(localStorage.getItem('toefl-exam-store'))
// Should show JSON with sessionId

// Check Zustand store
import { useExamStore } from './stores'
console.log(useExamStore.getState().sessionId)
// Should show sessionId string
```

---

## 📊 Verification Checklist

After deployment, verify:

- [ ] Git commit successful
- [ ] GitHub shows latest commit
- [ ] Railway deployment completed
- [ ] No errors in Railway logs
- [ ] Frontend loads without errors
- [ ] Timer displays in reading section
- [ ] Timer counts down correctly
- [ ] Timer resets on section change
- [ ] Timer persists on page refresh
- [ ] Console shows initialization logs
- [ ] No "sessionId" errors in console

---

## 📝 Additional Notes

### What If Timer Still Doesn't Work?

Check these common issues:

1. **Backend Timer API**
   ```bash
   # Test timer API directly
   curl -X POST https://your-api.railway.app/api/timers \
     -H "Content-Type: application/json" \
     -d '{"sessionId":"test123","sectionName":"reading","duration":35}'
   ```

2. **Session Creation**
   ```javascript
   // In browser console after starting exam
   console.log(localStorage.getItem('toefl-exam-store'))
   // Should contain: { state: { sessionId: "...", ... } }
   ```

3. **Network Issues**
   ```
   DevTools → Network tab → Filter: timer
   Should see POST to /api/timers
   Should see GET to /api/timers/{id}
   ```

### Related Files

- `frontend/src/components/SectionTimer.tsx` - Fixed component
- `frontend/src/stores/examStore.ts` - Store with sessionId
- `frontend/src/components/ExamStart.tsx` - Creates session
- `BUG_FIX_COMPLETE.md` - Detailed analysis
- `DATA_STATUS_AND_FIX_PLAN.md` - Original investigation

---

## 🎉 Success Criteria

You'll know the fix works when:
- ✅ Timer starts at correct time (35:00 for reading)
- ✅ Timer counts down every second
- ✅ Timer changes color (orange at 5 min, red at 1 min)
- ✅ Timer auto-navigates when reaching 00:00
- ✅ No console errors about sessionId
- ✅ Timer persists on page refresh

---

**Ready to deploy?** Run the commands in Step 1 above! 🚀
