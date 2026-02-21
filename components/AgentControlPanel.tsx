"use client";

import { useState } from "react";
import { useCallStore } from "../lib/store/callStore";
import type { CallStatus } from "../lib/types";

const QUICK_TEMPLATES = [
  "Ask if they plan to visit this week.",
  "Confirm their preferred CVS location.",
  "Ask for an email to send the coupon.",
  "Thank them and end the call politely."
];

export function AgentControlPanel() {
  const [instructionText, setInstructionText] = useState("");
  const [approvedOfferInput, setApprovedOfferInput] = useState<string>("");

  const { callSession, sendInstruction, applyApprovedOffer } = useCallStore((s) => ({
    callSession: s.callSession,
    sendInstruction: s.sendInstruction,
    applyApprovedOffer: s.applyApprovedOffer
  }));

  const status: CallStatus = callSession?.status ?? "IDLE";
  const isLive = status === "LIVE";
  const offer = callSession?.offer;

  async function handleInstructionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!instructionText.trim() || !callSession) return;
    await sendInstruction(instructionText.trim());
    setInstructionText("");
  }

  async function handleApplyOffer() {
    if (!callSession) return;
    const value = Number(approvedOfferInput || offer?.approvedAmount || offer?.baseAmount || 0);
    if (!value || value <= 0) return;
    await applyApprovedOffer(value);
  }

  function setQuickOffer(delta: number) {
    if (!offer) return;
    const current = offer.approvedAmount ?? offer.baseAmount;
    const next = Math.max(1, current + delta);
    setApprovedOfferInput(String(next));
  }

  function matchRequested() {
    if (!offer?.requestedAmount) return;
    setApprovedOfferInput(String(offer.requestedAmount));
  }

  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
      <div className="border-b border-slate-800 pb-2">
        <h2 className="text-sm font-semibold text-slate-100">Agent control</h2>
        <p className="text-xs text-slate-400">
          Adjust offers and send instructions. The customer never sees this panel.
        </p>
      </div>

      {offer && callSession?.type === "PROMOTION" && (
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-medium">Current offer</span>
            {offer.code && (
              <span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-[11px] text-emerald-300">
                Code assigned
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400">
            <div>
              <div className="text-slate-500">Base</div>
              <div className="text-sm font-semibold text-slate-100">${offer.baseAmount}</div>
            </div>
            <div>
              <div className="text-slate-500">Customer asked</div>
              <div className="text-sm font-semibold text-amber-300">
                {offer.requestedAmount ? `$${offer.requestedAmount}` : "—"}
              </div>
            </div>
            <div>
              <div className="text-slate-500">Approved</div>
              <div className="text-sm font-semibold text-emerald-300">
                {offer.approvedAmount ? `$${offer.approvedAmount}` : "Not set"}
              </div>
            </div>
          </div>

          <div className="space-y-1 pt-1">
            <label className="text-[11px] font-medium text-slate-300">
              Approve new amount (USD)
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 text-[11px] text-slate-500">
                  $
                </span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={approvedOfferInput}
                  onChange={(e) => setApprovedOfferInput(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 pl-5 text-xs text-slate-50 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
                  placeholder={
                    offer.approvedAmount
                      ? String(offer.approvedAmount)
                      : offer.requestedAmount
                      ? String(offer.requestedAmount)
                      : String(offer.baseAmount)
                  }
                  disabled={!isLive}
                />
              </div>
              <button
                type="button"
                onClick={handleApplyOffer}
                disabled={!isLive}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                Apply offer
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1 text-[11px]">
              <button
                type="button"
                onClick={() => setQuickOffer(5)}
                disabled={!isLive}
                className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-500"
              >
                + $5
              </button>
              <button
                type="button"
                onClick={() => setQuickOffer(10)}
                disabled={!isLive}
                className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-500"
              >
                + $10
              </button>
              <button
                type="button"
                onClick={matchRequested}
                disabled={!isLive || !offer.requestedAmount}
                className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-500"
              >
                Match request
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleInstructionSubmit} className="flex flex-1 flex-col gap-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-300">Agent instructions</label>
            {!isLive && (
              <span className="text-[11px] text-slate-500">
                Instructions enabled when call is live.
              </span>
            )}
          </div>
          <textarea
            value={instructionText}
            onChange={(e) => setInstructionText(e.target.value)}
            placeholder="Tell the agent what to do next (customer will not hear this)."
            className="min-h-[72px] w-full flex-1 resize-none rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-50 outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            disabled={!isLive}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="submit"
            disabled={!isLive || !instructionText.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-slate-50 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
          >
            Send instruction
          </button>
          <div className="flex flex-wrap gap-1 text-[11px]">
            {QUICK_TEMPLATES.map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => setInstructionText(template)}
                disabled={!isLive}
                className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-500"
              >
                {template}
              </button>
            ))}
          </div>
        </div>
      </form>

      <InstructionList />
    </div>
  );
}

function InstructionList() {
  const instructions = useCallStore((s) => s.callSession?.instructions ?? []);

  if (!instructions.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/60 p-2 text-[11px] text-slate-500">
        Instructions you send will show here with their status.
      </div>
    );
  }

  return (
    <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/80 p-2 text-[11px]">
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-200">Instruction history</span>
      </div>
      <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
        {instructions.map((instr) => (
          <div
            key={instr.id}
            className="flex items-start justify-between gap-2 rounded border border-slate-800 bg-slate-950 px-2 py-1"
          >
            <div className="flex-1">
              <div className="truncate text-slate-100">{instr.content}</div>
              <div className="text-[10px] text-slate-500">
                {new Date(instr.createdAt).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit"
                })}
              </div>
            </div>
            <StatusPill status={instr.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: "pending" | "applied" | "rejected" }) {
  const label =
    status === "pending" ? "Pending" : status === "applied" ? "Applied" : "Rejected";
  const cls =
    status === "pending"
      ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
      : status === "applied"
      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
      : "bg-rose-500/10 text-rose-300 border-rose-500/30";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

