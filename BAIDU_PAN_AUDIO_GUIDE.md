# 📦 Baidu Pan Audio Resources Guide

## marksentence Audio Resources

The `leihui6/marksentence` repository hosts its audio files on **Baidu Pan (百度网盘)**, a Chinese cloud storage service.

### Direct Link
**URL**: https://pan.baidu.com/s/1wlWVfvdSkorc04DWji6-uA#list/path=%2F

## How to Download from Baidu Pan

### Option 1: Direct Download (With Baidu Account)

1. **Create Baidu Account** (if you don't have one):
   - Visit: https://pan.baidu.com
   - Click "注册" (Register) or use existing account
   - You can register with phone number or email

2. **Access the Shared Link**:
   - Open: https://pan.baidu.com/s/1wlWVfvdSkorc04DWji6-uA
   - Click "保存到网盘" (Save to NetDisk) or "下载" (Download)

3. **Download Files**:
   - Select all audio files (.mp3, .wav)
   - Click "下载" (Download)
   - Baidu may require their download client for large files

4. **Extract and Copy**:
   - Extract downloaded files if compressed
   - Copy all audio files to: `backend/uploads/audio/`
   - Run: `npm run ingest-audio`

### Option 2: Without Baidu Account (Alternative Tools)

If Baidu Pan requires login, you can use third-party download tools:

#### BaiduPCS-Go (Command Line)
```bash
# Install BaiduPCS-Go
# Download from: https://github.com/qjfoidnh/BaiduPCS-Go

# Download the shared folder
BaiduPCS-Go share -url "https://pan.baidu.com/s/1wlWVfvdSkorc04DWji6-uA"
```

#### PanDownload (Windows GUI)
- **Note**: Use with caution, verify source
- Search for "PanDownload" or similar Baidu Pan download tools
- Some tools may not work due to Baidu's restrictions

### Option 3: Web-Based Download (No Software)

Some online services can help download from Baidu Pan:
- Search for "baidu pan download online" (小白羊网盘搜索)
- Paste the share link
- Download directly via browser

**Warning**: Be cautious with third-party services for security reasons.

## What's in the marksentence Baidu Pan?

Expected content based on the repository:
- TOEFL listening audio files
- Sentence marking practice audio
- Possibly organized by difficulty or topic
- Estimated: 20-50 audio files

## After Downloading

Once you have the audio files:

### Step 1: Copy to Upload Directory
```bash
# Copy all MP3/WAV files to:
backend/uploads/audio/
```

### Step 2: Run Ingestion
```bash
cd backend
npm run ingest-audio
```

### Step 3: Verify
```bash
npm run check-audio
```

## Automated Script Support

The ingestion script will **automatically detect** marksentence audio files when you place them in `uploads/audio/`. The script looks for:

- Files in the audio directory
- Filenames containing markers like: "marksentence", "toefl", "listening"
- Audio formats: .mp3, .wav, .m4a

### Example Detection

```
📥 [2/3] Processing marksentence Baidu Pan resources...

   📚 marksentence Baidu Pan Resources:
   
   ⚠ MANUAL DOWNLOAD REQUIRED:
   
   URL: https://pan.baidu.com/s/1wlWVfvdSkorc04DWji6-uA
   
   STEPS:
   1. Visit the Baidu Pan link above
   2. Login with Baidu account (or use download tools)
   3. Download all audio files
   4. Copy to: backend/uploads/audio/
   5. Re-run: npm run ingest-audio
   
   Found 0 marksentence audio files in uploads directory
   ℹ Download from Baidu Pan and re-run this script
```

## File Naming Convention

For best auto-detection, name files like:
- `marksentence-listening-01.mp3`
- `toefl-conversation-01.mp3`
- `listening-practice-01.mp3`

Or just keep original filenames - the script will detect them!

## Expected Results

After adding marksentence audio:

| Metric | Before | After |
|--------|--------|-------|
| Audio Files | 2 | 22-52 |
| Listening Items | 5 | 45-105 |
| Sources | 1 (Magoosh) | 2 (Magoosh + marksentence) |

## Troubleshooting

### "Baidu Pan requires login"
- Create a free Baidu account
- Or use BaiduPCS-Go command-line tool
- Or try online download services

### "Download speed is slow"
- Baidu Pan may throttle free accounts
- Consider Baidu VIP membership (optional)
- Or download in batches

### "Files are in Chinese"
- Audio files work regardless of language
- Focus on .mp3/.wav/.m4a files
- Ignore text/document files if any

### "Can't access Baidu Pan from my country"
- May require VPN in some regions
- Try alternative sources (Archive.org, Eduers)
- Contact repository maintainer for alternative links

## Alternative: Contact Repository Owner

If Baidu Pan access is difficult:

1. Open issue on GitHub: https://github.com/leihui6/marksentence/issues
2. Request alternative download link (Google Drive, Dropbox, etc.)
3. Mention you're building an open-source TOEFL simulator

## Summary

✅ **marksentence DOES have audio** - hosted on Baidu Pan  
🔄 **Requires manual download** - Baidu Pan needs account/tools  
✅ **Auto-detection ready** - Script will process once downloaded  
📦 **Expected content**: 20-50 TOEFL listening audio files  

---

**Baidu Pan Link**: https://pan.baidu.com/s/1wlWVfvdSkorc04DWji6-uA  
**Status**: Manual download required  
**Estimated Items**: 40-100 listening questions  
**Last Updated**: 2026-06-06
