import { ScraperError } from './instagram';

import type { UnblockOptions, UnblockProvider } from './types';

/**
 * Fetching a page through someone else's network.
 *
 * Instagram, and increasingly venue sites behind Cloudflare, refuse a request
 * from a datacentre address. Both services here solve that the same way — they
 * fetch the URL from a residential address and hand back the body — so they are
 * one interface with two transports rather than two integrations. What comes
 * back is the target's own response, which means the parsing above this layer
 * is written once.
 *
 * Bright Data also sells a dataset product that returns ready-made Instagram
 * posts. It is not used here: it is a different shape per dataset, it is billed
 * per record rather than per request, and it puts the field mapping inside their
 * product where a change is invisible to us until it breaks.
 */
const ENDPOINTS = {
  scraperapi: 'https://api.scraperapi.com/',
  brightdata: 'https://api.brightdata.com/request',
} as const;

/** A scrape through a residential address is slow. This is not an API call. */
const DEFAULT_TIMEOUT_MS = 90_000;

export function unblockProvider(options: UnblockOptions = {}): UnblockProvider | null {
  const named = options.provider ?? (process.env.UNBLOCK_PROVIDER as UnblockProvider | undefined);

  if (named === 'scraperapi' || named === 'brightdata' || named === 'direct') return named;
  if (named) return null;

  // Nothing chosen: use whichever is configured, so adding a key is the only
  // step. Bright Data first only because it is the one with a free allowance
  // that does not expire.
  if (options.brightDataToken ?? process.env.BRIGHTDATA_TOKEN) return 'brightdata';
  if (options.scraperApiKey ?? process.env.SCRAPERAPI_KEY) return 'scraperapi';

  return null;
}

export function isUnblockConfigured(options: UnblockOptions = {}): boolean {
  const provider = unblockProvider(options);
  if (provider === 'direct') return true;
  if (provider === 'brightdata') return Boolean(options.brightDataToken ?? process.env.BRIGHTDATA_TOKEN);
  if (provider === 'scraperapi') return Boolean(options.scraperApiKey ?? process.env.SCRAPERAPI_KEY);
  return false;
}

/**
 * Builds the request that asks a provider to fetch `url` for us.
 *
 * Separate from sending it so the shape each service expects can be asserted
 * without a network or a key — which is the only part of this that can be
 * tested for free.
 */
export function unblockRequest(
  provider: UnblockProvider,
  url: string,
  options: UnblockOptions = {},
): { url: string; init: RequestInit } {
  const headers = options.headers ?? {};

  if (provider === 'direct') {
    return { url, init: { headers } };
  }

  if (provider === 'scraperapi') {
    const key = options.scraperApiKey ?? process.env.SCRAPERAPI_KEY ?? '';
    const query = new URLSearchParams({ api_key: key, url });

    // Without this the service strips our headers, and Instagram's web endpoint
    // answers a request with no app id with a redirect to the login page.
    if (Object.keys(headers).length > 0) query.set('keep_headers', 'true');
    if (options.countryCode) query.set('country_code', options.countryCode);
    if (options.renderJavaScript) query.set('render', 'true');

    return { url: `${ENDPOINTS.scraperapi}?${query.toString()}`, init: { headers } };
  }

  const token = options.brightDataToken ?? process.env.BRIGHTDATA_TOKEN ?? '';
  const zone = options.brightDataZone ?? process.env.BRIGHTDATA_ZONE ?? 'web_unlocker1';

  return {
    url: ENDPOINTS.brightdata,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        zone,
        url,
        // The target's own body, not a rendered screenshot or their wrapper.
        format: 'raw',
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
        ...(options.countryCode ? { country: options.countryCode } : {}),
      }),
    },
  };
}

/** Fetches `url` through the configured provider and returns the body as text. */
export async function fetchThrough(url: string, options: UnblockOptions = {}): Promise<string> {
  const provider = unblockProvider(options);

  if (!provider) {
    throw new ScraperError(
      'No unblocking provider configured. Set BRIGHTDATA_TOKEN or SCRAPERAPI_KEY.',
      'unconfigured',
    );
  }

  if (provider !== 'direct' && !isUnblockConfigured({ ...options, provider })) {
    throw new ScraperError(`${provider} was chosen but its credential is missing`, 'unconfigured');
  }

  const request = unblockRequest(provider, url, options);
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const response = await fetch(request.url, {
    ...request.init,
    signal: AbortSignal.timeout(timeout),
  }).catch((err: unknown) => {
    throw new ScraperError(
      `${provider} did not answer for ${url}: ${err instanceof Error ? err.message : String(err)}`,
      'timeout',
    );
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new ScraperError(
      `${provider} returned ${response.status} for ${url}: ${body.slice(0, 200)}`,
      // A refused credential is worth separating from a page that would not load:
      // one is a thing to fix once, the other is a venue to look at.
      response.status === 401 || response.status === 403 ? 'unconfigured' : 'failed',
    );
  }

  return response.text();
}
