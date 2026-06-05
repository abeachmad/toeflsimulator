# Railway Deployment Guide - TOEFL Simulator

## Root Cause of Previous Issues

The Railway dashboard was showing locked settings because:
1. Railway auto-detected workspace configuration from old package.json
2. Auto-generated railway.toml settings with `--workspace=` flags
3. Dashboard settings were locked and showed "The value is set in/railway.toml"
4. Frontend couldn't be reached (502) because Vite wasn't exposing port with `--host 0.0.0.0`
5. Backend crashed because it was looking for `DB_PASSWORD` instead of using `DATABASE_URL`

## Solution: Config-as-Code with railway.toml

We've created `railway.toml` files in both `/backend` and `/frontend` directories to control the deployment configuration.

## Current Railway Project Structure

- **Frontend Service**: `frontend-production`
  - Root Directory: `/frontend`
  - Domain: `toeflsimulator.up.railway.app`
  
- **Backend Service**: `backend-production`
  - Root Directory: `/backend`
  - Domain: `backend-production-0149.up.railway.app`
  
- **PostgreSQL Service**: `Postgres`
  - Connection available via `${{Postgres.DATABASE_URL}}`
  
- **Redis Service**: `Redis`
  - Connection available via `${{Redis.REDIS_URL}}`

## Environment Variables Configuration

### Backend Service Variables

Go to Backend Service → Variables tab and add/verify these:

```bash
# Database (Railway Reference)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis (Railway Reference)
REDIS_URL=${{Redis.REDIS_URL}}

# JWT Secret (Manual - Generate a strong random string)
JWT_SECRET=your-super-secret-jwt-key-here-change-this

# Gemini AI (Manual - Your API key)
GEMINI_API_KEY=your-gemini-api-key-here

# Environment
NODE_ENV=production

# Port (Railway auto-provides this)
PORT=${{PORT}}
```

### Frontend Service Variables

Go to Frontend Service → Variables tab and add:

```bash
# Backend API URL (Railway Reference)
VITE_API_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}

# Environment
NODE_ENV=production
```

## Deployment Steps

### 1. Push railway.toml Files to GitHub

```bash
git add backend/railway.toml frontend/railway.toml RAILWAY_DEPLOYMENT_GUIDE.md
git commit -m "Add railway.toml config files for proper deployment"
git push origin main
```

### 2. Railway Will Auto-Deploy

After pushing, Railway will:
- Detect the new `railway.toml` files
- Use nixpacks builder (specified in railway.toml)
- Run the correct start commands
- Backend: `npm run dev`
- Frontend: `npm run dev -- --host 0.0.0.0`

### 3. Initialize Database (One-Time Setup)

Once backend deploys successfully:

1. Go to Railway Dashboard → Postgres service
2. Click on **"Data"** or **"Query"** tab
3. Or connect via psql:
   ```bash
   psql ${{Postgres.DATABASE_URL}}
   ```
4. Copy and paste the entire contents of `backend/scripts/init-db.sql`
5. Execute the SQL

This will:
- Create tables: `test_items`, `exam_sessions`, `cefr_conversion`
- Add indexes for performance
- Insert CEFR conversion data

### 4. Seed Database with Test Data (Optional)

If you want sample test items:

```bash
# From your local machine
cd backend
npm run seed
```

Or manually insert test data through Railway's Postgres interface.

### 5. Verify Deployment

**Backend Health Check:**
```bash
curl https://backend-production-0149.up.railway.app/health
```

Expected response:
```json
{"status":"ok","timestamp":"2026-06-05T...","environment":"production"}
```

**Frontend:**
Visit: `https://toeflsimulator.up.railway.app/`

Should show the TOEFL Simulator UI.

## Troubleshooting

### Backend Still Shows DB_PASSWORD Error

If you see: `[FATAL] DATABASE_URL or DB_PASSWORD must be set in production`

**Fix**: Verify the `DATABASE_URL` variable is set in Railway:
1. Go to Backend Service → Variables
2. Check that `DATABASE_URL=${{Postgres.DATABASE_URL}}`
3. Redeploy if needed

### Frontend Shows 502 Bad Gateway

**Causes:**
1. Vite not binding to 0.0.0.0 (should be fixed by railway.toml)
2. Check Railway logs for port binding message

**Fix**: Verify `railway.toml` in frontend has:
```toml
[deploy]
startCommand = "npm run dev -- --host 0.0.0.0"
```

### Build Fails with "command not found"

**Cause**: nixpacks.toml and railway.toml conflict

**Fix**: railway.toml takes precedence. Ensure railway.toml has `builder = "nixpacks"`

### Max Retries Exceeded

Railway trial accounts limit retries to 10 per service. To reset:
1. Delete the service
2. Create a new service with the same configuration
3. Or upgrade to a paid plan

## File Structure Reference

```
toeflsimulator/
├── backend/
│   ├── railway.toml          # Backend Railway config
│   ├── nixpacks.toml         # Nixpacks build config
│   ├── package.json
│   └── scripts/
│       └── init-db.sql       # Database schema
├── frontend/
│   ├── railway.toml          # Frontend Railway config
│   ├── nixpacks.toml         # Nixpacks build config
│   └── package.json
└── package.json              # Root (no workspaces)
```

## Why This Setup Works

1. **Monorepo with separate services**: Best practice for full-stack apps
2. **Config-as-code**: railway.toml gives you full control over deployment
3. **Nixpacks**: Automatic dependency detection and building
4. **Railway References**: `${{Postgres.DATABASE_URL}}` creates automatic connections
5. **Proper port binding**: `--host 0.0.0.0` makes Vite accessible externally

## Important Notes

- Railway services deploy independently
- Each service has its own Root Directory setting (`/backend` or `/frontend`)
- Environment variables can reference other services using `${{ServiceName.VARIABLE}}`
- Railway auto-assigns PORT variable - don't hardcode ports
- Database initialization is manual (one-time setup)

## Next Steps After Successful Deployment

1. Test all features through the live URL
2. Monitor Railway logs for any errors
3. Set up custom domain (optional)
4. Configure CI/CD for automated testing before deployment
5. Set up monitoring and error tracking (Sentry, LogRocket, etc.)

---

**Current Status**: Configuration files created. Ready to push and deploy.
