# TOEFL Simulator - Database Check and Seed Script
# Run this in PowerShell after backend is deployed

$BackendURL = "https://backend-production-0149.up.railway.app"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " TOEFL Simulator - Database Setup" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check database status
Write-Host "Step 1: Checking database status..." -ForegroundColor Yellow
try {
    $statusResponse = Invoke-RestMethod -Uri "$BackendURL/db-status" -Method GET
    Write-Host "✓ Backend is online!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Database Status:" -ForegroundColor Cyan
    Write-Host "  - Initialized: $($statusResponse.initialized)" -ForegroundColor $(if ($statusResponse.initialized) { "Green" } else { "Red" })
    Write-Host "  - Seeded: $($statusResponse.seeded)" -ForegroundColor $(if ($statusResponse.seeded) { "Green" } else { "Red" })
    Write-Host "  - Test Items: $($statusResponse.tables.test_items)" -ForegroundColor White
    Write-Host "  - Sessions: $($statusResponse.tables.exam_sessions)" -ForegroundColor White
    Write-Host "  - CEFR Data: $($statusResponse.tables.cefr_conversion)" -ForegroundColor White
    Write-Host ""
    
    if ($statusResponse.items_by_section) {
        Write-Host "Items by Section:" -ForegroundColor Cyan
        foreach ($item in $statusResponse.items_by_section) {
            Write-Host "  - $($item.section): $($item.count)" -ForegroundColor White
        }
        Write-Host ""
    }
    
    # Step 2: Seed if needed
    if (-not $statusResponse.seeded) {
        Write-Host "Step 2: Database not seeded. Seeding now..." -ForegroundColor Yellow
        $seedResponse = Invoke-RestMethod -Uri "$BackendURL/seed-database" -Method POST
        Write-Host "✓ Seeding completed!" -ForegroundColor Green
        Write-Host "  - Items inserted: $($seedResponse.items_inserted)" -ForegroundColor White
        Write-Host ""
        Write-Host "Breakdown:" -ForegroundColor Cyan
        Write-Host "  - Reading: $($seedResponse.breakdown.reading)" -ForegroundColor White
        Write-Host "  - Listening: $($seedResponse.breakdown.listening)" -ForegroundColor White
        Write-Host "  - Writing: $($seedResponse.breakdown.writing)" -ForegroundColor White
        Write-Host "  - Speaking: $($seedResponse.breakdown.speaking)" -ForegroundColor White
    } else {
        Write-Host "✓ Database already seeded!" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host " Setup Complete!" -ForegroundColor Green
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Visit: https://toeflsimulator.up.railway.app/" -ForegroundColor White
    Write-Host "  2. Test the application" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host "✗ Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible issues:" -ForegroundColor Yellow
    Write-Host "  - Backend is still deploying (wait 1-2 minutes)" -ForegroundColor White
    Write-Host "  - Database not initialized (run init-db.sql in Railway Postgres Query tab)" -ForegroundColor White
    Write-Host ""
}
