import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getTasksCollection } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const user = await requireUser(request);
    if (!user) return jsonError("Unauthorized", 401);
    const ownerId = new ObjectId(user.userId);

    const collection = await getTasksCollection();
    const count = await collection.countDocuments({ ownerId });

    return NextResponse.json({ count });
  } catch (e) {
    return jsonError("Failed to fetch count", 500);
  }
}
