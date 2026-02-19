import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/admin";
import { getUsersCollection } from "@/lib/mongodb";

function jsonError(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function GET(_request, { params }) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("Forbidden", 403);

  const { id } = await Promise.resolve(params);
  let _id;
  try {
    _id = new ObjectId(id);
  } catch {
    return jsonError("Invalid id");
  }

  const users = await getUsersCollection();
  const u = await users.findOne(
    { _id },
    {
      projection: {
        email: 1,
        name: 1,
        avatarUrl: 1,
        avatarDataUrl: 1,
        role: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  );
  if (!u) return jsonError("Not found", 404);

  return NextResponse.json({
    user: {
      userId: String(u._id),
      email: u.email,
      name: u.name || null,
      avatarUrl: u.avatarUrl || null,
      avatarDataUrl: u.avatarDataUrl || null,
      role: u.role || "user",
      createdAt: u.createdAt || null,
      updatedAt: u.updatedAt || null,
    },
  });
}

