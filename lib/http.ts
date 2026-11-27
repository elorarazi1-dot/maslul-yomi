import { isAuthed } from "@/lib/auth";

export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export async function requireUser(): Promise<Response | null> {
  if (await isAuthed()) return null;
  return jsonError("נדרשת כניסה. הזינו את קוד הגישה ונסו שוב.", 401);
}

export async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
