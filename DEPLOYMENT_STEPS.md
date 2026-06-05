# Railway Deployment - Database Setup

## ✅ Status: Backend & Frontend Deployed Successfully

- **Frontend**: https://toeflsimulator.up.railway.app/
- **Backend**: https://backend-production-0149.up.railway.app/
- **Backend Health**: https://backend-production-0149.up.railway.app/health

## Next Steps: Initialize Database

### Step 1: Run Database Schema

1. Go to Railway Dashboard → Your Project → **Postgres** service
2. Click on the **Query** tab (or **Data** tab → **Query**)
3. Copy and paste the entire contents of `backend/scripts/init-db.sql`
4. Click **Run** or **Execute**

This will create:
- `test_items` table (for test questions)
- `exam_sessions` table (for user sessions)
- `cefr_conversion` table (for score conversion)
- All indexes and triggers

### Step 2: Seed Test Data

**Option A: Via Railway Shell (Recommended)**

1. Go to Railway Dashboard → Your Project → **backend** service
2. Click on **Settings** → Scroll to **Deploy** section
3. Find **Shell** or **Run Command** button
4. Run: `npm run db:seed`

**Option B: Temporarily Add Seed to Startup (if shell not available)**

Add this to `backend/package.json` scripts:
```json
"start": "npm run db:seed && node dist/server.js"
```

Then redeploy. After seeding completes once, remove it and redeploy again.

**Option C: Connect Locally via psql**

If you have PostgreSQL installed locally:
```bash
# Get DATABASE_URL from Railway → Postgres → Variables
psql "postgresql://postgres:password@host:port/database"

# Then in psql:
\i backend/scripts/init-db.sql

# Exit psql and run seed script locally (will seed remote DB)
cd backend
npm run db:seed
```

### Step 3: Verify Data

After seeding, verify in Railway Postgres Query tab:

```sql
-- Check item counts by section
SELECT section, COUNT(*) as count 
FROM test_items 
GROUP BY section 
ORDER BY section;

-- Should show ~50-60 items per section:
-- reading: 60+
-- listening: 60
-- writing: 30+
-- speaking: 15
```

### Step 4: Test the Application

1. Visit https://toeflsimulator.up.railway.app/
2. Frontend should load without errors
3. Test creating a new session
4. Verify API communication with backend

## Environment Variables Checklist

### Backend Variables (already set via Railway references):
- ✅ `NODE_ENV=production`
- ✅ `PORT=3000`
- ✅ `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- ✅ `REDIS_URL=${{Redis.REDIS_URL}}`
- ⚠️ `GEMINI_API_KEY` - **ADD YOUR API KEY**
- ⚠️ `JWT_SECRET` - Generate: `openssl rand -base64 32`
- ✅ `FRONTEND_URL=https://toeflsimulator.up.railway.app`
- ✅ `ALLOWED_ORIGINS=https://toeflsimulator.up.railway.app`

### Frontend Variables:
- ✅ `VITE_API_URL=https://backend-production-0149.up.railway.app`

## Important Notes

1. **GEMINI_API_KEY**: The AI grading feature won't work until you add your Google Gemini API key
   - Get one at: https://makersuite.google.com/app/apikey
   - Add to Railway → backend → Variables

2. **JWT_SECRET**: Required for session security
   - Generate: `openssl rand -base64 32`
   - Add to Railway → backend → Variables

3. **Database Seeding**: Only needs to be done ONCE. The seed script checks for existing data.

4. **Railway Trial Limits**: Monitor your usage - you've used credits on multiple failed deployments

## Troubleshooting

### "Cannot connect to database"
- Check that Postgres service is running in Railway
- Verify DATABASE_URL is correctly set as `${{Postgres.DATABASE_URL}}`

### "No test items found"
- Database schema initialized but not seeded
- Run Step 2 (Seed Test Data)

### "CORS error"
- Check ALLOWED_ORIGINS matches your frontend domain
- Verify VITE_API_URL in frontend points to correct backend URL

### Frontend shows "Blocked request"
- Already fixed in latest deployment
- Clear browser cache if you see this error
