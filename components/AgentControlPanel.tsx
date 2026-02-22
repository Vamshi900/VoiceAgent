"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

const QUICK_TEMPLATES = [
  "Ask if they plan to visit this week.",
  "Confirm their preferred CVS location.",
  "Ask for an email to send the coupon.",
  "Thank them and end the call politely.",
];

export function AgentControlPanel({
  sessionId,
  isLive,
}: {
  sessionId: Id<"callSessions"> | null;
  isLive: boolean;
}) {
  const [instructionText, setInstructionText] = useState("");
  const [approvedOfferInput, setApprovedOfferInput] = useState<string>("");

  const sendInstruction = useMutation(api.functions.operator.sendInstruction);

  const instructionsData = useQuery(
    api.functions.queries.operatorInstructions,
    sessionId ? { sessionId } : "skip"
  );

  const session = useQuery(
    api.functions.queries.activeSession,
    sessionId ? { sessionId } : "skip"
  );

  const instructions = instructionsData?.instructions ?? [];
  const offerState = session?.offerState;

  async function handleInstructionSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!instructionText.trim() || !sessionId) return;

    await sendInstruction({
      sessionId,
      type: "free_form",
      payload: { instructionText: instructionText.trim() },
    });
    setInstructionText("");
  }

  async function handleApplyOffer() {
    if (!sessionId) return;
    const value = Number(approvedOfferInput);
    if (!value || value <= 0) return;

    const centerOptions = session?.centerOptions;
    const centerId = centerOptions?.[0]?.id;
    if (!centerId) return;

    await sendInstruction({
      sessionId,
      type: "offer_adjustment",
      payload: {
        newOfferAmount: value,
        centerId: centerId as string,
      },
    });
    setApprovedOfferInput("");
  }

  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-3">
      <div className="border-b border-slate-800 pb-2">
        <h2 className="text-sm font-semibold text-slate-100">Agent control</h2>
        <p className="text-xs text-slate-400">
          Adjust offers and send instructions. The customer never sees this panel.
        </p>
      </div>

      {offerState && (
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/80 p-3">
          <div className="text-xs font-medium text-slate-300">Current discounts</div>
          <div className="space-y-1 text-[11px]">
            {session?.centerOptions?.map((center: any) => (
              <div key={center.id} className="flex items-center justify-between text-slate-400">
                <span>{center.name}</span>
                <span className="text-emerald-300">
                  ${center.discount} off &rarr; ${center.finalPrice}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-1 pt-1">
            <label className="text-[11px] font-medium text-slate-300">
              Adjust discount amount ($)
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
                  placeholder="New discount"
                  disabled={!isLive}
                />
              </div>
              <button
                type="button"
                onClick={handleApplyOffer}
                disabled={!isLive}
                className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                Apply
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

      <InstructionList instructions={instructions} />
    </div>
  );
}

function InstructionList({ instructions }: { instructions: any[] }) {
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
        {instructions.map((instr: any) => (
          <InstructionItem key={instr.id} instr={instr} />
        ))}
      </div>
    </div>
  );
}

function InstructionItem({ instr }: { instr: any }) {
  const [flash, setFlash] = useState(false);
  const prevStatus = useRef(instr.status);

  useEffect(() => {
    if (instr.status !== prevStatus.current) {
      prevStatus.current = instr.status;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1200);
      return () => clearTimeout(t);
    }
  }, [instr.status]);

  return (
    <div
      className={`flex items-start justify-between gap-2 rounded border border-slate-800 bg-slate-950 px-2 py-1 transition-colors duration-500 ${
        flash ? "bg-emerald-950/40 border-emerald-700/40" : ""
      }`}
    >
      <div className="flex-1">
        <div className="truncate text-slate-100">
          {instr.type === "free_form"
            ? instr.payload?.instructionText
            : instr.type === "offer_adjustment"
            ? `Adjust to $${instr.payload?.newOfferAmount}`
            : instr.type}
        </div>
        <div className="text-[10px] text-slate-500">
          {new Date(instr.createdAt).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
          {instr.appliedAtTurn != null && (
            <span className="ml-1 text-emerald-400">
              (applied at turn {instr.appliedAtTurn})
            </span>
          )}
        </div>
      </div>
      <StatusPill status={instr.status} />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const label =
    status === "queued" ? "Pending" : status === "applied" ? "Applied" : "Rejected";
  const cls =
    status === "queued"
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
