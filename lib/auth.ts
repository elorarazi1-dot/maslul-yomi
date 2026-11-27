import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "maslul_session";
const SESSION_DAYS = 30;

export function accessPassword(): string {
  const configured = process.env.APP_ACCESS_PASSWORD?.trim();
  return configured || "demo";
}

export function passwordIsDefault(): boolean {
  return !process.env.APP_ACCESS_PASSWORD?.trim();
}

export function passwordMatches(input: string): boolean {
  const expected = createHash("sha256").update(accessPassword()).digest();
  const actual = createHash("sha256").update(input).digest();
  return timingSafeEqual(expected, actual);
}

export function sealSession(now = Date.now()): string {
  const exp = Math.floor(now / 1000) + SESSION_DAYS * 24 * 60 * 60;
  const sig = createHmac("sha256", secret()).update(`v1|${exp}`).digest("hex");
  return `v1.${exp}.${sig}`;
}

export function verifyToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [version, expRaw, sig] = token.split(".");
  if (version !== "v1" || !expRaw || !sig) return false;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp * 1000 < now) return false;
  const expected = createHmac("sha256", secret()).update(`v1|${exp}`).digest("hex");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function isAuthed(): Promise<boolean> {
  const jar = await cookies();
  return verifyToken(jar.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

function secret(): string {
  return `${accessPassword()}|maslul-yomi-session`;
}
