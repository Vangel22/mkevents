import type { ApifyOptions } from './types';

const APIFY_BASE = 'https://api.apify.com/v2';
const ACTOR = process.env.APIFY_INSTAGRAM_ACTOR || 'apify~instagram-scraper';

/** Posts fetched per venue per run. Each one costs credit, so keep it modest. */
const DEFAULT_RESULTS_LIMIT = Number(process.env.APIFY_RESULTS_LIMIT) || 12;

/** An actor run is a scrape, not an API call — it takes tens of seconds. */
const RUN_TIMEOUT_MS = Number(process.env.APIFY_TIMEOUT_MS) || 180_000;

export interface ScrapedPost {
  url: string;
  imageUrl: string;
  caption: string;
  timestamp: string;
}

export class ScraperError extends Error {
  constructor(
    message: string,
    readonly reason: 'unconfigured' | 'failed' | 'timeout' | 'unreadable',
  ) {
    super(message);
    this.name = 'ScraperError';
  }
}

/**
 * The actor reports a profile it cannot read as a single item carrying an error
 * rather than as a failed run — a restricted or private account, most often.
 * Without this the run looks like a venue that simply has not posted, which is
 * the kind of silence that hides a problem for weeks.
 */
function profileError(items: ApifyPost[]): string | null {
  if (items.length !== 1) return null;

  const item = items[0] as ApifyPost & { error?: string; private?: boolean };
  if (!item.error && !item.private) return null;

  return item.error ?? 'Private profile';
}

export function isConfigured(options: ApifyOptions = {}): boolean {
  return Boolean(options.token ?? process.env.APIFY_TOKEN);
}

/** What the actor returns per post; only these fields are used. */
interface ApifyPost {
  url?: string;
  shortCode?: string;
  caption?: string;
  timestamp?: string;
  displayUrl?: string;
  images?: string[];
  type?: string;
}

export function mapPost(post: ApifyPost): ScrapedPost | null {
  const url = post.url ?? (post.shortCode ? `https://www.instagram.com/p/${post.shortCode}/` : '');

  // For a Reel, displayUrl is the poster frame — which is the image we want, and
  // the only thing worth reading, since the event details are printed on it.
  const imageUrl = post.displayUrl ?? post.images?.[0] ?? '';

  if (!url || !imageUrl) return null;

  return {
    url,
    imageUrl,
    caption: post.caption ?? '',
    timestamp: post.timestamp ?? new Date().toISOString(),
  };
}

/**
 * Fetches a profile's recent posts through Apify.
 *
 * Instagram's login wall makes direct scraping fail from any server, so this
 * delegates to a maintained actor that handles the proxies and fingerprinting.
 * The posts still go through extraction afterwards, because what comes back is a
 * caption and an image — Instagram has no event object.
 *
 * This remains against Instagram's terms of service. It is the bootstrap until
 * venues connect their own accounts, not the long-term source.
 */
export async function scrapeInstagramProfile(
  handle: string,
  options: ApifyOptions = {},
): Promise<ScrapedPost[]> {
  const token = options.token ?? process.env.APIFY_TOKEN;

  if (!token) {
    throw new ScraperError(
      'APIFY_TOKEN is not set, so Instagram cannot be read',
      'unconfigured',
    );
  }

  const cleaned = handle.trim().replace(/^@/, '');

  const response = await fetch(
    `${APIFY_BASE}/acts/${ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(RUN_TIMEOUT_MS),
      body: JSON.stringify({
        directUrls: [`https://www.instagram.com/${cleaned}/`],
        resultsType: 'posts',
        resultsLimit: options.limit ?? DEFAULT_RESULTS_LIMIT,
        addParentData: false,
      }),
    },
  ).catch((err: unknown) => {
    throw new ScraperError(
      `Apify run for @${cleaned} did not complete: ${err instanceof Error ? err.message : String(err)}`,
      'timeout',
    );
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new ScraperError(
      `Apify returned ${response.status} for @${cleaned}: ${body.slice(0, 200)}`,
      'failed',
    );
  }

  const items = (await response.json().catch(() => [])) as ApifyPost[];

  if (!Array.isArray(items)) return [];

  const unreadable = profileError(items);
  if (unreadable) {
    throw new ScraperError(
      `@${cleaned} cannot be read: ${unreadable}. The venue has to connect its own account, or send posters directly.`,
      'unreadable',
    );
  }

  return items
    .map(mapPost)
    .filter((post): post is ScrapedPost => post !== null);
}
