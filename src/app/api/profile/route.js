import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth";
import { getUsersCollection } from "@/lib/mongodb";

function jsonError(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

function normalizeOptionalString(v, maxLen) {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (maxLen && s.length > maxLen) return s.slice(0, maxLen);
  return s;
}

export async function GET() {
  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);

  const users = await getUsersCollection();
  const u = await users.findOne({ _id: new ObjectId(user.userId) });
  if (!u) return jsonError("Unauthorized", 401);

  return NextResponse.json({
    profile: {
      userId: String(u._id),
      email: u.email,
      name: u.name || null,
      avatarUrl: u.avatarUrl || null,
      avatarDataUrl: u.avatarDataUrl || null,
      role: u.role || "user",
      createdAt: u.createdAt || null,
    },
  });
}

export async function PATCH(request) {
  const user = await requireUser();
  if (!user) return jsonError("Unauthorized", 401);

  const body = await request.json().catch(() => ({}));
  const name = normalizeOptionalString(body?.name, 60);
  const avatarUrl = normalizeOptionalString(body?.avatarUrl, 500);
  const avatarDataUrl = normalizeOptionalString(body?.avatarDataUrl, 400_000);

  // very light validation on URL
  if (avatarUrl && !/^https?:\/\//i.test(avatarUrl)) {
    return jsonError("avatarUrl must start with http(s)://");
  }

  if (avatarDataUrl) {
    if (!avatarDataUrl.startsWith("data:image/")) {
      return jsonError("avatarDataUrl must be a data:image/* url");
    }
    if (avatarDataUrl.length > 400_000) {
      return jsonError("Avatar image too large");
    }
  }

  const users = await getUsersCollection();
  const res = await users.findOneAndUpdate(
    { _id: new ObjectId(user.userId) },
    { $set: { name, avatarUrl, avatarDataUrl, updatedAt: new Date().toISOString() } },
    { returnDocument: "after" },
  );

  if (!res?.value) return jsonError("Unauthorized", 401);
  const u = res.value;

  return NextResponse.json({
    profile: {
      userId: String(u._id),
      email: u.email,
      name: u.name || null,
      avatarUrl: u.avatarUrl || null,
      avatarDataUrl: u.avatarDataUrl || null,
      role: u.role || "user",
      createdAt: u.createdAt || null,
    },
  });
}

