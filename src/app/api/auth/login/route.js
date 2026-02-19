import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUsersCollection } from "@/lib/mongodb";
import { setSessionCookie, signSession } from "@/lib/auth";

function jsonError(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

function normalizeEmail(email) {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  if (!e.includes("@") || e.length > 254) return null;
  return e;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const email = normalizeEmail(body?.email);
    const password = typeof body?.password === "string" ? body.password : null;

    if (!email) return jsonError("Invalid email");
    if (!password) return jsonError("Password is required");

    const users = await getUsersCollection();
    const user = await users.findOne({ email });
    if (!user) return jsonError("Invalid credentials", 401);

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return jsonError("Invalid credentials", 401);

    const userId = String(user._id);
    const token = await signSession({ userId, email });

    const out = NextResponse.json({
      user: {
        userId,
        email,
        name: user.name || null,
        avatarUrl: user.avatarUrl || null,
        avatarDataUrl: user.avatarDataUrl || null,
        role: user.role || "user",
      },
    });
    setSessionCookie(out, token);
    return out;
  } catch (e) {
    return jsonError("Failed to login", 500, { details: e?.message || String(e) });
  }
}

