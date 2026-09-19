import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearRobotsCache } from './robots';
import {
  categorise,
  extractJsonLd,
  fetchPage,
  isEventNode,
  mapEvent,
  readEventsFromPage,
  WebsiteFetchError,
} from './website';

beforeEach(() => clearRobotsCache());
afterEach(() => vi.restoreAllMocks());

const club = { type: 'club' as const };

function page(jsonLd: unknown): string {
  return `<!doctype html><html><head>
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  </head><body>Programme</body></html>`;
}

/** robots.txt is fetched first, then the page itself. */
function serve(html: string, robots = 'User-agent: *\nAllow: /') {
  return vi
    .spyOn(global, 'fetch')
    .mockImplementation(async (input: string | URL | Request) => {
      const url = String(input);
      const body = url.endsWith('/robots.txt') ? robots : html;

      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => body,
      } as Response;
    });
}

describe('extractJsonLd', () => {
  it('reads a single block', () => {
    expect(extractJsonLd(page({ '@type': 'Event', name: 'X' }))).toHaveLength(1);
  });

  it('flattens an array', () => {
    const html = page([{ '@type': 'Event', name: 'A' }, { '@type': 'Event', name: 'B' }]);
    expect(extractJsonLd(html)).toHaveLength(2);
  });

  it('unwraps @graph, which most content systems emit', () => {
    const html = page({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Organization', name: 'Klub Mesto' },
        { '@type': 'Event', name: 'Concert' },
      ],
    });

    expect(extractJsonLd(html)).toHaveLength(2);
  });

  it('reads several script blocks', () => {
    const html =
      page({ '@type': 'Event', name: 'A' }) + page({ '@type': 'Event', name: 'B' });
    expect(extractJsonLd(html)).toHaveLength(2);
  });

  it('skips a malformed block instead of failing the page', () => {
    const html =
      '<script type="application/ld+json">{ not json }</script>' +
      page({ '@type': 'Event', name: 'Good' });

    const blocks = extractJsonLd(html);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].name).toBe('Good');
  });

  it('returns nothing for a page with no structured data', () => {
    expect(extractJsonLd('<html><body>Just words</body></html>')).toEqual([]);
  });

  it('copes with single quotes and extra attributes on the tag', () => {
    const html = `<script class="x" type='application/ld+json' data-a="1">{"@type":"Event","name":"Q"}</script>`;
    expect(extractJsonLd(html)).toHaveLength(1);
  });
});

describe('isEventNode', () => {
  it('accepts Event and its subtypes', () => {
    expect(isEventNode({ '@type': 'Event' })).toBe(true);
    expect(isEventNode({ '@type': 'MusicEvent' })).toBe(true);
    expect(isEventNode({ '@type': 'ScreeningEvent' })).toBe(true);
  });

  it('accepts a node typed as several things', () => {
    expect(isEventNode({ '@type': ['Thing', 'MusicEvent'] })).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isEventNode({ '@type': 'Organization' })).toBe(false);
    expect(isEventNode({ '@type': 'BreadcrumbList' })).toBe(false);
    expect(isEventNode({})).toBe(false);
  });
});

describe('categorise', () => {
  it('trusts the schema type over guessing from text', () => {
    expect(categorise({ '@type': 'MusicEvent', name: 'Филмска вечер' })).toBe('concert');
    expect(categorise({ '@type': 'ScreeningEvent', name: 'Концерт' })).toBe('cinema');
  });

  it('falls back to keywords for a bare Event', () => {
    expect(categorise({ '@type': 'Event', name: 'Изложба на фотографии' })).toBe('cultural');
  });

  it('falls back to the venue type when the text says nothing', () => {
    expect(categorise({ '@type': 'Event', name: 'Saturday' }, 'cinema')).toBe('cinema');
  });

  it('ends at other', () => {
    expect(categorise({ '@type': 'Event', name: 'Saturday' })).toBe('other');
  });
});

describe('mapEvent', () => {
  const base = { '@type': 'Event', name: 'Концерт', startDate: '2026-10-18T22:00:00+02:00' };

  it('maps the published fields across', () => {
    const mapped = mapEvent(
      {
        ...base,
        description: 'An evening',
        endDate: '2026-10-19T02:00:00+02:00',
        image: 'https://site.mk/poster.jpg',
        url: 'https://site.mk/events/1',
      },
      'https://site.mk/programme',
      club,
    );

    expect(mapped).toMatchObject({
      title: 'Концерт',
      description: 'An evening',
      image: 'https://site.mk/poster.jpg',
      sourceUrl: 'https://site.mk/events/1',
      isCancelled: false,
    });
  });

  it('reads a price out of an offer', () => {
    const mapped = mapEvent(
      { ...base, offers: { '@type': 'Offer', price: '300', priceCurrency: 'MKD' } },
      'https://site.mk/p',
      club,
    );

    expect(mapped?.isPaid).toBe(true);
    expect(mapped?.price).toBe(300);
  });

  it('treats a zero price as free', () => {
    const mapped = mapEvent({ ...base, offers: { price: 0 } }, 'https://site.mk/p', club);
    expect(mapped?.isPaid).toBe(false);
    expect(mapped?.price).toBeNull();
  });

  it('treats a ticket link with no price as paid', () => {
    const mapped = mapEvent(
      { ...base, offers: { url: 'https://tickets.mk/1' } },
      'https://site.mk/p',
      club,
    );

    expect(mapped?.isPaid).toBe(true);
    expect(mapped?.price).toBeNull();
    expect(mapped?.ticketUrl).toBe('https://tickets.mk/1');
  });

  it('takes the first usable offer from a list', () => {
    const mapped = mapEvent(
      { ...base, offers: [{ price: '500' }, { price: '800' }] },
      'https://site.mk/p',
      club,
    );

    expect(mapped?.price).toBe(500);
  });

  it('reads an image given as an object', () => {
    const mapped = mapEvent(
      { ...base, image: { '@type': 'ImageObject', url: 'https://site.mk/i.jpg' } },
      'https://site.mk/p',
      club,
    );

    expect(mapped?.image).toBe('https://site.mk/i.jpg');
  });

  it('falls back to a per-event anchor when the event has no url of its own', () => {
    const mapped = mapEvent(base, 'https://site.mk/programme', club);
    expect(mapped?.sourceUrl).toBe('https://site.mk/programme#%D0%9A%D0%BE%D0%BD%D1%86%D0%B5%D1%80%D1%82');
  });

  it('notices a cancelled event', () => {
    const mapped = mapEvent(
      { ...base, eventStatus: 'https://schema.org/EventCancelled' },
      'https://site.mk/p',
      club,
    );

    expect(mapped?.isCancelled).toBe(true);
  });

  it('drops a node with no name or no start date', () => {
    expect(mapEvent({ '@type': 'Event', startDate: base.startDate }, 'https://s.mk', club)).toBeNull();
    expect(mapEvent({ '@type': 'Event', name: 'X' }, 'https://s.mk', club)).toBeNull();
  });

  it('drops a node whose start date is unparseable', () => {
    expect(
      mapEvent({ ...base, startDate: 'next Friday' }, 'https://s.mk', club),
    ).toBeNull();
  });
});

describe('fetchPage', () => {
  it('refuses when robots.txt says no', async () => {
    serve(page({}), 'User-agent: *\nDisallow: /');

    await expect(fetchPage('https://site.mk/programme')).rejects.toMatchObject({
      name: 'WebsiteFetchError',
      reason: 'disallowed',
    });
  });

  it('identifies itself', async () => {
    const spy = serve(page({ '@type': 'Event', name: 'X' }));

    await fetchPage('https://site.mk/programme');

    const init = spy.mock.calls.at(-1)?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)['User-Agent']).toMatch(/Mapiks/);
  });

  it('reports an unreachable site', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (input: string | URL | Request) => {
      if (String(input).endsWith('/robots.txt')) {
        return { ok: false, status: 404, text: async () => '' } as Response;
      }
      throw new Error('ECONNREFUSED');
    });

    await expect(fetchPage('https://site.mk/p')).rejects.toMatchObject({ reason: 'unreachable' });
  });
});

describe('readEventsFromPage', () => {
  it('returns only the events, ignoring other structured data', async () => {
    serve(
      page({
        '@graph': [
          { '@type': 'Organization', name: 'Klub Mesto' },
          { '@type': 'WebSite', name: 'Site' },
          { '@type': 'MusicEvent', name: 'Концерт', startDate: '2026-10-18T22:00:00+02:00' },
        ],
      }),
    );

    const events = await readEventsFromPage('https://site.mk/programme', club);

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('Концерт');
    // Reported as the page declared it. Whether a club may actually host a
    // concert is a rule about the platform's own catalogue, so the caller
    // applies it: this library reports what a venue published, not what it is
    // allowed to publish.
    expect(events[0].category).toBe('concert');
  });

  it('keeps a concert when the venue can actually host one', async () => {
    serve(
      page({
        '@type': 'MusicEvent',
        name: 'Концерт',
        startDate: '2026-10-18T20:00:00+02:00',
      }),
    );

    const events = await readEventsFromPage('https://site.mk/programme', { type: 'theater' });
    expect(events[0].category).toBe('concert');
  });

  it('returns nothing for a site that publishes no markup', async () => {
    serve('<html><body>Our programme is on Facebook</body></html>');
    expect(await readEventsFromPage('https://site.mk/p', club)).toEqual([]);
  });
});

/**
 * Some venue sites sit behind a bot check that refuses a server outright. A
 * paid provider can fetch those, but it bills per request — so it is a second
 * attempt after a refusal, never the way pages are normally read.
 */
describe('falling back to an unblocking provider', () => {
  const ORIGINAL = { ...process.env };

  beforeEach(() => {
    delete process.env.SCRAPER_API_KEY;
    delete process.env.BRIGHT_DATA_KEY;
    delete process.env.UNBLOCK_PROVIDER;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
    vi.restoreAllMocks();
  });

  const PAGE = 'https://klubmesto.mk/events';

  /** robots.txt allowing everything, then whatever the page call should answer. */
  function serve(pageResponse: () => Promise<Response> | Response) {
    let call = 0;
    return vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      call += 1;
      if (String(input).endsWith('/robots.txt')) {
        return { ok: true, status: 200, text: async () => 'User-agent: *\nAllow: /' } as Response;
      }
      return pageResponse();
    });
  }

  const schemaPage = `<script type="application/ld+json">${JSON.stringify({
    '@type': 'Event',
    name: 'Behind the bot check',
    startDate: '2026-11-20T21:00:00+01:00',
  })}</script>`;

  it('does not call a provider when the site answers on its own', async () => {
    const call = serve(() => ({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => schemaPage,
    } as Response));

    const events = await readEventsFromPage(PAGE, { type: 'club' }, { scraperApiKey: 'k' });

    expect(events).toHaveLength(1);
    // robots.txt and the page itself; nothing went to a paid endpoint.
    const hosts = call.mock.calls.map(c => String(c[0]));
    expect(hosts.some(h => h.includes('scraperapi'))).toBe(false);
  });

  it('retries through the provider when the site refuses a server', async () => {
    let seen = 0;
    vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/robots.txt')) {
        return { ok: true, status: 200, text: async () => 'User-agent: *\nAllow: /' } as Response;
      }
      if (url.includes('scraperapi')) {
        seen += 1;
        return { ok: true, status: 200, text: async () => schemaPage } as Response;
      }
      return { ok: false, status: 403, headers: new Headers(), text: async () => 'Forbidden' } as Response;
    });

    const events = await readEventsFromPage(PAGE, { type: 'club' }, { scraperApiKey: 'k' });

    expect(seen).toBe(1);
    expect(events[0].title).toBe('Behind the bot check');
  });

  it('does not retry a 404, which is an honest answer', async () => {
    let providerCalls = 0;
    vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/robots.txt')) {
        return { ok: true, status: 200, text: async () => 'User-agent: *\nAllow: /' } as Response;
      }
      if (url.includes('scraperapi')) providerCalls += 1;
      return { ok: false, status: 404, headers: new Headers(), text: async () => '' } as Response;
    });

    await expect(readEventsFromPage(PAGE, { type: 'club' }, { scraperApiKey: 'k' })).rejects.toThrow();
    expect(providerCalls).toBe(0);
  });

  it('never pays a provider to get around robots.txt', async () => {
    let providerCalls = 0;
    vi.spyOn(global, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/robots.txt')) {
        return { ok: true, status: 200, text: async () => 'User-agent: *\nDisallow: /' } as Response;
      }
      if (url.includes('scraperapi')) providerCalls += 1;
      return { ok: true, status: 200, text: async () => schemaPage } as Response;
    });

    // A site that asked not to be read is not a site to try harder against.
    await expect(
      readEventsFromPage(PAGE, { type: 'club' }, { scraperApiKey: 'k' }),
    ).rejects.toMatchObject({ reason: 'disallowed' });

    expect(providerCalls).toBe(0);
  });

  it('reports the original refusal when no provider is configured', async () => {
    serve(() => ({ ok: false, status: 403, headers: new Headers(), text: async () => '' } as Response));

    await expect(readEventsFromPage(PAGE, { type: 'club' })).rejects.toMatchObject({
      reason: 'unreachable',
    });
  });
});
