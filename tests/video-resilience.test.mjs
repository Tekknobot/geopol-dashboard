import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("video API bounds slow publisher requests", async () => {
  const route = await readFile(new URL("../app/api/video-news/route.ts", import.meta.url), "utf8");
  assert.match(route, /AbortSignal\.timeout\(FEED_TIMEOUT_MS\)/);
  assert.match(route, /Promise\.allSettled/);
});

test("desk video component leaves loading state and offers a playlist fallback", async () => {
  const component = await readFile(new URL("../app/components/DeskVideoSection.tsx", import.meta.url), "utf8");
  assert.match(component, /setLoadState\("fallback"\)/);
  assert.match(component, /embed\/videoseries\?list=/);
  assert.match(component, /Retry video desk/);
});
