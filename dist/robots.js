"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_USER_AGENT = void 0;
exports.clearRobotsCache = clearRobotsCache;
exports.parseRobots = parseRobots;
exports.isAllowedByRules = isAllowedByRules;
exports.isAllowed = isAllowed;
exports.DEFAULT_USER_AGENT = process.env.CRAWLER_USER_AGENT ||
    'MapiksBot/1.0 (+https://mapiks.com/about; event listings)';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8_000;
const cache = new Map();
/** Test seam, and a way to force a refetch after a site changes its rules. */
function clearRobotsCache() {
    cache.clear();
}
/**
 * Parses the directives that apply to us: our own user agent if the file names
 * it, falling back to the wildcard group. Other agents' groups are ignored, which
 * is the whole point of the grouping.
 */
function parseRobots(body, userAgent = exports.DEFAULT_USER_AGENT) {
    const rules = { disallow: [], allow: [] };
    const name = userAgent.split('/')[0].toLowerCase();
    let applies = false;
    let sawSpecificGroup = false;
    const wildcard = { disallow: [], allow: [] };
    for (const rawLine of body.split('\n')) {
        const line = rawLine.split('#')[0].trim();
        if (!line)
            continue;
        const separator = line.indexOf(':');
        if (separator === -1)
            continue;
        const field = line.slice(0, separator).trim().toLowerCase();
        const value = line.slice(separator + 1).trim();
        if (field === 'user-agent') {
            const agent = value.toLowerCase();
            applies = agent === '*' || name.includes(agent) || agent.includes(name);
            if (applies && agent !== '*')
                sawSpecificGroup = true;
            continue;
        }
        if (!applies)
            continue;
        const target = sawSpecificGroup ? rules : wildcard;
        if (field === 'disallow' && value)
            target.disallow.push(value);
        if (field === 'allow' && value)
            target.allow.push(value);
        if (field === 'crawl-delay') {
            const seconds = Number(value);
            if (Number.isFinite(seconds))
                target.crawlDelaySeconds = seconds;
        }
    }
    // A group naming us explicitly overrides the wildcard group entirely.
    return sawSpecificGroup ? rules : wildcard;
}
function matches(path, rule) {
    // robots.txt patterns support * as a wildcard and $ as an end anchor.
    const pattern = rule
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\\\$$/, '$');
    return new RegExp(`^${pattern}`).test(path);
}
function isAllowedByRules(rules, path) {
    // The most specific matching rule wins; Allow beats Disallow at equal length.
    const longestAllow = rules.allow.filter(r => matches(path, r)).sort((a, b) => b.length - a.length)[0];
    const longestDisallow = rules.disallow
        .filter(r => matches(path, r))
        .sort((a, b) => b.length - a.length)[0];
    if (!longestDisallow)
        return true;
    if (!longestAllow)
        return false;
    return longestAllow.length >= longestDisallow.length;
}
/**
 * Whether a site's own robots.txt permits us to read a page.
 *
 * A site that has not published rules is treated as permitting it, which is the
 * convention; a site that cannot be reached is treated the same way, because an
 * outage is not a refusal. An explicit refusal is honoured.
 */
async function isAllowed(targetUrl) {
    let url;
    try {
        url = new URL(targetUrl);
    }
    catch {
        return false;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
        return false;
    const origin = url.origin;
    const cached = cache.get(origin);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return isAllowedByRules(cached.rules, url.pathname);
    }
    let rules = { disallow: [], allow: [] };
    try {
        const response = await fetch(`${origin}/robots.txt`, {
            headers: { 'User-Agent': exports.DEFAULT_USER_AGENT },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        // 404 means no rules, which means no restrictions.
        if (response.ok)
            rules = parseRobots(await response.text());
    }
    catch {
        // Unreachable: assume permitted rather than silently dropping a venue.
    }
    cache.set(origin, { rules, fetchedAt: Date.now() });
    return isAllowedByRules(rules, url.pathname);
}
