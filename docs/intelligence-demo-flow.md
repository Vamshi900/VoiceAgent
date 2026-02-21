# Intelligence Layer Demo Flow – Insurance Options Call

This document describes the demo conversation and the JSON contract between the voice layer and the intelligence layer (MiniMax + Convex) for an **insurance options** outbound call.

The goal is to make it easy for the intelligence-side collaborator to plug in real logic behind a stable API.

---

## 1. Demo Conversation Script

**Scenario:**  
Outbound call to a patient. Their doctor recommended an insurance / support program. The agent presents three options (A/B/C). The user chooses one (B in this example). The intelligence layer decides what to say next and updates memory.

### 1.1. Agent opening

> Hi, this is your virtual care assistant calling on a recorded line.  
> Your doctor recommended that you enroll in a support program, and you have three options:
>
> - Option A: nearby UCSF at no discount.  
> - Option B: a \$25 discount at CVS, about 5 miles away, valid at CVS locations nationwide.  
> - Option C: a \$35 discount at One Medical, about 15 miles away, valid at locations in California.
>
> Which option sounds best for you today – A, B, or C?

### 1.2. User response (example)

> I think option B sounds best.

### 1.3. Agent response after intelligence layer decision

> Great, I’ll enroll you in Option B: a \$25 discount at a CVS about 5 miles from you, and it’s valid at CVS locations nationwide.  
> I just need to confirm a couple of details so we can send your discount code.

Optionally, the agent then:

> Is this the best phone number to text your discount code to?

User:

> Yes, this number is fine.

Final wrap‑up:

> Perfect. I’m generating your CVS discount code now.  
> You’ll receive a text message in the next few minutes with your code and instructions for using it at checkout.  
> Thanks for your time today and have a great day!

The above is just demo copy; the intelligence layer can tune language as long as it preserves the semantics.

---

## 2. Intelligence API Contract (Proposed)

The voice/backend side should call a single endpoint **per user turn**:

```http
POST /api/intelligence/turn
Content-Type: application/json
```

### 2.1. Request payload (from voice layer → intelligence)

Shape in TypeScript (`lib/intelligence.ts`):

```ts
export type InsuranceOptionId = "A" | "B" | "C";

export type InsuranceOption = {
  id: InsuranceOptionId;
  label: string;
  location: string;
  discountAmount: number;
  validRegion: "LOCAL" | "NATIONAL" | "CALIFORNIA";
};

export type IntelligenceMemory = {
  doctorRecommendation: string;
  patientLocation: string;
  preferredChannel: "SMS" | "EMAIL";
  previousSelection: InsuranceOptionId | null;
};

export type IntelligenceTurnRequest = {
  callSessionId: string;
  turnId: string;
  userUtterance: string;
  speaker: "customer" | "agent";
  availableOptions: InsuranceOption[];
  memory: IntelligenceMemory;
  agentGuidelines: string[];
};
```

Example JSON sent to `/api/intelligence/turn`:

```json
{
  "callSessionId": "sess_12345",
  "turnId": "turn_3",
  "userUtterance": "I think option B sounds best.",
  "speaker": "customer",
  "availableOptions": [
    {
      "id": "A",
      "label": "UCSF clinic – no discount",
      "location": "nearest UCSF",
      "discountAmount": 0,
      "validRegion": "LOCAL"
    },
    {
      "id": "B",
      "label": "CVS – $25 discount",
      "location": "CVS (5 miles away)",
      "discountAmount": 25,
      "validRegion": "NATIONAL"
    },
    {
      "id": "C",
      "label": "One Medical – $35 discount",
      "location": "One Medical (15 miles away)",
      "discountAmount": 35,
      "validRegion": "CALIFORNIA"
    }
  ],
  "memory": {
    "doctorRecommendation": "Enroll in support program",
    "patientLocation": "San Francisco, CA",
    "preferredChannel": "SMS",
    "previousSelection": null
  },
  "agentGuidelines": [
    "Pick the option matching the user's choice.",
    "Restate the selected option clearly.",
    "Confirm how to deliver the discount code via SMS.",
    "Stay concise and empathetic."
  ]
}
```

### 2.2. Response payload (from intelligence → voice layer)

TypeScript shape (`lib/intelligence.ts`):

```ts
export type IntelligenceTurnResponse = {
  callSessionId: string;
  turnId: string;
  selectedOptionId: InsuranceOptionId | null;
  agentReplyText: string;
  discount?: {
    amount: number;
    provider: string;
    validRegion: "LOCAL" | "NATIONAL" | "CALIFORNIA";
  };
  updatedMemory: IntelligenceMemory;
};
```

Example JSON returned by `/api/intelligence/turn`:

```json
{
  "callSessionId": "sess_12345",
  "turnId": "turn_3",
  "selectedOptionId": "B",
  "agentReplyText": "Great, I’ll enroll you in Option B: a $25 discount at a CVS about 5 miles from you, valid at CVS locations nationwide. I just need to confirm that this is the best phone number to text your discount code to.",
  "discount": {
    "amount": 25,
    "provider": "CVS",
    "validRegion": "NATIONAL"
  },
  "updatedMemory": {
    "doctorRecommendation": "Enroll in support program",
    "patientLocation": "San Francisco, CA",
    "preferredChannel": "SMS",
    "previousSelection": "B"
  }
}
```

---

## 3. How the Voice Layer Uses This

For each user utterance:

1. Twilio streams audio → ASR → text (e.g. `"I think option B sounds best."`).
2. Backend constructs an `IntelligenceTurnRequest` and calls `/api/intelligence/turn`.
3. Intelligence layer (MiniMax + Convex) parses the utterance, chooses an option, updates memory, and returns:
   - `agentReplyText` – what the agent should say next.
   - `selectedOptionId` and optional `discount` metadata.
   - `updatedMemory` – persisted via Convex.
4. Backend:
   - Feeds `agentReplyText` into TTS → audio back to caller.
   - Streams the final text to the UI transcript.
   - Updates offer state (e.g. selected option and discount amount).

This loop repeats for the next user utterance, giving a streaming, stateful conversation.

