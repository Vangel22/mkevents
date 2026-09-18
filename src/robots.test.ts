import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearRobotsCache, isAllowed, isAllowedByRules, parseRobots } from './robots';

beforeEach(() => clearRobotsCache());
afterEach(() => vi.restoreAllMocks());

function serve(body: string, ok = true, status = 200) {
  return vi.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    status,
    text: async () => body,
  } as Response);
}

describe('parseRobots', () => {
  it('reads the wildcard group', () => {
    const rules = parseRobots('User-agent: *\nDisallow: /admin/\nDisallow: /private');
    expect(rules.disallow).toEqual(['/admin/', '/private']);
  });

  it('prefers a group naming us over the wildcard', () => {
    const rules = parseRobots(
      'User-agent: *\nDisallow: /\n\nUser-agent: MapiksBot\nDisallow: /admin/',
    );

    // The specific group replaces the wildcard rather than adding to it.
    expect(rules.disallow).toEqual(['/admin/']);
  });

  it('ignores groups addressed to other crawlers', () => {
    const rules = parseRobots('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /tmp');
    expect(rules.disallow).toEqual(['/tmp']);
  });

  it('ignores comments and blank lines', () => {
    const rules = parseRobots('# a comment\nUser-agent: *\n\nDisallow: /x  # trailing\n');
    expect(rules.disallow).toEqual(['/x']);
  });

  it('reads a crawl delay', () => {
    expect(parseRobots('User-agent: *\nCrawl-delay: 10').crawlDelaySeconds).toBe(10);
  });

  it('returns nothing restrictive for an empty file', () => {
    expect(parseRobots('')).toEqual({ disallow: [], allow: [] });
  });
});

describe('isAllowedByRules', () => {
  const rules = { disallow: ['/admin/', '/private'], allow: ['/admin/public'] };

  it('permits a path nothing matches', () => {
    expect(isAllowedByRules(rules, '/events')).toBe(true);
  });

  it('refuses a disallowed path', () => {
    expect(isAllowedByRules(rules, '/admin/settings')).toBe(false);
  });

  it('lets a more specific Allow override a Disallow', () => {
    expect(isAllowedByRules(rules, '/admin/public/list')).toBe(true);
  });

  it('honours a wildcard pattern', () => {
    expect(isAllowedByRules({ disallow: ['/*.pdf'], allow: [] }, '/files/report.pdf')).toBe(false);
  });

  it('permits everything when there are no rules', () => {
    expect(isAllowedByRules({ disallow: [], allow: [] }, '/anything')).toBe(true);
  });

  it('refuses everything under a blanket disallow', () => {
    expect(isAllowedByRules({ disallow: ['/'], allow: [] }, '/events')).toBe(false);
  });
});

describe('isAllowed', () => {
  it('reads robots.txt from the origin', async () => {
    const spy = serve('User-agent: *\nDisallow: /admin/');

    await isAllowed('https://klubmesto.mk/events');

    expect(String(spy.mock.calls[0][0])).toBe('https://klubmesto.mk/robots.txt');
  });

  it('honours an explicit refusal', async () => {
    serve('User-agent: *\nDisallow: /');
    expect(await isAllowed('https://klubmesto.mk/events')).toBe(false);
  });

  it('treats a missing robots.txt as no restrictions', async () => {
    serve('Not found', false, 404);
    expect(await isAllowed('https://klubmesto.mk/events')).toBe(true);
  });

  it('treats an unreachable site as permitted, since an outage is not a refusal', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await isAllowed('https://klubmesto.mk/events')).toBe(true);
  });

  it('caches per origin rather than refetching for every page', async () => {
    const spy = serve('User-agent: *\nDisallow: /admin/');

    await isAllowed('https://klubmesto.mk/a');
    await isAllowed('https://klubmesto.mk/b');

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('keeps separate rules for separate sites', async () => {
    const spy = serve('User-agent: *\nDisallow: /admin/');

    await isAllowed('https://one.mk/a');
    await isAllowed('https://two.mk/a');

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('refuses a malformed url without calling out', async () => {
    const spy = vi.spyOn(global, 'fetch');
    expect(await isAllowed('not a url')).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });

  it('refuses a non-http scheme', async () => {
    expect(await isAllowed('file:///etc/passwd')).toBe(false);
  });
});
