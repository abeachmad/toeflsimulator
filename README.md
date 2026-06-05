# TOEFL iBT 2026 Test Simulator

A production-grade, full-stack web application that replicates the official ETS TOEFL iBT 2026 exam experience with adaptive testing and AI-powered grading.

## Features

- **Adaptive Testing**: 2-stage Multistage Adaptive Testing (MST) using IRT 3-Parameter Logistic model
- **Four Test Sections**: Reading (30 min), Listening (29 min), Writing (23 min), Speaking (8 min)
- **Dual Scoring System**: CEFR Band Scale (1-6) and Equivalent Score (0-30)
- **AI-Powered Grading**: Google Gemini Flash API for Writing and Speaking assessment
- **Session Management**: Offline resilience with client-side persistence and server-side validation
- **Official ETS UI**: Exact replication of ETS 2026 interface specifications

## Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite 5.x** for build tooling
- **Zustand** for state management with persist middleware
- **TailwindCSS** for styling
- **Vitest** + **React Testing Library** for testing

### Backend
- **Node.js 20+** with TypeScript
- **Express 4.x** for API server
- **PostgreSQL 16+** for data storage
- **Redis 7** for caching
- **Google Gemini API** (@google/genai SDK) for AI grading

## Project Structure

```
toefl-simulator/
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── stores/       # Zustand stores
│   │   ├── services/     # API services
│   │   ├── utils/        # Utility functions
│   │   └── test/         # Test setup and utilities
│   ├── public/           # Static assets
│   └── package.json
├── backend/              # Express backend API
│   ├── src/
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   ├── models/       # Data models
│   │   ├── middleware/   # Express middleware
│   │   ├── config/       # Configuration files
│   │   └── utils/        # Utility functions
│   ├── scripts/          # Database scripts
│   └── package.json
├── docker-compose.yml    # Docker services (PostgreSQL, Redis)
└── package.json          # Root workspace configuration
```

## Prerequisites

- Node.js 20.0.0 or higher
- npm 10.0.0 or higher
- Docker and Docker Compose (for database services)
- Google Gemini API key (free tier available)

## Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd TOEFLsimulation
```

### 2. Install dependencies
```bash
# Install all workspace dependencies
npm install
```

### 3. Start database services
```bash
# Start PostgreSQL and Redis using Docker Compose
npm run docker:up

# To stop services
npm run docker:down
```

### 4. Configure environment variables
```bash
# Backend configuration
cd backend
cp .env.example .env
# Edit .env and add your Gemini API key and other configuration
```

### 5. Initialize the database
The database schema will be automatically initialized when PostgreSQL container starts.
You can verify the connection:
```bash
# In backend directory
npm run dev
# Look for "✅ Database connected successfully" message
```

## Development

### Start development servers
```bash
# Start both frontend and backend in development mode
npm run dev

# Or start them separately:
npm run dev:frontend  # Frontend at http://localhost:5173
npm run dev:backend   # Backend at http://localhost:3000
```

### Run tests
```bash
# Run all tests
npm test

# Run frontend tests only
npm test --workspace=frontend

# Run backend tests only
npm test --workspace=backend

# Run tests in watch mode
npm run test:watch --workspace=frontend
```

### Build for production
```bash
# Build both frontend and backend
npm run build

# Build separately
npm run build --workspace=frontend
npm run build --workspace=backend
```

## API Endpoints

### Health Check
- `GET /health` - Server health status

### Session Management
- `POST /api/sessions` - Create new exam session
- `GET /api/sessions/:id` - Get session state
- `PATCH /api/sessions/:id` - Update session state
- `POST /api/sessions/:id/submit` - Submit section/module

### Timer Validation
- `GET /api/sessions/:id/timer` - Get server-calculated remaining time
- `POST /api/sessions/:id/heartbeat` - Validate client timestamp

### Adaptive Testing
- `POST /api/mst/route` - Calculate ability and route to next module
- `GET /api/modules/:difficulty` - Fetch module items

### AI Grading
- `POST /api/grade/writing` - Submit writing for Gemini grading
- `POST /api/grade/speaking` - Submit audio for pronunciation assessment

### Test Content
- `GET /api/items/:section/:type` - Retrieve test items
- `GET /api/passages/:id` - Retrieve reading/listening passages

## Database Schema

### Tables
- `test_items` - Test questions with IRT parameters
- `exam_sessions` - Exam session state and progress
- `cefr_conversion` - CEFR to scale score conversion table

### Key Features
- JSONB columns for flexible data storage
- Indexes on frequently queried fields
- Automatic timestamp updates
- UUID primary keys

## Environment Variables

### Backend (.env)
```bash
# Server
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/toefl_simulator
DB_HOST=localhost
DB_PORT=5432
DB_NAME=toefl_simulator
DB_USER=postgres
DB_PASSWORD=password

# Redis
REDIS_URL=redis://localhost:6379

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here

# Session
SESSION_SECRET=your_session_secret_here
SESSION_DURATION_MINUTES=90

# IRT Configuration
IRT_EASY_THRESHOLD=-0.8
IRT_HARD_THRESHOLD=0.8
```

## Testing

### Frontend Testing
- **Unit Tests**: Vitest with React Testing Library
- **Component Tests**: Test React components in isolation
- **Integration Tests**: Test component interactions

### Backend Testing
- **Unit Tests**: Vitest for business logic
- **API Tests**: Test API endpoints
- **Database Tests**: Test database operations

### Property-Based Testing
The project uses property-based testing for critical IRT calculations and adaptive routing logic.

## Docker Services

### PostgreSQL 16
- Port: 5432
- Database: toefl_simulator
- User: postgres
- Password: password (change in production)

### Redis 7
- Port: 6379
- Persistence: AOF enabled

## Adaptive Testing Algorithm

### IRT 3PL Model
```
P(θ) = c + (1-c) / (1 + exp(-1.702*a*(θ-b)))
```
Where:
- θ (theta) = ability estimate
- a = discrimination parameter
- b = difficulty parameter
- c = guessing parameter

### Routing Thresholds
- **Easy Module**: θ < -0.8
- **Medium Module**: -0.8 ≤ θ ≤ 0.8
- **Hard Module**: θ > 0.8

## Contributing

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or contributions, please open an issue on GitHub.
