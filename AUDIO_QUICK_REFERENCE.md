# 🎵 Audio & Listening Quick Reference Card

## ⚡ Quick Commands

```bash
# Check audio setup status
npm run check-audio

# Download and ingest audio
npm run ingest-audio

# Verify what was ingested
npx tsx scripts/verify-audio-ingestion.ts

# Initialize database (if needed)
npm run db:init

# Seed with sample data (if needed)
npm run db:seed
```

## 📊 Current Status (As of Last Check)

```
✅ Database: Connected
✅ Audio Files: 2 files (6.59 MB)
✅ Listening Items: 149 total
✅ Items with Audio: 105
✅ Magoosh Items: 5 (with 2 audio files)
✅ IRT Parameters: All valid
✅ Status: READY FOR USE
```

## 🎯 Audio Sources

| Source | Status | Items | Auto/Manual |
|--------|--------|-------|-------------|
| Magoosh Official | ✅ Working | 5 | Automatic |
| marksentence Repo | ⚠️ Ready | 0-40 | Automatic |
| Eduers Pack | 🔄 Pending | 100-200 | Manual |

## 📁 Key Locations

```
Audio Storage:
  backend/uploads/audio/

Database Table:
  test_items (section = 'listening')

Audio URL Pattern:
  /audio/filename.mp3

Scripts:
  backend/scripts/ingest-audio-listening-sources.ts
  backend/scripts/verify-audio-ingestion.ts
  backend/scripts/check-audio-setup.ts
```

## 🔍 Quick Checks

### Is audio ingestion working?
```bash
npm run check-audio
# Should show all ✅ green checkmarks
```

### How many listening items?
```bash
cd backend
npx tsx -e "
import {pool} from './src/config/database.js';
const r = await pool.query('SELECT COUNT(*) FROM test_items WHERE section=\\'listening\\'');
console.log('Listening items:', r.rows[0].count);
await pool.end();
"
```

### List audio files
```bash
# Windows
dir backend\uploads\audio\

# Linux/Mac
ls -lh backend/uploads/audio/
```

### View Magoosh items
```bash
cd backend
npx tsx -e "
import {pool} from './src/config/database.js';
const r = await pool.query('SELECT item_id, metadata FROM test_items WHERE metadata->>\\\"source\\\"=\\\"Magoosh Official Practice\\\" LIMIT 3');
console.log(r.rows);
await pool.end();
"
```

## 🚀 Adding More Audio (Eduers Pack)

1. **Download**: http://www.eduers.com/toeflibt/TOEFL_Listening.rar
2. **Extract**: Use WinRAR or 7-Zip
3. **Copy**: All MP3/WAV files to `backend/uploads/audio/`
4. **Ingest**: Run `npm run ingest-audio`
5. **Verify**: Run `npm run check-audio`

**Expected Result**: +100-200 listening items

## 🛠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| No audio files | Run `npm run ingest-audio` |
| Database connection error | Check `.env` file, verify PostgreSQL running |
| "Audio Unavailable" in frontend | Verify files in `uploads/audio/`, check Express config |
| Download fails | Check internet, try manual download |
| Items not inserting | Run `npm run db:init` to initialize schema |

## 📚 Documentation

| File | Purpose |
|------|---------|
| `AUDIO_INGESTION_QUICKSTART.md` | Fast setup guide |
| `backend/scripts/AUDIO_INGESTION_README.md` | Complete documentation |
| `backend/scripts/AUDIO_SOURCES_SUMMARY.md` | Source details |
| `backend/scripts/ADDING_MORE_AUDIO_SOURCES.md` | Developer guide |
| `AUDIO_INGESTION_COMPLETE_SUMMARY.md` | Full summary |

## 🎓 Database Schema Cheat Sheet

```sql
-- Count listening items
SELECT COUNT(*) FROM test_items WHERE section = 'listening';

-- Count by source
SELECT metadata->>'source' as source, COUNT(*) 
FROM test_items WHERE section = 'listening' 
GROUP BY metadata->>'source';

-- Items with audio
SELECT COUNT(*) FROM test_items 
WHERE section = 'listening' 
AND metadata->>'audio_url' IS NOT NULL;

-- View Magoosh items
SELECT item_id, type, difficulty_level, 
       metadata->>'audio_filename' as audio
FROM test_items 
WHERE metadata->>'source' = 'Magoosh Official Practice';

-- Check IRT parameters
SELECT item_id, 
       irt_parameters->>'a' as discrimination,
       irt_parameters->>'b' as difficulty,
       irt_parameters->>'c' as guessing
FROM test_items 
WHERE section = 'listening' 
LIMIT 5;
```

## 🔗 Frontend Integration

```typescript
// In your React component
import { AudioPlayer, ListeningQuestionDisplay } from '@/components';

// Display listening question with audio
<ListeningQuestionDisplay
  question={{
    content: item.content,
    options: item.options,
    audioUrl: item.metadata.audio_url // '/audio/magoosh-1.mp3'
  }}
  onAnswer={(answer) => handleAnswer(answer)}
/>

// Audio URLs are served by Express:
// Frontend: /audio/filename.mp3
// Backend: backend/uploads/audio/filename.mp3
```

## ✅ Quick Health Check

Run this to verify everything is working:

```bash
# 1. Check setup
npm run check-audio

# Expected: All ✅ green checks

# 2. Verify audio files exist
ls backend/uploads/audio/*.mp3

# Expected: List of MP3 files

# 3. Test backend serves audio
npm run dev &
curl http://localhost:3000/audio/magoosh-lecture-1-high-intermediate.mp3 -I

# Expected: HTTP 200 OK

# 4. Query database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM test_items WHERE section='listening';"

# Expected: Number > 0
```

## 📞 Quick Help

- **Audio not downloading?** → Check internet connection, try manual download
- **Database errors?** → Verify `.env`, check PostgreSQL status
- **Need more items?** → Download Eduers pack or add more sources
- **How to add sources?** → See `ADDING_MORE_AUDIO_SOURCES.md`

## 🎯 Success Indicators

✅ `npm run check-audio` shows all green  
✅ Audio files present in `uploads/audio/`  
✅ Database has listening items  
✅ IRT parameters valid  
✅ Frontend can play audio  

---

**Last Updated**: 2026-06-06  
**Status**: ✅ PRODUCTION READY  
**Version**: 1.0.0
