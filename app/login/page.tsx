"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ErrorBanner } from "@/components/error-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/client-api";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showDefault, setShowDefault] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (response) => {
        const data = (await response.json()) as { ok?: boolean };
        if (data.ok) router.replace("/");
      })
      .catch(() => undefined);
    fetch("/api/status")
      .then(async (response) => {
        const data = (await response.json()) as { passwordIsDefault?: boolean };
        setShowDefault(Boolean(data.passwordIsDefault));
      })
      .catch(() => undefined);
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    const result = await api<{ ok: boolean }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-xl font-bold text-accent-ink">מ</span>
        <div>
          <h1 className="text-2xl font-semibold">מסלול יומי</h1>
          <p className="text-sm text-muted">כניסה לבעל העסק ולמזכירה</p>
        </div>
      </div>
      <form onSubmit={submit} className="rounded-3xl border border-line bg-paper p-5 shadow-[var(--shadow)]">
        <Label htmlFor="password">קוד גישה</Label>
        <Input
          id="password"
          className="mt-1"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {showDefault ? (
          <p className="mt-3 text-sm text-muted">
            לסביבת ההדגמה הקוד הוא <span className="font-semibold text-ink">demo</span>. לפני שימוש אמיתי הגדירו
            APP_ACCESS_PASSWORD.
          </p>
        ) : null}
        {error ? (
          <div className="mt-3">
            <ErrorBanner message={error} onRetry={() => void submit(new Event("submit") as unknown as FormEvent)} />
          </div>
        ) : null}
        <Button type="submit" size="lg" className="mt-4 w-full" disabled={pending}>
          {pending ? "נכנסים…" : "כניסה"}
        </Button>
      </form>
    </div>
  );
}
