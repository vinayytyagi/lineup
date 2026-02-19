import { NextResponse } from "next/server";
import { getUsersCollection } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin";

function jsonError(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return jsonError("Forbidden", 403);

  const users = await getUsersCollection();
  const list = await users
    .find(
      {},
      { projection: { email: 1, name: 1, avatarUrl: 1, avatarDataUrl: 1, role: 1, createdAt: 1 } },
    )
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray();

  return NextResponse.json({
    users: list.map((u) => ({
      userId: String(u._id),
      email: u.email,
      name: u.name || null,
      avatarUrl: u.avatarUrl || null,
      avatarDataUrl: u.avatarDataUrl || null,
      role: u.role || "user",
      createdAt: u.createdAt || null,
    })),
  });
}

