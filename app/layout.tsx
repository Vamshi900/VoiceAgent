import "./globals.css";
import type { ReactNode } from "react";
import { ConvexProvider } from "./ConvexProvider";

export const metadata = {
  title: "CallFlow Voice",
  description: "Outbound AI voice agent with human-in-the-loop controls."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <ConvexProvider>{children}</ConvexProvider>
      </body>
    </html>
  );
}

