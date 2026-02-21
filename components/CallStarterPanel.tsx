"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";

function isValidPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

export function CallStarterPanel({
  onSessionCreated,
  disabled: parentDisabled,
}: {
  onSessionCreated: (id: Id<"callSessions">) => void;
  disabled: boolean;
}) {
  const [phone, setPhone] = useState("");
  const [callType, setCallType] = useState<"FEEDBACK" | "PROMOTION">("PROMOTION");
  const [touched, setTouched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = useMutation(api.functions.sessions.createSession);

  const disabled = isLoading || parentDisabled;
  const phoneValid = isValidPhone(phone);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!phoneValid) return;

    setIsLoading(true);
    setError(null);
    try {
      // 1. Create Convex intelligence session
      const result = await createSession({
        prospectPhone: phone,
        callType,
      });
      onSessionCreated(result.sessionId);

      // 2. Trigger voice pipeline (LiveKit + Twilio) via Python API
      try {
        await fetch("/api/voice/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            convexSessionId: result.sessionId,
            phoneNumber: phone,
            callType,
          }),
        });
      } catch (voiceErr) {
        // Voice connect is optional — Convex session still works for testing
        console.warn("Voice pipeline not available:", voiceErr);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start call");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/80 p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Start outbound call</h2>
          <p className="text-xs text-slate-400">
            Enter a phone number and choose the call type.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">Phone number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="+1 (555) 123-4567"
            className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 outline-none ring-0 placeholder:text-slate-500 focus:border-accent focus:ring-1 focus:ring-accent"
            disabled={disabled}
          />
          {touched && !phoneValid && (
            <p className="text-[11px] text-rose-400">Enter a valid US phone number.</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">Call type</label>
          <div className="inline-flex w-full rounded-md border border-slate-700 bg-slate-900 p-1 text-xs">
            <button
              type="button"
              onClick={() => setCallType("FEEDBACK")}
              className={`flex-1 rounded px-2 py-1 font-medium ${
                callType === "FEEDBACK"
                  ? "bg-primary text-slate-50"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
              disabled={disabled}
            >
              Feedback Call
            </button>
            <button
              type="button"
              onClick={() => setCallType("PROMOTION")}
              className={`flex-1 rounded px-2 py-1 font-medium ${
                callType === "PROMOTION"
                  ? "bg-primary text-slate-50"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
              disabled={disabled}
            >
              Promotional Offer
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="submit"
          disabled={disabled || !phoneValid}
          className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-300"
        >
          {parentDisabled ? "Call in progress" : isLoading ? "Dialing..." : "Start Call"}
        </button>
        {error && <p className="text-[11px] text-rose-400">{error}</p>}
      </div>
    </form>
  );
}
