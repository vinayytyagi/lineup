import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/admin";
import { getTasksCollection } from "@/lib/mongodb";
import { dayKeyFromScheduledIso } from "@/lib/date";

function jsonError(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

function isValidScheduledIso(iso) {
  if (typeof iso !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(iso);
}

export async function GET(request, { params }) {
  const admin = await requireAdmin();
  if (!admin) return jsonError("Forbidden", 403);

  const { id } = await Promise.resolve(params);
  let ownerId;
  try {
    ownerId = new ObjectId(id);
  } catch {
    return jsonError("Invalid id");
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  if (!isValidScheduledIso(start) || !isValidScheduledIso(end)) {
    return jsonError("Invalid start/end");
  }

  const tasksCol = await getTasksCollection();
  const tasks = await tasksCol
    .find({ ownerId, scheduledDate: { $gte: start, $lt: end } })
    .sort({ scheduledDate: 1, order: 1, createdAt: -1 })
    .toArray();

  return NextResponse.json({
    tasks: tasks.map((t) => ({
      ...t,
      _id: String(t._id),
      ownerId: String(t.ownerId),
      dayKey: dayKeyFromScheduledIso(t.scheduledDate),
    })),
  });
}

