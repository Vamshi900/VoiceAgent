# Intelligence Platform — Input / Output Spec
## What Goes In, What Comes Out

**Owner:** Dev 2 (You)
**Last Updated:** February 21, 2026

---

## The Big Picture

Your intelligence platform has **4 boundaries** where data flows in and out.

```
                    ┌─────────────────────┐
                    │                     │
   BOUNDARY 1      │                     │     BOUNDARY 2
   LiveKit Agent ──►│                     │◄─── Operator UI
   (voice calls)   │    INTELLIGENCE     │     (human controls)
                    │    PLATFORM         │
   BOUNDARY 3      │    (Convex)         │     BOUNDARY 4
   Twilio/SMS  ◄───│                     │───► CRM / External
   (notifications) │                     │     (data sync)
                    │                     │
                    └─────────────────────┘
```

---

## BOUNDARY 1: LiveKit Agent ↔ Intelligence

This is the hottest path. Happens **every single conversational turn** — multiple times per call.

---

### 1A. Call Start — "A call just connected"

**WHO CALLS:** LiveKit agent (Dev 1), when prospect picks up the phone

**INPUT to you:**
```
{
  prospectPhone: "+14155551234",
  callType: "xray_booking",          // or "feedback", "promo" etc.
  campaignId: "cvs-xray-feb-2026",   // which marketing campaign
  livekitRoomId: "room-abc123",      // so you can reference it later
  twilioCallSid: "CA-xyz789",        // for tracking
}
```

**WHAT YOU DO:**
1. Look up prospect by phone number
2. If not found → create new prospect record
3. Create a new `callSession` record
4. Create a new Convex Agent thread (for message history)
5. Load the 3 center options for this prospect (based on zip/location)
6. Generate the **opening line** (the very first thing the agent says)

**OUTPUT from you:**
```
{
  sessionId: "sess_abc123",              // your session ID — LiveKit stores this
  prospectName: "John",                  // so agent can say "Hi John"
  openingLine: "Hi, is this John?",      // first thing agent says via TTS
  callPhase: "opening",
  centers: [                             // preloaded for quick reference
    { id: "c1", name: "Bay Imaging", discount: 0, distance: "close" },
    { id: "c2", name: "Peninsula Radiology", discount: 10, distance: "medium" },
    { id: "c3", name: "Valley Diagnostic", discount: 50, distance: "far" },
  ]
}
```

---

### 1B. Conversation Turn — "User just said something"

**WHO CALLS:** LiveKit agent (Dev 1), after every user utterance

**INPUT to you:**
```
{
  sessionId: "sess_abc123",
  utterance: "Yeah this is John, who's calling?",
  turnNumber: 2,
  callPhase: "opening",                 // current phase (you sent this last turn)
  metadata: {
    durationSoFar: 12,                  // seconds since call started
    silenceDuration: 0,                 // 0 = user spoke, >0 = silence before speaking
    isBarge: false,                     // did user interrupt the agent?
  }
}
```

**WHAT YOU DO:**
1. Load session state (prospect, thread, offer state, operator instructions)
2. Check for **pending operator instructions** — inject if any
3. Append user utterance to Agent thread
4. Call LLM via Agent Component `thread.generateText()` with:
   - Full conversation history
   - System prompt (sales script)
   - Available tools
   - Current context (centers, pricing, call phase)
5. LLM returns either:
   - A text reply → you pass it back
   - A tool call → you execute it, feed result back to LLM, get final reply
6. Evaluate call phase transition (did we move from "opening" → "presenting"?)
7. Save everything to DB

**OUTPUT from you:**
```
{
  agentReply: "Hey John! This is Sarah from CVS Health. I'm calling about
               your upcoming X-ray — we've got a few imaging center options
               for you, and a couple come with a discount. Got a quick minute?",

  callPhase: "opening",                 // or updated phase

  action: "none",                       // what LiveKit should DO (see action types below)
  actionData: null,

  toolsExecuted: [],                    // what tools fired this turn (for logging)

  offerState: {                         // current state of the offer
    presentedCenters: false,            // have we shown options yet?
    selectedCenterId: null,             // has user picked one?
    currentDiscounts: {
      "c1": 0,
      "c2": 10,
      "c3": 50,
    },
    operatorOverride: null,             // has operator changed anything?
  },

  escalate: false,
  escalateReason: null,
}
```

---

### 1C. Action Types — What LiveKit Should DO

The `action` field tells LiveKit to do something beyond just speaking.

| Action | When | actionData | What LiveKit Does |
|--------|------|------------|-------------------|
| `"none"` | Normal conversation turn | `null` | Just speak the `agentReply` |
| `"hold"` | Before escalation | `{ holdMessage: "Please hold..." }` | Play hold music, stop listening |
| `"escalate"` | Human needed | `{ repPhone: "+14155559999", repName: "Mike", briefing: "Patient wants MRI not X-ray..." }` | Dial rep, play briefing, connect |
| `"end_call"` | Call is done | `{ farewell: "Have a great day John!" }` | Speak farewell, hang up |
| `"send_dtmf"` | Rare — navigating IVR | `{ digits: "1" }` | Send touch tones |
| `"transfer_cold"` | Direct transfer (no briefing) | `{ transferTo: "+14155558888" }` | SIP REFER to number |

---

### 1D. Call End — "The call is over"

**WHO CALLS:** LiveKit agent (Dev 1), when call ends (hang up, timeout, error)

**INPUT to you:**
```
{
  sessionId: "sess_abc123",
  endReason: "prospect_hangup",         // or "agent_ended", "error", "timeout"
  finalDuration: 187,                   // seconds
  livekitRecordingUrl: "https://...",   // if recording enabled
}
```

**WHAT YOU DO:**
1. Mark session as ended
2. Pull full conversation from Agent thread
3. Generate call summary via LLM (separate quick call):
   - Outcome (booked / declined / escalated / etc.)
   - Key points discussed
   - Follow-up needed?
4. Update prospect status
5. Update call log with transcript + summary
6. If appointment was booked → confirm SMS is scheduled
7. If callback needed → schedule via `ctx.scheduler`
8. If CRM sync needed → trigger action
9. Notify UI (happens automatically via reactive queries)

**OUTPUT from you:**
```
{
  acknowledged: true,
  outcome: "booked",
  summary: "John booked an X-ray at Peninsula Radiology for Feb 25 at 10:30 AM.
            $10 discount applied. Confirmation SMS sent.",
  followUp: null,                       // or { type: "callback", scheduledAt: "..." }
}
```

---

### 1E. Silence / No Response

**WHO CALLS:** LiveKit agent (Dev 1), when user hasn't spoken for X seconds

**INPUT to you:**
```
{
  sessionId: "sess_abc123",
  utterance: "",                        // empty
  turnNumber: 5,
  callPhase: "presenting",
  metadata: {
    durationSoFar: 45,
    silenceDuration: 8,                 // 8 seconds of silence
    isBarge: false,
  }
}
```

**WHAT YOU DO:**
- LLM gets context: "user has been silent for 8 seconds"
- Decides: prompt them? ("John, are you still there?") or end call?

**OUTPUT from you:**
```
{
  agentReply: "John, are you still there? No worries if now's not
               a good time — I can call back later.",
  callPhase: "presenting",
  action: "none",
  ...
}
```

---

## BOUNDARY 2: Operator UI ↔ Intelligence

This happens when a human operator is watching the call and intervenes.

---

### 2A. Operator Sends Instruction

**WHO CALLS:** UI (Dev 3), when operator types/clicks something

**INPUT to you (Convex mutation):**
```
// TYPE 1: Adjust the offer
{
  sessionId: "sess_abc123",
  type: "offer_adjustment",
  payload: {
    centerId: "c2",
    newDiscountAmount: 25,             // was $10, operator bumping to $25
    reason: "high value prospect",     // optional
  }
}

// TYPE 2: Free-form instruction to agent
{
  sessionId: "sess_abc123",
  type: "free_form",
  payload: {
    instructionText: "Ask if they have a preferred day of the week",
  }
}

// TYPE 3: Force escalation
{
  sessionId: "sess_abc123",
  type: "escalate_now",
  payload: {
    reason: "VIP customer, wants to talk to a person",
  }
}

// TYPE 4: Force end call
{
  sessionId: "sess_abc123",
  type: "end_call",
  payload: {
    reason: "wrong prospect, abort",
  }
}
```

**WHAT YOU DO:**
1. Validate the instruction
2. Write to `operatorInstructions` table with status: `"queued"`
3. If offer adjustment → also patch `callSession.offerState`
4. If escalate_now → set a flag that the next turn MUST escalate
5. If end_call → set a flag that the next turn MUST end
6. On the **next intelligence turn** (Boundary 1B), you read these and inject them

**OUTPUT from you (back to UI):**
```
{
  instructionId: "inst_xyz",
  status: "queued",
  willApplyOnTurn: "next",             // not instant — applies on next utterance
}
```

**KEY INSIGHT:** Instructions are NOT instant. They apply on the **next conversational turn**. The agent can't interrupt itself mid-sentence. The operator should see this — "queued" → "applied" status progression.

---

### 2B. What the UI Reads from You (Reactive Queries)

These are Convex queries that auto-update the UI in real time. No polling, no WebSockets to manage — Convex handles it.

**QUERY: activeSession(sessionId)**
```
OUTPUT (updates in real time):
{
  sessionId: "sess_abc123",
  prospectName: "John Smith",
  prospectPhone: "+14155551234",
  status: "active",                     // active, on_hold, escalated, ended
  callPhase: "qa",                      // current conversation phase
  durationSoFar: 87,                    // seconds (updated periodically)
  offerState: {
    presentedCenters: true,
    selectedCenterId: null,
    currentDiscounts: { "c1": 0, "c2": 25, "c3": 50 },  // note: c2 updated by operator
    operatorOverride: { centerId: "c2", oldAmount: 10, newAmount: 25 },
  },
  centerOptions: [
    { id: "c1", name: "Bay Imaging", discount: 0, finalPrice: 150, distance: "2 miles" },
    { id: "c2", name: "Peninsula Radiology", discount: 25, finalPrice: 125, distance: "10 miles" },
    { id: "c3", name: "Valley Diagnostic", discount: 50, finalPrice: 100, distance: "25 miles" },
  ],
}
```

**QUERY: sessionTranscript(sessionId)**
```
OUTPUT (new messages appear in real time):
{
  messages: [
    { role: "agent", text: "Hi, is this John?", timestamp: 1740000000, turnNumber: 1 },
    { role: "user", text: "Yeah who's this?", timestamp: 1740000003, turnNumber: 2 },
    { role: "agent", text: "Hey John! This is Sarah from CVS...", timestamp: 1740000005, turnNumber: 3 },
    { role: "system", text: "Operator adjusted Center B discount: $10 → $25", timestamp: 1740000040, turnNumber: null },
    { role: "user", text: "What's the cheapest option?", timestamp: 1740000045, turnNumber: 6 },
    { role: "agent", text: "Great question! The biggest savings...", timestamp: 1740000047, turnNumber: 7 },
  ]
}
```

**QUERY: operatorInstructions(sessionId)**
```
OUTPUT:
{
  instructions: [
    {
      id: "inst_001",
      type: "offer_adjustment",
      payload: { centerId: "c2", newDiscountAmount: 25 },
      status: "applied",                // queued → applied
      createdAt: 1740000038,
      appliedAtTurn: 6,
    },
    {
      id: "inst_002",
      type: "free_form",
      payload: { instructionText: "Ask about preferred day" },
      status: "queued",                 // not yet applied
      createdAt: 1740000050,
      appliedAtTurn: null,
    },
  ]
}
```

**QUERY: pendingEscalations()**
```
OUTPUT:
{
  escalations: [
    {
      id: "esc_001",
      sessionId: "sess_abc123",
      prospectName: "John Smith",
      reason: "Patient asking about MRI — out of scope",
      transcriptPreview: "...I think my doctor said I need an MRI not an X-ray...",
      waitingSince: 1740000060,
      status: "pending",
    },
  ]
}
```

**QUERY: todayStats()**
```
OUTPUT:
{
  callsMade: 47,
  booked: 12,
  declined: 18,
  voicemail: 9,
  escalated: 4,
  noAnswer: 3,
  inProgress: 1,
  conversionRate: 0.255,               // 12/47
  avgCallDuration: 142,                // seconds
  avgBookingDuration: 198,             // seconds (booked calls only)
}
```

**QUERY: callSummary(sessionId)**
```
OUTPUT (available after call ends):
{
  sessionId: "sess_abc123",
  outcome: "booked",
  prospectName: "John Smith",
  selectedCenter: "Peninsula Radiology",
  appointmentDate: "2026-02-25",
  appointmentTime: "10:30 AM",
  discountApplied: 25,
  finalPrice: 125,
  duration: 187,
  summary: "Patient was initially hesitant but responded well to the $25
            discount at Peninsula Radiology. Booked for Tuesday morning.
            Operator increased discount mid-call from $10 to $25.",
  transcript: [...],                    // full message array
  confirmationSmsSent: true,
  reminderScheduled: true,
  followUp: null,
}
```

---

## BOUNDARY 3: Intelligence → Twilio (Notifications)

Outbound only — you send SMS notifications via Twilio.

---

### 3A. Confirmation SMS

**WHEN:** Immediately after appointment is booked

**TRIGGER:** `bookAppointment` tool → schedules action via `ctx.scheduler.runAfter(0, ...)`

**INPUT (internal — you construct this):**
```
{
  to: "+14155551234",
  body: "Hi John! Your X-ray appointment is confirmed:\n\n
         📍 Peninsula Radiology\n
         📅 Feb 25, 2026 at 10:30 AM\n
         💰 $25 discount applied (you pay $125)\n\n
         Address: 123 Main St, San Mateo, CA\n
         Bring: Insurance card, photo ID\n\n
         To reschedule, call (800) 555-0199.\n
         - CVS Health"
}
```

**OUTPUT:** Twilio message SID (for tracking)

---

### 3B. Reminder SMS

**WHEN:** Day before appointment, 10:00 AM

**TRIGGER:** `bookAppointment` tool → schedules via `ctx.scheduler.runAt(reminderTime, ...)`

**INPUT (internal):**
```
{
  to: "+14155551234",
  body: "Hi John! Reminder: your X-ray is tomorrow at 10:30 AM
         at Peninsula Radiology (123 Main St, San Mateo).
         See you there! - CVS Health"
}
```

---

### 3C. Missed Call / Callback SMS

**WHEN:** After failed escalation (no rep available) — tell prospect we'll call back

**INPUT (internal):**
```
{
  to: "+14155551234",
  body: "Hi John, thanks for your patience. One of our team members
         will call you back within the hour regarding your X-ray options.
         - CVS Health"
}
```

---

## BOUNDARY 4: Intelligence → CRM / External

Outbound — sync data to external systems.

---

### 4A. CRM Update (Post-Call)

**WHEN:** After every completed call

**TRIGGER:** Call end handler → schedules action

**INPUT (you construct, send to CRM API):**
```
{
  prospectId: "CRM-12345",             // external CRM ID
  status: "booked",
  callDate: "2026-02-21",
  callDuration: 187,
  outcome: "booked",
  appointmentDate: "2026-02-25",
  appointmentCenter: "Peninsula Radiology",
  discountApplied: 25,
  aiGenerated: true,                   // flag that AI made this call
  escalated: false,
  notes: "AI-generated summary: Patient booked after operator adjusted discount...",
  doNotCall: false,
}
```

---

## Summary: Every Input and Output at a Glance

```
INPUTS TO YOU (what you receive):
─────────────────────────────────────

FROM LIVEKIT:
  → Call started      { phone, callType, campaignId, roomId, callSid }
  → User spoke        { sessionId, utterance, turnNumber, callPhase, metadata }
  → Silence           { sessionId, utterance: "", silenceDuration }
  → Call ended        { sessionId, endReason, duration, recordingUrl }

FROM OPERATOR UI:
  → Offer adjustment  { sessionId, centerId, newAmount }
  → Free instruction  { sessionId, instructionText }
  → Force escalate    { sessionId, reason }
  → Force end call    { sessionId, reason }


OUTPUTS FROM YOU (what you send):
─────────────────────────────────────

TO LIVEKIT:
  ← Session created   { sessionId, prospectName, openingLine, centers }
  ← Agent reply       { agentReply, callPhase, action, actionData, offerState }
  ← Call summary      { outcome, summary, followUp }

TO OPERATOR UI (reactive queries):
  ← Active session    { status, phase, offerState, centers }
  ← Transcript        { messages[] in real time }
  ← Instructions      { instruction history with statuses }
  ← Escalation queue  { pending escalations across all calls }
  ← Today stats       { calls, booked, declined, rates }
  ← Call summary      { full post-call report }

TO TWILIO:
  ← Confirmation SMS  { to, body }
  ← Reminder SMS      { to, body }
  ← Callback SMS      { to, body }

TO CRM:
  ← Call outcome      { prospect, status, appointment, notes }
```

---

## What You Store (Your State)

Everything you need to make decisions lives in your Convex tables:

```
ALWAYS IN MEMORY DURING A CALL:
─────────────────────────────────────

prospect          WHO are we talking to?
  → name, phone, zip, insurance, past call history, status

callSession       WHAT's happening right now?
  → phase, offer state, operator overrides, start time, room/call refs

agentThread       WHAT's been said?
  → full conversation history (managed by Agent Component)
  → searchable via vector search for context

centers           WHAT are the options?
  → 3 centers with pricing, discounts, availability, hours

operatorInstructions   WHAT has the operator told us?
  → queued instructions to apply on next turn


PERSISTED AFTER CALL:
─────────────────────────────────────

callLog           WHAT happened?
  → outcome, transcript, summary, escalation details

appointment       WHAT was booked?
  → center, date, time, confirmation status

escalation        WAS THERE A PROBLEM?
  → reason, resolution, rep assignment
```

---

## The Intelligence Loop (Pseudocode)

This is the core of what you're building — the turn-by-turn reasoning loop:

```
function handleTurn(input):

  1. LOAD STATE
     session  ← db.get(input.sessionId)
     prospect ← db.get(session.prospectId)
     centers  ← db.query("centers")
     thread   ← agent.getThread(session.threadId)

  2. CHECK OPERATOR OVERRIDES
     instructions ← db.query("operatorInstructions")
                      .where(session, status="queued")

     if instructions exist:
       for each instruction:
         if offer_adjustment → update session.offerState
         if free_form → inject as system message into thread
         if escalate_now → set forceEscalate = true
         if end_call → set forceEnd = true
         mark instruction as "applied"

  3. BUILD CONTEXT
     systemContext = {
       prospect name, phone, insurance
       current call phase
       center options + current discounts (with any operator overrides)
       call duration so far
       "you are on turn {N} of this call"
     }

  4. CALL LLM
     if forceEscalate:
       reply = "Let me connect you with a specialist..."
       action = "escalate"
     elif forceEnd:
       reply = "Thanks for your time John, have a great day!"
       action = "end_call"
     else:
       result = thread.generateText({
         prompt: input.utterance,        // what user said
         context: systemContext,          // injected context
         tools: [lookupCenters, checkAvailability, bookAppointment,
                 transferToHuman, markDeclined, markCompleted,
                 scheduleCallback, sendConfirmationSms]
       })
       reply = result.text
       action = determine from tool calls (if any)

  5. UPDATE STATE
     update session.callPhase (if transition detected)
     save transcript entry (user + agent messages)
     update session.lastTurnAt

  6. RETURN
     { agentReply, callPhase, action, actionData, offerState }
```

---

## Edge Cases You Need to Handle

| Edge Case | What Happens | Your Response |
|-----------|-------------|---------------|
| User speaks before agent finishes | LiveKit sends `isBarge: true` | LLM should acknowledge interruption naturally |
| Two operator instructions queued at once | Both in queue when next turn fires | Apply both — offer change + free-form combined |
| Operator changes offer AFTER user already picked that center | Conflict — user agreed to old price | Apply new (better) price, agent says "actually, I can do even better..." |
| Call drops mid-booking | LiveKit sends `endReason: "error"` | Don't finalize booking. Mark as "callback". Schedule retry. |
| User says "do not call" | Detected by LLM | Execute `markDNC` tool → update prospect → never dial again |
| Same prospect called twice simultaneously | Batch dialer race condition | Check `status != "pending"` before dialing. Use Convex transactions. |
| LLM takes too long (>3s) | User waiting in silence | Set timeout. If exceeded, return fallback: "One moment please..." |
| Agent thread gets too long (20+ turns) | Token limit risk | Summarize earlier turns, keep recent 10 in full |
| Operator sends instruction after call ended | Stale session | Reject — return error "session ended" |
| No centers have availability | All slots booked | Agent apologizes, offers to schedule callback when slots open |

---

*This is the complete I/O spec for the intelligence platform. Dev 1 and Dev 3 can build against these contracts independently.*
