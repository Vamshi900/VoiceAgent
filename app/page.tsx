"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { AppShell } from "../components/AppShell";
import { CallStarterPanel } from "../components/CallStarterPanel";
import { CallStatusBar } from "../components/CallStatusBar";
import { TranscriptViewer } from "../components/TranscriptViewer";
import { AgentControlPanel } from "../components/AgentControlPanel";
import { CallSummaryPanel } from "../components/CallSummaryPanel";
import type { CallStatus } from "../lib/types";

export default function HomePage() {
  const [sessionId, setSessionId] = useState<Id<"callSessions"> | null>(null);

  const session = useQuery(
    api.functions.queries.activeSession,
    sessionId ? { sessionId } : "skip"
  );

  const endSession = useAction(api.functions.sessions.endSession);

  // Map Convex status to UI status
  const status: CallStatus = !sessionId
    ? "IDLE"
    : !session
    ? "DIALING"
    : session.status === "active" || session.status === "escalated"
    ? "LIVE"
    : session.status === "ended"
    ? "COMPLETED"
    : "LIVE";

  async function handleEndCall() {
    if (!sessionId) return;
    await endSession({ sessionId, endReason: "operator_ended" });
  }

  function handleReset() {
    setSessionId(null);
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <CallStarterPanel onSessionCreated={setSessionId} disabled={!!sessionId} />

        <CallStatusBar status={status} onEndCall={handleEndCall} />

        <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="flex min-h-[360px] flex-col gap-3">
            <TranscriptViewer sessionId={sessionId} isLive={status === "LIVE"} />
            <CallSummaryPanel sessionId={sessionId} onReset={handleReset} />
          </div>
          <div className="min-h-[360px]">
            <AgentControlPanel sessionId={sessionId} isLive={status === "LIVE"} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
