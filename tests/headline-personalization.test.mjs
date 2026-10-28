import assert from "node:assert/strict";
import test from "node:test";
import { personalizeHeadlines } from "../app/api/news/headline-personalization.ts";

const now = Date.parse("2026-10-28T04:00:00.000Z");
const story = (title, countryCode, region, minutesAgo, evidence="location") => ({
  title,
  countryCode,
  countryEvidence: evidence,
  region,
  level: "watch",
  summary: "Regional developments and international reporting, summarized from publisher sources for readers.",
  publishedAt: new Date(now - minutesAgo*60_000).toISOString(),
});

const pool = [
  ...Array.from({length: 10}, (_, i) => story(`Canadian ${i}`, "CA", "Canada", 15+i*12)),
  ...Array.from({length: 10}, (_, i) => story(`Sri Lankan ${i}`, "LK", "South Asia", 12+i*13)),
  ...Array.from({length: 10}, (_, i) => story(`International ${i}`, "US", "United States", i*7)),
];

test("Canadian visitors see domestic news leading, interleaved with global headlines", () => {
  const ranked = personalizeHeadlines(pool, {countryCode:"CA", region:"Canada"}, now);
  assert.match(ranked[0].title, /Canadian/);
  assert.match(ranked[1].title, /^(?!Canadian)/);
  assert.match(ranked[2].title, /Canadian/);
  assert.ok(ranked.slice(0, 10).some((item) => item.title.startsWith("International")));
  assert.deepEqual(new Set(ranked.map((s)=>s.title)), new Set(pool.map((s)=>s.title)));
});

test("A Sri Lankan visitor sees different leading headlines from the same source pool", () => {
  const ranked = personalizeHeadlines(pool, {countryCode:"LK",region:"South Asia"}, now);
  assert.match(ranked[0].title, /Sri Lankan/);
  assert.match(ranked[2].title, /Sri Lankan/);
  assert.notEqual(ranked[0].title, personalizeHeadlines(pool, {countryCode:"CA",region:"Canada"}, now)[0].title);
});

test("A missing viewer location retains unbiased quality ranking", () => {
  const ranked = personalizeHeadlines(pool, null, now);
  assert.equal(ranked[0].title, "International 0");
});

test("Do not force stale domestic headlines above recent world stories", () => {
  const stories = [story("Old domestic", "CA", "Canada", 2*24*60), story("New global", "US", "United States", 10)];
  assert.equal(personalizeHeadlines(stories, {countryCode:"CA", region:"Canada"}, now)[0].title, "New global");
});

test("Only a matching country, not merely a regional label, qualifies as domestic", () => {
  const stories = [story("UK", "GB", "Europe", 30),story("France", "FR", "Europe", 40)];
  assert.equal(personalizeHeadlines(stories,{countryCode:"FR",region:"Europe"}, now)[0].title,"France");
});

test("Regional fallback does not pretend to be specific country news", () => {
  const stories = [story("Regional",undefined,"South Asia", 30),story("Elsewhere","US","United States", 20)];
  assert.equal(personalizeHeadlines(stories,{countryCode:"LK",region:"South Asia"},now)[0].title,"Regional");
});
