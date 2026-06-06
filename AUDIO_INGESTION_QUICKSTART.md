# 🎵 Audio Ingestion Quick Start Guide

Get your TOEFL simulator populated with audio and listening questions in minutes!

## Prerequisites

```bash
✅ PostgreSQL database running
✅ Node.js installed (v20+)
✅ Internet connection
✅ Database initialized (npm run db:init)
```

## Step 1: Run the Automated Ingestion

```bash
cd backend
npm run ingest-audio
```

**What happens:**
- ✅ Downloads Magoosh official practice audio (2 files)
- ✅ Fetches audio from leihui6/marksentence GitHub repo
- ✅ Creates ~35-50 listening items with questions
- ✅ Stores audio files in `backend/uploads/audio/`
- ✅ Inserts items into database

**Time**: 2-5 minutes

## Step 2: Manual Download (Optional - Highly Recommended)

For the comprehensive Eduers TOEFL Listening Pack:

### Download & Extract

1. **Download RAR file**:
   - URL: http://www.eduers.com/toeflibt/TOEFL_Listening.rar
   - Save to Downloads folder

2. **Extract with WinRAR or 7-Zip**:
   - Right-click → "Extract Here"
   - Or use command: `7z x TOEFL_Listening.rar`

3. **Copy audio files**:
   ```bash
   # Copy all MP3/WAV files to:
   backend/uploads/audio/
   ```

4. **Re-run script**:
   ```bash
   npm run ingest-audio
   ```

**Additional items**: 100-200+ listening questions

## Step 3: Verify Installation

### Check Database

```bash
# Connect to database
psql -U postgres -d toefl_simulator

# Query listening items
SELECT COUNT(*) FROM test_items WHERE section = 'listening';

# Should see: 35-250+ items depending on Step 2
```

### Check Audio Files

```bash
# Windows
dir backend\uploads\audio\

# Linux/Mac
ls -lh backend/uploads/audio/
```

### Test in Application

1. Start backend: `npm run dev` (in backend folder)
2. Start frontend: `npm run dev` (in frontend folder)
3. Navigate to Listening section
4. Click on a listening question
5. Audio player should appear and play

## Expected Results

### After Step 1 (Automated)
```
✅ 17-25 audio files downloaded
✅ 35-50 listening items in database
✅ 2 sources: Magoosh + marksentence
```

### After Step 2 (Manual)
```
✅ 67-125 audio files total
✅ 135-250 listening items in database
✅ 3 sources: Magoosh + marksentence + Eduers
```

## Troubleshooting

### "Connection refused" error
→ Check database is running: `pg_ctl status`

### "Download failed" error
→ Check internet connection, try again

### "No audio playing" in frontend
→ Verify files in `backend/uploads/audio/`
→ Check browser console for errors

### "Permission denied" when copying files
→ Use administrator/sudo: `sudo cp ...`

## Quick Commands Reference

```bash
# Run ingestion
npm run ingest-audio

# Check database
psql -U postgres -d toefl_simulator -c "SELECT COUNT(*) FROM test_items WHERE section = 'listening';"

# View audio files
ls backend/uploads/audio/ | wc -l

# Re-initialize database (WARNING: deletes all data)
npm run db:init

# Seed with additional sample data
npm run db:seed
```

## File Locations

```
backend/
├── uploads/audio/              ← Audio files stored here
├── scripts/
│   ├── ingest-audio-listening-sources.ts   ← Main script
│   ├── AUDIO_INGESTION_README.md           ← Full documentation
│   └── AUDIO_SOURCES_SUMMARY.md            ← Source details
└── package.json                ← Contains npm run ingest-audio
```

## Next Steps

After successful ingestion:

1. ✅ Test audio playback in the application
2. ✅ Review generated questions for accuracy
3. ✅ Consider adding transcripts for accessibility
4. ✅ Implement adaptive selection algorithm
5. ✅ Add more audio sources as needed

## Need Help?

📖 **Full Documentation**: `backend/scripts/AUDIO_INGESTION_README.md`  
📊 **Source Details**: `backend/scripts/AUDIO_SOURCES_SUMMARY.md`  
🔧 **Troubleshooting**: See README troubleshooting section

## One-Line Summary

```bash
# Complete automated ingestion (Step 1 only)
cd backend && npm run ingest-audio

# For full content: download Eduers RAR, extract to uploads/audio/, then run above
```

That's it! Your TOEFL simulator now has authentic listening content with audio files. 🎉
