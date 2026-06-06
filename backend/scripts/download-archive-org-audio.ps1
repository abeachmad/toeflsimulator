# PowerShell Script to Download Archive.org TOEFL Audio Files

Write-Host "TOEFL Audio Downloader" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host ""

# Set download directory
$audioDir = "$PSScriptRoot\..\uploads\audio"

# Create directory if it doesn't exist
if (!(Test-Path $audioDir)) {
    New-Item -ItemType Directory -Path $audioDir -Force | Out-Null
    Write-Host "Created audio directory: $audioDir" -ForegroundColor Green
}

# Download files directly
Write-Host "Downloading Archive.org TOEFL Official Sampler..." -ForegroundColor Cyan
Write-Host ""

$files = @(
    @{
        Url = "https://archive.org/download/SAMPLER_201902/SAMPLER_201902.mp3"
        Name = "SAMPLER_201902.mp3"
    },
    @{
        Url = "https://archive.org/download/SAMPLER_201902/SAMPLER_201902_64kb.mp3"
        Name = "SAMPLER_201902_64kb.mp3"
    }
)

$totalDownloaded = 0
$totalFailed = 0

foreach ($file in $files) {
    $outputPath = Join-Path $audioDir $file.Name
    
    if (Test-Path $outputPath) {
        Write-Host "  Skipping (already exists): $($file.Name)" -ForegroundColor Yellow
        continue
    }
    
    Write-Host "  Downloading: $($file.Name)..." -ForegroundColor White
    
    try {
        Invoke-WebRequest -Uri $file.Url -OutFile $outputPath -TimeoutSec 300 -ErrorAction Stop
        
        $fileSize = (Get-Item $outputPath).Length / 1MB
        Write-Host "  Downloaded: $($file.Name) ($([math]::Round($fileSize, 2)) MB)" -ForegroundColor Green
        $totalDownloaded++
    }
    catch {
        Write-Host "  Failed: $($file.Name) - $($_.Exception.Message)" -ForegroundColor Red
        $totalFailed++
        
        if (Test-Path $outputPath) {
            Remove-Item $outputPath -Force
        }
    }
}

Write-Host ""
Write-Host "======================" -ForegroundColor Cyan
Write-Host "Download Summary:" -ForegroundColor Cyan
Write-Host "  Downloaded: $totalDownloaded files" -ForegroundColor Green
Write-Host "  Failed: $totalFailed files" -ForegroundColor Red
Write-Host ""

if ($totalDownloaded -gt 0) {
    Write-Host "Next steps:" -ForegroundColor Green
    Write-Host "  1. Run: cd backend" -ForegroundColor White
    Write-Host "  2. Run: npm run ingest-audio" -ForegroundColor White
    Write-Host "  3. Run: npm run check-audio" -ForegroundColor White
    Write-Host ""
}

Write-Host "Done!" -ForegroundColor Green
