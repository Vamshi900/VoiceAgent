# VoiceAgent — Tasks & Status Tracker

## Current State (updated)

| Layer | Status |
|-------|--------|
| Convex schema + helpers | Compiles clean (0 errors) |
| Convex agent + tools | Compiles clean, tools inline in agent.ts |
| Convex HTTP endpoints | /intelligence/turn, /session/start, /session/end, /health |
| Convex functions | queries (public), sessions (public), operator (public), sms |
| Convex seed data | Deployed (3 centers, 5 prospects, 2 reps) |
| Convex env vars | NONE SET (need OPENAI_API_KEY at minimum) |
| Next.js build | Compiles clean |
| Frontend UI | All components using Convex reactive hooks (useQuery/useMutation/useAction) |
| API routes (Next.js) | ALL 5 WIRED to Convex backend |
| Zustand store | REMOVED — replaced by Convex |
| Real-time transcript | Stored in callLogs via intelligence turn, queried reactively |

---

## Phase 1 — Wire Frontend to Convex (DONE)

### 1.1 [x] Wire `/api/calls/outbound` → Convex `/session/start`
### 1.2 [x] Wire `/api/intelligence/turn` → Convex `/intelligence/turn`
### 1.3 [x] Wire `/api/calls/[id]/end` → Convex `/session/end`
### 1.4 [x] Wire `/api/calls/[id]/instructions` → Convex mutation `sendInstruction`
### 1.5 [x] Wire `/api/calls/[id]/send-discount-code` → Convex action `sendSms`

---

## Phase 2 — Convex Real-Time in Frontend (DONE)

### 2.1 [x] Add Convex reactive queries to components (useQuery hooks)
- `activeSession` for live session data
- `sessionTranscript` for real-time transcript
- `operatorInstructions` for instruction status
- `callSummary` for post-call summary

### 2.2 [x] Wire CallSummaryPanel to `callSummary` query
- Shows real outcome, appointment details, duration, summary

### 2.3 [x] Remove Zustand store, replace with direct Convex hooks
- Deleted `lib/store/callStore.ts`
- Deleted `lib/intelligence.ts`
- Slimmed `lib/types.ts`

### 2.4 [x] Make sessions public (mutation/action) for frontend direct access

### 2.5 [x] Add real-time transcript storage
- Intelligence turn HTTP handler stores user+agent entries in callLogs
- callLog created at session start with "in_progress" outcome
- endSession updates existing callLog with final outcome + summary

---

## Phase 3 — Environment & Deployment

### 3.1 [ ] Set Convex env vars
- `OPENAI_API_KEY` (required for agent LLM)
- `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM_NUMBER` (optional)

### 3.2 [x] Commit all pending changes

### 3.3 [ ] Test end-to-end flow (start session → intelligence turn → end session)

---

## Phase 4 — Voice Integration (LATER)

### 4.1 [ ] LiveKit/Twilio voice pipeline
### 4.2 [ ] Real-time STT → intelligence turn → TTS loop
### 4.3 [ ] Production deployment

---

## Git Status

Last commit: pending — Phase 2 Convex real-time frontend
