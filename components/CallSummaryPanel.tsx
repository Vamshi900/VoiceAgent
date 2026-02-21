"use client";

import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

export function CallSummaryPanel({
  sessionId,
  onReset,
}: {
  sessionId: Id<"callSessions"> | null;
  onReset: () => void;
}) {
  const summary = useQuery(
    api.functions.queries.callSummary,
    sessionId ? { sessionId } : "skip"
  );

  if (!summary || summary.outcome === "in_progress") return null;

  const durationLabel =
    summary.duration != null
      ? `${String(Math.floor(summary.duration / 60)).padStart(2, "0")}:${String(
          summary.duration % 60
        ).padStart(2, "0")}`
      : "--";

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Call summary</h3>
          <p className="text-[11px] text-slate-400">
            Review the outcome of the completed call.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <div className="text-[11px] text-slate-500">Prospect</div>
          <div className="text-sm font-medium text-slate-100">{summary.prospectName}</div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500">Outcome</div>
          <div className="text-sm font-medium text-emerald-300 capitalize">
            {summary.outcome?.replace(/_/g, " ")}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500">Duration</div>
          <div className="text-sm font-medium text-slate-100">{durationLabel}</div>
        </div>
      </div>

      {summary.selectedCenter && (
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <div className="text-[11px] text-slate-500">Center</div>
            <div className="text-sm font-medium text-slate-100">{summary.selectedCenter}</div>
          </div>
          {summary.appointmentDate && (
            <div>
              <div className="text-[11px] text-slate-500">Appointment</div>
              <div className="text-sm font-medium text-slate-100">
                {summary.appointmentDate} at {summary.appointmentTime}
              </div>
            </div>
          )}
          {summary.finalPrice != null && (
            <div>
              <div className="text-[11px] text-slate-500">Final price</div>
              <div className="text-sm font-medium text-emerald-300">
                ${summary.finalPrice} (${summary.discountApplied} off)
              </div>
            </div>
          )}
        </div>
      )}

      {summary.summary && (
        <div>
          <div className="text-[11px] text-slate-500">Summary</div>
          <div className="text-sm text-slate-200">{summary.summary}</div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onReset}
          className="rounded-md bg-primary px-3 py-1 text-[11px] font-semibold text-slate-50"
        >
          Start another call
        </button>
      </div>
    </div>
  );
}
