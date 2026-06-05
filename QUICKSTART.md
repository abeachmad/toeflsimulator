# Quick Start Guide

## Prerequisites Check
```bash
node --version  # Should be 20.0.0 or higher
npm --version   # Should be 10.0.0 or higher
docker --version # Required for PostgreSQL and Redis
```

## 🚀 Get Started in 5 Steps

### Step 1: Install Dependencies
```bash
# In project root
npm install
```

### Step 2: Start Database Services
```bash
npm run docker:up
```
Wait for PostgreSQL and Redis to be healthy (check with `docker ps`)

### Step 3: Configure Backend
```bash
cd backend
# Edit .env and add your Gemini API key
# Get free key at: https://ai.google.dev/
```

Edit `backend/.env`:
```env
GEMINI_API_KEY=your_actual_api_key_here
```

### Step 4: Start Development Servers
```bash
# In project root
npm run dev
```

This starts:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

### Step 5: Verify Setup
Open in browser:
- Frontend: http://localhost:5173
- Backend health: http://localhost:3000/health

## 🧪 Run Tests
```bash
# All tests
npm test

# Frontend tests only
npm test --workspace=frontend

# Backend tests only
npm test --workspace=backend

# Watch mode
npm run test:watch --workspace=frontend
```

## 🔧 Common Commands

### Docker Services
```bash
npm run docker:up     # Start PostgreSQL + Redis
npm run docker:down   # Stop services
docker ps             # Check service status
docker logs toefl-postgres  # View PostgreSQL logs
docker logs toefl-redis     # View Redis logs
```

### Development
```bash
npm run dev              # Start both frontend and backend
npm run dev:frontend     # Frontend only (port 5173)
npm run dev:backend      # Backend only (port 3000)
```

### Build
```bash
npm run build            # Build both workspaces
npm run build --workspace=frontend
npm run build --workspace=backend
```

### Linting
```bash
npm run lint --workspaces
```

## 📊 Database Access

### PostgreSQL Connection
- Host: localhost
- Port: 5432
- Database: toefl_simulator
- User: postgres
- Password: password

### Connect with psql
```bash
docker exec -it toefl-postgres psql -U postgres -d toefl_simulator
```

### Useful SQL Commands
```sql
-- List all tables
\dt

-- View test items
SELECT * FROM test_items LIMIT 10;

-- View exam sessions
SELECT * FROM exam_sessions;

-- View CEFR conversion table
SELECT * FROM cefr_conversion;
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Check what's using port 5173 (frontend)
netstat -ano | findstr :5173

# Check what's using port 3000 (backend)
netstat -ano | findstr :3000

# Stop the process or change ports in .env
```

### Docker Services Not Starting
```bash
# Remove old volumes and restart
npm run docker:down
docker volume rm toeflsimulation_postgres-data toeflsimulation_redis-data
npm run docker:up
```

### Database Connection Failed
```bash
# Wait for PostgreSQL to be ready
docker logs toefl-postgres

# Look for: "database system is ready to accept connections"
```

### Vite Build Issues
If you see Rolldown binding errors:
```bash
# Clean and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### TypeScript Errors
```bash
# Rebuild TypeScript
npm run build --workspace=backend
npm run build --workspace=frontend
```

## 📝 Environment Variables

### Backend (.env)
```env
# Required
GEMINI_API_KEY=your_key_here

# Optional (defaults shown)
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
DB_HOST=localhost
DB_PORT=5432
DB_NAME=toefl_simulator
DB_USER=postgres
DB_PASSWORD=password
```

## 🎯 Next Steps

1. ✅ Verify all services are running
2. 📖 Read the [README.md](./README.md) for detailed documentation
3. 🏗️ Start implementing features from [tasks.md](./.kiro/specs/toefl-simulator/tasks.md)
4. 🧪 Write tests as you develop
5. 📊 Check [PROJECT_STATUS.md](./PROJECT_STATUS.md) for implementation status

## 🆘 Getting Help

- Check logs: `docker logs toefl-postgres` or `docker logs toefl-redis`
- View API docs: http://localhost:3000/api
- Health check: http://localhost:3000/health
- Frontend console: Open browser DevTools

## 🔗 Useful Links

- [Gemini API Docs](https://ai.google.dev/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/16/)
- [React 18 Docs](https://react.dev/)
- [Vite Docs](https://vitejs.dev/)
- [Vitest Docs](https://vitest.dev/)
- [Zustand Docs](https://github.com/pmndrs/zustand)
- [TailwindCSS Docs](https://tailwindcss.com/)
