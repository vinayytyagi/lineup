import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getTasksCollection } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/admin";

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request, { params }) {
  try {
    const admin = await requireAdmin();
    if (!admin) return jsonError("Forbidden", 403);

    const { id } = await Promise.resolve(params);
    let ownerId;
    try {
      ownerId = new ObjectId(id);
    } catch {
      return jsonError("Invalid id");
    }

    const collection = await getTasksCollection();
    const count = await collection.countDocuments({ ownerId });

    return NextResponse.json({ count });
  } catch (e) {
    return jsonError("Failed to fetch count", 500);
  }
}
