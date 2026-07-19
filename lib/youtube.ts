import { confidenceStatus, scoreCandidate } from "./matching.ts";
import type { Candidate, TrackMatch, YouTubeMatch } from "./types";

export function parseYouTubeDuration(value: string) {
  const match = value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return 0;
  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  return (((Number(days) * 24 + Number(hours)) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000;
}

export function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function decodeYouTubeText(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function classifyYouTubeResult(title: string, channel: string): TrackMatch["kind"] {
  const value = `${title} ${channel}`;
  if (/official\s+audio|provided to youtube by|[-–]\s*topic\b/i.test(value)) return "Official Audio";
  if (/official\s+(music\s+)?video|\bvevo\b/i.test(value)) return "Official Video";
  if (/lyric/i.test(value)) return "Lyrics";
  return "Unknown";
}

export function selectBestYouTubeMatch(input: {
  title: string;
  artist: string;
  durationMs: number;
  candidates: Candidate[];
}): YouTubeMatch {
  const best = rankYouTubeMatches(input)[0];
  return best || {
    youtubeVideoId: null,
    youtubeUrl: null,
    youtubeThumbnail: null,
    youtubeTitle: null,
    channel: null,
    youtubeDuration: null,
    confidence: 0,
    status: "missing",
    kind: "Unknown",
  };
}

export function rankYouTubeMatches(input: {
  title: string;
  artist: string;
  durationMs: number;
  candidates: Candidate[];
}): YouTubeMatch[] {
  return input.candidates
    .map((candidate) => ({ candidate, score: scoreCandidate({ ...input, candidate }) }))
    .sort((left, right) => right.score - left.score)
    .map(({ candidate, score }) => ({
      youtubeVideoId: candidate.id,
      youtubeUrl: `https://music.youtube.com/watch?v=${candidate.id}`,
      youtubeThumbnail: candidate.thumbnail || `https://i.ytimg.com/vi/${candidate.id}/mqdefault.jpg`,
      youtubeTitle: candidate.title,
      channel: candidate.channel,
      youtubeDuration: formatDuration(candidate.durationMs),
      confidence: score,
      status: confidenceStatus(score),
      kind: classifyYouTubeResult(candidate.title, candidate.channel),
    }));
}
