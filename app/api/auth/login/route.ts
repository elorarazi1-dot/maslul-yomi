import { passwordMatches, sealSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { jsonError, readBody } from "@/lib/http";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const body = (await readBody(request)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password || !passwordMatches(password)) {
    return jsonError("קוד הגישה שגוי. נסו שוב.", 401);
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sealSession(), sessionCookieOptions());
  return Response.json({ ok: true });
}
