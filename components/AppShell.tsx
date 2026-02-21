"use client";

import type { ReactNode } from "react";
import { LogoMark } from "./LogoMark";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-50">
      <header className="border-b border-slate-800 bg-slate-950/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <LogoMark className="h-8 w-8" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight">CallFlow Voice</span>
              <span className="text-xs text-slate-400">
                Outbound AI calls with human-in-the-loop
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald-950/60 px-3 py-1 text-xs font-medium text-emerald-300">
              Sandbox
            </span>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto flex max-w-6xl flex-col px-4 py-6">{children}</div>
      </main>
    </div>
  );
}

