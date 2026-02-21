"use client";

import { AppShell } from "../components/AppShell";
import { CallStarterPanel } from "../components/CallStarterPanel";
import { CallStatusBar } from "../components/CallStatusBar";
import { TranscriptViewer } from "../components/TranscriptViewer";
import { AgentControlPanel } from "../components/AgentControlPanel";
import { CallSummaryPanel } from "../components/CallSummaryPanel";
import { useCallStore } from "../lib/store/callStore";

export default function HomePage() {
  const callSession = useCallStore((s) => s.callSession);
  const setCallStatus = useCallStore((s) => s.setCallStatus);

  const status = callSession?.status ?? "IDLE";

  function handleEndCall() {
    if (!callSession) return;
    setCallStatus("COMPLETED");
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-4">
        <CallStarterPanel />

        <CallStatusBar status={status} onEndCall={handleEndCall} />

        <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="flex min-h-[360px] flex-col gap-3">
            <TranscriptViewer entries={callSession?.transcript ?? []} isLive={status === "LIVE"} />
            <CallSummaryPanel />
          </div>
          <div className="min-h-[360px]">
            <AgentControlPanel />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

