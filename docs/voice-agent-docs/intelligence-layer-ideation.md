# Intelligence Layer Design — Ideation Doc
## CVS X-Ray Booking Voice Agent

**Status:** Ideation / Draft
**Last Updated:** February 21, 2026
**Repo:** [github.com/Vamshi900/VoiceAgent](https://github.com/Vamshi900/VoiceAgent)

---

## 1. What We Already Have (Current State)

The VoiceAgent repo is a **Next.js 14 front-end console** with a well-thought-out operator UX. Here's what exists today:

| Layer | What's Built | Status |
|-------|-------------|--------|
| **UI — Call Starter** | Phone number input, call type selector (Feedback / Promotional), base offer amount | ✅ Built |
| **UI — Live Transcript** | Real-time transcript viewer (agent / customer / system / operator messages) | ✅ Built |
| **UI — Human-in-the-Loop Controls** | Offer adjustment panel, free-form agent instructions, instruction history | ✅ Built |
| **UI — Call Summary** | Post-call outcome, duration, discount code, SMS/transcript buttons | ✅ Built |
| **State Management** | Zustand store managing call session, transcript, offers, instructions | ✅ Built |
| **API Stubs** | `/api/calls/outbound`, `/api/calls/:id/instructions`, `/api/intelligence/turn` | 🟡 Stubbed |
| **Realtime Simulator** | `lib/realtime.ts` — simulates call events and a short agent/customer conversation | 🟡 Simulated |
| **Intelligence Layer** | `lib/intelligence.ts` + stub route — parses utterance, picks option on keyword match | 🟡 Stubbed |
| **Telephony (Twilio)** | Not connected | ❌ Not built |
| **Voice AI (LiveKit / MiniMax)** | Not connected | ❌ Not built |
| **Backend Brain (Convex)** | Not connected | ❌ Not built |

**Key insight:** The front-end is solid. The operator workflow and UX are ready. What's missing is the entire intelligence + telephony backbone.

---

## 2. The Use Case: CVS X-Ray Booking Call

### The Scenario
A CVS-marketed user needs an X-ray. The AI agent calls them outbound and presents three imaging center options:

| Option | Center | Discount | Distance | Pitch Angle |
|--------|--------|----------|----------|-------------|
| **A** | Center A | $0 | Closest | Convenience — "in and out" |
| **B** | Center B | $10 off | ~10 miles | Balance — "save a bit, not too far" |
| **C** | Center C | $50 off | ~25 miles | Savings — "biggest discount, worth the drive" |

### The Call Flow (Happy Path)

```
OPEN → Verify identity → Disclose AI caller
  ↓
PRESENT OPTIONS → A (close, no discount) / B (medium, $10) / C (far, $50)
  ↓
HANDLE QUESTIONS → Pricing? Referral? Hours? Insurance?
  ↓
USER SELECTS → Check availability at chosen center
  ↓
BOOK → Confirm date/time/address/discount → Lock appointment
  ↓
CLOSE → Send confirmation SMS → Log everything → Update CRM
```

### The Escalation Paths

```
USER ASKS SOMETHING CRAZY
  → "Can I get the $50 discount at the close center?"
  → "I want to pay in installments"
  → "My doctor said I need an MRI not an X-ray"
  → Agent can't resolve in 2-3 turns
  ↓
HUMAN IN THE LOOP
  → Agent: "Let me connect you with a specialist..."
  → Place on hold → Brief human rep → Warm transfer
  ↓
CLOSE THE LOOP
  → Whether AI or human resolved it → full transcript + summary + CRM update
```

---

## 3. The Intelligence Layer — What It Needs To Do

The intelligence layer is the **brain** that sits between the voice pipeline (what the user says / hears) and the data layer (prospects, centers, appointments). It makes decisions, tracks state, and drives the conversation.

### 3.1 Core Responsibilities

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTELLIGENCE LAYER                            │
│                    (Convex Backend)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. CONVERSATION STATE       "Where are we in the call?"        │
│     → Track call phase (opening, presenting, Q&A, booking,     │
│       closing, escalation)                                      │
│     → Maintain thread/message history per call                  │
│                                                                 │
│  2. DECISION MAKING          "What should the agent say/do?"    │
│     → Given user utterance + call state + prospect data         │
│       → decide: respond / ask question / present options /      │
│         book / escalate                                         │
│                                                                 │
│  3. TOOL EXECUTION           "Do something in the real world"   │
│     → Look up centers for this prospect                         │
│     → Check appointment availability                            │
│     → Book the appointment                                      │
│     → Send confirmation SMS                                     │
│     → Transfer to human                                         │
│     → Mark declined / completed / DNC                           │
│                                                                 │
│  4. MEMORY & CONTEXT         "What do we know?"                 │
│     → Prospect profile (name, phone, zip, insurance)            │
│     → Past call attempts & outcomes                             │
│     → Current offer state (which centers, which discounts)      │
│     → Operator overrides (adjusted offer, custom instructions)  │
│                                                                 │
│  5. OPERATOR INTEGRATION     "Human-in-the-loop controls"       │
│     → Receive real-time instructions from operator panel        │
│     → Apply offer adjustments mid-call                          │
│     → Trigger escalation on operator command                    │
│                                                                 │
│  6. POST-CALL PROCESSING     "Close the loop"                   │
│     → Generate call summary                                     │
│     → Tag outcome                                               │
│     → Update prospect record                                    │
│     → Sync to external CRM                                      │
│     → Schedule follow-ups if needed                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 The "Turn" — Core Intelligence Loop

Every conversation is a series of **turns**. Each turn goes through the intelligence layer:

```
USER SAYS SOMETHING (via voice → STT → text)
        │
        ▼
┌──────────────────────────────────────────┐
│  INTELLIGENCE TURN                        │
│                                          │
│  Input:                                  │
│    • userUtterance (text)                │
│    • callPhase (opening/presenting/etc.) │
│    • prospectProfile                     │
│    • conversationHistory (thread)        │
│    • offerState (current centers/prices) │
│    • operatorInstructions (if any)       │
│                                          │
│  Processing:                             │
│    1. Append to conversation history     │
│    2. Check for operator overrides       │
│    3. LLM reasons over full context      │
│    4. LLM decides: respond / tool call   │
│    5. If tool call → execute & feed back │
│    6. Generate agent response text       │
│    7. Update call phase if needed        │
│    8. Check escalation triggers          │
│                                          │
│  Output:                                 │
│    • agentReplyText (→ TTS → user hears) │
│    • updatedCallPhase                    │
│    • toolCallResults (if any)            │
│    • escalate (boolean + reason)         │
│    • updatedMemory                       │
│                                          │
└──────────────────────────────────────────┘
        │
        ▼
AGENT SAYS SOMETHING (text → TTS → voice)
```

This maps directly to the existing `/api/intelligence/turn` stub in the repo. The stub currently does keyword matching — the real version will use Convex Agent threads + LLM reasoning.

---

## 4. Convex as the Intelligence Layer — How It Fits

### 4.1 Why Convex for This?

| What We Need | What Convex Gives Us |
|-------------|---------------------|
| Store & retrieve prospect data mid-call | Reactive database with low-latency reads |
| Persist conversation history across turns | Agent Component — automatic thread/message management |
| LLM-powered decision making with tools | Agent Component — tool calling with any AI SDK model |
| Real-time UI updates (transcript, status) | Reactive queries — UI auto-updates on DB change |
| Operator sends instruction → agent gets it instantly | Mutations + reactive subscriptions = real-time |
| Schedule retries, callbacks, reminders | Scheduler (runAfter, runAt) + Cron Jobs |
| Orchestrate multi-step call workflows | Workflows component for durable execution |
| Call external APIs (Twilio SMS, LiveKit, CRM) | Actions (serverless functions with network access) |

### 4.2 Convex Data Model (Conceptual)

```
TABLES:
─────────────────────────────────────────────────────────

prospects
  ├── identity (name, phone, zip, insurance)
  ├── status (pending → in_progress → booked/declined/etc.)
  ├── call history (attempts, last called, outcomes)
  └── assigned center (after booking)

centers
  ├── info (name, address, hours, phone)
  ├── pricing (base price, discount amount)
  ├── distance tier (close / medium / far)
  └── availability (date → time slots)

callSessions
  ├── prospect reference
  ├── agent thread ID (Convex Agent Component)
  ├── call phase (opening → presenting → Q&A → booking → closing)
  ├── offer state (which centers presented, current offer amounts)
  ├── operator overrides (adjusted amounts, custom instructions)
  ├── voice session refs (LiveKit room ID, Twilio call SID)
  └── timestamps (started, ended, duration)

callLogs
  ├── session reference
  ├── outcome tag
  ├── full transcript
  ├── AI-generated summary
  └── escalation details (if any)

appointments
  ├── prospect + center reference
  ├── date / time
  ├── status (confirmed → completed / cancelled / no-show)
  └── confirmation & reminder SMS status

escalations
  ├── session reference
  ├── reason + transcript snapshot
  ├── status (pending → assigned → resolved)
  └── human rep assignment

operatorInstructions
  ├── session reference
  ├── instruction text
  ├── type (offer_adjustment / free_form / escalate)
  ├── status (sent → acknowledged → applied)
  └── timestamp

CONVEX AGENT THREADS (managed by Agent Component):
─────────────────────────────────────────────────────────

  One thread per call session
  ├── All messages (user utterances, agent replies, system messages)
  ├── Tool call history
  ├── Vector-searchable for context retrieval
  └── Handed off between agents (SalesAgent → TransferAgent)
```

### 4.3 The Agents

**Sales Agent** — Primary agent on every call
- Prompt: CVS X-ray booking specialist persona
- Model: GPT-4o (or Claude Sonnet for cost efficiency)
- Tools: lookupCenters, checkAvailability, bookAppointment, sendConfirmationSms, transferToHuman, markDeclined, markCompleted, scheduleCallback
- Behavior: Follows the call script, adapts to user responses, checks for operator overrides each turn

**Transfer Agent** — Only active during escalation
- Prompt: Brief the human rep with context
- Model: GPT-4o-mini (fast, cheap — just summarizing)
- Tools: none (just generates a summary for the rep)
- Behavior: Reads the full thread, produces a concise handoff brief

### 4.4 Operator ↔ Agent Communication (Real-Time)

This is one of the coolest parts of the existing UI — the operator can adjust offers and send instructions **mid-call**. Here's how it flows with Convex:

```
OPERATOR (React UI)                         CONVEX                           AGENT (on call)
       │                                      │                                  │
       │  "Change offer to $50"                │                                  │
       ├──── mutation: insertInstruction ──────►│                                  │
       │                                      │  writes to operatorInstructions   │
       │                                      │  table + patches callSession      │
       │                                      │                                  │
       │                                      │  ◄── next intelligence turn ──────┤
       │                                      │                                  │
       │                                      │  Agent thread reads:              │
       │                                      │  "Operator says: increase offer   │
       │                                      │   to $50 for Center B"            │
       │                                      │                                  │
       │                                      │  LLM incorporates instruction     │
       │                                      │  ────► agentReply: "Actually,     │
       │                                      │        I can offer you $50 off    │
       │                                      │        at Center B..."            │
       │                                      │                                  │
       │  ◄── reactive query: UI updates ─────│                                  │
       │  (transcript, offer state, status)    │                                  │
```

Because Convex queries are **reactive**, the operator's UI auto-updates as the call progresses — no polling, no WebSocket plumbing.

---

## 5. System Integration Map

### What Connects to What

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXISTING (VoiceAgent Repo)                    │
│                                                                 │
│  Next.js UI ──── Zustand Store ──── Stub API Routes             │
│  (Console)       (Call State)       (/api/calls, /api/intel)    │
└───────┬──────────────────┬─────────────────┬────────────────────┘
        │                  │                 │
        │  REPLACE WITH    │  REPLACE WITH   │  REPLACE WITH
        │                  │                 │
        ▼                  ▼                 ▼
┌───────────────┐  ┌──────────────┐  ┌──────────────────────────┐
│ Convex React  │  │ Convex DB    │  │ Convex Functions         │
│ Client        │  │ (reactive    │  │                          │
│               │  │  tables)     │  │  Queries (dashboard)     │
│ useQuery()    │  │              │  │  Mutations (book, update) │
│ useMutation() │  │  prospects   │  │  Actions (Twilio, LK)    │
│               │  │  centers     │  │  Agents (Sales, Transfer)│
│ replaces      │  │  sessions    │  │  Scheduler (retries)     │
│ Zustand for   │  │  callLogs    │  │  Crons (batch dial)      │
│ server state  │  │  etc.        │  │                          │
└───────┬───────┘  └──────────────┘  └──────────┬───────────────┘
        │                                       │
        │          CONVEX ACTIONS CALL           │
        │          EXTERNAL SERVICES             │
        │                                       │
        │              ┌────────────────────────┐│
        │              │                        ││
        │              ▼                        ▼│
        │      ┌──────────────┐         ┌──────────────┐
        │      │   Twilio     │         │   LiveKit    │
        │      │              │         │              │
        │      │ • Outbound   │   SIP   │ • Voice AI   │
        │      │   calls      │◄───────►│   Agent      │
        │      │ • SMS        │  Trunk  │ • Rooms      │
        │      │ • Phone #s   │         │ • STT/TTS    │
        │      └──────────────┘         │ • Warm       │
        │                               │   Transfer   │
        │                               └──────────────┘
        │
        │      ┌──────────────┐
        │      │ External CRM │
        │      │ (Salesforce / │
        └─────►│  HubSpot)    │
               └──────────────┘
```

### Migration Path from Stubs → Real

| Current Stub | Replaced By | Notes |
|-------------|-------------|-------|
| `lib/realtime.ts` (simulator) | Convex reactive queries + subscriptions | UI auto-updates when DB changes |
| `lib/store/callStore.ts` (Zustand) | Convex useQuery/useMutation for server state; keep Zustand for UI-only state (panel open/closed, etc.) | Hybrid approach |
| `/api/calls/outbound` (stub) | Convex action → Twilio + LiveKit | Real outbound call |
| `/api/calls/:id/instructions` (stub) | Convex mutation → operatorInstructions table | Agent reads on next turn |
| `/api/intelligence/turn` (stub) | Convex Agent thread.generateText() with tools | Full LLM reasoning |
| Keyword matching for option selection | LLM tool call: `bookAppointment(centerId, date, time)` | Real decision making |

---

## 6. What We Need to Make This Work

### 6.1 Accounts & Services

| Service | What For | Cost Tier |
|---------|----------|-----------|
| **Convex** | Backend brain — DB, agents, scheduling, real-time | Free tier → Pro |
| **Twilio** | Phone numbers, outbound calls, SMS, SIP trunking | Pay-per-use (~$0.014/min voice, $0.0079/SMS) |
| **LiveKit Cloud** | Voice AI agent hosting, SIP bridge, rooms | Free tier → Growth |
| **OpenAI** | GPT-4o for agent reasoning | Pay-per-use (~$2.50/1M input tokens) |
| **Deepgram** | Speech-to-text (low latency) | Pay-per-use (~$0.0043/min) |
| **Cartesia / ElevenLabs** | Text-to-speech (natural voice) | Pay-per-use |
| **CRM (optional)** | Salesforce / HubSpot for lead sync | Existing account |

### 6.2 Environment Variables Needed

```
# Convex
CONVEX_DEPLOYMENT=...
NEXT_PUBLIC_CONVEX_URL=...

# Twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...

# LiveKit
LIVEKIT_URL=...
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
SIP_OUTBOUND_TRUNK_ID=...

# AI Models
OPENAI_API_KEY=...
DEEPGRAM_API_KEY=...
CARTESIA_API_KEY=... (or ELEVEN_API_KEY)

# CRM (optional)
SALESFORCE_CLIENT_ID=...
SALESFORCE_CLIENT_SECRET=...
```

### 6.3 Infrastructure Setup Steps

```
1. CONVEX SETUP
   ├── npx convex init (in VoiceAgent repo)
   ├── Define schema (tables above)
   ├── Install @convex-dev/agents component
   ├── Define SalesAgent + TransferAgent
   ├── Implement tools (mutations/queries)
   ├── Set up cron jobs (batch dialer, cleanup)
   └── Wire React client (useQuery, useMutation)

2. TWILIO SETUP
   ├── Purchase phone number
   ├── Create Elastic SIP Trunk
   ├── Configure origination URI → LiveKit SIP endpoint
   ├── Set up credentials for SIP auth
   └── Configure SMS capabilities

3. LIVEKIT SETUP
   ├── Create LiveKit Cloud project
   ├── Create inbound SIP trunk (for Twilio → LiveKit)
   ├── Create outbound SIP trunk (for LiveKit → Twilio → PSTN)
   ├── Set up dispatch rules
   ├── Deploy voice agent (Python):
   │   ├── STT: Deepgram
   │   ├── LLM: OpenAI GPT-4o
   │   ├── TTS: Cartesia
   │   └── Turn detection: Silero
   └── Test with LiveKit Agent Playground

4. CONNECT THE DOTS
   ├── Convex action triggers LiveKit outbound call
   ├── LiveKit agent reads/writes to Convex via HTTP actions
   ├── Agent calls Convex intelligence turn on each utterance
   ├── Convex Agent Component manages thread/memory
   ├── Operator UI reads from Convex reactive queries
   ├── Operator writes instructions via Convex mutations
   └── Post-call: Convex action sends SMS, updates CRM
```

---

## 7. The Call State Machine

Every call moves through defined phases. The intelligence layer tracks this.

```
                    ┌─────────┐
                    │ PENDING │  (in queue, not yet dialed)
                    └────┬────┘
                         │ batch dialer picks up
                         ▼
                    ┌─────────┐
                    │ DIALING │  (Twilio placing call)
                    └────┬────┘
                    ┌────┴─────────────┐
                    │                  │
                    ▼                  ▼
              ┌───────────┐    ┌────────────┐
              │ VOICEMAIL │    │ CONNECTED  │
              └───────────┘    └─────┬──────┘
                                     │ verify identity
                                     ▼
                               ┌───────────┐
                               │ OPENING   │  "Hi, is this {name}?"
                               └─────┬─────┘
                              ┌──────┴───────┐
                              │              │
                              ▼              ▼
                      ┌────────────┐  ┌──────────┐
                      │ WRONG      │  │PRESENTING│  present 3 options
                      │ PERSON     │  └────┬─────┘
                      └────────────┘       │
                                           ▼
                                    ┌────────────┐
                                    │   Q & A    │  handle questions
                                    └──────┬─────┘
                              ┌────────────┼────────────┐
                              │            │            │
                              ▼            ▼            ▼
                       ┌──────────┐ ┌──────────┐ ┌───────────┐
                       │ DECLINED │ │ BOOKING  │ │ ESCALATION│
                       └──────────┘ └────┬─────┘ └─────┬─────┘
                                         │             │
                                         ▼             ▼
                                   ┌──────────┐ ┌───────────┐
                                   │ CONFIRM  │ │ HUMAN ON  │
                                   └────┬─────┘ │ THE LINE  │
                                        │       └─────┬─────┘
                                        │             │
                                        ▼             ▼
                                   ┌─────────────────────┐
                                   │     CLOSING         │
                                   │  (summary, CRM,     │
                                   │   SMS, log)         │
                                   └─────────────────────┘
```

---

## 8. Escalation Triggers — Decision Matrix

The agent needs clear rules for when to escalate vs. handle itself.

| Signal | Confidence | Action |
|--------|-----------|--------|
| User explicitly says "talk to a person / human / representative" | **100%** | Escalate immediately |
| User is angry / using profanity / raised voice | **High** | Escalate after 1 de-escalation attempt |
| User asks for something outside scope (MRI, surgery, billing dispute) | **High** | Escalate — agent can't handle |
| User wants a discount at a different center than offered | **Medium** | Try to redirect 1-2 times, then escalate |
| User asks complex insurance questions | **Medium** | Answer if possible, escalate if unsure |
| User is confused / keeps repeating / misunderstands | **Medium** | Rephrase 2x, then escalate |
| User asks about payment plans / financing | **Medium** | Escalate — agent doesn't have authority |
| User mentions legal concerns | **High** | Escalate immediately |
| Conversation has gone 3+ turns without progress | **Medium** | Escalate with "let me get someone who can help" |
| Operator sends escalation command | **100%** | Escalate immediately |

---

## 9. Open Questions for Ideation

### Product Questions
1. **Which voice?** Male or female? Formal or casual? Do we want a named persona ("Hi, I'm Sarah from CVS")?
2. **AI disclosure:** What exact wording for the "I'm an AI" disclosure? Required in several states.
3. **Multi-language?** Do we need Spanish or other language support from day one?
4. **Call hours:** What hours can we dial? TCPA limits vary by state. Convex cron jobs need to respect this.
5. **Retry logic:** How many attempts before giving up? Current schema has `maxAttempts` — what's the right number? How long between retries?

### Technical Questions
6. **LiveKit vs. MiniMax:** The repo mentions MiniMax as the voice agent. Are we switching to LiveKit Agents for the voice pipeline, or keeping MiniMax and just using Convex for the brain?
7. **Convex Agent Component vs. raw actions:** Should the LLM reasoning happen inside Convex (via Agent Component) or in the LiveKit agent (Python) with Convex as just the DB? Trade-offs:
   - **Option A: LLM in Convex** — Agent Component manages everything. LiveKit just handles audio. Simpler architecture, but adds a network hop (LiveKit → Convex → LLM → Convex → LiveKit).
   - **Option B: LLM in LiveKit** — LiveKit Python agent does STT → LLM → TTS natively. Convex provides data + memory + tools via HTTP. Lower latency, but split brain.
   - **Option C: Hybrid** — LiveKit handles real-time voice + basic responses. Convex handles tool execution + state + complex decisions. LLM runs in LiveKit but calls Convex tools.
8. **Operator concurrency:** Can one operator monitor multiple calls? How do we handle the queue?
9. **Center data source:** Is availability pulled from a real booking system, or managed in our DB?
10. **SMS provider:** Twilio for SMS too, or a separate service?

### Business Questions
11. **Cost per call target:** What's the acceptable cost? (Rough estimate: $0.05–0.15 per call for AI-only, more with human escalation)
12. **Volume:** How many calls per day? 100? 1,000? 10,000? This affects infrastructure choices.
13. **Success metric:** Is it booking rate? Cost per booking? Patient satisfaction?

---

## 10. Recommended Architecture (Option C — Hybrid)

After thinking through the trade-offs, here's the recommended approach:

```
┌──────────────────────────────────────────────────┐
│ LiveKit Agent (Python)                            │
│                                                  │
│  Handles: Real-time audio, STT, TTS, turn        │
│  detection, basic conversation flow               │
│                                                  │
│  On each user turn:                              │
│    1. STT converts speech → text                 │
│    2. Agent calls Convex HTTP action:            │
│       POST /api/intelligence/turn                │
│       { utterance, sessionId, callPhase }        │
│    3. Convex returns: agentReply, tools, phase   │
│    4. TTS converts reply → speech                │
│    5. Agent speaks to user                       │
│                                                  │
│  LiveKit owns: audio quality, latency,           │
│  turn detection, warm transfer mechanics          │
└──────────────┬───────────────────────────────────┘
               │
               │  HTTP (each turn)
               ▼
┌──────────────────────────────────────────────────┐
│ Convex (Intelligence Layer)                       │
│                                                  │
│  Handles: All reasoning, state, memory, tools,   │
│  operator integration, post-call processing       │
│                                                  │
│  On each turn:                                   │
│    1. Load prospect + session + operator state    │
│    2. Agent Component: thread.generateText()     │
│       with full context + tools                  │
│    3. LLM decides: respond / tool call / escalate│
│    4. Execute tools transactionally              │
│    5. Return agent reply + updated state          │
│                                                  │
│  Convex owns: data, decisions, memory,           │
│  CRM sync, scheduling, operator controls          │
└──────────────────────────────────────────────────┘
               │
               │  Reactive queries
               ▼
┌──────────────────────────────────────────────────┐
│ Next.js UI (Existing VoiceAgent Repo)             │
│                                                  │
│  Handles: Operator console, real-time transcript, │
│  offer controls, call management                  │
│                                                  │
│  Convex React hooks replace Zustand for           │
│  server-synced state. Zustand kept for            │
│  UI-only state (panel toggles, etc.)              │
└──────────────────────────────────────────────────┘
```

**Why Hybrid?**
- LiveKit handles what it's best at: low-latency audio, turn detection, SIP
- Convex handles what it's best at: state, reasoning, real-time sync, tools, scheduling
- The `/api/intelligence/turn` contract already exists in the repo — we just make it real
- Operator controls work naturally through Convex reactive queries
- Everything is durable — if the LiveKit agent crashes mid-call, Convex has the full state to resume or log

---

## 11. Next Steps

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 1 | Decide on open questions (especially #6, #7) | Team | 🔴 Blocker |
| 2 | Set up Convex in VoiceAgent repo (`npx convex init`) | Dev | High |
| 3 | Define Convex schema (tables above) | Dev | High |
| 4 | Implement SalesAgent with Convex Agent Component | Dev | High |
| 5 | Build tools (lookupCenters, bookAppointment, etc.) | Dev | High |
| 6 | Replace `/api/intelligence/turn` stub with Convex action | Dev | High |
| 7 | Set up Twilio account + SIP trunk | Dev | High |
| 8 | Set up LiveKit Cloud + voice agent | Dev | High |
| 9 | Wire Convex React client into existing UI | Dev | Medium |
| 10 | Build batch dialer (Convex cron + scheduler) | Dev | Medium |
| 11 | Implement warm transfer flow | Dev | Medium |
| 12 | Test end-to-end with real phone call | Team | High |
| 13 | Tune prompts with real call recordings | Team | Ongoing |

---

*This is an ideation document. No code yet — just the thinking. Let's align on the open questions before we build.*
