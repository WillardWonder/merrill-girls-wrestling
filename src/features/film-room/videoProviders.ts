import type { FilmProvider } from "./filmRoomStore";

const SUPPORTED_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "tiktok.com",
  "www.tiktok.com",
  "vm.tiktok.com",
  "instagram.com",
  "www.instagram.com",
  "vimeo.com",
  "www.vimeo.com",
  "player.vimeo.com",
  "facebook.com",
  "www.facebook.com",
  "fb.watch",
];

export function parseVideoUrl(raw: string): {
  url: string;
  provider: FilmProvider;
  youtubeId?: string;
  vimeoId?: string;
} {
  let parsed: URL;

  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error("Paste the full video link.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Use an https video link.");
  }

  const host = parsed.hostname.toLowerCase();

  if (!SUPPORTED_HOSTS.includes(host)) {
    throw new Error(
      "Use a YouTube, TikTok, Instagram, Vimeo, or Facebook video link.",
    );
  }

  if (host === "youtu.be") {
    const youtubeId = parsed.pathname.split("/").filter(Boolean)[0];
    if (!youtubeId) throw new Error("Check the YouTube link and try again.");
    return { url: parsed.toString(), provider: "youtube", youtubeId };
  }

  if (host.includes("youtube.com")) {
    const parts = parsed.pathname.split("/").filter(Boolean);
    const youtubeId =
      parsed.searchParams.get("v") ??
      (["shorts", "embed"].includes(parts[0] ?? "") ? parts[1] : undefined);

    if (!youtubeId) throw new Error("Check the YouTube link and try again.");
    return { url: parsed.toString(), provider: "youtube", youtubeId };
  }

  if (host.includes("tiktok.com")) {
    return { url: parsed.toString(), provider: "tiktok" };
  }

  if (host.includes("instagram.com")) {
    return { url: parsed.toString(), provider: "instagram" };
  }

  if (host.includes("vimeo.com")) {
    const parts = parsed.pathname.split("/").filter(Boolean);
    const vimeoId = [...parts].reverse().find((part) => /^\d+$/.test(part));
    return { url: parsed.toString(), provider: "vimeo", vimeoId };
  }

  return { url: parsed.toString(), provider: "facebook" };
}

export function youtubeThumbnail(url: string): string | undefined {
  try {
    const parsed = parseVideoUrl(url);
    return parsed.youtubeId
      ? `https://i.ytimg.com/vi/${parsed.youtubeId}/hqdefault.jpg`
      : undefined;
  } catch {
    return undefined;
  }
}

export function providerLabel(provider: FilmProvider): string {
  switch (provider) {
    case "youtube":
      return "YouTube";
    case "tiktok":
      return "TikTok";
    case "instagram":
      return "Instagram";
    case "vimeo":
      return "Vimeo";
    case "facebook":
      return "Facebook";
  }
}
