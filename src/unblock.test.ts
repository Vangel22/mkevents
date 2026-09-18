import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScraperError } from './instagram';
import { fetchThrough, isUnblockConfigured, unblockProvider, unblockRequest } from './unblock';

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.BRIGHTDATA_TOKEN;
  delete process.env.SCRAPERAPI_KEY;
  delete process.env.UNBLOCK_PROVIDER;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.restoreAllMocks();
});

const TARGET = 'https://www.instagram.com/api/v1/users/web_profile_info/?username=mirage__club';

describe('choosing a provider', () => {
  it('uses whichever one has a credential, so adding a key is the only step', () => {
    expect(unblockProvider({ scraperApiKey: 'k' })).toBe('scraperapi');
    expect(unblockProvider({ brightDataToken: 't' })).toBe('brightdata');
  });

  it('prefers the explicit choice over what happens to be configured', () => {
    expect(unblockProvider({ provider: 'scraperapi', brightDataToken: 't' })).toBe('scraperapi');
  });

  it('is nothing at all when neither is configured', () => {
    expect(unblockProvider()).toBeNull();
    expect(isUnblockConfigured()).toBe(false);
  });

  it('reads the choice from the environment', () => {
    process.env.UNBLOCK_PROVIDER = 'brightdata';
    process.env.BRIGHTDATA_TOKEN = 'from-env';

    expect(unblockProvider()).toBe('brightdata');
    expect(isUnblockConfigured()).toBe(true);
  });

  it('refuses a provider name it does not have', () => {
    expect(unblockProvider({ provider: 'apify' as never })).toBeNull();
  });

  it('treats a chosen provider with no credential as not configured', () => {
    expect(isUnblockConfigured({ provider: 'brightdata' })).toBe(false);
  });
});

/**
 * The request shape is the only part of a paid service that can be pinned down
 * for free, and it is also the part that silently costs money when wrong: a
 * malformed call still spends the credit.
 */
describe('the request each service expects', () => {
  it('sends ScraperAPI the target as a query parameter', () => {
    const { url, init } = unblockRequest('scraperapi', TARGET, { scraperApiKey: 'secret-key' });
    const query = new URL(url).searchParams;

    expect(url.startsWith('https://api.scraperapi.com/')).toBe(true);
    expect(query.get('api_key')).toBe('secret-key');
    expect(query.get('url')).toBe(TARGET);
    expect(init.method).toBeUndefined();
  });

  it('tells ScraperAPI to keep our headers, or Instagram answers the login page', () => {
    const { url } = unblockRequest('scraperapi', TARGET, {
      scraperApiKey: 'k',
      headers: { 'x-ig-app-id': '936619743392459' },
    });

    expect(new URL(url).searchParams.get('keep_headers')).toBe('true');
  });

  it('does not ask ScraperAPI to render javascript unless told to', () => {
    const plain = unblockRequest('scraperapi', TARGET, { scraperApiKey: 'k' });
    const rendered = unblockRequest('scraperapi', TARGET, {
      scraperApiKey: 'k',
      renderJavaScript: true,
    });

    expect(new URL(plain.url).searchParams.get('render')).toBeNull();
    expect(new URL(rendered.url).searchParams.get('render')).toBe('true');
  });

  it('sends Bright Data a posted body naming the zone and the target', () => {
    const { url, init } = unblockRequest('brightdata', TARGET, {
      brightDataToken: 'secret-token',
      brightDataZone: 'my_zone',
      countryCode: 'mk',
    });

    expect(url).toBe('https://api.brightdata.com/request');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-token');

    expect(JSON.parse(init.body as string)).toMatchObject({
      zone: 'my_zone',
      url: TARGET,
      // Their wrapper around the body would have to be unwrapped again.
      format: 'raw',
      country: 'mk',
    });
  });

  it('falls back to the zone name Bright Data creates by default', () => {
    const { init } = unblockRequest('brightdata', TARGET, { brightDataToken: 't' });

    expect(JSON.parse(init.body as string).zone).toBe('web_unlocker1');
  });

  it('asks for the target directly when told to go direct', () => {
    const { url, init } = unblockRequest('direct', TARGET, { headers: { Accept: 'application/json' } });

    expect(url).toBe(TARGET);
    expect(init.method).toBeUndefined();
  });

  it('never puts a credential in the url Bright Data is given', () => {
    const { url, init } = unblockRequest('brightdata', TARGET, { brightDataToken: 'secret-token' });

    expect(url).not.toContain('secret-token');
    expect(JSON.parse(init.body as string).url).not.toContain('secret-token');
  });
});

describe('fetching through a provider', () => {
  const respond = (body: string, ok = true, status = 200) =>
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok,
      status,
      text: async () => body,
    } as Response);

  it('returns the target own body, untouched', async () => {
    respond('{"data":{"user":{}}}');

    await expect(fetchThrough(TARGET, { scraperApiKey: 'k' })).resolves.toBe('{"data":{"user":{}}}');
  });

  it('says so plainly when nothing is configured, rather than trying', async () => {
    const call = vi.spyOn(global, 'fetch');

    await expect(fetchThrough(TARGET)).rejects.toThrow(ScraperError);
    expect(call).not.toHaveBeenCalled();
  });

  it('separates a refused credential from a page that would not load', async () => {
    respond('unauthorised', false, 401);

    await expect(fetchThrough(TARGET, { scraperApiKey: 'wrong' })).rejects.toMatchObject({
      reason: 'unconfigured',
    });

    respond('upstream said no', false, 500);

    await expect(fetchThrough(TARGET, { scraperApiKey: 'k' })).rejects.toMatchObject({
      reason: 'failed',
    });
  });

  it('reports a timeout as a timeout', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('The operation timed out'));

    await expect(fetchThrough(TARGET, { scraperApiKey: 'k' })).rejects.toMatchObject({
      reason: 'timeout',
    });
  });

  it('does not repeat the credential in the message when a call fails', async () => {
    respond('nope', false, 500);

    // The message is logged and shown in the health digest, so the key must not
    // travel with it. Asserted on the caught message rather than through a
    // matcher, which would have passed whatever the message said.
    const message = await fetchThrough(TARGET, { scraperApiKey: 'secret-key' }).then(
      () => 'it resolved',
      (err: Error) => err.message,
    );

    expect(message).toContain('500');
    expect(message).not.toContain('secret-key');
  });
});
