import type { EventCategory } from './types';

import { isAllowed, DEFAULT_USER_AGENT } from './robots';

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
const TYPE_CATEGORY: Record<string, EventCategory> = {
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

export class WebsiteFetchError extends Error {
  constructor(
    message: string,
    readonly reason: 'disallowed' | 'unreachable' | 'too-large' | 'not-html',
  ) {
    super(message);
    this.name = 'WebsiteFetchError';
  }
}

/** Every JSON-LD block on a page, flattened out of @graph and arrays. */
export function extractJsonLd(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(pattern)) {
    let parsed: unknown;

    try {
      parsed = JSON.parse(match[1].trim());
    } catch {
      // A malformed block on a page is common and is not worth failing over.
      continue;
    }

    const queue = Array.isArray(parsed) ? [...parsed] : [parsed];

    while (queue.length > 0) {
      const node = queue.shift();
      if (!node || typeof node !== 'object') continue;

      const record = node as Record<string, unknown>;

      if (Array.isArray(record['@graph'])) {
        queue.push(...(record['@graph'] as unknown[]));
        continue;
      }

      blocks.push(record);
    }
  }

  return blocks;
}

function typeOf(node: Record<string, unknown>): string[] {
  const raw = node['@type'];
  if (typeof raw === 'string') return [raw];
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === 'string');
  return [];
}

export function isEventNode(node: Record<string, unknown>): boolean {
  return typeOf(node).some(type => EVENT_TYPES.has(type));
}

const KEYWORDS: Array<[EventCategory, string[]]> = [
  ['cinema', ['филм', 'кино', 'премиера', 'проекциј', 'cinema', 'film', 'screening']],
  ['party', ['журк', 'забав', 'техно', 'party', 'techno', 'rave', 'dj ', 'clubbing']],
  ['food_wine', ['вино', 'дегустац', 'вечера', 'wine', 'tasting', 'dinner', 'brunch']],
  ['cultural', ['изложб', 'театар', 'претстав', 'поезиј', 'галериј', 'exhibition', 'theatre', 'gallery']],
  ['concert', ['концерт', 'настап', 'concert', 'live band', 'acoustic']],
  ['tech', ['конференц', 'работилниц', 'conference', 'workshop', 'hackathon', 'meetup']],
  ['corporate', ['корпоратив', 'corporate', 'networking']],
];

const VENUE_TYPE_CATEGORY: Record<string, EventCategory> = {
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
export function categorise(node: Record<string, unknown>, venueType?: string): EventCategory {
  for (const type of typeOf(node)) {
    if (TYPE_CATEGORY[type]) return TYPE_CATEGORY[type];
  }

  const text = `${node.name ?? ''} ${node.description ?? ''}`.toLowerCase();
  for (const [category, words] of KEYWORDS) {
    if (words.some(word => text.includes(word))) {
      return category;
    }
  }

  return VENUE_TYPE_CATEGORY[venueType ?? ''] ?? 'other';
}

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return firstString(value[0]);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return firstString(record.url ?? record.contentUrl ?? record['@id'] ?? record.name);
  }
  return undefined;
}

/** Price and whether money is involved, from an Offer or a list of them. */
function readOffer(value: unknown): { isPaid: boolean; price: number | null; ticketUrl?: string } {
  const offers = Array.isArray(value) ? value : value ? [value] : [];

  for (const offer of offers) {
    if (!offer || typeof offer !== 'object') continue;

    const record = offer as Record<string, unknown>;
    const raw = record.price ?? record.lowPrice;
    const price = raw === undefined || raw === null ? null : Number(raw);
    const ticketUrl = firstString(record.url);

    if (price !== null && Number.isFinite(price)) {
      return { isPaid: price > 0, price: price > 0 ? price : null, ticketUrl };
    }

    if (ticketUrl) return { isPaid: true, price: null, ticketUrl };
  }

  return { isPaid: false, price: null };
}

export interface WebsiteEvent {
  title: string;
  description?: string;
  image?: string;
  startDate: string;
  endDate?: string;
  isPaid: boolean;
  price: number | null;
  ticketUrl?: string;
  category: EventCategory;
  sourceUrl: string;
  isCancelled: boolean;
}

/**
 * Maps a schema.org Event onto our own shape. Everything here was published as
 * structured data by the venue, so nothing is inferred and no model is involved.
 */
export function mapEvent(
  node: Record<string, unknown>,
  pageUrl: string,
  venue: { type?: string },
): WebsiteEvent | null {
  const title = firstString(node.name);
  const startDate = typeof node.startDate === 'string' ? node.startDate : undefined;

  if (!title || !startDate || Number.isNaN(new Date(startDate).getTime())) return null;

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
export async function fetchPage(pageUrl: string): Promise<string> {
  if (!(await isAllowed(pageUrl))) {
    throw new WebsiteFetchError(`robots.txt disallows ${pageUrl}`, 'disallowed');
  }

  let response: Response;

  try {
    response = await fetch(pageUrl, {
      headers: { 'User-Agent': DEFAULT_USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    });
  } catch (err) {
    throw new WebsiteFetchError(
      `Could not reach ${pageUrl}: ${err instanceof Error ? err.message : String(err)}`,
      'unreachable',
    );
  }

  if (!response.ok) {
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
export async function readEventsFromPage(
  pageUrl: string,
  venue: { type?: string },
): Promise<WebsiteEvent[]> {
  const html = await fetchPage(pageUrl);

  return extractJsonLd(html)
    .filter(isEventNode)
    .map(node => mapEvent(node, pageUrl, venue))
    .filter((event): event is WebsiteEvent => event !== null);
}
