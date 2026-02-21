"use client";

import { useCallStore } from "../lib/store/callStore";

export function CallSummaryPanel() {
  const { callSession, resetCall } = useCallStore((s) => ({
    callSession: s.callSession,
    resetCall: s.resetCall
  }));

  if (!callSession || callSession.status !== "COMPLETED") return null;

  const offer = callSession.offer;

  const duration =
    callSession.startedAt && callSession.endedAt
      ? Math.max(
          0,
          Math.round(
            (new Date(callSession.endedAt).getTime() -
              new Date(callSession.startedAt).getTime()) /
              1000
          )
        )
      : null;

  const durationLabel =
    duration != null
      ? `${String(Math.floor(duration / 60)).padStart(2, "0")}:${String(
          duration % 60
        ).padStart(2, "0")}`
      : "—";

  function copyCode() {
    if (offer?.code) {
      void navigator.clipboard?.writeText(offer.code);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Call summary</h3>
          <p className="text-[11px] text-slate-400">
            Review the outcome and share the discount code with the customer.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <div className="text-[11px] text-slate-500">Phone</div>
          <div className="text-sm font-medium text-slate-100">{callSession.phoneNumber}</div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500">Result</div>
          <div className="text-sm font-medium text-emerald-300">
            {offer?.approvedAmount
              ? `Accepted $${offer.approvedAmount} offer`
              : "Completed"}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500">Duration</div>
          <div className="text-sm font-medium text-slate-100">{durationLabel}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="space-y-1">
          <div className="text-[11px] text-slate-500">Discount code</div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-slate-900 px-3 py-1 font-mono text-sm tracking-wide text-emerald-300">
              {offer?.code ?? "Code to be assigned"}
            </span>
            <button
              type="button"
              onClick={copyCode}
              disabled={!offer?.code}
              className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-500"
            >
              Copy
            </button>
          </div>
        </div>
        <div className="flex flex-1 flex-wrap justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
          >
            Send via SMS (stub)
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-700 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
          >
            Download transcript (stub)
          </button>
          <button
            type="button"
            onClick={resetCall}
            className="rounded-md bg-primary px-3 py-1 text-[11px] font-semibold text-slate-50"
          >
            Start another call
          </button>
        </div>
      </div>
    </div>
  );
}

