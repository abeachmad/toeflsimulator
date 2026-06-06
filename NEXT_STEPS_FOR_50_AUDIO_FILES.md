# Getting to 50+ Audio Files - Next Steps

## Current Status ✅
- **Audio files downloaded**: 22 MP3 files (46.92 MB)
- **Listening items in database**: 169 total (27 with real audio)
- **Target**: 50+ audio files for production

**Gap**: Need 28+ more audio files

---

## ✅ Completed Sources

### 1. Archive.org TOEFL-Listening ✅
- **Files obtained**: 19 MP3 files
- **Status**: Complete - all available files downloaded
- **URL**: https://archive.org/details/TOEFL-Listening

### 2. Magoosh Official Practice ✅
- **Files obtained**: 2 MP3 files
- **Status**: Complete - all public samples downloaded

### 3. TOEFL Resources ✅
- **Files obtained**: 1 MP3 file
- **Status**: Limited availability (most URLs return 404)

---

## 🔍 Investigated but No Audio Available

### Barron's Collections
Investigated three Barron's collections on Archive.org:
- ❌ barronstoeflibt10000phdp - No extractable MP3s
- ❌ barronstoeflibti00shar - No extractable MP3s
- ❌ isbn_9780764145667 - No extractable MP3s

These contain CD-ROM images or non-extractable audio formats.

---

## 🎯 Remaining Options to Reach 50+ Files

### Option 1: Baidu Pan (marksentence) 🌟 RECOMMENDED
**URL**: https://pan.baidu.com/s/1wlWVfvdSkorc04DWji6-uA

**Estimated content**: 50-100+ TOEFL audio files

**Access methods**:
1. **With Baidu Account** (easiest):
   - Create free account at https://pan.baidu.com
   - Open share link
   - Download files directly

2. **Command-line tool**:
   ```bash
   # Install BaiduPCS-Go
   # https://github.com/qjfoidnh/BaiduPCS-Go
   BaiduPCS-Go share -url "https://pan.baidu.com/s/1wlWVfvdSkorc04DWji6-uA"
   ```

3. **Third-party downloaders**:
   - PanDownload (Windows)
   - Baidu NetDisk Client

**After downloading**:
```bash
# Copy files to project
cp *.mp3 backend/uploads/audio/

# Run ingestion
npm run ingest-audio
```

### Option 2: ETS Official Sources
**Free Practice Tests**: https://www.ets.org/toefl/test-takers/ibt/prepare/practice-tests/

- Limited free samples
- May require registration
- High quality but limited quantity

### Option 3: Additional Archive.org Collections
Search Archive.org for:
- "TOEFL listening practice"
- "ESL listening comprehension"
- "Academic English listening"

Some potentially useful collections:
- Delta's Key to TOEFL: https://archive.org/details/deltaskeytotoefl0000gall
- Cambridge TOEFL collections
- Educational broadcasting archives

### Option 4: YouTube Audio Extraction ⚠️
Many TOEFL practice channels exist on YouTube. However:
- **Check copyright**: Only use clearly marked educational/practice content
- **Attribution required**: Credit original creators
- **Fair use consideration**: Educational use for test preparation

Example channels (verify licensing):
- TOEFL Resources
- TST Prep
- NotefulTOEFL

**Extract audio**:
```bash
# Using yt-dlp
yt-dlp -x --audio-format mp3 [VIDEO_URL]
```

### Option 5: Purchase Commercial Packages
If budget allows:
- Official ETS Practice Sets
- Kaplan TOEFL Audio CDs
- Manhattan Prep TOEFL Audio
- Cambridge TOEFL Prep Courses

These provide:
- 50-200+ audio samples per package
- High quality, authentic TOEFL format
- Questions and transcripts included
- Legal for educational use

---

## 🚀 Recommended Action Plan

### Immediate (This Week)
1. **Access Baidu Pan** (marksentence source)
   - Create account or use download tool
   - Download all available TOEFL listening files
   - Expected: 50-80 more audio files

2. **Run automated ingestion**
   ```bash
   npm run ingest-audio
   ```

3. **Verify database**
   ```bash
   npm run tsx scripts/check-db-count.ts
   ```

### Result Expected
- **Total audio files**: 70-100+
- **Listening items**: 200-300+
- **Production ready**: ✅

---

## 🔧 Technical Setup

### Current Automated System
The ingestion system is fully automated:

1. **Place MP3 files** in `backend/uploads/audio/`
2. **Run ingestion**: `npm run ingest-audio`
3. **System automatically**:
   - Detects all MP3 files
   - Identifies source (Archive.org, Magoosh, other)
   - Creates 2-3 questions per audio
   - Generates IRT parameters
   - Inserts into database
   - Updates serving endpoint

### Supported Audio Formats
- MP3 (recommended)
- WAV
- M4A
- OGG (with conversion)

### Question Generation
For each audio file, the system creates:
- **Conversations**: 2 questions (main idea, inference)
- **Lectures**: 3 questions (main topic, details, implication)
- **Difficulty**: Distributed across easy/medium/hard
- **IRT parameters**: Auto-generated based on difficulty

---

## 📊 Monitoring & Verification

### Check current status:
```bash
cd backend

# Count items by section
npm run tsx scripts/check-db-count.ts

# List audio files
ls -lh uploads/audio/*.mp3

# Verify ingestion
npm run check-audio
```

### Expected output after reaching goal:
```
Total items: 400+
Listening items: 200+
Audio files: 50+
```

---

## 🎯 Success Criteria

- [x] Automated download system created
- [x] Automated ingestion system working
- [x] 22 audio files obtained
- [x] Database updated (169 items)
- [x] Code pushed to GitHub
- [ ] **50+ audio files** (Need 28 more)
- [ ] **150+ listening items with real audio**

---

## 📝 Notes

### Legal & Attribution
- All Archive.org content is open access
- Magoosh samples are officially provided for practice
- Baidu Pan marksentence is open-source educational content
- Always check licensing before using commercial content
- Attribute sources in metadata

### Performance Considerations
- Current 22 files = 47 MB
- 50 files ≈ 100-150 MB (reasonable size)
- Audio served via CDN (Railway static files)
- Database handles metadata only (efficient)

### Alternative Approach
If unable to access Baidu Pan:
- Contact test prep companies for educational licenses
- Explore university ESL departments for shared resources
- Build synthetic audio using TTS (lower quality but scalable)

---

## 🚀 Quick Start for Baidu Pan

1. **Visit**: https://pan.baidu.com/s/1wlWVfvdSkorc04DWji6-uA
2. **Create account** (free, requires email/phone)
3. **Download files** (click "保存到网盘" then "下载")
4. **Copy to project**: `backend/uploads/audio/`
5. **Run**: `npm run ingest-audio`
6. **Done!** 50+ audio files ready

---

**Priority**: Baidu Pan access is the fastest path to 50+ audio files ✅
