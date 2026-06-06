# Audio & Listening Content Ingestion Guide

This guide explains how to populate your TOEFL simulator database with audio files and listening questions from multiple open-source repositories.

## Overview

The `ingest-audio-listening-sources.ts` script automatically downloads audio files and creates listening comprehension questions from three major sources:

1. **Magoosh Official Practice Audio** - Direct MP3 downloads
2. **leihui6/marksentence GitHub Repository** - Community audio resources
3. **Eduers TOEFL Listening Pack** - Comprehensive RAR archive (manual step required)

## Prerequisites

- Node.js and npm installed
- PostgreSQL database configured
- Internet connection for downloads
- WinRAR or 7-Zip (for Eduers pack extraction)

## Quick Start

### Step 1: Run the Ingestion Script

```bash
cd backend
npm run ingest-audio
```

Or directly with tsx:

```bash
npx tsx scripts/ingest-audio-listening-sources.ts
```

### Step 2: Manual Download (Optional but Recommended)

For the Eduers TOEFL Listening Pack:

1. **Download the RAR file:**
   - URL: http://www.eduers.com/toeflibt/TOEFL_Listening.rar
   - Save to your computer

2. **Extract the archive:**
   - Right-click → Extract with WinRAR or 7-Zip
   - Extract all audio files

3. **Copy files to uploads directory:**
   ```bash
   # Copy all MP3/WAV files to:
   backend/uploads/audio/
   ```

4. **Re-run the script:**
   ```bash
   npm run ingest-audio
   ```
   
   The script will detect the new files and create database entries automatically.

## What the Script Does

### Automatic Downloads

1. **Magoosh Audio Files:**
   - High-Intermediate Listening Lecture
   - Speaking Task 4 Lecture
   - Creates 2-3 questions per audio file
   - Stores in `backend/uploads/audio/`

2. **GitHub Repository (leihui6/marksentence):**
   - Fetches audio files from the repository
   - Downloads MP3/WAV/M4A files
   - Creates comprehension questions
   - Supports up to 20 audio files

### Database Entries

For each audio file, the script creates:
- **Item ID**: Unique identifier (e.g., `magoosh-1-q1`)
- **Section**: Always `listening`
- **Type**: `conversation` or `academic-lecture`
- **Stage**: 1 (easy/medium) or 2 (hard)
- **Difficulty**: Easy, Medium, or Hard
- **Content**: Question text with audio reference
- **Options**: 4 multiple-choice answers
- **IRT Parameters**: Calibrated a, b, c values
- **Metadata**: 
  - `audio_url`: Path to audio file (e.g., `/audio/filename.mp3`)
  - `audio_filename`: Original filename
  - `source`: Origin repository
  - `topic`: Content description
  - `duration`: Estimated length in seconds

## Directory Structure

```
backend/
├── uploads/
│   └── audio/
│       ├── magoosh-lecture-1-high-intermediate.mp3
│       ├── magoosh-speaking-task4-lecture.mp3
│       ├── marksentence-1.mp3
│       ├── marksentence-2.mp3
│       └── [eduers files].mp3
└── scripts/
    └── ingest-audio-listening-sources.ts
```

## Audio File Serving

Audio files are served via the Express static middleware:

```
Frontend request: /audio/filename.mp3
Backend serves: backend/uploads/audio/filename.mp3
```

The frontend `AudioPlayer` component automatically handles:
- Loading audio from `/audio/` endpoint
- Graceful fallback for missing files
- "Audio Unavailable" message for 404 errors

## Verification

### Check Database Entries

```bash
# Connect to PostgreSQL
psql -U your_username -d toefl_simulator

# Count listening items
SELECT COUNT(*) FROM test_items WHERE section = 'listening';

# View listening items with audio
SELECT item_id, type, difficulty_level, metadata->'audio_filename' 
FROM test_items 
WHERE section = 'listening' 
AND metadata->>'audio_url' IS NOT NULL;
```

### Check Audio Files

```bash
# List downloaded audio files
ls -lh backend/uploads/audio/

# On Windows
dir backend\uploads\audio\
```

### Test in Application

1. Start the backend server:
   ```bash
   npm run dev
   ```

2. Navigate to a listening section
3. Verify audio playback works
4. Check that questions display correctly

## Troubleshooting

### Download Failures

**Problem**: Audio download times out or fails

**Solutions**:
- Check internet connection
- Verify URLs are still valid
- Try downloading manually and placing in `uploads/audio/`
- Re-run the script (it skips existing files)

### Database Insertion Errors

**Problem**: Items fail to insert into database

**Solutions**:
- Verify database connection in `.env`
- Check PostgreSQL is running
- Ensure `test_items` table exists:
  ```bash
  npm run db:init
  ```
- Check for duplicate `item_id` values

### Audio Files Not Playing

**Problem**: Frontend shows "Audio Unavailable"

**Solutions**:
- Verify files exist in `backend/uploads/audio/`
- Check file permissions (readable)
- Verify Express static middleware is configured:
  ```javascript
  app.use('/audio', express.static(AUDIO_DIR));
  ```
- Check browser console for CORS or network errors

### Missing Eduers Content

**Problem**: Eduers TOEFL Pack items not created

**Solution**: This is expected - requires manual download:
1. Download RAR from http://www.eduers.com/toeflibt/TOEFL_Listening.rar
2. Extract with WinRAR/7-Zip
3. Copy audio files to `backend/uploads/audio/`
4. Re-run script

## Advanced Usage

### Custom Audio Sources

To add your own audio sources, modify the script:

```typescript
async function fetchCustomAudio(): Promise<ListeningItem[]> {
  const items: ListeningItem[] = [];
  
  // Your custom logic here
  const audioUrl = 'https://example.com/audio.mp3';
  const filename = 'custom-audio.mp3';
  const audioPath = path.join(AUDIO_DIR, filename);
  
  await downloadFile(audioUrl, audioPath);
  
  items.push({
    item_id: 'custom-1',
    section: 'listening',
    type: 'conversation',
    stage: 1,
    difficulty_level: 'medium',
    content: '[Listen to the audio]\n\nWhat is discussed?',
    options: ['A', 'B', 'C', 'D'],
    correct_answer: '0',
    irt_parameters: generateIRT('medium'),
    metadata: {
      source: 'Custom Source',
      audio_url: `/audio/${filename}`,
      audio_filename: filename
    }
  });
  
  return items;
}

// Add to main():
allItems.push(...await fetchCustomAudio());
```

### Batch Processing

For large audio collections:

```typescript
// Process in batches to avoid memory issues
const BATCH_SIZE = 50;

for (let i = 0; i < audioFiles.length; i += BATCH_SIZE) {
  const batch = audioFiles.slice(i, i + BATCH_SIZE);
  const batchItems = await processBatch(batch);
  await insertListeningItems(batchItems);
}
```

## Performance Tips

1. **Parallel Downloads**: The script downloads sequentially to avoid overwhelming servers. For faster ingestion, increase concurrency carefully.

2. **Audio Formats**: MP3 files are smaller than WAV. Consider converting WAV to MP3 for storage efficiency.

3. **Database Indexing**: The script uses `ON CONFLICT` to handle duplicates efficiently.

4. **Caching**: Downloaded files are not re-downloaded if they already exist.

## License & Attribution

All audio sources are used under their respective open-source licenses:

- **Magoosh**: Practice materials provided by Magoosh for educational use
- **leihui6/marksentence**: Open-source GitHub repository
- **Eduers**: Open-source TOEFL practice materials

Please respect the original licenses and attribute sources appropriately.

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review script logs for error messages
3. Verify database and filesystem permissions
4. Ensure all prerequisites are installed

## Next Steps

After successful ingestion:

1. ✅ Verify database contains listening items
2. ✅ Test audio playback in frontend
3. ✅ Review generated questions for accuracy
4. ✅ Consider adding transcripts for accessibility
5. ✅ Implement scoring rubrics for listening responses

Happy testing! 🎵📚
