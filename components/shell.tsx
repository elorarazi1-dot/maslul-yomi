"use client";

import { History, LogOut, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent text-lg font-bold text-accent-ink">
              מ
            </span>
            <span className="min-w-0">
              <span className="block text-lg leading-tight font-semibold">מסלול יומי</span>
              <span className="block text-sm text-muted">בעל העסק והמזכירה</span>
            </span>
          </Link>
          <NavLink href="/history" label="היסטוריה">
            <History className="h-5 w-5" />
          </NavLink>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            aria-label="יציאה"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              router.replace("/login");
              router.refresh();
            }}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-5">{children}</main>
    </div>
  );
}

function NavLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "grid h-12 min-w-12 place-items-center rounded-xl px-3 text-sm font-semibold",
        active ? "bg-accent text-accent-ink" : "text-ink hover:bg-paper",
      )}
    >
      <span className="sm:hidden">{children}</span>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="החלפת מצב תצוגה"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="hidden h-5 w-5 dark:block" />
      <Moon className="h-5 w-5 dark:hidden" />
    </Button>
  );
}
