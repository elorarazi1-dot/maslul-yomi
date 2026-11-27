"use client";

import { use } from "react";
import { AuthGate } from "@/components/auth-gate";
import { HistoryDetail } from "@/components/history-screen";
import { Shell } from "@/components/shell";

export default function HistoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGate>
      <Shell>
        <HistoryDetail id={id} />
      </Shell>
    </AuthGate>
  );
}
