import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getTasksCollection } from "@/lib/mongodb";
import { dayKeyFromScheduledIso } from "@/lib/date";
import { extractYouTubeVideoId, fetchYouTubeMetadata } from "@/lib/youtube";
import { requireUser } from "@/lib/auth";

function jsonError(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function normalizeOptionalString(v) {
  if (!isNonEmptyString(v)) return null;
  return v.trim();
}

function parseObjectId(id) {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

function isValidScheduledIso(iso) {
  if (typeof iso !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(iso);
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

export const dynamic = "force-dynamic";

export async function PATCH(request, { params }) {
  try {
    const user = await requireUser(request);
    if (!user) return jsonError("Unauthorized", 401);
    const ownerId = new ObjectId(user.userId);

    const { id } = await Promise.resolve(params);
    const _id = parseObjectId(id);
    if (!_id) return jsonError("Invalid id");

    const body = await request.json();
    const scheduledDate =
      body?.scheduledDate === undefined ? undefined : body.scheduledDate;
    const videoUrl = normalizeOptionalString(body?.videoUrl);
    const notes = normalizeOptionalString(body?.notes);
    const order = body?.order === undefined ? undefined : Number(body.order);

    const rawTime = body?.timeToComplete;
    const timeToComplete =
      rawTime === undefined
        ? undefined
        : rawTime === null
          ? null
          : Number(rawTime);

    if (scheduledDate !== undefined && !isValidScheduledIso(scheduledDate)) {
      return jsonError(
        "`scheduledDate` must be ISO like YYYY-MM-DDT00:00:00.000Z",
      );
    }

    if (order !== undefined) {
      if (!Number.isInteger(order) || order < 0) return jsonError("Invalid order");
    }

    if (timeToComplete !== undefined && timeToComplete !== null) {
      if (!Number.isInteger(timeToComplete) || timeToComplete <= 0) {
        return jsonError("`timeToComplete` must be a positive integer (minutes)");
      }
      if (timeToComplete > 7 * 24 * 60) return jsonError("`timeToComplete` is too large");
    }

    if (!videoUrl && !notes) {
      return jsonError("Provide at least a YouTube link or notes");
    }

    let type = videoUrl ? "video" : "note";
    let title = null;
    let thumbnailUrl = null;
    let videoDuration = null;

    if (videoUrl) {
      try {
        const meta = await fetchYouTubeMetadata(videoUrl);
        title = meta.title;
        thumbnailUrl = meta.thumbnailUrl;
        videoDuration = meta.videoDuration;
      } catch {
        const vid = extractYouTubeVideoId(videoUrl);
        title = "Untitled video";
        thumbnailUrl = vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : null;
        videoDuration = null;
      }
    } else if (notes) {
      title = notes.split("\n")[0].trim().slice(0, 80) || "Note";
    }

    const update = {
      type,
      title,
      videoUrl,
      thumbnailUrl,
      videoDuration,
      notes,
      updatedAt: new Date().toISOString(),
    };

    if (timeToComplete !== undefined) update.timeToComplete = timeToComplete;
    if (scheduledDate !== undefined) update.scheduledDate = scheduledDate;
    if (order !== undefined) update.order = order;

    const collection = await getTasksCollection();

    const existing = await collection.findOne({ _id });
    if (!existing) return jsonError("Task not found", 404);

    const taskOwnerStr = existing.ownerId?.toString?.() ?? String(existing.ownerId);
    if (taskOwnerStr !== String(user.userId)) {
      return jsonError(
        "You don't have permission to edit this task. Try logging out and back in.",
        403,
      );
    }

    if (scheduledDate !== undefined && order === undefined) {
      update.order = await getNextOrder(collection, scheduledDate);
    }

    const raw = await collection.findOneAndUpdate(
      { _id },
      { $set: update },
      { returnDocument: "after" },
    );
    let t = raw?.value ?? raw;
    if (!t || !t._id) {
      t = await collection.findOne({ _id });
      if (!t) {
        return jsonError("Failed to update task", 500, {
          details: "Update succeeded but could not return updated task",
        });
      }
    }
    return NextResponse.json({
      task: {
        ...t,
        _id: String(t._id),
        ownerId: String(t.ownerId),
        dayKey: dayKeyFromScheduledIso(t.scheduledDate),
      },
    });
  } catch (e) {
    return jsonError("Failed to update task", 500, {
      details: e?.message || String(e),
    });
  }
}

export async function DELETE(request, { params }) {
  try {
    const user = await requireUser(request);
    if (!user) return jsonError("Unauthorized", 401);
    const ownerId = new ObjectId(user.userId);

    const { id } = await Promise.resolve(params);
    const _id = parseObjectId(id);
    if (!_id) return jsonError("Invalid id");

    const collection = await getTasksCollection();
    const res = await collection.deleteOne({ _id, ownerId });
    if (!res?.deletedCount) return jsonError("Task not found", 404);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError("Failed to delete task", 500, {
      details: e?.message || String(e),
    });
  }
}

