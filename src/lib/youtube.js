import ytdl from "ytdl-core";
import { formatDurationSeconds } from "./time";

/** Parse YouTube API ISO 8601 duration (PT1H2M10S) to seconds */
function parseIso8601Duration(iso) {
  if (typeof iso !== "string" || !iso.startsWith("PT")) return null;
  let seconds = 0;
  const matchH = iso.match(/(\d+)H/);
  const matchM = iso.match(/(\d+)M/);
  const matchS = iso.match(/(\d+)S/);
  if (matchH) seconds += parseInt(matchH[1], 10) * 3600;
  if (matchM) seconds += parseInt(matchM[1], 10) * 60;
  if (matchS) seconds += parseInt(matchS[1], 10);
  return seconds > 0 ? seconds : null;
}

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

async function fetchFromYouTubeDataApi(videoId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;
  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(
    videoId,
  )}&part=snippet,contentDetails&key=${encodeURIComponent(apiKey)}`;
  const res = await withTimeout(fetch(apiUrl, { cache: "no-store" }), 8000);
  if (!res.ok) return null;
  const data = await res.json();
  const item = data?.items?.[0];
  if (!item) return null;
  let title = item.snippet?.title || null;
  const thumb =
    item.snippet?.thumbnails?.maxres?.url ||
    item.snippet?.thumbnails?.high?.url ||
    item.snippet?.thumbnails?.medium?.url ||
    null;
  const dur = parseIso8601Duration(item.contentDetails?.duration);
  return {
    title,
    thumbnailUrl: thumb,
    videoDuration: dur ? formatDurationSeconds(dur) : null,
  };
}

async function fetchFromYtdl(videoId) {
  const requestOptions = {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
    },
  };
  let details = null;
  try {
    const basic = await withTimeout(
      ytdl.getBasicInfo(videoId, { requestOptions }),
      10000,
    );
    details = basic?.videoDetails || null;
  } catch {
    const info = await withTimeout(
      ytdl.getInfo(videoId, { requestOptions }),
      10000,
    );
    details = info?.videoDetails || null;
  }
  if (!details) return null;
  const title = details.title || null;
  const thumbs = Array.isArray(details?.thumbnails) ? details.thumbnails : [];
  const thumbnailUrl = thumbs.length ? thumbs[thumbs.length - 1].url : null;
  const lengthSeconds = details?.lengthSeconds
    ? Number(details.lengthSeconds)
    : null;
  const videoDuration = lengthSeconds
    ? formatDurationSeconds(lengthSeconds)
    : null;
  return { title, thumbnailUrl, videoDuration };
}

export async function fetchYouTubeMetadata(videoUrl) {
  const videoId = extractYouTubeVideoId(videoUrl);
  if (!videoId) throw new Error("Invalid YouTube URL");

  let title = null;
  let thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  let videoDuration = null;

  // 1. Try YouTube Data API v3 first (works reliably in production)
  try {
    const apiResult = await fetchFromYouTubeDataApi(videoId);
    if (apiResult) {
      if (apiResult.title) title = apiResult.title;
      if (apiResult.thumbnailUrl) thumbnailUrl = apiResult.thumbnailUrl;
      if (apiResult.videoDuration) videoDuration = apiResult.videoDuration;
    }
  } catch {
    // ignore, try ytdl
  }

  // 2. Fallback to ytdl (works locally, often blocked in production)
  if (!title || !videoDuration) {
    try {
      const ytdlResult = await fetchFromYtdl(videoId);
      if (ytdlResult) {
        if (ytdlResult.title && !title) title = ytdlResult.title;
        if (ytdlResult.thumbnailUrl && !thumbnailUrl)
          thumbnailUrl = ytdlResult.thumbnailUrl;
        if (ytdlResult.videoDuration && !videoDuration)
          videoDuration = ytdlResult.videoDuration;
      }
    } catch {
      // ignore
    }
  }

  // 3. Fallback to oEmbed (title + thumbnail only, no duration)
  if (!title || !thumbnailUrl) {
    try {
      const o = await fetchOEmbed(videoUrl);
      if (o?.title && !title) title = o.title;
      if (o?.thumbnail_url && !thumbnailUrl) thumbnailUrl = o.thumbnail_url;
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
