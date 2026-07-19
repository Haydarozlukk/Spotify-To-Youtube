import type { Candidate } from "./types";

const noise = /\s*[\[(](remaster(?:ed)?(?:\s+\d{4})?|bonus track|deluxe|explicit)[\])]\s*/gi;
const unwanted = /\b(live|cover|karaoke|reaction|nightcore|slowed|reverb|bass boosted)\b/i;

export function normalizeTitle(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(noise, " ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tokenSimilarity(a: string, b: string) {
  const left = new Set(normalizeTitle(a).split(" ").filter(Boolean));
  const right = new Set(normalizeTitle(b).split(" ").filter(Boolean));
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  return intersection / left.size;
}

export function scoreCandidate(input: {
  title: string;
  artist: string;
  durationMs: number;
  candidate: Candidate;
}) {
  const titleScore = tokenSimilarity(input.title, input.candidate.title) * 40;
  const artistScore = tokenSimilarity(input.artist, `${input.candidate.title} ${input.candidate.channel}`) * 30;
  const difference = Math.abs(input.durationMs - input.candidate.durationMs) / 1000;
  const durationScore = difference <= 3 ? 20 : difference <= 10 ? 14 : difference <= 15 ? 7 : 0;
  const officialScore = /official|vevo|topic/i.test(`${input.candidate.title} ${input.candidate.channel}`) ? 10 : 0;
  const penalty = unwanted.test(input.candidate.title) && !unwanted.test(input.title) ? 30 : 0;

  return Math.max(0, Math.min(100, Math.round(titleScore + artistScore + durationScore + officialScore - penalty)));
}

export function confidenceStatus(score: number) {
  if (score >= 85) return "matched" as const;
  if (score >= 60) return "review" as const;
  return "missing" as const;
}
