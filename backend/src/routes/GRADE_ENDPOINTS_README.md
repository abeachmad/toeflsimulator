# AI Grading Endpoints

This document describes the AI grading endpoints for the TOEFL iBT 2026 Test Simulator.

## Overview

The grading service uses Google Gemini Flash API to provide AI-powered assessment of writing and speaking responses. The service includes circuit breaker pattern for resilience and automatic fallback to default scores when the API is unavailable.

## Requirements

- `GEMINI_API_KEY` environment variable must be set
- Google Gemini API Free Tier credentials
- For speaking endpoints: audio files in WAV, MP3, MP4, or WebM format (max 10MB)

## Endpoints

### 1. Grade Writing Response

Grade a writing response using Gemini Flash AI.

**Endpoint:** `POST /api/grade/writing`

**Request Body:**
```json
{
  "text": "The quick brown fox jumps over the lazy dog.",
  "taskType": "build-sentence" | "email" | "academic-discussion",
  "professorPrompt": "optional - for academic-discussion tasks",
  "peerOpinions": ["optional array of peer opinions"]
}
```

**Response:**
```json
{
  "message": "Writing response graded successfully",
  "data": {
    "cefrBand": 4,
    "scaleScore": 22,
    "grammarCorrections": [
      {
        "originalText": "...",
        "correctedText": "...",
        "errorType": "subject-verb agreement",
        "explanation": "..."
      }
    ],
    "lexicalAnalysis": {
      "vocabularyLevel": "intermediate",
      "lexicalDiversity": 0.65,
      "academicWordCount": 5,
      "suggestions": ["Use more varied vocabulary", "..."]
    }
  },
  "metadata": {
    "taskType": "build-sentence",
    "textLength": 44,
    "processingTime": 1234
  }
}
```

**Validation:**
- `text`: required, non-empty string
- `taskType`: required, must be one of: `build-sentence`, `email`, `academic-discussion`
- `professorPrompt`: optional string (recommended for `academic-discussion`)
- `peerOpinions`: optional array of strings

**Score Ranges:**
- `cefrBand`: 1-6 (clamped automatically)
- `scaleScore`: 0-30 (clamped automatically)

**Error Handling:**
- Returns `503 Service Unavailable` if API key is not configured
- Returns default scores (CEFR: 3, Scale: 15) if grading fails
- Includes error message when fallback is triggered

---

### 2. Assess Speaking Pronunciation

Assess pronunciation from an audio recording using Gemini Flash Pronunciation API.

**Endpoint:** `POST /api/grade/speaking`

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audio` | File | Yes | Audio file (WAV, MP3, MP4, WebM, max 10MB) |
| `referenceText` | string | Yes | Expected text that should be spoken |
| `taskType` | string | No | `listen-repeat` or `simulated-interview` (default: `listen-repeat`) |

**Response:**
```json
{
  "message": "Speaking response assessed successfully",
  "data": {
    "accuracyScore": 85,
    "fluencyScore": 78,
    "prosodyScore": 82,
    "completenessScore": 90,
    "cefrBand": 5,
    "scaleScore": 25
  },
  "metadata": {
    "taskType": "listen-repeat",
    "audioFormat": "audio/wav",
    "audioSize": 128000,
    "referenceTextLength": 44,
    "processingTime": 2345
  }
}
```

**Validation:**
- `audio`: required, must be WAV, MP3, MP4, or WebM format, max 10MB
- `referenceText`: required, non-empty string
- `taskType`: optional, must be `listen-repeat` or `simulated-interview`

**Score Ranges:**
- `accuracyScore`, `fluencyScore`, `prosodyScore`, `completenessScore`: 0-100
- `cefrBand`: 1-6 (clamped automatically)
- `scaleScore`: 0-30 (clamped automatically)

**File Handling:**
- Uploaded files are automatically deleted after processing
- Temporary storage in `uploads/audio/` directory

**Error Handling:**
- Returns `503 Service Unavailable` if API key is not configured
- Returns default scores (all metrics: 50, CEFR: 3, Scale: 15) if assessment fails
- Includes error message when fallback is triggered

---

### 3. Check Service Health

Check grading service health and circuit breaker status.

**Endpoint:** `GET /api/grade/health`

**Response:**
```json
{
  "status": "healthy" | "degraded" | "unavailable",
  "circuitState": "CLOSED" | "OPEN" | "HALF_OPEN",
  "configured": true,
  "message": "Grading service is healthy"
}
```

**Status Values:**
- `healthy`: Circuit is CLOSED, service operating normally
- `degraded`: Circuit is HALF_OPEN, testing service recovery
- `unavailable`: Circuit is OPEN, service is failing

---

### 4. Reset Circuit Breaker

Manually reset the circuit breaker (admin endpoint for recovery).

**Endpoint:** `POST /api/grade/reset`

**Response:**
```json
{
  "message": "Circuit breaker reset successfully"
}
```

**Use Case:**
- After fixing Gemini API issues
- When circuit breaker is stuck in OPEN state
- For manual recovery of grading service

---

## Circuit Breaker Configuration

The grading service implements a circuit breaker pattern to prevent cascading failures:

**Default Configuration:**
- `failureThreshold`: 5 consecutive failures trigger OPEN state
- `successThreshold`: 2 consecutive successes required to close from HALF_OPEN
- `timeout`: 60000ms (60 seconds) between requests in OPEN state
- `resetTimeout`: 30000ms (30 seconds) before transitioning to HALF_OPEN

**Retry Logic:**
- Maximum 3 retry attempts with exponential backoff
- Base delay: 1000ms
- Backoff multiplier: 2x (1s, 2s, 4s)

---

## Error Responses

### Validation Error (400)
```json
{
  "error": "Validation Error",
  "message": "Invalid request data",
  "details": [
    {
      "path": "text",
      "message": "text is required and cannot be empty"
    }
  ]
}
```

### Service Unavailable (503)
```json
{
  "error": "Service Unavailable",
  "message": "Grading service is not configured. Please set GEMINI_API_KEY environment variable."
}
```

### Fallback Response (200 with error field)
```json
{
  "message": "Writing grading completed with fallback scores due to service error",
  "data": {
    "cefrBand": 3,
    "scaleScore": 15,
    ...
  },
  "error": "Grading service temporarily unavailable"
}
```

---

## Testing

Comprehensive integration tests are provided in `grade.test.ts`:

```bash
# Run grading endpoint tests
npm test -- src/routes/grade.test.ts

# Run all tests
npm test
```

**Test Coverage:**
- ✅ Writing grading (all task types)
- ✅ Speaking assessment (listen-repeat, simulated-interview)
- ✅ Input validation
- ✅ Service health checks
- ✅ Circuit breaker reset
- ✅ Error handling and fallback behavior
- ✅ Concurrent requests
- ✅ Edge cases (long text, Unicode, file types)
- ✅ Complete workflow integration

---

## Requirements Validation

This implementation satisfies the following requirements:

**Writing Requirements (5.x):**
- ✅ 5.5: Gemini_Grader analyzes text using Google Gemini API
- ✅ 5.6: CEFR bands above 6 clamped to 6
- ✅ 5.7: CEFR bands below 1 clamped to 1, scale scores clamped 0-30
- ✅ 5.8: Returns structured JSON with CEFR band, scale score, grammar, and lexical analysis
- ✅ 5.9: Uses @google/genai SDK for API communication

**Speaking Requirements (6.x):**
- ✅ 6.3: Audio_Recorder captures audio from microphone
- ✅ 6.4: Audio files uploaded to Gemini_Grader
- ✅ 6.5: Extracts accuracyScore, fluencyScore, prosodyScore, completenessScore
- ✅ 6.6: Uses Gemini Flash Pronunciation API
- ✅ 6.7: Returns scores in structured format

**Gemini API Requirements (17.x):**
- ✅ 17.1: Uses @google/generative-ai SDK
- ✅ 17.2: Authenticates with API key from environment
- ✅ 17.3: Uses Gemini Flash model for writing
- ✅ 17.4: Uses Gemini Flash Pronunciation API for speaking
- ✅ 17.5: Implements retry logic with exponential backoff

**Error Handling Requirements (19.x):**
- ✅ 19.2: Returns default scores when Gemini API errors occur

**Audio Processing Requirements (20.x):**
- ✅ 20.3: Captures audio in Gemini-compatible formats
- ✅ 20.4: Handles file size limits (10MB max)
- ✅ 20.6: Uploads audio files to backend API endpoint

---

## Usage Examples

### Example 1: Grade Build-Sentence Task
```bash
curl -X POST http://localhost:3000/api/grade/writing \
  -H "Content-Type: application/json" \
  -d '{
    "text": "The cat sat on the mat.",
    "taskType": "build-sentence"
  }'
```

### Example 2: Grade Academic Discussion
```bash
curl -X POST http://localhost:3000/api/grade/writing \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I agree with Sarah that online learning offers flexibility...",
    "taskType": "academic-discussion",
    "professorPrompt": "Discuss online vs in-person learning",
    "peerOpinions": ["Sarah: Online is convenient", "Mike: Prefer in-person"]
  }'
```

### Example 3: Assess Speaking Pronunciation
```bash
curl -X POST http://localhost:3000/api/grade/speaking \
  -F "audio=@recording.wav" \
  -F "referenceText=The quick brown fox jumps over the lazy dog" \
  -F "taskType=listen-repeat"
```

### Example 4: Check Service Health
```bash
curl http://localhost:3000/api/grade/health
```

---

## Integration with Frontend

The frontend should:

1. **For Writing Tasks:**
   - Collect text from textarea
   - Include task-specific metadata (professorPrompt, peerOpinions)
   - Display grammarCorrections and lexicalAnalysis feedback

2. **For Speaking Tasks:**
   - Request microphone permissions
   - Record audio using Web Audio API or MediaRecorder
   - Upload as FormData with `audio` field
   - Display all four pronunciation metrics

3. **Error Handling:**
   - Check for `error` field in response
   - Display user-friendly message for fallback scores
   - Allow retry for failed requests

4. **Service Monitoring:**
   - Periodically check `/api/grade/health`
   - Display service status to user
   - Disable grading features if service unavailable

---

## Security Considerations

- ✅ Rate limiting: 100 requests per 15 minutes per IP
- ✅ File size validation: 10MB max for audio uploads
- ✅ MIME type validation: Only audio formats accepted
- ✅ Automatic file cleanup: Uploaded files deleted after processing
- ✅ API key protection: Stored in environment variables, never exposed
- ✅ Input validation: Zod schemas prevent injection attacks
- ✅ Error message sanitization: Internal errors not exposed to client

---

## Performance Notes

- Writing grading: ~2-5 seconds per request
- Speaking assessment: ~3-7 seconds per request (includes file upload)
- Concurrent request limit: Based on Gemini API rate limits
- Circuit breaker prevents system overload during API failures
- Retry logic adds up to 7 seconds delay for failed requests

---

## Future Enhancements

Potential improvements for future iterations:

- [ ] Batch grading API for multiple responses
- [ ] Websocket support for real-time progress updates
- [ ] Caching layer for common phrases/patterns
- [ ] Custom rubric configuration per task type
- [ ] Detailed phoneme-level feedback for pronunciation
- [ ] Admin dashboard for circuit breaker monitoring
- [ ] A/B testing framework for prompt engineering
- [ ] Multi-language support beyond English
