"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

export function TranscriptViewer({
  sessionId,
  isLive,
}: {
  sessionId: Id<"callSessions"> | null;
  isLive: boolean;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);

  const data = useQuery(
    api.functions.queries.sessionTranscript,
    sessionId ? { sessionId } : "skip"
  );

  const entries = data?.messages ?? [];

  useEffect(() => {
    if (isLive && endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [entries, isLive]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-950/70">
      <div className="border-b border-slate-800 px-3 py-2 text-xs font-medium text-slate-300">
        Live transcript
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3 text-xs">
        {entries.length === 0 && (
          <p className="text-slate-500">
            Transcript will appear here once the call is connected.
          </p>
        )}
        {entries.map((entry: any, i: number) => (
          <TranscriptBubble key={`${entry.timestamp}-${i}`} entry={entry} />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function TranscriptBubble({
  entry,
}: {
  entry: { role: string; text: string; timestamp: number };
}) {
  const time = new Date(entry.timestamp);
  const timeLabel = time.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isAgent = entry.role === "agent";
  const isUser = entry.role === "user" || entry.role === "customer";
  const isSystem = entry.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="rounded-full bg-slate-900/80 px-3 py-1 text-[11px] text-slate-400">
          {entry.text}
        </div>
      </div>
    );
  }

  const align = isAgent ? "justify-end" : "justify-start";
  const bubbleColor = isAgent
    ? "bg-primary text-slate-50"
    : isUser
    ? "bg-slate-800 text-slate-50"
    : "bg-emerald-900/80 text-emerald-50";

  const label = isAgent ? "Agent" : isUser ? "Customer" : "Operator";

  return (
    <div className={`flex ${align}`}>
      <div className="max-w-[80%] space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {label}
          </span>
          <span className="text-[10px] text-slate-500">{timeLabel}</span>
        </div>
        <div className={`rounded-lg px-3 py-2 text-xs ${bubbleColor}`}>{entry.text}</div>
      </div>
    </div>
  );
}
