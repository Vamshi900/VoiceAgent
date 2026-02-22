# VoiceAgent — Current State & Local Setup Guide

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│  OPERATOR DASHBOARD (Next.js :3000)                      │
│  - Start/end calls     - Send operator instructions      │
│  - Live transcript      - Call summary + stats           │
│  - Reactive via Convex useQuery/useMutation hooks        │
└────────────────────────┬─────────────────────────────────┘
                         │ useQuery / useMutation / useAction
┌────────────────────────▼─────────────────────────────────┐
│  CONVEX INTELLIGENCE LAYER (convex.cloud)                │
│  - GPT-4o agent with 8 tools (booking, centers, etc.)   │
│  - Real-time session state + transcript storage          │
│  - Operator instruction queue (queued → applied)         │
│  - Call logs, appointments, escalations                  │
│  HTTP endpoints: /intelligence/turn, /session/start,     │
│                  /session/end, /health                    │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP (from agent-worker)
┌────────────────────────▼─────────────────────────────────┐
│  AGENT WORKER (Python, LiveKit agent)                    │
│  - Whisper STT (speech-to-text)                          │
│  - ElevenLabs TTS (text-to-speech)                       │
│  - Routes each voice turn through Convex intelligence    │
│  - Dual mode: Convex intelligence or direct OpenAI       │
└────────────────────────┬─────────────────────────────────┘
                         │ LiveKit SIP
┌────────────────────────▼─────────────────────────────────┐
│  LIVEKIT SERVER (:7880)                                  │
│  - Real-time media routing                               │
│  - SIP trunk ↔ Twilio PSTN                               │
└────────────────────────┬─────────────────────────────────┘
                         │ SIP / PSTN
┌────────────────────────▼─────────────────────────────────┐
│  TWILIO                                                  │
│  - Outbound calls to real phone numbers                  │
│  - Inbound call reception                                │
│  - Phone: +18055905092                                   │
└──────────────────────────────────────────────────────────┘
```

---

## What Works Right Now

### Convex Backend (FULLY BUILT)
| Component | Status | Details |
|-----------|--------|---------|
| Schema | Done | 8 tables: prospects, centers, callSessions, callLogs, appointments, escalations, humanReps, operatorInstructions |
| Seed data | Deployed | 3 imaging centers, 5 prospects, 2 human reps |
| Agent (GPT-4o) | Done | 8 tools: lookupCenters, checkAvailability, bookAppointment, transferToHuman, markDeclined, markCompleted, scheduleCallback, sendConfirmationSms |
| HTTP endpoints | Done | /intelligence/turn, /session/start, /session/end, /health |
| Queries (public) | Done | activeSession, sessionTranscript, operatorInstructions, pendingEscalations, todayStats, callSummary |
| Mutations (public) | Done | createSession, endSession, sendInstruction |
| Helpers (internal) | Done | 18 functions for DB ops, transcript, call logs |
| Guardrails | Done | Local profanity filter + ArmorIQ stub |
| SMS adapter | Done | Twilio + stub providers |
| Env vars | Set | OPENAI_API_KEY configured |

### Next.js Frontend (FULLY BUILT)
| Component | Status | Details |
|-----------|--------|---------|
| CallStarterPanel | Done | Phone input → Convex createSession → triggers voice pipeline |
| CallStatusBar | Done | Maps Convex status (active/ended) to UI (LIVE/COMPLETED) |
| TranscriptViewer | Done | useQuery(sessionTranscript) — reactive real-time updates |
| AgentControlPanel | Done | Send instructions (free_form, offer_adjustment), quick templates |
| CallSummaryPanel | Done | Post-call: outcome, center, appointment, duration, summary |
| ConvexProvider | Done | Graceful wrapper, works without Convex for stub mode |
| API routes | Done | /api/voice/connect, /api/intelligence/turn, /api/calls/* |

### Voice Pipeline (INTEGRATED)
| Component | Status | Details |
|-----------|--------|---------|
| Python API (FastAPI) | Ready | Call orchestration, Twilio/LiveKit webhooks, PostgreSQL |
| Agent Worker | Ready | LiveKit agent with Convex bridge for intelligence |
| LiveKit | Configured | Cloud: b4nter-8xzadz8e.livekit.cloud |
| Twilio | Configured | SID + auth token + phone number set |
| ElevenLabs TTS | Configured | Voice ID: 21m00Tcm4TlvDq8ikWAM |
| Docker Compose | Ready | 7 services: postgres, redis, livekit, api, agent-worker, dashboard, next-dashboard |

---

## Local Development Setup

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker & Docker Compose (for voice pipeline)
- Convex CLI: `npm install -g convex`

### Quick Start (Convex + Next.js only, no voice)

This is the fastest way to test the intelligence layer and operator dashboard.

```bash
# Terminal 1: Convex dev server
npx convex dev

# Terminal 2: Next.js dev server
npx next dev -p 3000
```

Open http://localhost:3000

**Test flow:**
1. Enter phone number (e.g. 5551234567) → click Start Call
2. Convex session is created → status changes to LIVE
3. Send operator instructions via the Agent Control panel
4. Instructions appear in real-time with Pending → Applied status

**Note:** Without the voice pipeline, the agent won't generate responses.
To test the intelligence layer directly, use curl:

```bash
# Get session ID from the dashboard URL or browser console

# Send an intelligence turn
curl -X POST https://accomplished-basilisk-464.convex.site/intelligence/turn \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "<SESSION_ID>",
    "utterance": "Hi, I would like to book an X-ray appointment",
    "callPhase": "opening",
    "isSilence": false,
    "metadata": {"callDuration": 10, "turnId": "test-1"}
  }'
```

### Full Stack (with voice pipeline)

```bash
# 1. Start infrastructure (Docker)
docker compose up -d postgres redis livekit-server

# 2. Start Python API
docker compose up -d api

# 3. Start agent worker
docker compose up -d agent-worker

# 4. Start Convex + Next.js (local, not Docker)
npx convex dev &
npx next dev -p 3000

# Or start everything via Docker:
docker compose up --build -d
```

### All Services & Ports

| Service | Port | URL |
|---------|------|-----|
| Next.js Dashboard | 3000 | http://localhost:3000 |
| Python API | 8000 | http://localhost:8000 |
| Python Dashboard | 8080 | http://localhost:8080 |
| LiveKit Server | 7880 | http://localhost:7880 |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |
| Convex | cloud | https://accomplished-basilisk-464.convex.cloud |
| Convex HTTP | cloud | https://accomplished-basilisk-464.convex.site |

---

## Environment Files

### `.env.local` (Next.js — not committed)
```
CONVEX_DEPLOYMENT=dev:accomplished-basilisk-464
NEXT_PUBLIC_CONVEX_URL=https://accomplished-basilisk-464.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://accomplished-basilisk-464.convex.site
VOICE_API_URL=http://localhost:8000
API_AUTH_TOKEN=<your-token>
```

### `.env` (Docker services — not committed)
Contains all credentials for: Twilio, LiveKit, OpenAI, ElevenLabs, PostgreSQL, etc.
See `.env.example` for the full template.

### Convex Environment Variables
```bash
npx convex env list    # View current vars
npx convex env set OPENAI_API_KEY sk-...   # Set a var
```

Currently set: `OPENAI_API_KEY`

---

## End-to-End Call Flow

### Outbound Call (Operator-Initiated)
1. **Operator** opens http://localhost:3000
2. Enters phone number → clicks **Start Call**
3. **Next.js** calls `createSession` Convex mutation
   - Creates prospect (or finds existing)
   - Creates agent thread (GPT-4o)
   - Creates callSession + initial callLog
   - Returns sessionId
4. **Next.js** calls `/api/voice/connect` → Python API `/v1/calls/outbound`
   - Creates LiveKit room
   - Dispatches agent-worker
   - Creates SIP participant (Twilio dials phone)
5. **Agent-worker** joins LiveKit room
   - Reads `convex_session_id` from participant attributes
   - Activates Convex intelligence mode
6. **Caller answers** → Whisper STT transcribes speech
7. Each user utterance → **Convex `/intelligence/turn`**
   - Convex agent runs with 8 tools
   - Checks operator instructions
   - Returns agentReply + actions
8. Agent reply → **ElevenLabs TTS** → Caller hears response
9. **Transcript** stored in Convex callLogs (real-time via useQuery)
10. **Operator** sees live transcript, can send instructions
11. Call ends → `endSession` generates summary via transfer agent

### Intelligence Turn Detail
```
User speech → Whisper STT → text
  → POST /intelligence/turn
    → Load session + centers + pending operator instructions
    → Build context prompt
    → GPT-4o agent with tools (lookupCenters, bookAppointment, etc.)
    → Guardrails check on reply
    → Store transcript entries in callLogs
    → Update session state (phase, turnCount)
  ← Return: agentReply, callPhase, action, offerState
→ ElevenLabs TTS → audio → caller
```

---

## Key Files

### Convex Backend
```
convex/
├── schema.ts              # 8 tables with indexes
├── agent.ts               # GPT-4o agent + 8 inline tools
├── helpers.ts             # 18 internal query/mutation helpers
├── http.ts                # HTTP endpoints (intelligence, session, health)
├── convex.config.ts       # Agent component config
├── seed.ts                # Seed data (centers, prospects, reps)
├── functions/
│   ├── queries.ts         # 6 public queries (activeSession, transcript, etc.)
│   ├── sessions.ts        # createSession (mutation), endSession (action)
│   ├── operator.ts        # sendInstruction mutation
│   └── sms.ts             # SMS action (Twilio/stub)
├── guardrails/            # Content safety (local + ArmorIQ)
└── sms/                   # SMS adapters (Twilio + stub)
```

### Next.js Frontend
```
app/
├── page.tsx               # Main page with session state management
├── layout.tsx             # Root layout with ConvexProvider
├── ConvexProvider.tsx      # Graceful Convex wrapper
└── api/
    ├── voice/connect/     # Triggers LiveKit+Twilio via Python API
    ├── intelligence/turn/ # Proxies to Convex intelligence
    ├── calls/outbound/    # Proxies to Convex session start
    └── calls/[id]/        # end, instructions, send-discount-code

components/
├── CallStarterPanel.tsx   # Phone input + Convex createSession
├── CallStatusBar.tsx      # Status display + End Call button
├── TranscriptViewer.tsx   # Real-time transcript via useQuery
├── AgentControlPanel.tsx  # Operator instructions + offer adjustment
├── CallSummaryPanel.tsx   # Post-call summary via useQuery
├── AppShell.tsx           # Layout wrapper
└── LogoMark.tsx           # Logo component
```

### Voice Pipeline (Python)
```
services/
├── api/                   # FastAPI call orchestration
│   ├── app/main.py
│   ├── app/api/routes_calls.py      # POST /v1/calls/outbound
│   ├── app/api/routes_webhooks.py   # Twilio/LiveKit webhooks
│   ├── app/services/calls.py        # Call CRUD + state machine
│   ├── app/services/livekit.py      # LiveKit client (rooms, SIP)
│   └── app/models/call.py           # SQLAlchemy models
├── agent-worker/          # LiveKit voice agent
│   └── worker/
│       ├── main.py                  # Entrypoint (Convex + direct modes)
│       ├── convex_bridge.py         # HTTP client for Convex endpoints
│       ├── config.py                # Settings (all env vars)
│       └── prompts.py               # CVS booking system prompt
└── dashboard/             # Simple Python monitoring UI
```

---

## Troubleshooting

### "No environment variables set" for Convex
```bash
npx convex env set OPENAI_API_KEY sk-proj-...
```

### Convex functions not deploying
```bash
npx convex dev --once  # One-shot deploy
```

### Next.js can't reach Convex
Check `.env.local` has:
```
NEXT_PUBLIC_CONVEX_URL=https://accomplished-basilisk-464.convex.cloud
```

### Voice pipeline not connecting
1. Check Docker is running: `docker compose ps`
2. Check Python API health: `curl http://localhost:8000/healthz`
3. Check LiveKit: `curl http://localhost:7880`
4. Check `.env` has all credentials

### Intelligence turn returns error
- Verify OPENAI_API_KEY is set in Convex: `npx convex env list`
- Check Convex logs: `npx convex logs`
