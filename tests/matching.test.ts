import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { confidenceStatus, normalizeTitle, scoreCandidate } from "../lib/matching.ts";

describe("matching engine", () => {
  it("removes common edition noise", () => {
    assert.equal(normalizeTitle("Midnight City (Remastered 2011)"), "midnight city");
  });

  it("prefers a close official result", () => {
    const score = scoreCandidate({
      title: "Midnight City",
      artist: "M83",
      durationMs: 244000,
      candidate: { id: "1", title: "M83 - Midnight City (Official Video)", channel: "M83", durationMs: 243000 },
    });
    assert.ok(score >= 85);
    assert.equal(confidenceStatus(score), "matched");
  });

  it("penalizes unrelated live versions", () => {
    const score = scoreCandidate({
      title: "Midnight City",
      artist: "M83",
      durationMs: 244000,
      candidate: { id: "2", title: "Midnight City live cover", channel: "Random Band", durationMs: 390000 },
    });
    assert.ok(score < 60);
    assert.equal(confidenceStatus(score), "missing");
  });
});
