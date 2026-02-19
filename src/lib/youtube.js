import ytdl from "ytdl-core";
import { formatDurationSeconds } from "./time";

export function extractYouTubeVideoId(videoUrl) {
  try {
    if (!videoUrl) return null;
    const url = new URL(videoUrl);

    // youtu.be/<id>
    if (url.hostname === "youtu.be") {
      const id = url.pathname.replace("/", "").trim();
      return id || null;
    }

    // youtube.com/watch?v=<id>
    if (url.searchParams.get("v")) return url.searchParams.get("v");

    // youtube.com/shorts/<id> or /embed/<id>
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.findIndex((p) => p === "shorts" || p === "embed");
    if (idx !== -1 && parts[idx + 1]) return parts[idx + 1];

    return null;
  } catch {
    return null;
  }
}

function withTimeout(promise, ms) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error("YouTube metadata timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

async function fetchOEmbed(videoUrl) {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(videoUrl)}`;
  const res = await withTimeout(fetch(url, { cache: "no-store" }), 6000);
  if (!res.ok) throw new Error("oEmbed request failed");
  return res.json();
}

export async function fetchYouTubeMetadata(videoUrl) {
  const videoId = extractYouTubeVideoId(videoUrl);
  if (!videoId) throw new Error("Invalid YouTube URL");

  let title = null;
  let thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  let videoDuration = null;

  try {
    const requestOptions = {
      headers: {
        // Helps reduce 403s in some networks.
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "accept-language": "en-US,en;q=0.9",
      },
    };

    // BasicInfo is often faster/less brittle, but either may work.
    let details = null;
    try {
      const basic = await withTimeout(
        ytdl.getBasicInfo(videoId, { requestOptions }),
        12000,
      );
      details = basic?.videoDetails || null;
    } catch {
      const info = await withTimeout(
        ytdl.getInfo(videoId, { requestOptions }),
        12000,
      );
      details = info?.videoDetails || null;
    }

    if (details?.title) title = details.title;

    const thumbs = Array.isArray(details?.thumbnails) ? details.thumbnails : [];
    const bestThumb = thumbs.length ? thumbs[thumbs.length - 1].url : null;
    if (bestThumb) thumbnailUrl = bestThumb;

    const lengthSeconds = details?.lengthSeconds
      ? Number(details.lengthSeconds)
      : null;
    if (lengthSeconds) videoDuration = formatDurationSeconds(lengthSeconds);
  } catch {
    // Fall back to oEmbed for at least the title/thumbnail.
    try {
      const o = await fetchOEmbed(videoUrl);
      if (o?.title) title = o.title;
      if (o?.thumbnail_url) thumbnailUrl = o.thumbnail_url;
    } catch {
      // ignore
    }
  }

  return {
    videoId,
    title: title || "Untitled video",
    thumbnailUrl,
    videoDuration,
  };
}
