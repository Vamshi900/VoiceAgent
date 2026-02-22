"use client";

import type { CallStatus } from "../lib/types";

const statusLabels: Record<CallStatus, string> = {
  IDLE: "Idle",
  DIALING: "Dialing",
  RINGING: "Ringing",
  LIVE: "Live",
  COMPLETED: "Completed",
  FAILED: "Failed"
};

function statusColor(status: CallStatus) {
  switch (status) {
    case "DIALING":
    case "RINGING":
      return "bg-amber-500/10 text-amber-300";
    case "LIVE":
      return "bg-emerald-500/10 text-emerald-300";
    case "COMPLETED":
      return "bg-slate-700/60 text-slate-100";
    case "FAILED":
      return "bg-rose-500/10 text-rose-300";
    default:
      return "bg-slate-800 text-slate-300";
  }
}

export function CallStatusBar({
  status,
  onEndCall
}: {
  status: CallStatus;
  onEndCall?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        {status === "LIVE" && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
        )}
        <span className={`rounded-full px-2 py-0.5 font-medium ${statusColor(status)}`}>
          {statusLabels[status]}
        </span>
        <span className="text-slate-400">
          {status === "LIVE"
            ? "Call in progress"
            : status === "DIALING" || status === "RINGING"
            ? "Connecting to customer…"
            : status === "COMPLETED"
            ? "Call completed"
            : status === "FAILED"
            ? "Call failed"
            : "Ready to start a call"}
        </span>
      </div>
      {status === "LIVE" && onEndCall && (
        <button
          type="button"
          onClick={onEndCall}
          className="rounded-full bg-rose-600 px-3 py-1 text-xs font-semibold text-rose-50 hover:bg-rose-500"
        >
          End Call
        </button>
      )}
    </div>
  );
}

