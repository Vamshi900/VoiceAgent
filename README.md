# VoiceAgent – CallFlow Voice UI

Outbound AI voice calling console with human‑in‑the‑loop controls.  
This UI is designed for a platform that uses Twilio (outbound calls), MiniMax (voice agent), and Convex (real‑time memory / events). Those integrations are stubbed for now; the app focuses on operator workflow and UX.

## Features

- Start outbound calls from a landing page with phone number + call type.
- Live transcript viewer (agent / customer / system / operator messages).
- Human‑in‑the‑loop control panel:
  - Adjust promotional offer amounts (e.g. CVS discount from \$25 → \$50).
  - Send structured and free‑form instructions to the agent.
  - View instruction history with status.
- Call summary with outcome, duration, and discount code display.
- Responsive layout (two‑column on desktop, stacked on small screens).

## Tech Stack

- [Next.js 14](https://nextjs.org/) (App Router)
- React 18 + TypeScript
- Tailwind CSS for styling
- Zustand for client‑side call/session state

Back‑end integrations (Twilio, MiniMax, Convex) are represented by simple API routes and a client‑side realtime simulator.

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm (or pnpm / yarn, if you prefer and adapt commands)

### Install dependencies

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

Then open your browser at:

```text
http://localhost:3000
```

You should see the CallFlow Voice console.

## How It Works (Current Stubbed Behavior)

1. **Start a call**
   - Enter a (mock) phone number and choose:
     - *Feedback Call* or
     - *Promotional Offer* (e.g. CVS discount).
   - Optionally adjust the base offer (default \$25 for promotions).
   - Click **Start Call**.

2. **Realtime simulation**
   - A synthetic call session is created by `POST /api/calls/outbound`.
   - `lib/realtime.ts` simulates call status changes and a short conversation where:
     - The agent offers a \$25 discount.
     - The customer asks for \$75.
     - An offer request event updates the right‑hand offer panel.

3. **Human‑in‑the‑loop controls**
   - Use the **Agent control** panel to:
     - Approve a new offer amount (e.g. \$50) and apply it.
     - Send free‑form instructions (“Ask if they will visit this week”, etc.).
   - Instructions are optimistically stored in the Zustand store and posted to:
     - `POST /api/calls/:id/instructions` (stubbed).

4. **Ending the call**
   - Click **End Call** in the status bar to mark the call as completed.
   - The **Call summary** panel shows:
     - Phone, result (e.g. “Accepted \$50 offer”), duration, and discount code (if set).
   - Buttons to send via SMS / download transcript are placeholders.

## Project Structure (High Level)

- `app/`
  - `layout.tsx` – Root layout, global Tailwind import.
  - `page.tsx` – Main call console page.
  - `api/calls/*` – Stub API routes for starting calls, sending instructions, ending calls, etc.
  - `api/intelligence/turn` – Stub endpoint for the intelligence layer (MiniMax + Convex).
- `components/`
  - `AppShell.tsx` – Header + shell layout.
  - `LogoMark.tsx` – Chat/agent logo icon.
  - `CallStarterPanel.tsx` – Phone number + call type form.
  - `CallStatusBar.tsx` – Call status and end‑call control.
  - `TranscriptViewer.tsx` – Live transcript UI.
  - `AgentControlPanel.tsx` – Offer controls + agent instruction chat.
  - `CallSummaryPanel.tsx` – Post‑call summary and discount code.
- `lib/`
  - `types.ts` – Shared TypeScript types (call status, transcript entries, instructions, offer state, etc.).
  - `store/callStore.ts` – Zustand store handling call session state and actions.
  - `realtime.ts` – Client‑side simulator for call events (placeholder for Convex/Twilio/MiniMax wiring).
  - `intelligence.ts` – Types + helper for the intelligence layer turn API.
- `docs/`
  - `intelligence-demo-flow.md` – Insurance-options demo script + JSON contract for intelligence.

## Scripts

- `npm run dev` – Start development server.
- `npm run build` – Create production build.
- `npm start` – Run production server (after `npm run build`).
- `npm run lint` – Run ESLint (Next.js config).

## Intelligence Layer Notes (MiniMax + Convex)

For collaborators working on the reasoning/memory side:

- See `docs/intelligence-demo-flow.md` for:
  - The **insurance options** demo script (UCSF / CVS / One Medical).
  - The proposed JSON contract for `/api/intelligence/turn`.
- See `lib/intelligence.ts` for the TypeScript types and a small client helper.
- The route `app/api/intelligence/turn/route.ts` currently contains a **stub** implementation that:
  - Parses the last user utterance.
  - Picks option B when the user mentions “B” or “CVS”.
  - Returns `agentReplyText`, `selectedOptionId`, and updated memory.

You can replace the body of that route (and/or the `callIntelligenceTurn` helper) with real MiniMax + Convex logic while keeping the same request/response shape.

## Next Steps / Integration Points

- Replace `lib/realtime.ts` with real Convex (or WebSocket) event subscriptions.
- Implement Twilio outbound call initiation in `app/api/calls/outbound/route.ts`.
- Connect instructions API to MiniMax (or your agent stack) via Convex.
- Add authentication and multi‑operator support if needed.
