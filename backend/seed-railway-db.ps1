# Seed Railway Database Directly
# This script connects to Railway's PUBLIC database URL and runs the ingestion

Write-Host "Seeding Railway Production Database..." -ForegroundColor Green

# Railway PUBLIC Database URL (external access)
$env:DATABASE_URL = "postgresql://postgres:AcpxOTJZtgmtULfjAQEeOjATpOZpdGoI@yamanote.proxy.rlwy.net:54394/railway"

# Run ingestion script
Write-Host "Running ingestion script..." -ForegroundColor Cyan
npx tsx scripts/ingest-from-all-sources.ts

Write-Host "Done!" -ForegroundColor Green
