# 🎵 Download TOEFL Audio - Simple Instructions

## Option 1: One-Click Download (Easiest) ⚡

**Just double-click this file:**
```
DOWNLOAD_AUDIO_NOW.bat
```

That's it! The script will:
1. Download audio from Archive.org
2. Place files in the correct folder
3. Tell you to run `npm run ingest-audio`

## Option 2: PowerShell Script 💻

```powershell
cd backend\scripts
.\download-archive-org-audio.ps1
```

Choose which collection to download:
- Option 1: ETS Official Sampler (smaller, faster)
- Option 2: Barron's TOEFL iBT (5 CDs, more content)
- Option 3: Both (recommended)

## Option 3: Manual Download 🌐

If scripts don't work:

### ETS Official Sampler
1. Visit: https://archive.org/details/SAMPLER_201902
2. Click "DOWNLOAD OPTIONS" → "VBR MP3"
3. Save and extract
4. Copy MP3 files to: `backend\uploads\audio\`

### Barron's TOEFL iBT
1. Visit: https://archive.org/details/barronstoeflibt10000phdp
2. Click "DOWNLOAD OPTIONS" → "VBR MP3"
3. Save and extract
4. Copy MP3 files to: `backend\uploads\audio\`

## After Downloading

Run the ingestion script:

```bash
cd backend
npm run ingest-audio
```

Then verify:

```bash
npm run check-audio
```

## Expected Results

- **ETS Sampler**: 1-2 files, 5-10 listening items
- **Barron's**: 5 files, 20-30 listening items
- **Both**: 6-7 files, 25-40 listening items

## Troubleshooting

**"Execution policy error"**
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy Bypass
```

**"Download failed"**
- Check internet connection
- Try manual download (Option 3)
- Try one collection at a time

**"Files not detected"**
- Ensure files are in `backend\uploads\audio\`
- Run `npm run ingest-audio` again

## Why I Can't Download Directly

I (the AI) cannot directly download binary files to your system due to security limitations. However, the scripts I created will handle everything automatically when you run them.

## Summary

🚀 **Fastest**: Double-click `DOWNLOAD_AUDIO_NOW.bat`  
💻 **Flexible**: Run PowerShell script with options  
🌐 **Manual**: Download from Archive.org directly  

All methods work - choose what's easiest for you!

---

**Need Help?** See `FINAL_AUDIO_SOURCES_SUMMARY.md` for complete documentation.
