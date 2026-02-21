import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  CallSession,
  CallStatus,
  CallType,
  OfferState,
  OperatorInstruction,
  TranscriptEntry,
} from "../types";

/* ── Store shape ──────────────────────────────────────────────── */

interface CallStore {
  callSession: CallSession | null;
  isLoading: boolean;
  error: string | null;

  /* actions */
  startCall: (phone: string, type: CallType, baseOffer: number) => Promise<void>;
  setCallStatus: (status: CallStatus) => void;
  addTranscriptEntry: (entry: Omit<TranscriptEntry, "id">) => void;
  sendInstruction: (content: string) => Promise<void>;
  applyApprovedOffer: (amount: number) => Promise<void>;
  resetCall: () => void;
}

/* ── Store implementation ─────────────────────────────────────── */

export const useCallStore = create<CallStore>((set, get) => ({
  callSession: null,
  isLoading: false,
  error: null,

  async startCall(phone, type, baseOffer) {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch("/api/calls/outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phone,
          callType: type,
          baseOffer,
        }),
      });

      if (!res.ok) throw new Error("Failed to start call");
      const data = await res.json();

      const offer: OfferState | null =
        type === "PROMOTION"
          ? {
              baseAmount: baseOffer,
              requestedAmount: null,
              approvedAmount: null,
              code: null,
            }
          : null;

      const session: CallSession = {
        id: data.callSessionId,
        phoneNumber: phone,
        type,
        status: "DIALING",
        offer,
        transcript: [],
        instructions: [],
        startedAt: new Date().toISOString(),
        endedAt: null,
      };

      set({ callSession: session, isLoading: false });

      // Simulate progression to LIVE after a short delay (stub behavior)
      setTimeout(() => {
        const current = get().callSession;
        if (current && current.status === "DIALING") {
          set({ callSession: { ...current, status: "LIVE" } });
        }
      }, 2000);
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },

  setCallStatus(status) {
    const session = get().callSession;
    if (!session) return;
    set({
      callSession: {
        ...session,
        status,
        endedAt:
          status === "COMPLETED" || status === "FAILED"
            ? new Date().toISOString()
            : session.endedAt,
      },
    });
  },

  addTranscriptEntry(entry) {
    const session = get().callSession;
    if (!session) return;
    set({
      callSession: {
        ...session,
        transcript: [
          ...session.transcript,
          { ...entry, id: nanoid() },
        ],
      },
    });
  },

  async sendInstruction(content) {
    const session = get().callSession;
    if (!session) return;

    const instruction: OperatorInstruction = {
      id: nanoid(),
      content,
      status: "pending",
      createdAt: Date.now(),
    };

    set({
      callSession: {
        ...session,
        instructions: [...session.instructions, instruction],
      },
    });

    try {
      await fetch(`/api/calls/${session.id}/instructions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      // Mark as applied after server acknowledges
      const current = get().callSession;
      if (!current) return;
      set({
        callSession: {
          ...current,
          instructions: current.instructions.map((i) =>
            i.id === instruction.id ? { ...i, status: "applied" } : i
          ),
        },
      });
    } catch {
      const current = get().callSession;
      if (!current) return;
      set({
        callSession: {
          ...current,
          instructions: current.instructions.map((i) =>
            i.id === instruction.id ? { ...i, status: "rejected" } : i
          ),
        },
      });
    }
  },

  async applyApprovedOffer(amount) {
    const session = get().callSession;
    if (!session || !session.offer) return;

    set({
      callSession: {
        ...session,
        offer: { ...session.offer, approvedAmount: amount },
      },
    });
  },

  resetCall() {
    set({ callSession: null, isLoading: false, error: null });
  },
}));
