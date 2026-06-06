# 🚀 Get marksentence Audio - Quick Start

## 3-Minute Setup

### Step 1: Visit Baidu Pan (1 min)
```
URL: https://pan.baidu.com/s/1wlWVfvdSkorc04DWji6-uA
```

### Step 2: Download (1 min)
- Click "保存到网盘" (Save to NetDisk) OR
- Click "下载" (Download) directly
- May need free Baidu account (quick registration)

### Step 3: Add to Project (30 sec)
```bash
# Copy all audio files (.mp3, .wav) to:
backend/uploads/audio/

# Then run:
cd backend
npm run ingest-audio
```

### Step 4: Verify (30 sec)
```bash
npm run check-audio
```

## Done! 🎉

You should now have:
- ✅ Magoosh audio (2 files, 5 items)
- ✅ marksentence audio (20-50 files, 40-100 items)
- ✅ Ready for testing!

## No Baidu Account?

### Alternative Method: Archive.org
```
1. Visit: https://archive.org/details/TOEFL-Listening
2. Download MP3 package
3. Extract and copy to: backend/uploads/audio/
4. Run: npm run ingest-audio
```

### Alternative Tool: BaiduPCS-Go
```bash
# Install from: https://github.com/qjfoidnh/BaiduPCS-Go
# Then:
BaiduPCS-Go share -url "https://pan.baidu.com/s/1wlWVfvdSkorc04DWji6-uA"
```

## Need Help?

See detailed guides:
- **BAIDU_PAN_AUDIO_GUIDE.md** - Complete Baidu Pan instructions
- **MARKSENTENCE_BAIDU_PAN_EXPLAINED.md** - Full explanation
- **AUDIO_INGESTION_QUICKSTART.md** - General audio setup

## Quick Troubleshooting

**"Can't access Baidu Pan"**
→ Use Archive.org alternative

**"Need Baidu account"**
→ Free registration at https://pan.baidu.com

**"Download is slow"**
→ Try BaiduPCS-Go tool or download in batches

**"Files not detected"**
→ Ensure files are in `backend/uploads/audio/`
→ Run `npm run ingest-audio` again

---

**Baidu Pan Link**: https://pan.baidu.com/s/1wlWVfvdSkorc04DWji6-uA  
**Expected Files**: 20-50 MP3/WAV audio files  
**Expected Items**: 40-100 listening questions  
**Time to Setup**: ~3 minutes
