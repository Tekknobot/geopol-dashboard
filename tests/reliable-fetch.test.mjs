import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchJsonWithRetry } from "../app/reliable-fetch.ts";

const success = (data) => new Response(JSON.stringify(data), {
  status: 200, headers: { "Content-Type": "application/json" },
});

async function withFetch(mock, action) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { await action(); } finally { globalThis.fetch = original; }
}

test("recovers from a temporary 503 on the first visit without a page reload", async () => {
  let calls = 0;
  await withFetch(async () => {
    calls += 1;
    return calls === 1 ? new Response("unavailable", { status: 503 }) : success({ stories: [{ id: 1 }] });
  }, async () => {
    const result = await fetchJsonWithRetry("/api/news", {
      retryDelaysMs: [0], isValid: (data) => data.stories?.length > 0,
    });
    assert.equal(result.stories[0].id, 1);
    assert.equal(calls, 2);
  });
});

test("retries a 200 response containing no headlines", async () => {
  let calls = 0;
  await withFetch(async () => success({ stories: calls++ ? [{ title: "Recovered" }] : [] }), async () => {
    const result = await fetchJsonWithRetry("/api/news", {
      retryDelaysMs: [0], isValid: (data) => data.stories?.length > 0,
    });
    assert.equal(result.stories[0].title, "Recovered");
    assert.equal(calls, 2);
  });
});

test("does not retry permanent 404 errors", async () => {
  let calls = 0;
  await withFetch(async () => { calls++; return new Response("missing", { status: 404 }); }, async () => {
    await assert.rejects(fetchJsonWithRetry("/missing", { retryDelaysMs: [0, 0] }), /HTTP 404/);
    assert.equal(calls, 1);
  });
});

test("cancels a pending retry if the page unmounts", async () => {
  const controller = new AbortController();
  let calls = 0;
  await withFetch(async () => { calls++; return new Response("unavailable", { status: 503 }); }, async () => {
    const request = fetchJsonWithRetry("/api/news", { signal: controller.signal, retryDelaysMs: [5000] });
    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.abort();
    await assert.rejects(request);
    assert.equal(calls, 1);
  });
});
