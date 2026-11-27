export async function api<T>(
  url: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (response.status === 401 && !url.endsWith("/api/auth/login")) {
      window.dispatchEvent(new Event("maslul-unauthorized"));
      return { ok: false, error: "נדרשת כניסה מחדש.", status: 401 };
    }
    if (!response.ok) {
      return {
        ok: false,
        error: data.error || "הפעולה נכשלה. נסו שוב.",
        status: response.status,
      };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: "לא הצלחנו להתחבר לשרת. בדקו את החיבור ונסו שוב.", status: 0 };
  }
}
