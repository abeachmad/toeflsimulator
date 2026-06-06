# PowerShell script to download Archive.org TOEFL audio files
# More reliable than Node.js for Windows file downloads

$AudioDir = "$PSScriptRoot\..\uploads\audio"

# Ensure directory exists
if (-not (Test-Path $AudioDir)) {
    New-Item -ItemType Directory -Path $AudioDir -Force | Out-Null
}

Write-Host "Starting audio download to: $AudioDir" -ForegroundColor Cyan
Write-Host ""

# Archive.org TOEFL-Listening Collection URLs
$audioSources = @(
    @{ url = "https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F01.Exercise1516.mp3"; filename = "archive-org-exercise-1516.mp3" },
    @{ url = "https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F01.Exercise17.mp3"; filename = "archive-org-exercise-17.mp3" },
    @{ url = "https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F03.Exercise18.mp3"; filename = "archive-org-exercise-18.mp3" },
    @{ url = "https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F04.Exercise19.mp3"; filename = "archive-org-exercise-19.mp3" },
    @{ url = "https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F05.Exercise20.mp3"; filename = "archive-org-exercise-20.mp3" },
    @{ url = "https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F06.Exercise21.mp3"; filename = "archive-org-exercise-21.mp3" },
    @{ url = "https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F07.Exercise22.mp3"; filename = "archive-org-exercise-22.mp3" },
    @{ url = "https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F08.Exercise23.mp3"; filename = "archive-org-exercise-23.mp3" },
    @{ url = "https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F09.Exercise24.mp3"; filename = "archive-org-exercise-24.mp3" },
    @{ url = "https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F10.Exercise25.mp3"; filename = "archive-org-exercise-25.mp3" },
    @{ url = "https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F11.Exercise26.mp3"; filename = "archive-org-exercise-26.mp3" },
    @{ url = "https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F12.Exercise27.mp3"; filename = "archive-org-exercise-27.mp3" },
    @{ url = "https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F13.Exercise28.mp3"; filename = "archive-org-exercise-28.mp3" },
    @{ url = "https://archive.org/download/TOEFL-Listening/Modul%20Excercise%2F14.Exercise29.mp3"; filename = "archive-org-exercise-29.mp3" },
    @{ url = "https://archive.org/download/TOEFL-Listening/Worksheet%20Excercise%2FToefl%20Excercise%201.mp3"; filename = "archive-org-toefl-exercise-1.mp3" },
    @{ url = "https://archive.org/download/TOEFL-Listening/Worksheet%20Excercise%2FToefl%20Excercise%202.mp3"; filename = "archive-org-toefl-exercise-2.mp3" },
    @{ url = "https://archive.org/download/TOEFL-Listening/Worksheet%20Excercise%2FToefl%20Excercise%203.mp3"; filename = "archive-org-toefl-exercise-3.mp3" },
    @{ url = "https://archive.org/download/TOEFL-Listening/Worksheet%20Excercise%2FToefl%20Excercise%207.mp3"; filename = "archive-org-toefl-exercise-7.mp3" },
    @{ url = "https://archive.org/download/TOEFL-Listening/Worksheet%20Excercise%2FToefl%20Excercise%20skill%20123.mp3"; filename = "archive-org-toefl-exercise-skill-123.mp3" }
)

$downloaded = 0
$skipped = 0
$failed = 0

foreach ($source in $audioSources) {
    $outputPath = Join-Path $AudioDir $source.filename
    
    if (Test-Path $outputPath) {
        Write-Host "Skip: $($source.filename) (already exists)" -ForegroundColor Yellow
        $skipped++
        continue
    }
    
    try {
        Write-Host "Downloading: $($source.filename)..." -ForegroundColor Cyan
        Invoke-WebRequest -Uri $source.url -OutFile $outputPath -UserAgent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" -TimeoutSec 60
        
        $sizeKB = [math]::Round((Get-Item $outputPath).Length / 1KB, 2)
        Write-Host "Success: $($source.filename) ($sizeKB KB)" -ForegroundColor Green
        $downloaded++
        
        # Small delay to be polite
        Start-Sleep -Milliseconds 500
    }
    catch {
        Write-Host "Failed: $($source.filename) - $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "=== DOWNLOAD COMPLETE ===" -ForegroundColor Cyan
Write-Host "Downloaded: $downloaded files" -ForegroundColor Green
Write-Host "Skipped: $skipped files" -ForegroundColor Yellow
Write-Host "Failed: $failed files" -ForegroundColor Red
Write-Host ""
Write-Host "Audio directory: $AudioDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next step: Run npm run ingest-audio to process these files" -ForegroundColor Yellow
