# Railway Setup Checklist - One-Time Configuration

## What Railway Auto-Detects ✅

When you connect your GitHub repo, Railway automatically:
- ✅ Detects it's a Node.js project
- ✅ Finds `package.json` files
- ✅ Offers to create PostgreSQL and Redis services
- ✅ Builds and deploys your code

## What You MUST Set Manually ⚠️

Railway **cannot** auto-fill these for security reasons (they contain sensitive data):

### 1. GEMINI_API_KEY
- Get from: https://makersuite.google.com/app/apikey
- Free tier: 15 requests/minute
- Copy the key starting with `AIzaSy...`

### 2. JWT_SECRET
- Generate locally:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- Copy the output (32+ random characters)

## Step-by-Step Setup (5 Minutes)

### Step 1: Create Railway Project
1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose `abeachmad/toeflsimulator`

### Step 2: Railway Will Ask About Services
- Click "Add PostgreSQL" → ✅ Yes
- Click "Add Redis" → ✅ Yes
- Railway creates these automatically

### Step 3: Configure Backend Service

1. Click on **backend** service
2. Go to **"Variables"** tab
3. Click **"RAW Editor"** button
4. **Copy-paste this** (then edit the 2 values):

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
GEMINI_API_KEY=PASTE_YOUR_KEY_HERE
JWT_SECRET=PASTE_YOUR_SECRET_HERE
FRONTEND_URL=${{frontend.RAILWAY_PUBLIC_DOMAIN}}
ALLOWED_ORIGINS=${{frontend.RAILWAY_PUBLIC_DOMAIN}}
```

5. **Replace**:
   - `PASTE_YOUR_KEY_HERE` → Your Gemini API key
   - `PASTE_YOUR_SECRET_HERE` → Your generated JWT secret

6. Click **"Save"**

### Step 4: Configure Frontend Service

1. Click on **frontend** service
2. Go to **"Variables"** tab
3. Click **"RAW Editor"** button
4. **Copy-paste this**:

```bash
VITE_API_URL=${{backend.RAILWAY_PUBLIC_DOMAIN}}
```

5. Click **"Save"**

### Step 5: Generate Public Domains

1. Click **backend** service → Settings → **"Generate Domain"**
2. Click **frontend** service → Settings → **"Generate Domain"**
3. Railway creates public URLs like:
   - Frontend: `https://toeflsimulator.up.railway.app`
   - Backend: `https://toeflsimulator-backend.up.railway.app`

### Step 6: Wait for Deployment (2-3 minutes)
- Railway automatically builds and deploys
- Watch the logs in "Deployments" tab
- Wait for green checkmark ✅

### Step 7: Initialize Database

**Option A: Using Railway Dashboard**
1. Click **PostgreSQL** service
2. Go to **"Query"** tab
3. Open `backend/scripts/init-db.sql` in your local editor
4. Copy ALL the SQL
5. Paste into Railway query editor
6. Click "Run"

**Option B: Using Railway CLI** (if you prefer)
```bash
npm install -g @railway/cli
railway login
railway link
railway run --service postgres psql < backend/scripts/init-db.sql
```

### Step 8: Seed Database

**Option A: Using Railway CLI**
```bash
railway link
railway run --service backend npm run seed
```

**Option B: Manual trigger**
1. Railway backend logs → Look for seed command
2. Trigger manually via Railway console

### Step 9: Test Your App! 🎉

1. Click frontend service → **"View Deployment"**
2. Your TOEFL simulator opens
3. Test all features

---

## Quick Reference: What Each Variable Does

| Variable | What It Is | Who Fills It |
|----------|------------|--------------|
| `DATABASE_URL` | PostgreSQL connection string | Railway auto-fills |
| `REDIS_URL` | Redis connection string | Railway auto-fills |
| `GEMINI_API_KEY` | Google AI API key | You must paste |
| `JWT_SECRET` | Auth token secret | You must paste |
| `FRONTEND_URL` | Where your frontend is hosted | Railway auto-fills |
| `ALLOWED_ORIGINS` | CORS security (which domains can access API) | Railway auto-fills |
| `VITE_API_URL` | Backend API endpoint for frontend | Railway auto-fills |

---

## After Setup - URLs You'll Have

- **Frontend**: `https://your-app-name.up.railway.app`
- **Backend API**: `https://your-app-name-backend.up.railway.app`
- **Health Check**: `https://your-app-name-backend.up.railway.app/health`

---

## Troubleshooting

### "Service won't start"
- Check logs in Railway dashboard
- Verify `GEMINI_API_KEY` and `JWT_SECRET` are set
- Ensure PostgreSQL and Redis services are running (green indicator)

### "Can't connect to database"
- Verify PostgreSQL service is running
- Check that `DATABASE_URL` shows the reference: `${{Postgres.DATABASE_URL}}`
- If it's still `${{...}}`, Railway is resolving it - wait 30 seconds

### "CORS errors"
- Verify `ALLOWED_ORIGINS` in backend = your frontend domain
- Must use `https://` (not `http://`)
- No trailing slash

### "Frontend can't reach backend"
- Verify `VITE_API_URL` in frontend = your backend domain
- Check backend service has a public domain generated

---

## Cost

- **Free Trial**: $5 credit (500 execution hours)
- **After Trial**: ~$5-10/month for all services
- Includes: Frontend + Backend + PostgreSQL + Redis + HTTPS

---

## Summary

**Railway Auto-Handles**: PostgreSQL, Redis, connection strings, HTTPS, deployments

**You Must Provide**: Gemini API key (2 minutes to get), JWT secret (1 command to generate)

**Total Setup Time**: ~5-10 minutes

**Result**: Fully deployed TOEFL simulator with database, caching, and AI grading! 🚀
