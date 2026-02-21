# Developer Workstream Breakdown
## CVS X-Ray Voice Agent — 3-Person Split

**Last Updated:** February 21, 2026
**Repo:** [github.com/Vamshi900/VoiceAgent](https://github.com/Vamshi900/VoiceAgent)

---

## The Three Tracks

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   DEV 1          │  │   DEV 2 (You)    │  │   DEV 3          │
│   LIVEKIT        │  │   INTELLIGENCE   │  │   UI             │
│   Voice Pipeline │  │   Convex Backend │  │   Operator Panel │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                     │
         │   SIP + Audio       │   Brain + Data      │   React + UX
         │   Twilio            │   Agents + Tools    │   Convex Client
         │   STT / TTS         │   State Machine     │   Real-time UI
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
                        CONVEX IS THE HUB
                     (everyone touches it)
```

---

## The Contract Between Devs

Before anyone writes a line of code, you all agree on **three interfaces**. These are the contracts that let you work in parallel.

### Contract 1: Intelligence Turn API

This is how LiveKit (Dev 1) talks to Convex (Dev 2).

```
POST /api/intelligence/turn    (Convex HTTP action)

REQUEST:
{
  sessionId: string,           // Convex call session ID
  utterance: string,           // what the user just said (STT text)
  callPhase: string,           // current phase (opening, presenting, qa, booking, closing)
  isSilence: boolean,          // user didn't say anything (timeout)
  metadata: {
    callDuration: number,      // seconds since call started
    sentiment: string,         // optional: positive/neutral/negative
  }
}

RESPONSE:
{
  agentReply: string,          // what the agent should say (→ TTS)
  callPhase: string,           // updated phase
  action: string | null,       // "none" | "book" | "escalate" | "end_call" | "hold"
  actionData: object | null,   // depends on action type
  offerState: {                // current offer state for UI sync
    centers: [...],
    selectedCenterId: string | null,
  }
}
```

### Contract 2: Operator Instructions

This is how UI (Dev 3) talks to Convex (Dev 2).

```
Convex Mutation: sendOperatorInstruction

INPUT:
{
  sessionId: string,
  type: "offer_adjustment" | "free_form" | "escalate_now" | "end_call",
  payload: {
    newOfferAmount?: number,       // for offer_adjustment
    centerId?: string,             // which center to adjust
    instructionText?: string,      // for free_form
  }
}

OUTPUT:
{
  instructionId: string,
  status: "queued",                // agent will pick up on next turn
}
```

### Contract 3: Real-Time Data Queries

This is how UI (Dev 3) reads from Convex (Dev 2).

```
Convex Queries (reactive — auto-update UI):

activeSession(sessionId)       → session state, call phase, offer state
sessionTranscript(sessionId)   → all messages in order
operatorInstructions(sessionId)→ instruction history + statuses
pendingEscalations()           → all calls waiting for a human
todayStats()                   → calls made, booked, declined, escalated
callSummary(sessionId)         → post-call summary, outcome, duration
```

**Once these three contracts are agreed on, everyone can work independently.**

---

## DEV 1 — LiveKit + Twilio (Voice Pipeline)

> **Mission:** Make phones ring. Handle audio. Bridge calls to the intelligence layer.

### What Dev 1 Owns

```
Twilio account + phone numbers
Twilio SIP trunk configuration
LiveKit Cloud project
LiveKit voice agent (Python)
STT / TTS model selection + config
Turn detection
Outbound call initiation
Warm transfer mechanics
Voicemail detection
Audio quality + latency optimization
```

### Exact Tasks (In Order)

#### Phase 1 — Telephony Setup
| # | Task | Detail | Output |
|---|------|--------|--------|
| 1.1 | Create Twilio account | Purchase 1 phone number for outbound calling + SMS | Twilio Account SID, Auth Token, Phone Number |
| 1.2 | Set up Twilio Elastic SIP Trunk | Create trunk, set origination URI to LiveKit SIP endpoint, configure credentials | SIP Trunk SID, domain name |
| 1.3 | Create LiveKit Cloud project | Sign up, create project, note Project URL + SIP URI | LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET |
| 1.4 | Create LiveKit outbound SIP trunk | Register Twilio trunk with LiveKit using `outbound-trunk.json` | SIP_OUTBOUND_TRUNK_ID |
| 1.5 | Create LiveKit inbound SIP trunk | For callbacks / return calls (if needed later) | Inbound trunk ID |
| 1.6 | Test raw call | Use LiveKit CLI to place a test outbound call to your own phone — confirm audio works | ✅ Call connects, audio flows |

#### Phase 2 — Voice Agent
| # | Task | Detail | Output |
|---|------|--------|--------|
| 2.1 | Scaffold LiveKit agent project | Python project using `livekit-agents` SDK with voice pipeline | `/livekit-agent/` directory in repo |
| 2.2 | Configure STT | Deepgram plugin — low latency, good accuracy | Agent hears user speech as text |
| 2.3 | Configure TTS | Cartesia or ElevenLabs — pick a warm, professional voice | Agent speaks naturally |
| 2.4 | Configure turn detection | Silero VAD — detect when user stops talking | No interruptions, natural conversation |
| 2.5 | Implement intelligence bridge | On each user turn, call Convex HTTP endpoint (`/api/intelligence/turn`) with utterance + session context. Take the `agentReply` from response and speak it via TTS. | Agent reasoning comes from Convex |
| 2.6 | Handle call lifecycle | On call connect → notify Convex (session started). On call end → notify Convex (session ended). On silence timeout → notify Convex. | Convex always knows call state |
| 2.7 | Voicemail detection | Use LLM tool call to detect answering machines. If voicemail → play pre-recorded message → hang up → notify Convex. | Voicemails handled gracefully |

#### Phase 3 — Warm Transfer
| # | Task | Detail | Output |
|---|------|--------|--------|
| 3.1 | Implement hold | When Convex returns `action: "hold"`, place prospect in hold state with hold music/message | Prospect hears hold music |
| 3.2 | Dial human rep | When Convex returns `action: "escalate"` with rep phone number, create second SIP participant in room | Human rep's phone rings |
| 3.3 | Brief the rep | TransferAgent (from Convex) provides summary text. Speak it to rep before connecting to prospect. | Rep knows what's going on |
| 3.4 | Connect parties | Move prospect off hold, both parties in same room | Prospect + human talking |
| 3.5 | Agent exits | AI agent leaves the room after handoff | Clean exit |

#### Phase 4 — Production Hardening
| # | Task | Detail | Output |
|---|------|--------|--------|
| 4.1 | Outbound call initiation | Build endpoint that Convex can call to trigger a new outbound call: `POST /livekit/dial { prospectPhone, sessionId }` | Convex can start calls |
| 4.2 | Call recording | Enable LiveKit room recording for compliance | Recordings stored |
| 4.3 | Error handling | What happens if STT fails? TTS fails? Network hiccup? | Graceful degradation |
| 4.4 | Latency optimization | Measure end-to-end turn latency. Target: < 1.5s from user stops talking to agent starts speaking. | Performance baseline |

### What Dev 1 Gives to Others

| To | What | Format |
|----|------|--------|
| Dev 2 (You) | Twilio credentials + LiveKit credentials | Env vars in shared `.env` |
| Dev 2 (You) | Outbound call endpoint | `POST /livekit/dial { phone, sessionId }` |
| Dev 2 (You) | Call event webhooks | LiveKit room events → Convex (call started, ended, participant joined) |
| Dev 3 | Nothing direct | Everything flows through Convex |

### What Dev 1 Needs from Others

| From | What | Why |
|------|------|-----|
| Dev 2 (You) | Intelligence turn endpoint URL | Agent calls this on every user utterance |
| Dev 2 (You) | Session creation endpoint | To get a sessionId when a call starts |
| Dev 2 (You) | Escalation data (rep phone number) | To know who to dial for warm transfer |

---

## DEV 2 — Intelligence Layer / Convex (You)

> **Mission:** Be the brain. Store everything. Make all the decisions. Connect the dots.

### What You Own

```
Convex project setup + deployment
Database schema (all tables)
Convex Agent Component (SalesAgent, TransferAgent)
All tool implementations
Intelligence turn endpoint
Operator instruction handling
Call state machine
Post-call processing (summary, CRM, SMS)
Batch dialer (cron + scheduler)
All Convex queries (for UI)
All Convex mutations (for UI + LiveKit)
All Convex actions (external APIs)
```

### Exact Tasks (In Order)

#### Phase 1 — Convex Foundation
| # | Task | Detail | Output |
|---|------|--------|--------|
| 1.1 | Init Convex in repo | `npx convex init` in VoiceAgent repo, set up `convex/` directory | Convex connected to project |
| 1.2 | Define schema | All tables: prospects, centers, callSessions, callLogs, appointments, escalations, humanReps, operatorInstructions | `convex/schema.ts` |
| 1.3 | Seed center data | Populate the 3 imaging centers (Center A/B/C) with names, addresses, discounts, hours, availability | Data in DB |
| 1.4 | Seed test prospects | Create 5-10 test prospect records for development | Data in DB |
| 1.5 | Install Agent Component | `npm install @convex-dev/agents`, add to `convex.config.ts` | Agent infrastructure ready |

#### Phase 2 — Intelligence Core
| # | Task | Detail | Output |
|---|------|--------|--------|
| 2.1 | Define SalesAgent | Name, model (GPT-4o), system prompt (CVS X-ray booking script), tool list | `convex/agents.ts` |
| 2.2 | Define TransferAgent | Lighter model (GPT-4o-mini), summary prompt, no tools | `convex/agents.ts` |
| 2.3 | Implement tool: lookupCenters | Query centers table, return 3 options with pricing + distance for prospect | `convex/tools.ts` |
| 2.4 | Implement tool: checkAvailability | Query center's available slots, optionally filtered by date | `convex/tools.ts` |
| 2.5 | Implement tool: bookAppointment | Create appointment record, update prospect status, schedule confirmation SMS | `convex/tools.ts` |
| 2.6 | Implement tool: transferToHuman | Find available rep, create escalation record, return rep info to LiveKit | `convex/tools.ts` |
| 2.7 | Implement tool: markDeclined | Update prospect status to declined | `convex/tools.ts` |
| 2.8 | Implement tool: markCompleted | Update prospect status to completed (already got X-ray) | `convex/tools.ts` |
| 2.9 | Implement tool: scheduleCallback | Schedule a retry call via `ctx.scheduler.runAfter` | `convex/tools.ts` |
| 2.10 | Implement tool: sendConfirmationSms | Convex action → Twilio SMS API with appointment details | `convex/actions/sms.ts` |

#### Phase 3 — Intelligence Turn Endpoint
| # | Task | Detail | Output |
|---|------|--------|--------|
| 3.1 | Build session creation endpoint | Convex mutation: create callSession + Agent thread. Returns sessionId. Called by LiveKit when call connects. | `convex/sessions.ts` |
| 3.2 | Build intelligence turn endpoint | Convex HTTP action: receives utterance + sessionId, loads context, calls `thread.generateText()` with tools, returns agentReply + phase + action | `convex/http.ts` or `app/api/intelligence/turn` |
| 3.3 | Inject operator overrides | Before each LLM call, check operatorInstructions table for unacknowledged instructions. Inject them as system messages into the thread. | Operator instructions flow to agent |
| 3.4 | Track call phase | After each turn, evaluate and update the call phase in callSession record | State machine works |
| 3.5 | Build session end handler | When call ends: generate summary (LLM call), tag outcome, update all records | `convex/sessions.ts` |

#### Phase 4 — Operator & Scheduling
| # | Task | Detail | Output |
|---|------|--------|--------|
| 4.1 | Build operator mutations | `sendOperatorInstruction` — writes to operatorInstructions table, patches session | UI can send instructions |
| 4.2 | Build reactive queries | `activeSession`, `sessionTranscript`, `operatorInstructions`, `pendingEscalations`, `todayStats`, `callSummary` | UI can read everything |
| 4.3 | Build batch dialer | Convex cron job (every 5 min) → picks pending prospects → creates sessions → triggers LiveKit outbound calls via action | Automated dialing |
| 4.4 | Build retry logic | Voicemail / no-answer → schedule retry via `ctx.scheduler.runAfter` respecting max attempts + business hours | Smart retries |
| 4.5 | Build callback scheduler | When human rep unavailable → schedule callback in 30-60 min | No dropped escalations |
| 4.6 | Build stale call cleanup | Cron job (every 15 min) → find in_progress sessions older than 30 min → mark as failed | No zombie sessions |
| 4.7 | Build daily report | Cron job (end of day) → aggregate stats → store report | Analytics ready |

#### Phase 5 — CRM + Polish
| # | Task | Detail | Output |
|---|------|--------|--------|
| 5.1 | CRM sync action | Convex action → push outcomes to Salesforce/HubSpot API | External CRM updated |
| 5.2 | SMS reminder | Scheduled function → send reminder SMS day before appointment | Patient reminded |
| 5.3 | DNC handling | If user says "do not call" → tool updates prospect → blocks future dials | Compliance |
| 5.4 | Prompt tuning | Iterate on SalesAgent prompt based on real call transcripts | Better conversations |

### What You Give to Others

| To | What | Format |
|----|------|--------|
| Dev 1 | Intelligence turn endpoint URL | `POST {CONVEX_URL}/intelligence/turn` |
| Dev 1 | Session create/end endpoints | Convex HTTP actions |
| Dev 1 | Escalation response (rep phone) | Returned in turn response `actionData` |
| Dev 3 | All Convex query function references | `api.dashboard.activeSession`, etc. |
| Dev 3 | All Convex mutation function references | `api.operator.sendInstruction`, etc. |
| Dev 3 | TypeScript types for all data shapes | Convex generates these automatically |
| Both | Environment variables | CONVEX_URL, deployment info |

### What You Need from Others

| From | What | Why |
|------|------|-----|
| Dev 1 | Twilio creds (for SMS actions) | To send confirmation/reminder texts |
| Dev 1 | LiveKit creds + outbound call endpoint | To trigger calls from batch dialer |
| Dev 1 | Call event webhooks | To know when calls start/end/transfer |
| Dev 3 | Nothing | You define the API, they consume it |

---

## DEV 3 — UI (Operator Console)

> **Mission:** Make the existing UI real. Replace stubs with Convex. Build the operator experience.

### What Dev 3 Owns

```
Convex React client integration
Replace Zustand server state → Convex hooks
CallStarterPanel → real call initiation
TranscriptViewer → real-time from Convex
AgentControlPanel → real operator instructions
CallSummaryPanel → real post-call data
Escalation queue view (new)
Stats dashboard (new)
Human rep join-call flow (new)
Responsive design + polish
```

### Exact Tasks (In Order)

#### Phase 1 — Convex Client Setup
| # | Task | Detail | Output |
|---|------|--------|--------|
| 1.1 | Install Convex React | `npm install convex`, wrap app in `ConvexProvider` | Convex client connected |
| 1.2 | Connect to deployment | Set `NEXT_PUBLIC_CONVEX_URL` in `.env.local` | App talks to Convex |
| 1.3 | Audit Zustand store | Identify which state is server-synced (→ Convex) vs UI-only (→ keep Zustand) | Clear migration plan |
| 1.4 | Create Convex hooks file | Centralized file with all `useQuery` and `useMutation` hooks used across components | `lib/convex-hooks.ts` |

#### Phase 2 — Replace Stubs with Real Data
| # | Task | Detail | Output |
|---|------|--------|--------|
| 2.1 | CallStarterPanel | Replace stub API call with Convex mutation: `startCall({ phone, callType, baseOffer })`. This creates a prospect (or finds existing) + triggers a call session. | Real call initiation |
| 2.2 | TranscriptViewer | Replace simulated messages with `useQuery(api.dashboard.sessionTranscript, { sessionId })`. Messages auto-update as they're added by intelligence layer. | Real-time transcript |
| 2.3 | CallStatusBar | Replace local state with `useQuery(api.dashboard.activeSession, { sessionId })`. Shows real call phase, duration, status. End call button calls Convex mutation. | Real call status |
| 2.4 | AgentControlPanel — Offers | Replace stub with `useMutation(api.operator.sendInstruction)` with type `"offer_adjustment"`. Read current offer state from session query. | Real offer adjustments |
| 2.5 | AgentControlPanel — Instructions | Replace stub with `useMutation(api.operator.sendInstruction)` with type `"free_form"`. Show instruction history from `useQuery(api.dashboard.operatorInstructions)`. | Real agent instructions |
| 2.6 | CallSummaryPanel | Replace stub with `useQuery(api.dashboard.callSummary, { sessionId })`. Shows real outcome, duration, discount, transcript download. | Real post-call summary |

#### Phase 3 — New Views
| # | Task | Detail | Output |
|---|------|--------|--------|
| 3.1 | Escalation queue | New component: `useQuery(api.dashboard.pendingEscalations)`. Shows all calls waiting for a human with context. "Join Call" button. | Reps see what needs attention |
| 3.2 | Rep join-call flow | When rep clicks "Join Call" → Convex mutation assigns rep → UI shows transcript + briefing → rep confirms → signal sent to LiveKit (via Convex) | Human can take over |
| 3.3 | Stats dashboard | New component: `useQuery(api.dashboard.todayStats)`. Cards showing: calls made, booked, declined, escalated, conversion rate. | Manager has visibility |
| 3.4 | Call history / list | New component: list of past calls with outcome tags, duration, links to transcripts. Filterable by outcome, date. | Historical view |
| 3.5 | Prospect queue view | Show upcoming prospects to be dialed with status. Allow manual dial override. | Operator can see the queue |

#### Phase 4 — Polish
| # | Task | Detail | Output |
|---|------|--------|--------|
| 4.1 | Loading states | Skeleton loaders while Convex queries hydrate | Smooth UX |
| 4.2 | Error handling | What happens if Convex is down? Call fails? Show user-friendly errors. | Resilient UI |
| 4.3 | Notifications | Browser notifications when escalation comes in (for reps) | Reps don't miss escalations |
| 4.4 | Mobile responsive | Test and fix stacked layout on mobile for reps on the go | Works on phone/tablet |
| 4.5 | Keyboard shortcuts | Quick keys: E = escalate, Enter = send instruction, etc. | Operator efficiency |

### What Dev 3 Needs from Others

| From | What | Why |
|------|------|-----|
| Dev 2 (You) | Convex query/mutation function names + types | To wire up `useQuery` / `useMutation` |
| Dev 2 (You) | Convex deployment URL | To configure the client |
| Dev 2 (You) | Data shape docs (or just rely on Convex generated types) | To build UI components |
| Dev 1 | Nothing direct | Everything flows through Convex |

### What Dev 3 Gives to Others

| To | What | Format |
|----|------|--------|
| Dev 2 (You) | UI requirements for queries | "I need X data in Y shape for this component" |
| Dev 1 | Nothing | Everything flows through Convex |

---

## Dependency Map — Who Blocks Whom

```
WEEK 1-2: FOUNDATION (mostly independent)
──────────────────────────────────────────

Dev 1 (LiveKit)              Dev 2 (You/Convex)          Dev 3 (UI)
  │                            │                           │
  ├── Twilio account           ├── Convex init             ├── Install Convex React
  ├── SIP trunk setup          ├── Schema design           ├── Audit Zustand store
  ├── LiveKit project          ├── Seed data               ├── Plan component migration
  ├── Test raw call            ├── Agent Component setup   │
  │                            ├── Core tools              │
  │                            │                           │
  │                        ★ HANDOFF ★                     │
  │                      Contracts agreed                  │
  │                      (turn API, queries, mutations)    │
  │                            │                           │

WEEK 3-4: CORE INTEGRATION (parallel with contracts)
──────────────────────────────────────────

Dev 1 (LiveKit)              Dev 2 (You/Convex)          Dev 3 (UI)
  │                            │                           │
  ├── Voice agent scaffold     ├── Intelligence turn       ├── Replace stubs with
  ├── STT + TTS config         │   endpoint                │   Convex hooks
  ├── Intelligence bridge ────►├── Session create/end      ├── Real transcript
  │   (calls Convex turn)      ├── Operator instructions   ├── Real offer controls
  │                            ├── Reactive queries ──────►├── Real call status
  │                            │                           │
  │                            │                           │

WEEK 5-6: ESCALATION + SCHEDULING
──────────────────────────────────────────

Dev 1 (LiveKit)              Dev 2 (You/Convex)          Dev 3 (UI)
  │                            │                           │
  ├── Warm transfer ◄─────────├── Escalation logic        ├── Escalation queue
  ├── Hold + dial rep          ├── Batch dialer            ├── Rep join flow
  ├── Voicemail detection      ├── Retry scheduler         ├── Stats dashboard
  │                            ├── SMS actions             │
  │                            │                           │

WEEK 7-8: END TO END + POLISH
──────────────────────────────────────────

Dev 1 (LiveKit)              Dev 2 (You/Convex)          Dev 3 (UI)
  │                            │                           │
  ├── Latency tuning           ├── CRM sync               ├── Polish + loading
  ├── Error handling           ├── Prompt tuning           ├── Notifications
  ├── Call recording           ├── Daily reports           ├── Mobile responsive
  │                            │                           │
  └────────────────────────────┴───────────────────────────┘
                               │
                        ★ END TO END TEST ★
                      First real phone call
```

---

## Critical Path — What Blocks Everything

```
1. CONTRACT AGREEMENT (Day 1-2)
   All 3 devs agree on:
   ├── Intelligence turn request/response shape
   ├── Convex query names + return types
   ├── Convex mutation names + args
   └── LiveKit → Convex webhook events

   ⚠️ IF THIS SLIPS → EVERYONE IS BLOCKED

2. CONVEX SCHEMA + BASIC QUERIES (Week 1)
   Dev 2 must ship schema + seed data + basic queries
   └── Dev 3 is blocked on wiring UI without these

3. INTELLIGENCE TURN ENDPOINT (Week 2-3)
   Dev 2 must ship the turn endpoint
   └── Dev 1 is blocked on making the agent "smart"
       (can scaffold and test audio without it, but can't
        have a real conversation)

4. LIVEKIT OUTBOUND CALL ENDPOINT (Week 2-3)
   Dev 1 must ship the "dial a number" endpoint
   └── Dev 2 is blocked on batch dialer without this
```

---

## Shared Responsibilities

Some things don't belong to one person — they need collaboration.

| Responsibility | Who's Involved | How |
|---------------|---------------|-----|
| **Prompt engineering** | Dev 2 leads, all review | Dev 2 writes SalesAgent prompt. All 3 listen to test calls and suggest improvements. |
| **End-to-end testing** | All 3 | Dev 1 starts a call → Dev 2's intelligence responds → Dev 3 watches it in the UI |
| **Environment variables** | All 3 contribute | Shared `.env.example` with all required vars. Each dev adds their service's vars. |
| **Error handling across boundaries** | All 3 | What happens when Convex is slow? LiveKit drops? UI loses connection? Each dev handles their failure mode. |
| **Demo / walkthrough** | All 3 | Weekly sync: each dev demos what they've built that week |

---

## Communication Protocol

```
DAILY:
  • Quick async check-in (Slack/Discord): "what I'm working on, any blockers"

WEEKLY:
  • 30 min sync call: demo progress, discuss issues, adjust priorities

CONTRACTS:
  • Any change to the turn API / query shapes / mutation args
    → MUST be discussed before changing
    → Update the contract doc
    → Notify other devs

BRANCHING:
  • Main branch = stable
  • Feature branches: livekit/*, convex/*, ui/*
  • PRs reviewed by at least one other dev before merge
  • Dev 2 (You) reviews anything touching convex/
  • Dev 1 reviews anything touching livekit-agent/
  • Dev 3 reviews anything touching components/
```

---

## Quick Reference: "Who Do I Ask?"

| If you're stuck on... | Ask |
|----------------------|-----|
| "The call won't connect" | Dev 1 |
| "The agent is saying weird things" | Dev 2 |
| "The transcript isn't updating" | Dev 3 first (UI binding), then Dev 2 (query issue) |
| "Operator instruction isn't reaching the agent" | Dev 2 |
| "The offer change isn't reflected in the call" | Dev 2 (is it in the DB?) → Dev 1 (is the agent reading it?) |
| "The warm transfer isn't working" | Dev 1 (audio/SIP) + Dev 2 (escalation logic) |
| "SMS didn't send" | Dev 2 (Convex action) + check Twilio logs |
| "The dashboard numbers look wrong" | Dev 3 (query binding) → Dev 2 (query logic) |
