# Deployment Guide - TOEFL Simulator

## Overview

This guide covers deploying the TOEFL iBT 2026 Test Simulator to production. The application consists of:
- **Frontend**: React 18 + Vite
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL 16+
- **Cache**: Redis 7+

## Deployment Options

### Option 1: Vercel (Frontend) + Railway (Backend) ⭐ Recommended

This approach uses Vercel's excellent frontend hosting and Railway's full-stack platform for the backend.

#### Step 1: Deploy Backend to Railway

1. **Sign up at [Railway.app](https://railway.app)**

2. **Create a new project**
   - Click "New Project"
   - Choose "Deploy from GitHub repo"
   - Connect your GitHub account and select `toeflsimulator` repository

3. **Add PostgreSQL database**
   - In your Railway project dashboard, click "+ New"
   - Select "Database" → "PostgreSQL"
   - Railway will automatically provision a Postgres instance
   - Copy the `DATABASE_URL` from the PostgreSQL service variables

4. **Add Redis cache**
   - Click "+ New" again
   - Select "Database" → "Redis"
   - Copy the `REDIS_URL` from the Redis service variables

5. **Configure Backend Service**
   - Click on your backend service
   - Go to "Settings" → "Root Directory"
   - Set to: `backend`
   - Go to "Variables" tab and add:
     ```bash
     NODE_ENV=production
     PORT=3000
     DATABASE_URL=${{Postgres.DATABASE_URL}}
     REDIS_URL=${{Redis.REDIS_URL}}
     GEMINI_API_KEY=your-gemini-api-key-here
     JWT_SECRET=your-generated-secret-here
     ALLOWED_ORIGINS=https://your-app.vercel.app
     ```

6. **Set Build & Start Commands**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

7. **Deploy**
   - Railway will automatically deploy
   - Copy your backend URL (e.g., `https://your-app.up.railway.app`)

8. **Initialize Database**
   - In Railway dashboard, click on PostgreSQL service
   - Go to "Query" tab
   - Run the SQL from `backend/scripts/init-db.sql`

9. **Seed Database**
   - In Railway, go to your backend service
   - Open terminal and run: `npm run seed`

#### Step 2: Deploy Frontend to Vercel

1. **Sign up at [Vercel.com](https://vercel.com)**

2. **Import your repository**
   - Click "New Project"
   - Import from GitHub: `toeflsimulator`

3. **Configure Build Settings**
   - Framework Preset: `Vite`
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **Add Environment Variables**
   - Go to Settings → Environment Variables
   - Add:
     ```bash
     VITE_API_URL=https://your-backend.up.railway.app
     ```

5. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy your frontend
   - Your app will be live at `https://your-app.vercel.app`

6. **Update Backend ALLOWED_ORIGINS**
   - Go back to Railway
   - Update `ALLOWED_ORIGINS` to include your Vercel URL:
     ```bash
     ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com
     ```
   - Redeploy backend

---

### Option 2: All-in-One on Railway

Deploy both frontend and backend to Railway.

1. **Create Railway Project** (same as above)

2. **Add Services**
   - Backend service (from `backend/` directory)
   - PostgreSQL
   - Redis

3. **Deploy Frontend as Static Site**
   - Click "+ New" → "Empty Service"
   - Set Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npx serve -s dist -l 3000`

4. **Set Environment Variables**

   **Backend**:
   ```bash
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   REDIS_URL=${{Redis.REDIS_URL}}
   GEMINI_API_KEY=your-key
   JWT_SECRET=your-secret
   ALLOWED_ORIGINS=${{Frontend.RAILWAY_STATIC_URL}}
   ```

   **Frontend**:
   ```bash
   VITE_API_URL=${{Backend.RAILWAY_STATIC_URL}}
   ```

---

### Option 3: Docker Compose on VPS

For self-hosting on a VPS (DigitalOcean, AWS EC2, etc.)

1. **Set up your VPS**
   - Ubuntu 22.04+ recommended
   - At least 2GB RAM, 2 vCPUs

2. **Install Docker and Docker Compose**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo apt install docker-compose
   ```

3. **Clone repository**
   ```bash
   git clone https://github.com/abeachmad/toeflsimulator.git
   cd toeflsimulator
   ```

4. **Configure environment**
   ```bash
   cp backend/.env.example backend/.env
   nano backend/.env
   ```
   
   Update values:
   ```bash
   DATABASE_URL=postgresql://postgres:password@postgres:5432/toefl_simulator
   REDIS_URL=redis://redis:6379
   GEMINI_API_KEY=your-key
   JWT_SECRET=your-secret
   ALLOWED_ORIGINS=https://yourdomain.com
   ```

5. **Build and start services**
   ```bash
   docker-compose up -d
   ```

6. **Initialize database**
   ```bash
   docker exec toefl-postgres psql -U postgres -d toefl_simulator -f /init.sql
   ```

7. **Seed database**
   ```bash
   docker exec toefl-backend npm run seed
   ```

8. **Set up reverse proxy (Nginx/Caddy)**
   
   Install Caddy for automatic HTTPS:
   ```bash
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update
   sudo apt install caddy
   ```

   Create Caddyfile:
   ```bash
   sudo nano /etc/caddy/Caddyfile
   ```

   Add:
   ```
   yourdomain.com {
       reverse_proxy localhost:5173
       
       handle /api/* {
           reverse_proxy localhost:3000
       }
   }
   ```

   Reload Caddy:
   ```bash
   sudo systemctl reload caddy
   ```

---

## Environment Variables Reference

### Required Variables

#### Backend (`backend/.env`):

```bash
# Server
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Redis
REDIS_URL=redis://host:6379

# AI Integration
GEMINI_API_KEY=your-gemini-api-key-from-google-ai-studio

# Security
JWT_SECRET=generate-with-crypto-randomBytes-32-hex
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

#### Frontend (Vercel/Build-time):

```bash
# API URL (backend endpoint)
VITE_API_URL=https://your-backend-url.com
```

### Generating Secure Secrets

**JWT_SECRET**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Output example: `a7f3d9e8b2c4f1a6e5d8c7b9a2f4e6d8c1b3a5f7e9d2c4b6a8f1e3d5c7b9a2f4`

---

## Database Setup

### 1. Initialize Schema

Run the SQL from `backend/scripts/init-db.sql`:

**Railway/Managed DB**:
- Use the database query editor in the dashboard
- Copy and paste the entire `init-db.sql` file
- Execute

**Docker**:
```bash
docker exec toefl-postgres psql -U postgres -d toefl_simulator -f /init.sql
```

**Local psql**:
```bash
psql -U postgres -d toefl_simulator -f backend/scripts/init-db.sql
```

### 2. Seed Data

```bash
# Railway/Remote
npm run seed --workspace=backend

# Docker
docker exec toefl-backend npm run seed

# Local
cd backend && npm run seed
```

---

## SSL/TLS Configuration

### Vercel (Frontend)
- Automatic HTTPS ✅
- No configuration needed

### Railway (Backend)
- Automatic HTTPS ✅
- Railway provides SSL certificates

### Self-hosted (VPS)
- Use Caddy (automatic HTTPS with Let's Encrypt)
- Or use Nginx with Certbot:
  ```bash
  sudo apt install certbot python3-certbot-nginx
  sudo certbot --nginx -d yourdomain.com
  ```

---

## Performance Optimization

### 1. Enable Redis Caching

Ensure Redis is connected and `REDIS_URL` is set correctly.

### 2. Set Up CDN (Optional)

For Vercel deployments, static assets are automatically served via CDN.

For self-hosted, use Cloudflare:
1. Sign up at [Cloudflare.com](https://cloudflare.com)
2. Add your domain
3. Update nameservers
4. Enable "Proxy" (orange cloud) for your domain

### 3. Database Connection Pooling

Already configured in `backend/src/config/database.ts`:
- Max 20 connections
- Idle timeout: 30s

---

## Monitoring and Logging

### Log Aggregation

**Option 1: Use built-in logging endpoint**
- Frontend sends errors to `POST /api/logs`
- Backend stores in PostgreSQL `error_logs` table

**Option 2: External services**
- **Sentry**: Add `@sentry/node` and `@sentry/react`
- **LogRocket**: Session replay and error tracking
- **Datadog**: Full observability platform

### Health Checks

- **Backend**: `GET /health` returns server status
- **Frontend**: Vercel provides built-in health monitoring

---

## Troubleshooting

### Issue: "Failed to connect to database"
- Verify `DATABASE_URL` format: `postgresql://user:pass@host:5432/dbname`
- Check firewall rules allow connections
- Ensure database service is running

### Issue: "CORS error"
- Add your frontend URL to `ALLOWED_ORIGINS`
- Format: `https://domain.com` (no trailing slash)
- Multiple origins: comma-separated

### Issue: "JWT authentication failed"
- Verify `JWT_SECRET` is set and matches across restarts
- Check token expiration (default: 24h)

### Issue: "Gemini API rate limit"
- Free tier: 15 requests/minute
- Implement exponential backoff (already built-in)
- Consider upgrading to paid tier

### Issue: "Audio upload fails"
- Check file size limit (10MB default)
- Verify multer middleware is configured
- For Vercel: Need external storage (AWS S3, Cloudinary)

---

## Security Checklist

- [ ] Set strong `JWT_SECRET` (32+ random characters)
- [ ] Configure `ALLOWED_ORIGINS` with your actual domains
- [ ] Enable HTTPS/TLS (automatic on Vercel/Railway)
- [ ] Set `NODE_ENV=production`
- [ ] Disable database public access (use internal network)
- [ ] Enable rate limiting (already configured: 100 req/min)
- [ ] Keep Gemini API key secure (use environment variables only)
- [ ] Set up monitoring alerts
- [ ] Regular database backups (Railway/managed DB handles this)

---

## Cost Estimates

### Free Tier Setup:
- **Frontend (Vercel)**: Free (100GB bandwidth/month)
- **Backend (Railway)**: $5/month (500 hours free trial)
- **Database (Railway)**: Included
- **Redis (Railway)**: Included
- **Gemini API**: Free tier (15 req/min)

**Total**: ~$5/month after trial

### Production Setup:
- **Vercel Pro**: $20/month (1TB bandwidth)
- **Railway**: $20-40/month (depending on usage)
- **Neon DB**: $19/month (managed Postgres)
- **Upstash Redis**: $10/month
- **Gemini API**: $0.10 per 1K requests

**Total**: ~$70-90/month

---

## Next Steps After Deployment

1. **Test All Features**:
   - Create exam session
   - Complete all 4 sections
   - Verify scoring
   - Test timer functionality
   - Check error handling

2. **Load Testing**:
   ```bash
   k6 run load-tests/exam-sessions.k6.js
   ```

3. **Monitor Performance**:
   - Check response times (target: <500ms p95)
   - Monitor database query performance
   - Track Gemini API usage

4. **Set Up Backups**:
   - Railway: Automatic daily backups
   - Self-hosted: Use pg_dump cron job

5. **Custom Domain** (Optional):
   - Vercel: Settings → Domains → Add domain
   - Railway: Settings → Domains → Add custom domain

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/abeachmad/toeflsimulator/issues
- Documentation: See README.md and PRODUCTION_READINESS.md

