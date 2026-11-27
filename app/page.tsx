"use client";

import { AuthGate } from "@/components/auth-gate";
import { PlannerApp } from "@/components/planner-app";
import { Shell } from "@/components/shell";

export default function HomePage() {
  return (
    <AuthGate>
      <Shell>
        <PlannerApp />
      </Shell>
    </AuthGate>
  );
}
