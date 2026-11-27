"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      {children}
      <ThemedToaster />
      <ServiceWorkerRegister />
      <AuthRedirect />
    </ThemeProvider>
  );
}

function AuthRedirect() {
  const router = useRouter();
  useEffect(() => {
    const onUnauthorized = () => router.replace("/login");
    window.addEventListener("maslul-unauthorized", onUnauthorized);
    return () => window.removeEventListener("maslul-unauthorized", onUnauthorized);
  }, [router]);
  return null;
}

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      dir="rtl"
      position="top-center"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      toastOptions={{ style: { fontFamily: "inherit" } }}
    />
  );
}

function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}
