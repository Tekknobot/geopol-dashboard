/**
 * Retries transient API errors (including cold starts) rather than leaving a
 * newsroom blank until the visitor manually refreshes the page.
 * An abort from the owning page always cancels the request and its retry delay.
 */
export type ReliableFetchOptions<T> = {
  signal?: AbortSignal;
  timeoutMs?: number;
  retryDelaysMs?: readonly number[];
  isValid?: (value: T) => boolean;
};

const waitForRetry = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) {
    reject(signal.reason ?? new DOMException("Request cancelled", "AbortError"));
    return;
  }
  const onAbort = () => {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
    reject(signal?.reason ?? new DOMException("Request cancelled", "AbortError"));
  };
  const timer = setTimeout(() => {
    signal?.removeEventListener("abort", onAbort);
    resolve();
  }, ms);
  signal?.addEventListener("abort", onAbort, { once: true });
});

export async function fetchJsonWithRetry<T>(
  url: string,
  { signal, timeoutMs = 15000, retryDelaysMs = [1500, 3500], isValid }: ReliableFetchOptions<T> = {},
): Promise<T> {
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    signal?.throwIfAborted();
    const timeout = AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
      // Do not retry a permanent client error; retry transient HTTP failures.
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
          throw new PermanentApiError(`API returned HTTP ${response.status}`);
        }
        throw new Error(`API temporarily unavailable (HTTP ${response.status})`);
      }
      const data = await response.json() as T;
      if (isValid && !isValid(data)) throw new Error("API returned empty or invalid data");
      return data;
    } catch (error) {
      if (signal?.aborted || error instanceof PermanentApiError || attempt === retryDelaysMs.length) throw error;
      await waitForRetry(retryDelaysMs[attempt], signal);
    }
  }
  throw new Error("API unavailable");
}

class PermanentApiError extends Error {}
