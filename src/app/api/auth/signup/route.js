import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUsersCollection } from "@/lib/mongodb";
import { setAuthCookie, signAuthToken } from "@/lib/auth";

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
    if (!password || password.length < 6) return jsonError("Password must be 6+ characters");
    if (password.length > 200) return jsonError("Password too long");

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    const users = await getUsersCollection();
    const res = await users.insertOne({
      email,
      passwordHash,
      name: null,
      avatarUrl: null,
      avatarDataUrl: null,
      role: "user",
      createdAt: now,
    });

    const userId = String(res.insertedId);
    const token = await signAuthToken({ userId, email });

    const out = NextResponse.json({
      user: { userId, email, name: null, avatarUrl: null, avatarDataUrl: null, role: "user" },
      token,
    });
    setAuthCookie(out, token);
    return out;
  } catch (e) {
    // Duplicate key
    if (e?.code === 11000) return jsonError("Email already registered", 409);
    return jsonError("Failed to sign up", 500, { details: e?.message || String(e) });
  }
}

