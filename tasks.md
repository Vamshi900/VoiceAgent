# VoiceAgent — Tasks & Status Tracker

## Current State (updated)

| Layer | Status |
|-------|--------|
| Convex schema + helpers | Compiles clean (0 errors) |
| Convex agent + tools | Compiles clean, tools inline in agent.ts |
| Convex HTTP endpoints | /intelligence/turn, /session/start, /session/end, /health |
| Convex functions | queries (public), sessions (public), operator (public), sms |
| Convex seed data | Deployed (3 centers, 5 prospects, 2 reps) |
| Next.js build | Compiles clean (7 routes + /api/voice/connect) |
| Frontend UI | All components using Convex reactive hooks |
| Voice pipeline | LiveKit + Twilio + Whisper STT + ElevenLabs TTS |
| Agent worker | Convex bridge integrated (dual mode: Convex or direct OpenAI) |
| Python API | FastAPI with PostgreSQL, Twilio/LiveKit webhooks |
| Docker Compose | Full stack: postgres, redis, livekit, api, agent-worker, dashboards |
| Zustand store | REMOVED — replaced by Convex |

---

## Phase 1 — Wire Frontend to Convex (DONE)

### 1.1 [x] Wire all 5 API routes to Convex backend

---

## Phase 2 — Convex Real-Time in Frontend (DONE)

### 2.1 [x] Replace Zustand with Convex hooks (useQuery/useMutation/useAction)
### 2.2 [x] Wire all components to reactive queries
### 2.3 [x] Add real-time transcript storage
### 2.4 [x] Make sessions public for frontend access

---

## Phase 3 — Voice Pipeline Integration (DONE)

### 3.1 [x] Cherry-pick Python services from master branch
- services/api (FastAPI), services/agent-worker (LiveKit), services/dashboard
- docker-compose.yml, infra/livekit/, tests/

### 3.2 [x] Create Convex bridge in agent-worker
- worker/convex_bridge.py — HTTP client for Convex endpoints
- create_session, send_turn, end_session

### 3.3 [x] Modify agent-worker to use Convex intelligence
- Dual mode: Convex (tools/state/instructions) or direct OpenAI (fallback)
- Updated prompts.py with CVS booking persona
- config.py: added CONVEX_SITE_URL setting

### 3.4 [x] Wire outbound voice flow end-to-end
- /api/voice/connect route → Python API /v1/calls/outbound
- Passes convex_session_id as participant attribute
- CallStarterPanel triggers voice after Convex session

### 3.5 [x] Update infrastructure
- .env.example with all Convex + voice vars
- docker-compose.yml with next-dashboard service
- Dockerfile.next for Next.js container
- Python API schema accepts convex_session_id

---

## Phase 4 — Environment & E2E Testing

### 4.1 [ ] Set Convex env vars (OPENAI_API_KEY)
### 4.2 [ ] Configure Twilio + LiveKit SIP trunk
### 4.3 [ ] Test end-to-end: operator starts call → voice pipeline → intelligence → transcript
### 4.4 [ ] Test operator instructions during live call

---

## Phase 5 — Production Polish (LATER)

### 5.1 [ ] Error handling & retry logic
### 5.2 [ ] Call recording integration
### 5.3 [ ] Dashboard stats with Convex todayStats query
### 5.4 [ ] Escalation queue in frontend
### 5.5 [ ] Production deployment

---

## Architecture

```
Operator Dashboard (Next.js :3000)
    ↕ useQuery / useMutation / useAction
Convex Intelligence Layer (convex.cloud)
    ↑ HTTP: /intelligence/turn, /session/start, /session/end
Agent Worker (LiveKit agent)
    ↕ Whisper STT / ElevenLabs TTS
LiveKit Server (:7880)
    ↕ SIP Trunk
Twilio PSTN
    ↕
Caller's Phone
```

## Git Status

Last commit: pending — Voice pipeline integration
