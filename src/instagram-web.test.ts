import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScraperError } from './instagram';
import { mapTimelineNode, profileHeaders, profileUrl, readInstagramProfile, readTimeline } from './instagram-web';

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

/** The shape instagram.com's own profile request answers with. */
function node(overrides: Record<string, unknown> = {}) {
  return {
    shortcode: 'DdUGfxjsH4A',
    display_url: 'https://instagram.fagc1-1.fna.fbcdn.net/v/t51.71878-15/811501149.jpg',
    thumbnail_src: 'https://instagram.fagc1-1.fna.fbcdn.net/v/t51.71878-15/thumb.jpg',
    taken_at_timestamp: 1789488497,
    is_video: true,
    edge_media_to_caption: {
      edges: [{ node: { text: 'Balkan Party\n🗓️ Петок, 18.09.2026\n🎫 Влез: Бесплатен' } }],
    },
    ...overrides,
  };
}

function profile(nodes: Record<string, unknown>[], extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    data: {
      user: {
        is_private: false,
        edge_owner_to_timeline_media: { edges: nodes.map(n => ({ node: n })) },
        ...extra,
      },
    },
  });
}

describe('the request sent to Instagram', () => {
  it('asks the endpoint the profile page itself calls', () => {
    expect(profileUrl('mirage__club')).toBe(
      'https://www.instagram.com/api/v1/users/web_profile_info/?username=mirage__club',
    );
  });

  it('takes the handle with or without the at sign', () => {
    expect(profileUrl('@mirage__club')).toBe(profileUrl(' mirage__club '));
  });

  it('identifies the web app, without which the endpoint answers the login page', () => {
    expect(profileHeaders()['x-ig-app-id']).toBeTruthy();
  });
});

describe('mapTimelineNode', () => {
  it('produces exactly what the Apify reader produced, so nothing downstream changes', () => {
    expect(mapTimelineNode(node())).toEqual({
      url: 'https://www.instagram.com/p/DdUGfxjsH4A/',
      imageUrl: 'https://instagram.fagc1-1.fna.fbcdn.net/v/t51.71878-15/811501149.jpg',
      caption: 'Balkan Party\n🗓️ Петок, 18.09.2026\n🎫 Влез: Бесплатен',
      timestamp: '2026-09-15T16:08:17.000Z',
    });
  });

  it('keeps a post with no caption — the poster carries the details', () => {
    const post = mapTimelineNode(node({ edge_media_to_caption: { edges: [] } }));

    expect(post?.caption).toBe('');
    expect(post?.imageUrl).toBeTruthy();
  });

  it('falls back to the thumbnail when there is no full image', () => {
    const post = mapTimelineNode(node({ display_url: undefined }));

    expect(post?.imageUrl).toContain('thumb.jpg');
  });

  it('drops a post with nothing to read', () => {
    expect(mapTimelineNode(node({ display_url: undefined, thumbnail_src: undefined }))).toBeNull();
    expect(mapTimelineNode(node({ shortcode: undefined }))).toBeNull();
  });
});

describe('readTimeline', () => {
  it('reads the posts in the order Instagram gave them', () => {
    const posts = readTimeline(profile([node(), node({ shortcode: 'SECOND' })]));

    expect(posts).toHaveLength(2);
    expect(posts[1].url).toContain('SECOND');
  });

  it('stops at the limit, because every post read costs a model call later', () => {
    const many = Array.from({ length: 30 }, (_, i) => node({ shortcode: `POST${i}` }));

    expect(readTimeline(profile(many), 5)).toHaveLength(5);
  });

  it('says the request was not unblocked when the login wall answers with html', () => {
    // This is the failure that looks like a broken parser and is not one.
    expect(() => readTimeline('<!DOCTYPE html><html><body>Login</body></html>')).toThrow(
      /not unblocked|login wall/i,
    );
  });

  it('names a private account as something only the venue can fix', () => {
    expect(() => readTimeline(profile([node()], { is_private: true }))).toThrow(
      /private/i,
    );
  });

  it('separates a handle that does not exist from one that posted nothing', () => {
    expect(() => readTimeline(JSON.stringify({ data: {} }))).toThrow(ScraperError);
    expect(readTimeline(profile([]))).toEqual([]);
  });
});

describe('reading a profile end to end', () => {
  it('goes through the configured provider and returns posts', async () => {
    const call = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => profile([node()]),
    } as Response);

    const posts = await readInstagramProfile('@mirage__club', { scraperApiKey: 'k' });

    expect(posts).toHaveLength(1);

    // The target must reach the provider as a parameter, not be fetched directly.
    const requested = String(call.mock.calls[0][0]);
    expect(requested.startsWith('https://api.scraperapi.com/')).toBe(true);
    expect(new URL(requested).searchParams.get('url')).toContain('mirage__club');
  });

  it('carries the app id header through to the provider', async () => {
    const call = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => profile([node()]),
    } as Response);

    await readInstagramProfile('mirage__club', { brightDataToken: 't' });

    const body = JSON.parse((call.mock.calls[0][1] as RequestInit).body as string);
    expect(body.headers['x-ig-app-id']).toBeTruthy();
  });

  it('refuses to run at all with no provider configured', async () => {
    await expect(readInstagramProfile('mirage__club')).rejects.toMatchObject({
      reason: 'unconfigured',
    });
  });
});
