import assert from "node:assert/strict";
import test from "node:test";
import { classifyYouTubeResult, parseYouTubeDuration, selectBestYouTubeMatch } from "../lib/youtube.ts";

test("YouTube ISO sürelerini milisaniyeye çevirir", () => {
  assert.equal(parseYouTubeDuration("PT4M3S"), 243_000);
  assert.equal(parseYouTubeDuration("PT1H2M3S"), 3_723_000);
});

test("resmî ses kaydını sınıflandırır", () => {
  assert.equal(classifyYouTubeResult("Midnight City", "M83 - Topic"), "Official Audio");
});

test("başlık, sanatçı ve süreye göre en güçlü adayı seçer", () => {
  const match = selectBestYouTubeMatch({
    title: "Midnight City",
    artist: "M83",
    durationMs: 243_000,
    candidates: [
      { id: "abcdefghijk", title: "Midnight City (Live)", channel: "Festival", durationMs: 300_000 },
      { id: "lmnopqrstuv", title: "M83 - Midnight City (Official Audio)", channel: "M83 - Topic", durationMs: 243_000 },
    ],
  });
  assert.equal(match.youtubeVideoId, "lmnopqrstuv");
  assert.equal(match.status, "matched");
});
