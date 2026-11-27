import { isAuthed, passwordIsDefault } from "@/lib/auth";

export async function GET() {
  return Response.json({ ok: await isAuthed(), passwordIsDefault: passwordIsDefault() });
}
