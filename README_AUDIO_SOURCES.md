# 🎵 Audio Sources - Quick Reference

## ✅ All Working Links

### 1. Magoosh (Automatic) ✅
Already working - no action needed!

### 2. Archive.org ETS Official (Recommended) ✅
**URL**: https://archive.org/details/SAMPLER_201902  
**Type**: Official ETS TOEFL CD-ROM  
**Action**: Download MP3s → Copy to `uploads/audio/` → Run script  
**Time**: 5 minutes

### 3. marksentence Baidu Pan (Optional) 🔄
**URL**: https://pan.baidu.com/s/1wlWVfvdSkorc04DWji6-uA  
**Type**: TOEFL listening practice  
**Action**: Requires Baidu account → Download → Copy → Run script  
**Time**: 10 minutes

## Quick Start

```bash
# 1. Run automatic ingestion
cd backend
npm run ingest-audio

# 2. Download from Archive.org (recommended)
# Visit: https://archive.org/details/SAMPLER_201902
# Download MP3s, copy to backend/uploads/audio/

# 3. Run again to process new files
npm run ingest-audio

# 4. Verify
npm run check-audio
```

## Expected Results

- **Now**: 5 items (Magoosh)
- **+ Archive.org**: 25-65 items
- **+ marksentence**: 65-165 items

## Documentation

- **FINAL_AUDIO_SOURCES_SUMMARY.md** - Complete guide
- **BAIDU_PAN_AUDIO_GUIDE.md** - Baidu Pan instructions
- **AUDIO_QUICK_REFERENCE.md** - Command reference

---

**All links verified**: 2026-06-06  
**Status**: Ready to use
