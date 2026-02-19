import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getTasksCollection } from "@/lib/mongodb";
import { requireUser } from "@/lib/auth";

function jsonError(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

function isValidScheduledIso(iso) {
  if (typeof iso !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(iso);
}

function parseObjectId(id) {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    const user = await requireUser();
    if (!user) return jsonError("Unauthorized", 401);
    const ownerId = new ObjectId(user.userId);

    const body = await request.json();
    const updates = Array.isArray(body?.updates) ? body.updates : null;
    if (!updates || updates.length === 0) return jsonError("No updates");
    if (updates.length > 300) return jsonError("Too many updates");

    const ops = [];
    for (const u of updates) {
      const _id = parseObjectId(u?.id);
      const scheduledDate = u?.scheduledDate;
      const order = Number(u?.order);

      if (!_id) return jsonError("Invalid id in updates");
      if (!isValidScheduledIso(scheduledDate)) return jsonError("Invalid scheduledDate");
      if (!Number.isInteger(order) || order < 0) return jsonError("Invalid order");

      ops.push({
        updateOne: {
          filter: { _id, ownerId },
          update: {
            $set: {
              scheduledDate,
              order,
              updatedAt: new Date().toISOString(),
            },
          },
        },
      });
    }

    const collection = await getTasksCollection();
    const res = await collection.bulkWrite(ops, { ordered: false });

    return NextResponse.json({ ok: true, modifiedCount: res.modifiedCount });
  } catch (e) {
    return jsonError("Failed to reorder", 500, {
      details: e?.message || String(e),
    });
  }
}

