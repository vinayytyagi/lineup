import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getAdminPanelPassword, setAdminCookie, signAdminSession } from "@/lib/admin";

function jsonError(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

function safeEqual(a, b) {
  const aBuf = Buffer.from(String(a ?? ""), "utf8");
  const bBuf = Buffer.from(String(b ?? ""), "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const password = body?.password;

  const expected = getAdminPanelPassword();
  if (!expected) return jsonError("Admin password not configured", 500);
  if (typeof password !== "string") return jsonError("Invalid password", 400);

  if (!safeEqual(password, expected)) return jsonError("Invalid password", 401);

  const token = await signAdminSession();
  const res = NextResponse.json({ ok: true });
  setAdminCookie(res, token);
  return res;
}
