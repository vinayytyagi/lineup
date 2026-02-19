import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { ObjectId } from "mongodb";
import { getUsersCollection } from "@/lib/mongodb";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  try {
    const users = await getUsersCollection();
    const u = await users.findOne({ _id: new ObjectId(user.userId) });
    if (!u) return NextResponse.json({ user: null }, { status: 401 });
    return NextResponse.json({
      user: {
        userId: String(u._id),
        email: u.email,
        name: u.name || null,
        avatarUrl: u.avatarUrl || null,
        avatarDataUrl: u.avatarDataUrl || null,
        role: u.role || "user",
      },
    });
  } catch {
    return NextResponse.json({ user }, { status: 200 });
  }
}

