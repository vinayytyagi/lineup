import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getTasksCollection } from "@/lib/mongodb";
import { dayKeyFromScheduledIso } from "@/lib/date";
import { fetchYouTubeMetadata } from "@/lib/youtube";
import { requireUser } from "@/lib/auth";

function jsonError(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

function isValidScheduledIso(iso) {
  if (typeof iso !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(iso);
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeOptionalString(v) {
  if (!isNonEmptyString(v)) return null;
  return v.trim();
}

async function getNextOrder(collection, scheduledDate) {
  const last = await collection
    .find({ scheduledDate, order: { $type: "number" } })
    .sort({ order: -1 })
    .limit(1)
    .toArray();
  const maxOrder = last?.[0]?.order;
  return (Number.isFinite(Number(maxOrder)) ? Number(maxOrder) : 0) + 1000;
}

export async function GET(request) {
  try {
    const user = await requireUser();
    if (!user) return jsonError("Unauthorized", 401);
    const ownerId = new ObjectId(user.userId);

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!isValidScheduledIso(start) || !isValidScheduledIso(end)) {
      return jsonError(
        "`start` and `end` must be ISO strings like YYYY-MM-DDT00:00:00.000Z",
      );
    }

    if (start >= end) {
      return jsonError("`start` must be < `end`");
    }

    const collection = await getTasksCollection();

    const tasks = await collection
      .find({ ownerId, scheduledDate: { $gte: start, $lt: end } })
      .sort({ scheduledDate: 1, order: 1, createdAt: -1 })
      .toArray();

    // Ensure client has stable dayKey grouping if needed.
    const out = tasks.map((t) => ({
      ...t,
      _id: String(t._id),
      ownerId: String(t.ownerId),
      dayKey: dayKeyFromScheduledIso(t.scheduledDate),
    }));

    return NextResponse.json({ tasks: out });
  } catch (e) {
    return jsonError("Failed to fetch tasks", 500, {
      details: e?.message || String(e),
    });
  }
}

export async function POST(request) {
  try {
    const user = await requireUser();
    if (!user) return jsonError("Unauthorized", 401);
    const ownerId = new ObjectId(user.userId);

    const body = await request.json();

    const scheduledDate = body?.scheduledDate;
    const videoUrl = normalizeOptionalString(body?.videoUrl);
    const notes = normalizeOptionalString(body?.notes);
    const rawTime = body?.timeToComplete;
    const timeToComplete =
      rawTime === undefined || rawTime === null
        ? null
        : Number(rawTime);

    if (!isValidScheduledIso(scheduledDate)) {
      return jsonError(
        "`scheduledDate` must be ISO like YYYY-MM-DDT00:00:00.000Z",
      );
    }

    if (timeToComplete != null) {
      if (!Number.isInteger(timeToComplete) || timeToComplete <= 0) {
        return jsonError("`timeToComplete` must be a positive integer (minutes)");
      }
      if (timeToComplete > 7 * 24 * 60) {
        return jsonError("`timeToComplete` is too large");
      }
    }

    if (!videoUrl && !notes) {
      return jsonError("Provide at least a YouTube link or notes");
    }

    let type = "note";
    let title = null;
    let thumbnailUrl = null;
    let videoDuration = null;

    if (videoUrl) {
      type = "video";
      const meta = await fetchYouTubeMetadata(videoUrl);
      title = meta.title;
      thumbnailUrl = meta.thumbnailUrl;
      videoDuration = meta.videoDuration;
    } else if (notes) {
      // Derive a light title from the first line for consistency.
      title = notes.split("\n")[0].trim().slice(0, 80) || "Note";
    }

    const nowIso = new Date().toISOString();

    const doc = {
      ownerId,
      type,
      title,
      videoUrl,
      thumbnailUrl,
      videoDuration,
      notes,
      scheduledDate,
      timeToComplete,
      order: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const collection = await getTasksCollection();
    doc.order = await getNextOrder(collection, scheduledDate);
    const res = await collection.insertOne(doc);

    return NextResponse.json({
      task: {
        ...doc,
        _id: String(res.insertedId),
        ownerId: String(ownerId),
        dayKey: dayKeyFromScheduledIso(scheduledDate),
      },
    });
  } catch (e) {
    return jsonError("Failed to create task", 500, {
      details: e?.message || String(e),
    });
  }
}

