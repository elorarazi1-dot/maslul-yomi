"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorBanner } from "@/components/error-banner";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then(async (response) => {
        const data = (await response.json()) as { ok?: boolean };
        if (cancelled) return;
        if (data.ok) setState("ready");
        else router.replace("/login");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (state === "error") {
    return (
      <div className="mx-auto max-w-lg p-6">
        <ErrorBanner message="לא הצלחנו לבדוק את הכניסה. בדקו את החיבור ונסו שוב." onRetry={() => window.location.reload()} />
      </div>
    );
  }
  if (state !== "ready") {
    return <p className="p-10 text-center text-muted">בודקים הרשאה…</p>;
  }
  return children;
}
