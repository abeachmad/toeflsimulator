# Railway Quick Start - Environment Variables

## 🚀 Copy-Paste Ready Configuration

### Step 1: Generate JWT Secret First

Run this command locally:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output (looks like: `a7f3d9e8b2c4f1a6e5d8c7b9a2f4e6d8...`)

---

### Step 2: Backend Variables (Railway Dashboard)

Go to: **Railway Dashboard → Backend Service → Variables Tab**

Click **"Raw Editor"** and paste:

```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
GEMINI_API_KEY=YOUR_GEMINI_KEY_HERE
JWT_SECRET=YOUR_GENERATED_JWT_SECRET_HERE
FRONTEND_URL=${{frontend.RAILWAY_PUBLIC_DOMAIN}}
ALLOWED_ORIGINS=${{frontend.RAILWAY_PUBLIC_DOMAIN}}
```

**Replace**:
- `YOUR_GEMINI_KEY_HERE` → Your actual Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- `YOUR_GENERATED_JWT_SECRET_HERE` → The secret you generated in Step 1

**Keep as-is** (Railway auto-fills these):
- `${{Postgres.DATABASE_URL}}`
- `${{Redis.REDIS_URL}}`
- `${{frontend.RAILWAY_PUBLIC_DOMAIN}}`

---

### Step 3: Frontend Variables (Railway Dashboard)

Go to: **Railway Dashboard → Frontend Service → Variables Tab**

Click **"Raw Editor"** and paste:

```bash
VITE_API_URL=${{backend.RAILWAY_PUBLIC_DOMAIN}}
```

**Keep as-is** (Railway auto-fills):
- `${{backend.RAILWAY_PUBLIC_DOMAIN}}`

---

## 🎯 What You DON'T Need to Set

❌ **POSTGRES_PASSWORD** - Railway generates this automatically in DATABASE_URL  
❌ **DB_HOST, DB_PORT, DB_NAME, DB_USER** - All included in DATABASE_URL  
❌ **REDIS_HOST, REDIS_PORT** - All included in REDIS_URL  

---

## ✅ What the Values Look Like After Deployment

After Railway deploys your services, the references resolve to actual values:

```bash
# Backend Variables (what you see in Railway)
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://postgres:randompassword123@postgres.railway.internal:5432/railway
REDIS_URL=redis://default:randomkey456@redis.railway.internal:6379
GEMINI_API_KEY=AIzaSyAbc123... (your actual key)
JWT_SECRET=a7f3d9e8b2c4f1a6... (your generated secret)
FRONTEND_URL=https://toeflsimulator.up.railway.app
ALLOWED_ORIGINS=https://toeflsimulator.up.railway.app

# Frontend Variables (what you see in Railway)
VITE_API_URL=https://toeflsimulator-backend.up.railway.app
```

---

## 🔧 Troubleshooting

### "Backend can't connect to database"
**Check**: Is `DATABASE_URL` showing as `${{Postgres.DATABASE_URL}}`?  
**Fix**: Make sure PostgreSQL service is running (green indicator in Railway dashboard)

### "CORS errors in browser console"
**Check**: Is `ALLOWED_ORIGINS` pointing to your frontend URL?  
**Fix**: Update to `${{frontend.RAILWAY_PUBLIC_DOMAIN}}` or your actual frontend URL with `https://`

### "Frontend can't reach backend API"
**Check**: Is `VITE_API_URL` correct?  
**Fix**: Update to `${{backend.RAILWAY_PUBLIC_DOMAIN}}` or your actual backend URL

### "Authentication errors"
**Check**: Is `JWT_SECRET` a long random string (32+ characters)?  
**Fix**: Generate new one with the node command above

---

## 📝 Quick Checklist

Before deploying, verify:

- [ ] Generated JWT_SECRET (32+ random characters)
- [ ] Got Gemini API key from Google AI Studio
- [ ] Added PostgreSQL service in Railway
- [ ] Added Redis service in Railway
- [ ] Set all backend variables (6 required)
- [ ] Set frontend variable (1 required)
- [ ] Both services have public domains generated
- [ ] Checked that variables use `https://` (not `http://`)

---

## 🎉 After Setting Variables

1. Railway will **automatically redeploy** both services
2. Wait 2-3 minutes for deployment to complete
3. Click on frontend service → **"View Deployment"**
4. Your TOEFL simulator is live!

---

## 🔗 Get Your API Keys

- **Gemini API Key**: https://makersuite.google.com/app/apikey (Free tier: 15 requests/minute)
- **JWT Secret**: Generate locally with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## 💰 Cost After Free Trial

- First month: **$5 free credits** (500 execution hours)
- After trial: **~$5-10/month** for all services
- Includes: Frontend + Backend + PostgreSQL + Redis + HTTPS

---

**Need more help?** See `RAILWAY_DEPLOYMENT.md` for the complete guide with screenshots and troubleshooting.
