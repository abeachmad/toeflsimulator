# Session Management API

This directory contains the REST API routes for managing exam sessions in the TOEFL iBT 2026 Test Simulator.

## Implementation: Task 9.2

This implementation fulfills Task 9.2: **Implement session management endpoints**.

### Features

✅ **All Required Endpoints Implemented:**
- `POST /api/sessions` - Create new session
- `GET /api/sessions/:sessionId` - Get session by ID
- `PUT /api/sessions/:sessionId` - Update session state
- `DELETE /api/sessions/:sessionId` - Delete session
- `POST /api/sessions/:sessionId/modules/:moduleId/complete` - Mark module completed
- `PUT /api/sessions/:sessionId/ability/:section` - Update ability estimate

✅ **Request Validation with Zod:**
- All endpoints use Zod schemas for request validation
- Comprehensive validation error messages
- Type-safe request/response handling

✅ **Error Handling:**
- 400 Bad Request - Validation errors, missing parameters
- 404 Not Found - Session or resource not found
- 500 Internal Server Error - Server errors with appropriate logging

✅ **TypeScript Types:**
- Full type safety with SessionManager interfaces
- Request/response types properly defined
- No TypeScript compilation errors

✅ **SessionManager Integration:**
- Uses SessionManager service for all database operations
- Proper error propagation from service layer
- Database connection pooling via shared pool instance

✅ **Comprehensive Integration Tests:**
- 34 test cases covering all endpoints
- Happy path and error scenarios
- Complete workflow integration test
- Edge case handling

## Running the Tests

### Prerequisites

The integration tests require a running PostgreSQL database. Start the database using Docker Compose:

```bash
# From the project root directory
cd TOEFLsimulation
docker-compose up -d postgres

# Wait for database to be ready (check health)
docker-compose ps
```

### Running Tests

```bash
# Run all tests
npm test

# Run only session management tests
npm test -- sessions.test.ts

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Test Environment

The tests will:
1. Connect to the PostgreSQL database using configuration from `.env`
2. Clean up test data before each test
3. Create and manipulate test sessions
4. Clean up all test data after completion

Make sure your `.env` file has the correct database credentials:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=toefl_simulator
DB_USER=postgres
DB_PASSWORD=password
```

## API Documentation

### Base URL

All session endpoints are prefixed with `/api/sessions`.

### Authentication

**Note:** Authentication is not yet implemented. All endpoints are currently open.

### Endpoints

#### 1. Create New Session

**POST** `/api/sessions`

Creates a new exam session with a unique session ID.

**Request Body:**
```json
{
  "userId": "string (required)",
  "moduleName": "reading" | "writing" | "listening" | "speaking" (optional)
}
```

**Response (201 Created):**
```json
{
  "message": "Session created successfully",
  "data": {
    "sessionId": "uuid",
    "userId": "string",
    "moduleName": "reading" | null,
    "status": "not_started",
    "currentQuestion": 0,
    "answers": {},
    "score": null,
    "startedAt": "ISO8601 timestamp",
    "completedAt": null,
    "currentSection": "reading" | null,
    "currentModule": number | null,
    "abilityEstimates": {},
    "completedModules": []
  }
}
```

**Error Responses:**
- `400 Bad Request` - Missing or invalid userId

**Example:**
```bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-123", "moduleName": "reading"}'
```

---

#### 2. Get Session by ID

**GET** `/api/sessions/:sessionId`

Retrieves the current state of an exam session.

**Path Parameters:**
- `sessionId` (string, required) - UUID of the session

**Response (200 OK):**
```json
{
  "message": "Session retrieved successfully",
  "data": {
    "sessionId": "uuid",
    "userId": "string",
    "moduleName": "reading",
    "status": "in_progress",
    "currentQuestion": 5,
    "answers": {
      "q1": "A",
      "q2": "B"
    },
    "score": null,
    "startedAt": "ISO8601 timestamp",
    "completedAt": null,
    "currentSection": "reading",
    "currentModule": 1,
    "abilityEstimates": {
      "reading": 0.5
    },
    "completedModules": ["reading-stage1"]
  }
}
```

**Error Responses:**
- `404 Not Found` - Session does not exist

**Example:**
```bash
curl http://localhost:3000/api/sessions/your-session-id
```

---

#### 3. Update Session State

**PUT** `/api/sessions/:sessionId`

Updates the session state (partial update).

**Path Parameters:**
- `sessionId` (string, required) - UUID of the session

**Request Body (all fields optional):**
```json
{
  "moduleName": "reading" | "writing" | "listening" | "speaking",
  "status": "not_started" | "in_progress" | "paused" | "completed" | "expired",
  "currentQuestion": number (>= 0),
  "answers": {
    "questionId": "answer"
  },
  "score": number | null,
  "completedAt": "ISO8601 timestamp" | null,
  "currentSection": "string" | null,
  "currentModule": number | null
}
```

**Response (200 OK):**
```json
{
  "message": "Session updated successfully",
  "data": {
    // Updated session state
  }
}
```

**Error Responses:**
- `400 Bad Request` - No update fields provided or invalid data
- `404 Not Found` - Session does not exist

**Example:**
```bash
curl -X PUT http://localhost:3000/api/sessions/your-session-id \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress", "currentQuestion": 5}'
```

---

#### 4. Delete Session

**DELETE** `/api/sessions/:sessionId`

Deletes an exam session permanently.

**Path Parameters:**
- `sessionId` (string, required) - UUID of the session

**Response (200 OK):**
```json
{
  "message": "Session deleted successfully"
}
```

**Error Responses:**
- None (idempotent operation)

**Example:**
```bash
curl -X DELETE http://localhost:3000/api/sessions/your-session-id
```

---

#### 5. Mark Module as Completed

**POST** `/api/sessions/:sessionId/modules/:moduleId/complete`

Marks a specific module as completed within the session.

**Path Parameters:**
- `sessionId` (string, required) - UUID of the session
- `moduleId` (string, required) - Identifier of the module

**Response (200 OK):**
```json
{
  "message": "Module reading-stage1 marked as completed"
}
```

**Error Responses:**
- `400 Bad Request` - Missing sessionId or moduleId
- `404 Not Found` - Session does not exist

**Example:**
```bash
curl -X POST http://localhost:3000/api/sessions/your-session-id/modules/reading-stage1/complete
```

---

#### 6. Update Ability Estimate

**PUT** `/api/sessions/:sessionId/ability/:section`

Updates the ability estimate (θ) for a specific section.

**Path Parameters:**
- `sessionId` (string, required) - UUID of the session
- `section` (string, required) - Section name (reading, writing, listening, speaking)

**Request Body:**
```json
{
  "theta": number (range: -3 to 3)
}
```

**Response (200 OK):**
```json
{
  "message": "Ability estimate updated for section reading",
  "data": {
    "section": "reading",
    "theta": 0.8
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid section name or theta out of range (-3 to 3)
- `404 Not Found` - Session does not exist

**Example:**
```bash
curl -X PUT http://localhost:3000/api/sessions/your-session-id/ability/reading \
  -H "Content-Type: application/json" \
  -d '{"theta": 0.8}'
```

---

## Complete Workflow Example

Here's a typical exam session flow:

```bash
# 1. Create a new session
SESSION_ID=$(curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-123", "moduleName": "reading"}' \
  | jq -r '.data.sessionId')

# 2. Start the exam
curl -X PUT http://localhost:3000/api/sessions/$SESSION_ID \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress", "currentQuestion": 0}'

# 3. Submit answers
curl -X PUT http://localhost:3000/api/sessions/$SESSION_ID \
  -H "Content-Type: application/json" \
  -d '{"currentQuestion": 5, "answers": {"q1":"A", "q2":"B", "q3":"C"}}'

# 4. Complete reading module
curl -X POST http://localhost:3000/api/sessions/$SESSION_ID/modules/reading-stage1/complete

# 5. Update ability estimate
curl -X PUT http://localhost:3000/api/sessions/$SESSION_ID/ability/reading \
  -H "Content-Type: application/json" \
  -d '{"theta": 0.8}'

# 6. Move to next section
curl -X PUT http://localhost:3000/api/sessions/$SESSION_ID \
  -H "Content-Type: application/json" \
  -d '{"currentSection": "listening", "currentModule": 1, "currentQuestion": 0}'

# 7. Get current session state
curl http://localhost:3000/api/sessions/$SESSION_ID

# 8. Complete the exam
curl -X PUT http://localhost:3000/api/sessions/$SESSION_ID \
  -H "Content-Type: application/json" \
  -d "{\"status\": \"completed\", \"completedAt\": \"$(date -Iseconds)\"}"
```

## Architecture

```
┌─────────────────┐
│  Express App    │
│   (app.ts)      │
└────────┬────────┘
         │
         │ mounts
         ↓
┌─────────────────┐
│ Session Routes  │
│ (sessions.ts)   │
└────────┬────────┘
         │
         │ uses
         ↓
┌─────────────────┐
│ SessionManager  │
│  (service)      │
└────────┬────────┘
         │
         │ queries
         ↓
┌─────────────────┐
│   PostgreSQL    │
│   (exam_sessions│
│     table)      │
└─────────────────┘
```

## Error Handling

All endpoints follow consistent error response format:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "details": {} // Only in development mode
}
```

Error types:
- `Validation Error` (400) - Request data validation failed
- `Bad Request` (400) - Missing required parameters
- `Not Found` (404) - Resource not found
- `Internal Server Error` (500) - Unexpected server error

## Future Enhancements

- [ ] Add authentication middleware
- [ ] Implement rate limiting per user
- [ ] Add session expiration/cleanup
- [ ] Implement WebSocket for real-time updates
- [ ] Add pagination for session list endpoint
- [ ] Implement session sharing/proctoring features
- [ ] Add metrics and monitoring

## Contributing

When adding new endpoints:

1. Define Zod validation schema
2. Add route handler with proper TypeScript types
3. Implement error handling (400, 404, 500)
4. Write comprehensive integration tests
5. Update this README with documentation
6. Ensure TypeScript compilation succeeds
