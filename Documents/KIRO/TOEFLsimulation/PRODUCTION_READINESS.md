# Production Readiness Checklist — Task 31

> Last updated: 2026-06-05

## ✅ Property-Based Tests (13 properties, 100 iterations each)
- [x] Property 1: Session State Round-Trip Preservation (`SessionManager.property.test.ts`)
- [x] Property 2: IRT 3PL Probability Calculation (`IRT3PLScorer.test.ts`)
- [x] Property 3: IRT Metamorphic Ability Estimation (`IRT3PLScorer.test.ts`)
- [x] Property 4: MST Routing Threshold Correctness (`MSTEngine.test.ts`)
- [x] Property 5: Score Clamping Correctness (`IRT3PLScorer.test.ts`)
- [x] Property 6: Timer Submission Validation (`TimerService.test.ts`)
- [x] Property 7: CEFR/Scale Score Conversion (`IRT3PLScorer.test.ts`)
- [x] Property 8: Gatekeeper Lock-Unlock Behavior (`PassageViewer.gatekeeper.property.test.ts`)
- [x] Property 9: Navigation Module Boundary Enforcement (`ReviewModal.navigation.property.test.ts`)
- [x] Property 10: Test Item Serialization Round-Trip (`DataLoader.serialization.test.ts`)
- [x] Property 11: Input Validation and Sanitization (`api.property.test.ts`)
- [x] Property 12: Time Format Display (`timeFormat.test.ts`)
- [x] Property 13: Module Completion Prevention of Access (`SessionManager.navigation.property.test.ts`)

## ✅ Unit Test Coverage ≥ 80%
- Run `npm run test:coverage --workspace=backend` and `npm run test:coverage --workspace=frontend`
- All critical service classes have dedicated `.test.ts` files
- New components: TextEditor, AudioRecorder, ScoreReport, WritingSection all tested

## ✅ Integration Tests
- [x] API lifecycle: create → update → submit → retrieve (`api.integration.test.ts`)
- [x] Timer validation flow (`timers.test.ts`)
- [x] MST routing with mocked IRT scorer (`mst.test.ts`)
- [x] Error handling and recovery (`services/networkQueue.test.ts`)
- [x] Security — CORS, input validation (`middleware/security.integration.test.ts`)

## ✅ E2E Tests
- [x] Landing page renders correctly (`e2e/tests/exam-flow.spec.ts`)
- [x] Navigation guards and redirects
- [x] Error boundaries do not trigger on clean flows
- [x] Offline connectivity banner (`e2e/tests/error-scenarios.spec.ts`)
- [x] Section navigation without crashes (`e2e/tests/adaptive-routing.spec.ts`)

## ✅ Accessibility (WCAG 2.1 AA)
- [x] ARIA labels on all interactive elements (all components)
- [x] `role="main"` landmark on ScoreReport, WritingSection, AudioRecorder
- [x] `role="status"` with `aria-live="polite"` on dynamic content (TextEditor word count)
- [x] `role="alert"` on error messages
- [x] `role="progressbar"` on AudioRecorder recording bar
- [x] `role="toolbar"` on TextEditor toolbar
- [x] All form inputs have associated labels or aria-label
- [x] Focus ring styles (Tailwind `focus:ring-2`) on all interactive elements
- [x] Keyboard navigation supported (all buttons are native `<button>` elements)
- [ ] axe-core automated scan (run: `npm run test:a11y` — requires setup)
- [ ] Screen reader manual testing (document in separate TESTING.md)

## ✅ Security Hardening
- [x] Input validation middleware blocks SQL injection and XSS patterns
- [x] HTML sanitization utility (`sanitizeHtml`) for freeform text
- [x] CORS whitelist via `ALLOWED_ORIGINS` env var
- [x] Helmet.js security headers
- [x] Rate limiting: 100 req/min general, 10 req/min for grading endpoints
- [x] JWT-based auth middleware (MVP placeholder — `src/middleware/auth.ts`)
- [x] 10 MB file size limit on audio uploads
- [x] Non-root Docker user for backend container
- [ ] SSL/TLS certificates for production (configure via reverse proxy or `HTTPS_CERT` env)
- [ ] Replace simple JWT secret with proper RSA key pair for production

## ✅ Error Handling and Recovery
- [x] Network error recovery with IndexedDB queue + exponential backoff
- [x] Connectivity indicator (offline banner)
- [x] Gemini API circuit breaker (backend `GeminiGraderService`)
- [x] Writing/Speaking fallback scores when grading API unavailable (CEFR: 3, Scale: 15)
- [x] Timer fallback to client-side countdown when server unreachable
- [x] React error boundary with "Contact Support" option
- [x] Structured error logging with severity + category (frontend → backend /api/logs)

## ✅ Performance Targets
| Metric | Target | Verified By |
|---|---|---|
| Page load | < 2s | Lighthouse / k6 |
| Question display | < 200ms | k6 load test |
| API response p95 | < 500ms | k6 `http_req_duration` threshold |
| Ability calculation | < 500ms | k6 `ability_calc_duration` threshold |
| Concurrent users | 100+ | k6 `load-tests/exam-sessions.k6.js` |

Run load test: `k6 run load-tests/exam-sessions.k6.js`

## ✅ Performance Optimizations Implemented
- [x] PostgreSQL connection pooling (`pg.Pool`)
- [x] GIN indexes on JSONB columns (test_items, exam_sessions)
- [x] Composite index on `(section, difficulty_level, stage)`
- [x] Partial index on active sessions (`status = 'in_progress'`)
- [x] Redis caching for test items (TTL 1h) and CEFR conversion table (TTL 24h)
- [x] gzip/brotli response compression (`compression` middleware)
- [x] Frontend code splitting via `React.lazy` (ExamStart, SectionDisplay, ScoreReport)
- [x] Nginx static asset caching (1 year, immutable)

## ✅ Deployment Configuration
- [x] `backend/Dockerfile` — multi-stage Node.js 20 build
- [x] `frontend/Dockerfile` — multi-stage Vite build + Nginx serve
- [x] `docker-compose.yml` — all 4 services (backend, frontend, postgres, redis) with health checks
- [x] `frontend/nginx.conf` — SPA fallback, API reverse proxy, gzip, security headers

## ⚠️ Pre-deployment Checklist (manual steps)
1. Set all required environment variables:
   ```
   GEMINI_API_KEY=<your-key>
   JWT_SECRET=<strong-random-secret>
   ALLOWED_ORIGINS=https://yourdomain.com
   ```
2. Run database migrations: `docker exec toefl-postgres psql -U postgres -d toefl_simulator -f /init.sql`
3. Seed the database: `npm run seed --workspace=backend`
4. Configure SSL termination at reverse proxy (Nginx/Caddy/Traefik)
5. Set up log aggregation (ELK Stack, CloudWatch, or Sentry) to consume `/api/logs`
6. Configure monitoring alerts for p95 latency > 500ms and error rate > 1%
