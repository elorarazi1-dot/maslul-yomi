"use client";

import { AuthGate } from "@/components/auth-gate";
import { HistoryScreen } from "@/components/history-screen";
import { Shell } from "@/components/shell";

export default function HistoryPage() {
  return (
    <AuthGate>
      <Shell>
        <HistoryScreen />
      </Shell>
    </AuthGate>
  );
}
