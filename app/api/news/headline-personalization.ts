/** Editorial ordering for a local-first but globally mixed headline wire.
 * Does not filter out international coverage or change article source metadata.
 */
export type ViewerLocation = { countryCode: string; region: string };

export type PersonalizedHeadline = {
  region: string;
  countryCode?: string;
  countryEvidence?: "location" | "publisher";
  publishedAt: string;
  level: "critical" | "elevated" | "watch" | "stable";
  title: string;
  summary: string;
  imageUrl?: string;
  location?: unknown;
};

const HOUR = 3_600_000;

export function headlineScore(story: PersonalizedHeadline, now: number): number {
  const ageHours = Math.max(0, (now - Date.parse(story.publishedAt)) / HOUR);
  const recency = Math.max(0, 120 - ageHours * 1.4);
  const completeness = (story.imageUrl ? 14 : 0) + (story.summary.length >= 120 ? 7 : story.summary.length >= 60 ? 3 : 0) + (story.location ? 4 : 0);
  const urgency = story.level === "critical" ? 10 : story.level === "elevated" ? 6 : story.level === "watch" ? 2 : 0;
  return recency + completeness + urgency;
}

const byQuality = <T extends PersonalizedHeadline>(a: T, b: T, now: number): number =>
  headlineScore(b, now) - headlineScore(a, now) || Date.parse(b.publishedAt) - Date.parse(a.publishedAt);

/**
 * First ~15 positions use a 2-local / 3-international cadence when enough
 * genuinely current domestic coverage exists. Other international stories
 * retain their quality order; readers do not get a block of local-only news.
 */
export function personalizeHeadlines<T extends PersonalizedHeadline>(
  stories: T[],
  viewer: ViewerLocation | null,
  now = Date.now(),
): T[] {
  const globalOrder = [...stories].sort((a, b) => byQuality(a, b, now));
  if (!viewer?.countryCode) return globalOrder;

  const local: T[] = [];
  const international: T[] = [];
  for (const story of globalOrder) {
    // No guessed domestic classification for stories with only a regional
    // label (e.g. Europe is not equivalent to France).
    const domestic = story.countryCode === viewer.countryCode;
    const ageHours = (now - Date.parse(story.publishedAt)) / HOUR;
    if (domestic && ageHours >= -1 && ageHours <= 36) local.push(story);
    else international.push(story);
  }

  if (!local.length) {
    // When no country-specific material is available, nearby regional news
    // gets a mild boost, while breaking global news can still rise to the top.
    return globalOrder.sort((a, b) => {
      const aBoost = a.region === viewer.region ? 8 : 0;
      const bBoost = b.region === viewer.region ? 8 : 0;
      return headlineScore(b, now) + bBoost - headlineScore(a, now) - aBoost || byQuality(a, b, now);
    });
  }

  // Explicitly located articles are more reliable local leads than publisher
  // defaults. Publishers still help fill the domestic portion when a
  // headline omits the country name.
  local.sort((a, b) => {
    const aBoost = a.countryEvidence === "location" ? 9 : 0;
    const bBoost = b.countryEvidence === "location" ? 9 : 0;
    return headlineScore(b, now) + bBoost - headlineScore(a, now) - aBoost || byQuality(a, b, now);
  });
  international.sort((a, b) => {
    const aBoost = a.region === viewer.region ? 6 : 0;
    const bBoost = b.region === viewer.region ? 6 : 0;
    return headlineScore(b, now) + bBoost - headlineScore(a, now) - aBoost || byQuality(a, b, now);
  });

  const mixed: T[] = [];
  let localIndex = 0;
  let worldIndex = 0;
  // First slot is domestic; subsequently distribute two domestic headlines
  // across each five-story section, never clustering three or more together.
  const pattern = ["local", "world", "local", "world", "world"] as const;
  for (let index = 0; index < stories.length; index++) {
    const preferLocal = pattern[index % pattern.length] === "local";
    if (preferLocal && localIndex < local.length) mixed.push(local[localIndex++]);
    else if (worldIndex < international.length) mixed.push(international[worldIndex++]);
    else if (localIndex < local.length) mixed.push(local[localIndex++]);
  }
  return mixed;
}
