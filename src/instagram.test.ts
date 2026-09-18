import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isConfigured, mapPost, ScraperError, scrapeInstagramProfile } from './instagram';

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env.APIFY_TOKEN = 'test-token';
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.restoreAllMocks();
});

/** The shape the actor actually returned for a real Strumica club. */
const realPost = {
  id: '3986840141924695552',
  type: 'Video',
  shortCode: 'DdUGfxjsH4A',
  url: 'https://www.instagram.com/p/DdUGfxjsH4A/',
  caption: 'Balkan Party\n🗓️ Петок, 18.09.2026\n🕦 00:00 часот\n🎫 Влез: Бесплатен',
  timestamp: '2026-09-15T16:08:17.000Z',
  displayUrl: 'https://instagram.fagc1-1.fna.fbcdn.net/v/t51.71878-15/811501149.jpg',
  images: [],
};

function respond(items: unknown, ok = true, status = 200) {
  return vi.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    status,
    json: async () => items,
    text: async () => JSON.stringify(items),
  } as Response);
}

describe('mapPost', () => {
  it('keeps the fields the pipeline needs', () => {
    expect(mapPost(realPost)).toEqual({
      url: 'https://www.instagram.com/p/DdUGfxjsH4A/',
      imageUrl: 'https://instagram.fagc1-1.fna.fbcdn.net/v/t51.71878-15/811501149.jpg',
      caption: realPost.caption,
      timestamp: '2026-09-15T16:08:17.000Z',
    });
  });

  it('uses a reel poster frame, which is where the event details are printed', () => {
    expect(mapPost({ ...realPost, type: 'Video' })?.imageUrl).toContain('811501149.jpg');
  });

  it('falls back to the first image of a carousel', () => {
    const mapped = mapPost({ ...realPost, displayUrl: undefined, images: ['https://cdn/a.jpg'] });
    expect(mapped?.imageUrl).toBe('https://cdn/a.jpg');
  });

  it('builds the url from a short code when the actor omits it', () => {
    const mapped = mapPost({ ...realPost, url: undefined });
    expect(mapped?.url).toBe('https://www.instagram.com/p/DdUGfxjsH4A/');
  });

  it('drops a post with no image, since there is nothing to read', () => {
    expect(mapPost({ ...realPost, displayUrl: undefined, images: [] })).toBeNull();
  });

  it('copes with a post that has no caption', () => {
    expect(mapPost({ ...realPost, caption: undefined })?.caption).toBe('');
  });
});

describe('scrapeInstagramProfile', () => {
  it('asks the actor for the profile posts', async () => {
    const spy = respond([realPost]);

    await scrapeInstagramProfile('mirage__club');

    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toContain('apify~instagram-scraper');
    expect(String(url)).toContain('run-sync-get-dataset-items');

    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.directUrls).toEqual(['https://www.instagram.com/mirage__club/']);
    expect(body.resultsType).toBe('posts');
  });

  it('strips a leading at-sign from the handle', async () => {
    const spy = respond([realPost]);

    await scrapeInstagramProfile('@mirage__club');

    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.directUrls).toEqual(['https://www.instagram.com/mirage__club/']);
  });

  it('says so when no token is configured rather than failing obscurely', async () => {
    delete process.env.APIFY_TOKEN;

    await expect(scrapeInstagramProfile('mirage__club')).rejects.toMatchObject({
      name: 'ScraperError',
      reason: 'unconfigured',
    });
  });

  it('raises rather than returning nothing when the run fails', async () => {
    respond({ error: { message: 'Actor run failed' } }, false, 400);

    await expect(scrapeInstagramProfile('mirage__club')).rejects.toMatchObject({
      reason: 'failed',
    });
  });

  it('returns an empty list for a profile with no usable posts', async () => {
    respond([]);
    expect(await scrapeInstagramProfile('mirage__club')).toEqual([]);
  });

  it('skips unusable posts rather than the whole run', async () => {
    respond([realPost, { ...realPost, url: 'x', displayUrl: undefined, images: [] }]);
    expect(await scrapeInstagramProfile('mirage__club')).toHaveLength(1);
  });

  it('reports whether it can run at all', () => {
    expect(isConfigured()).toBe(true);
    delete process.env.APIFY_TOKEN;
    expect(isConfigured()).toBe(false);
  });
});

describe('a profile the actor cannot read', () => {
  it('reports a restricted profile rather than pretending there were no posts', async () => {
    // Exactly what the actor returned for a real restricted venue account.
    respond([{ id: '75266532011', error: 'Restricted profile', private: false }]);

    await expect(scrapeInstagramProfile('loopclubsr')).rejects.toMatchObject({
      name: 'ScraperError',
      reason: 'unreadable',
    });
  });

  it('says what to do about it', async () => {
    respond([{ id: '1', error: 'Restricted profile' }]);

    await expect(scrapeInstagramProfile('loopclubsr')).rejects.toThrow(/connect its own account/);
  });

  it('reports a private profile the same way', async () => {
    respond([{ id: '1', private: true }]);

    await expect(scrapeInstagramProfile('someone')).rejects.toMatchObject({
      reason: 'unreadable',
    });
  });

  it('does not mistake a single genuine post for an error', async () => {
    respond([realPost]);
    expect(await scrapeInstagramProfile('mirage__club')).toHaveLength(1);
  });
});
