# Deployment & Module Architecture Plan
## CVS X-Ray Booking Voice Agent — Convex Intelligence Layer

**Status:** Active Development
**Last Updated:** February 21, 2026
**Repo:** github.com/Vamshi900/VoiceAgent

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│ LiveKit Agent (Python)          — Dev 1              │
│  STT (Deepgram) → Convex Turn API → TTS (Cartesia)  │
└──────────────┬───────────────────────────────────────┘
               │  HTTP (each turn)
               ▼
┌──────────────────────────────────────────────────────┐
│ Convex Intelligence Layer       — Dev 2 (This Repo)  │
│  Agent Component (SalesAgent / TransferAgent)         │
│  Tools: lookup, book, escalate, SMS, etc.             │
│  State: prospects, sessions, centers, appointments    │
│  Real-time queries for operator UI                    │
└──────────────┬───────────────────────────────────────┘
               │  Reactive queries
               ▼
┌──────────────────────────────────────────────────────┐
│ Next.js Operator Console        — Dev 3              │
│  ConvexProvider → useQuery / useMutation              │
│  Live transcript, offer controls, escalation queue    │
└──────────────────────────────────────────────────────┘
```

---

## Module Breakdown

### MODULE 1 — Foundation

**Files:**
- `.gitignore` — Fix Python gitignore, add Convex entries
- `lib/types.ts` — Shared TypeScript types (CallStatus, TranscriptEntry, etc.)
- `lib/store/callStore.ts` — Zustand store for UI state
- `lib/intelligence.ts` — Intelligence turn types (request/response)
- `convex/convex.config.ts` — Convex component config (agents)
- `convex/schema.ts` — Full database schema
- `convex/seed.ts` — Seed data (centers, test prospects)

**Dependencies to install:**
```
convex @convex-dev/agents
```

### MODULE 2 — SMS Adapter

Pluggable SMS system: stub for dev, Twilio for production.

**Files:**
- `convex/sms/types.ts` — SmsProvider interface
- `convex/sms/stub.ts` — Console-logging stub for development
- `convex/sms/twilio.ts` — Real Twilio integration
- `convex/sms/index.ts` — Factory: picks provider from env

### MODULE 3 — Guardrails

Content safety layer for agent responses.

**Files:**
- `convex/guardrails/types.ts` — GuardrailProvider interface
- `convex/guardrails/local.ts` — Keyword/regex blocklist
- `convex/guardrails/armoriq.ts` — External guardrail API stub
- `convex/guardrails/index.ts` — Factory: picks provider from env

### MODULE 4 — Agent + Tools

The intelligence brain — Convex Agent Component with tools.

**Files:**
- `convex/tools/lookupCenters.ts`
- `convex/tools/checkAvailability.ts`
- `convex/tools/bookAppointment.ts`
- `convex/tools/transferToHuman.ts`
- `convex/tools/markDeclined.ts`
- `convex/tools/markCompleted.ts`
- `convex/tools/scheduleCallback.ts`
- `convex/tools/sendConfirmationSms.ts`
- `convex/tools/index.ts` — Exports all tools
- `convex/agent.ts` — SalesAgent + TransferAgent definitions

### MODULE 5 — HTTP Actions + Functions

The API surface that LiveKit and the UI consume.

**Files:**
- `convex/functions/sessions.ts` — createSession, endSession mutations
- `convex/functions/operator.ts` — sendInstruction mutation
- `convex/functions/queries.ts` — All reactive queries (activeSession, transcript, stats, etc.)
- `convex/functions/sms.ts` — SMS sending action
- `convex/http.ts` — HTTP routes (/intelligence/turn, /session/start, /session/end)

### MODULE 6 — Wire Next.js

Connect the existing frontend to Convex.

**Files:**
- `app/ConvexProvider.tsx` — ConvexProvider wrapper component
- `app/layout.tsx` — Updated to wrap with ConvexProvider
- `tailwind.config.js` — Add convex/ to content paths (not strictly needed but future-proofs)

---

## Database Schema

```
prospects
  - name, phone, zip, insurance, status
  - callAttempts, lastCalledAt, maxAttempts
  - externalCrmId

centers
  - name, address, phone, hours
  - discountAmount, distanceTier, basePrice
  - availableSlots (array of date/time)

callSessions
  - prospectId, threadId, callPhase
  - offerState, operatorOverrides
  - livekitRoomId, twilioCallSid
  - status, startedAt, endedAt

callLogs
  - sessionId, outcome, transcript, summary
  - escalationDetails, recordingUrl

appointments
  - prospectId, centerId
  - date, time, status
  - confirmationSmsSent, reminderScheduled

escalations
  - sessionId, reason, transcriptSnapshot
  - status, assignedRepId

humanReps
  - name, phone, email, status, activeSessionId

operatorInstructions
  - sessionId, type, payload
  - status (queued/applied/rejected), appliedAtTurn
```

---

## Contracts

### Intelligence Turn API (LiveKit → Convex)

```
POST /api/intelligence/turn

Request:  { sessionId, utterance, callPhase, isSilence, metadata }
Response: { agentReply, callPhase, action, actionData, offerState }
```

### Operator Instructions (UI → Convex)

```
Mutation: sendOperatorInstruction
Input:  { sessionId, type, payload }
Output: { instructionId, status: "queued" }
```

### Reactive Queries (Convex → UI)

```
activeSession(sessionId)        → session state
sessionTranscript(sessionId)    → message list
operatorInstructions(sessionId) → instruction history
pendingEscalations()            → escalation queue
todayStats()                    → aggregate metrics
callSummary(sessionId)          → post-call report
```

---

## Environment Variables Required

```env
# Convex
CONVEX_DEPLOYMENT=
NEXT_PUBLIC_CONVEX_URL=

# Twilio (for SMS)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# AI Models (used by Convex Agent Component)
OPENAI_API_KEY=

# LiveKit (Dev 1 provides these)
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
```

---

## Build Order

1. Foundation (schema, types, seed data)
2. SMS Adapter (pluggable, start with stub)
3. Guardrails (pluggable, start with local)
4. Agent + Tools (SalesAgent, TransferAgent, 8 tools)
5. HTTP Actions + Functions (turn endpoint, queries, mutations)
6. Wire Next.js (ConvexProvider, layout update)
