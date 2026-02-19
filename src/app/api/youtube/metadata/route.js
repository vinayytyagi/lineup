import { NextResponse } from "next/server";
import { fetchYouTubeMetadata } from "@/lib/youtube";

function jsonError(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    if (!url) return jsonError("Missing url");
    const meta = await fetchYouTubeMetadata(url);
    return NextResponse.json({ meta });
  } catch (e) {
    return jsonError("Failed to fetch metadata", 500, { details: e?.message || String(e) });
  }
}

