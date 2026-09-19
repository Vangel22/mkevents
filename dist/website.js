"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebsiteFetchError = void 0;
exports.extractJsonLd = extractJsonLd;
exports.isEventNode = isEventNode;
exports.categorise = categorise;
exports.mapEvent = mapEvent;
exports.fetchPage = fetchPage;
exports.readEventsFromPage = readEventsFromPage;
const robots_1 = require("./robots");
const unblock_1 = require("./unblock");
const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 3_000_000;
/** schema.org Event and the subtypes a venue is likely to publish. */
const EVENT_TYPES = new Set([
    'Event',
    'MusicEvent',
    'TheaterEvent',
    'ScreeningEvent',
    'DanceEvent',
    'ComedyEvent',
    'Festival',
    'SocialEvent',
    'ExhibitionEvent',
    'EducationEvent',
    'LiteraryEvent',
    'FoodEvent',
    'BusinessEvent',
    'SportsEvent',
    'ChildrensEvent',
]);
/** A type that already tells us the category, so no guessing is needed. */
const TYPE_CATEGORY = {
    MusicEvent: 'concert',
    TheaterEvent: 'cultural',
    ScreeningEvent: 'cinema',
    ExhibitionEvent: 'cultural',
    LiteraryEvent: 'cultural',
    DanceEvent: 'party',
    ComedyEvent: 'cultural',
    FoodEvent: 'food_wine',
    BusinessEvent: 'corporate',
    EducationEvent: 'tech',
};
class WebsiteFetchError extends Error {
    reason;
    constructor(message, reason) {
        super(message);
        this.reason = reason;
        this.name = 'WebsiteFetchError';
    }
}
exports.WebsiteFetchError = WebsiteFetchError;
/** Every JSON-LD block on a page, flattened out of @graph and arrays. */
function extractJsonLd(html) {
    const blocks = [];
    const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    for (const match of html.matchAll(pattern)) {
        let parsed;
        try {
            parsed = JSON.parse(match[1].trim());
        }
        catch {
            // A malformed block on a page is common and is not worth failing over.
            continue;
        }
        const queue = Array.isArray(parsed) ? [...parsed] : [parsed];
        while (queue.length > 0) {
            const node = queue.shift();
            if (!node || typeof node !== 'object')
                continue;
            const record = node;
            if (Array.isArray(record['@graph'])) {
                queue.push(...record['@graph']);
                continue;
            }
            blocks.push(record);
        }
    }
    return blocks;
}
function typeOf(node) {
    const raw = node['@type'];
    if (typeof raw === 'string')
        return [raw];
    if (Array.isArray(raw))
        return raw.filter((t) => typeof t === 'string');
    return [];
}
function isEventNode(node) {
    return typeOf(node).some(type => EVENT_TYPES.has(type));
}
const KEYWORDS = [
    ['cinema', ['филм', 'кино', 'премиера', 'проекциј', 'cinema', 'film', 'screening']],
    ['party', ['журк', 'забав', 'техно', 'party', 'techno', 'rave', 'dj ', 'clubbing']],
    ['food_wine', ['вино', 'дегустац', 'вечера', 'wine', 'tasting', 'dinner', 'brunch']],
    ['cultural', ['изложб', 'театар', 'претстав', 'поезиј', 'галериј', 'exhibition', 'theatre', 'gallery']],
    ['concert', ['концерт', 'настап', 'concert', 'live band', 'acoustic']],
    ['tech', ['конференц', 'работилниц', 'conference', 'workshop', 'hackathon', 'meetup']],
    ['corporate', ['корпоратив', 'corporate', 'networking']],
];
const VENUE_TYPE_CATEGORY = {
    club: 'party',
    bar: 'party',
    cinema: 'cinema',
    restaurant: 'food_wine',
    gallery: 'cultural',
    theater: 'cultural',
    outdoor: 'other',
};
/**
 * schema.org gives a type, which is a far better signal than reading the text.
 * Keywords and the venue's own type are only consulted when the publisher used
 * the bare Event type.
 */
function categorise(node, venueType) {
    for (const type of typeOf(node)) {
        if (TYPE_CATEGORY[type])
            return TYPE_CATEGORY[type];
    }
    const text = `${node.name ?? ''} ${node.description ?? ''}`.toLowerCase();
    for (const [category, words] of KEYWORDS) {
        if (words.some(word => text.includes(word))) {
            return category;
        }
    }
    return VENUE_TYPE_CATEGORY[venueType ?? ''] ?? 'other';
}
function firstString(value) {
    if (typeof value === 'string')
        return value;
    if (Array.isArray(value))
        return firstString(value[0]);
    if (value && typeof value === 'object') {
        const record = value;
        return firstString(record.url ?? record.contentUrl ?? record['@id'] ?? record.name);
    }
    return undefined;
}
/** Price and whether money is involved, from an Offer or a list of them. */
function readOffer(value) {
    const offers = Array.isArray(value) ? value : value ? [value] : [];
    for (const offer of offers) {
        if (!offer || typeof offer !== 'object')
            continue;
        const record = offer;
        const raw = record.price ?? record.lowPrice;
        const price = raw === undefined || raw === null ? null : Number(raw);
        const ticketUrl = firstString(record.url);
        if (price !== null && Number.isFinite(price)) {
            return { isPaid: price > 0, price: price > 0 ? price : null, ticketUrl };
        }
        if (ticketUrl)
            return { isPaid: true, price: null, ticketUrl };
    }
    return { isPaid: false, price: null };
}
/**
 * Maps a schema.org Event onto our own shape. Everything here was published as
 * structured data by the venue, so nothing is inferred and no model is involved.
 */
function mapEvent(node, pageUrl, venue) {
    const title = firstString(node.name);
    const startDate = typeof node.startDate === 'string' ? node.startDate : undefined;
    if (!title || !startDate || Number.isNaN(new Date(startDate).getTime()))
        return null;
    const offer = readOffer(node.offers);
    const status = typeof node.eventStatus === 'string' ? node.eventStatus : '';
    return {
        title: title.trim(),
        description: firstString(node.description)?.trim(),
        image: firstString(node.image),
        startDate,
        endDate: typeof node.endDate === 'string' ? node.endDate : undefined,
        isPaid: offer.isPaid,
        price: offer.price,
        ticketUrl: offer.ticketUrl,
        category: categorise(node, venue.type),
        // The event's own page when it has one, so each event dedupes separately.
        sourceUrl: firstString(node.url) ?? `${pageUrl}#${encodeURIComponent(title.trim())}`,
        isCancelled: status.includes('Cancelled') || status.includes('Canceled'),
    };
}
/**
 * Reads a venue's own page, honouring its robots.txt.
 *
 * This is the one ingestion path with neither a cost nor a terms problem: the
 * venue published this data as structured markup precisely so that machines
 * would read it.
 */
/**
 * Second attempt through an unblocking provider, or null if there is none.
 *
 * Only ever reached after a direct fetch was refused, so the free path stays
 * the default and nothing is billed for a site that answers on its own. It is
 * never reached when robots.txt disallowed the page: a site that asked not to
 * be read is not a site to try harder against.
 */
async function viaProvider(pageUrl, options) {
    if (!(0, unblock_1.isUnblockConfigured)(options))
        return null;
    try {
        return await (0, unblock_1.fetchThrough)(pageUrl, {
            ...options,
            headers: { 'User-Agent': robots_1.DEFAULT_USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
        });
    }
    catch {
        // The fallback failing is not more interesting than the original refusal.
        return null;
    }
}
/**
 * Status codes worth paying a provider to retry.
 *
 * A block is a door held shut by a bot check, which is what an unblocker is
 * for. A 404 is an honest answer and a 500 is the site's own fault — neither
 * changes if the request arrives from somewhere else, so neither is retried.
 */
const BLOCKED_STATUSES = new Set([401, 403, 405, 406, 409, 418, 429, 503]);
async function fetchPage(pageUrl, options = {}) {
    if (!(await (0, robots_1.isAllowed)(pageUrl))) {
        throw new WebsiteFetchError(`robots.txt disallows ${pageUrl}`, 'disallowed');
    }
    let response;
    try {
        response = await fetch(pageUrl, {
            headers: { 'User-Agent': robots_1.DEFAULT_USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            redirect: 'follow',
        });
    }
    catch (err) {
        // Refused outright, so there is nothing to read here. A provider fetching
        // from a residential address is the only thing that might change that.
        const retried = await viaProvider(pageUrl, options);
        if (retried !== null)
            return retried;
        throw new WebsiteFetchError(`Could not reach ${pageUrl}: ${err instanceof Error ? err.message : String(err)}`, 'unreachable');
    }
    if (!response.ok) {
        if (BLOCKED_STATUSES.has(response.status)) {
            const retried = await viaProvider(pageUrl, options);
            if (retried !== null)
                return retried;
        }
        throw new WebsiteFetchError(`${pageUrl} returned ${response.status}`, 'unreachable');
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType && !contentType.includes('html') && !contentType.includes('xml')) {
        throw new WebsiteFetchError(`${pageUrl} is ${contentType}, not a page`, 'not-html');
    }
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > MAX_BYTES) {
        throw new WebsiteFetchError(`${pageUrl} is ${length} bytes`, 'too-large');
    }
    const html = await response.text();
    if (html.length > MAX_BYTES) {
        throw new WebsiteFetchError(`${pageUrl} body is ${html.length} bytes`, 'too-large');
    }
    return html;
}
/** Everything a page publishes as a schema.org Event. */
async function readEventsFromPage(pageUrl, venue, options = {}) {
    const html = await fetchPage(pageUrl, options);
    return extractJsonLd(html)
        .filter(isEventNode)
        .map(node => mapEvent(node, pageUrl, venue))
        .filter((event) => event !== null);
}
