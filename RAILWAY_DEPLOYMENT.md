# Railway All-in-One Deployment Guide

Deploy the entire TOEFL Simulator (frontend, backend, database, Redis) to Railway in one go.

## Prerequisites

- GitHub account with `toeflsimulator` repository
- Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

## Step-by-Step Deployment

### 1. Sign Up for Railway

1. Go to [Railway.app](https://railway.app)
2. Click "Login" and use GitHub to sign in
3. You'll get **$5 in free credits** (500 hours)

### 2. Create New Project from GitHub

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Choose `abeachmad/toeflsimulator` repository
4. Railway will detect your project structure

### 3. Add Database Services

Railway will scan your docker-compose.yml and offer to add services automatically.

**Option A: Automatic (Recommended)**
- Railway will see your docker-compose.yml
- Click **"Add PostgreSQL"** when prompted
- Click **"Add Redis"** when prompted

**Option B: Manual**
1. Click **"+ New"** in your project
2. Select **"Database"** → **"PostgreSQL"**
3. Click **"+ New"** again
4. Select **"Database"** → **"Redis"**

### 4. Configure Backend Service

1. Click on the **backend** service in your Railway dashboard
2. Go to **"Settings"** tab
3. Set **Root Directory**: `backend`
4. Go to **"Variables"** tab and add:

```bash
# Node Environment
NODE_ENV=production
PORT=3000

# Database (Railway auto-provides these)
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# API Keys
GEMINI_API_KEY=your-gemini-api-key-here

# Security
JWT_SECRET=generate-with-node-crypto
ALLOWED_ORIGINS=${{RAILWAY_PUBLIC_DOMAIN}},${{frontend.RAILWAY_PUBLIC_DOMAIN}}
```

**To generate JWT_SECRET**, run this locally:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

5. Go to **"Settings"** → **"Networking"**
6. Click **"Generate Domain"** to get a public URL

### 5. Configure Frontend Service

1. Click on the **frontend** service
2. Go to **"Settings"** tab
3. Set **Root Directory**: `frontend`
4. Go to **"Variables"** tab and add:

```bash
# Backend API URL (use the backend's Railway domain)
VITE_API_URL=${{backend.RAILWAY_PUBLIC_DOMAIN}}
```

5. Go to **"Settings"** → **"Networking"**
6. Click **"Generate Domain"** to get your frontend URL

### 6. Update ALLOWED_ORIGINS in Backend

1. Go back to backend service
2. Update `ALLOWED_ORIGINS` variable with your frontend domain:
```bash
ALLOWED_ORIGINS=https://your-frontend.up.railway.app
```
3. Backend will auto-redeploy

### 7. Initialize Database

**Option A: Using Railway Dashboard**
1. Click on **PostgreSQL** service
2. Go to **"Query"** tab
3. Copy the entire contents of `backend/scripts/init-db.sql`
4. Paste and execute

**Option B: Using CLI**
1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Link project: `railway link`
4. Run: `railway run --service postgres psql < backend/scripts/init-db.sql`

### 8. Seed Database

1. Go to **backend** service in Railway
2. Click **"Deployments"** tab
3. Click on the latest deployment
4. Open **"View Logs"**
5. In the Railway CLI or dashboard terminal, run:
```bash
npm run seed
```

**Or manually**:
1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Link to your project: `railway link`
4. Run seed: `railway run --service backend npm run seed`

### 9. Test Your Deployment

1. Visit your frontend URL (e.g., `https://toeflsimulator.up.railway.app`)
2. Click "Start Practice Test"
3. Test all four sections
4. Verify scoring works

## Environment Variables Reference

### Backend Required Variables

```bash
# Required
NODE_ENV=production
PORT=3000
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
GEMINI_API_KEY=your-key-from-google-ai-studio

# Generate this with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-random-32-char-string

# Use Railway's public domain
ALLOWED_ORIGINS=${{frontend.RAILWAY_PUBLIC_DOMAIN}}
```

### Frontend Required Variables

```bash
# Backend URL (Railway auto-generates this)
VITE_API_URL=${{backend.RAILWAY_PUBLIC_DOMAIN}}
```

## Deployment Architecture

```
┌─────────────────────────────────────┐
│         Railway Project             │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────┐    ┌──────────┐     │
│  │ Frontend │◄───│  Backend │     │
│  │  React   │    │  Express │     │
│  │  (Vite)  │    │   API    │     │
│  └──────────┘    └─────┬────┘     │
│                        │            │
│                   ┌────▼─────┐     │
│                   │PostgreSQL│     │
│                   └──────────┘     │
│                                     │
│                   ┌──────────┐     │
│                   │  Redis   │     │
│                   └──────────┘     │
│                                     │
└─────────────────────────────────────┘
```

## Cost Breakdown

### Free Trial (First Month)
- $5 in credits (500 execution hours)
- All services included
- **Cost: $0**

### After Free Trial
- Backend: ~$3-5/month
- Frontend: ~$2-3/month
- PostgreSQL: Included
- Redis: Included
- **Total: ~$5-8/month**

## Custom Domain (Optional)

### Add Your Own Domain

1. Go to your **frontend** service
2. Go to **"Settings"** → **"Networking"**
3. Click **"Custom Domain"**
4. Enter your domain (e.g., `toeflsimulator.com`)
5. Add the CNAME record to your DNS provider:
   ```
   CNAME @ your-app.up.railway.app
   ```
6. Railway will auto-configure SSL/TLS

### Update ALLOWED_ORIGINS

After adding custom domain, update backend:
```bash
ALLOWED_ORIGINS=https://toeflsimulator.com,https://www.toeflsimulator.com
```

## Monitoring and Logs

### View Logs
1. Click on any service
2. Go to **"Deployments"** tab
3. Click on a deployment
4. View logs in real-time

### Metrics
1. Click on any service
2. Go to **"Metrics"** tab
3. View CPU, Memory, Network usage

### Error Tracking
- Frontend errors are sent to `POST /api/logs`
- View in backend logs
- Or integrate Sentry (optional)

## Troubleshooting

### Backend won't start
- Check `DATABASE_URL` and `REDIS_URL` are set
- Verify `GEMINI_API_KEY` is correct
- Check logs for errors

### Frontend shows "API Error"
- Verify `VITE_API_URL` points to backend domain
- Check `ALLOWED_ORIGINS` in backend includes frontend domain
- Test backend health: `https://backend-url.up.railway.app/health`

### Database connection fails
- Ensure PostgreSQL service is running (green dot)
- Verify `DATABASE_URL` format is correct
- Check Railway service logs

### CORS errors
- Update `ALLOWED_ORIGINS` in backend
- Must include frontend domain without trailing slash
- Format: `https://domain.com`

## Updating Your App

### Auto-Deploy from GitHub

1. Push changes to GitHub `main` branch
2. Railway auto-detects and deploys
3. Monitor deployment in Railway dashboard

### Manual Deploy

1. Go to service in Railway
2. Click **"Deployments"** tab
3. Click **"Redeploy"** on any previous deployment

## Scaling (When Needed)

Railway automatically scales based on usage:
- CPU: Auto-scales to handle load
- Memory: Allocated per service
- Bandwidth: Unlimited

To increase resources:
1. Go to service **"Settings"**
2. Adjust resource limits
3. Save (billing adjusts automatically)

## Backup and Recovery

### Database Backups
- Railway automatically backs up PostgreSQL daily
- Restore from **"Backups"** tab in PostgreSQL service

### Manual Backup
```bash
# Install Railway CLI
railway login
railway link

# Backup database
railway run --service postgres pg_dump > backup.sql

# Restore
railway run --service postgres psql < backup.sql
```

## Security Checklist

- [x] Strong `JWT_SECRET` (32+ random characters)
- [x] `ALLOWED_ORIGINS` configured correctly
- [x] HTTPS enabled (automatic on Railway)
- [x] `NODE_ENV=production`
- [x] Database not publicly accessible (Railway internal network)
- [x] Gemini API key in environment variables (not in code)
- [x] Rate limiting enabled (already in code)

## Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Project Issues: https://github.com/abeachmad/toeflsimulator/issues

## Next Steps

1. ✅ Deploy to Railway (follow steps above)
2. ✅ Initialize and seed database
3. ✅ Test all features
4. ✅ (Optional) Add custom domain
5. ✅ (Optional) Set up monitoring/alerting
6. 🎉 Share your TOEFL simulator with the world!

---

**Pro Tip**: Railway's free tier is generous enough for development and low-traffic production use. Upgrade only when you need more resources or have significant traffic.
