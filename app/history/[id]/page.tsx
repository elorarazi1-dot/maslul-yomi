import { Suspense } from "react";
import { AuthGate } from "@/components/auth-gate";
import { HistoryDetail } from "@/components/history-screen";
import { Shell } from "@/components/shell";

async function HistoryItemContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AuthGate>
      <Shell>
        <HistoryDetail id={id} />
      </Shell>
    </AuthGate>
  );
}

export default function HistoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-canvas" />}>
      <HistoryItemContent params={params} />
    </Suspense>
  );
}
