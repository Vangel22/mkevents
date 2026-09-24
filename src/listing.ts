import type { EventCategory } from './types';

import { isAllowed, DEFAULT_USER_AGENT } from './robots';
import { categorise, WebsiteFetchError } from './website';

/** The ticket sites and programmes read here, each by its own reader. */
export type ListingOrigin = 'karti' | 'kupikarta' | 'wayin' | 'filharmonija' | 'kinoverzum';

/**
 * One event as a listing publishes it, before anyone decides where it belongs.
 *
 * A ticket site sells for dozens of venues, so the venue is only a name here:
 * matching it to a venue, or creating one, is the caller's rule, not ours.
 */
export interface ListedEvent {
  origin: ListingOrigin;
  /** Stable for the life of the event, so a second read updates the first. */
  sourceUrl: string;
  title: string;
  description?: string;
  image?: string;
  /**
   * Local wall time in North Macedonia, `2026-10-02T22:00:00`, or an instant
   * with an explicit zone. A day with no published time starts at midnight.
   */
  startDate: string;
  endDate?: string;
  /** Every screening, for a film shown many times. */
  showtimes?: string[];
  /** Where it happens, exactly as the listing writes it. */
  venueName: string;
  /** The city, when the listing states it apart from the venue. */
  cityName?: string;
  /** The lowest price, in denars. Absent when unpublished or not in denars. */
  price?: number;
  isPaid: boolean;
  ticketUrl?: string;
  category: EventCategory;
  isSoldOut?: boolean;
  /** Minimum age, for a film rated 12+ or 16+. */
  ageRestriction?: number;
}

// Latin letters that look Cyrillic. Sites type month names on whichever
// keyboard is open: the Philharmonic writes "Oктомври" with a Latin O.
const LOOKALIKES: Record<string, string> = {
  a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т', h: 'н', b: 'в', j: 'ј',
};

// Cyrillic, English, and Macedonian typed in Latin ("Oktomvri", "Avgust").
const MONTH_STEMS: Array<[RegExp, number]> = [
  [/^(јан|jan)/, 1], [/^(фев|feb)/, 2], [/^(мар|mar)/, 3], [/^(апр|apr)/, 4],
  [/^(мај|maj|may)/, 5], [/^(јун|jun)/, 6], [/^(јул|jul)/, 7], [/^(авг|avg|aug)/, 8],
  [/^(сеп|sep)/, 9], [/^(окт|okt|oct)/, 10], [/^(ное|noe|nov)/, 11], [/^(дек|dek|dec)/, 12],
];

/** 1–12 for a month name in Macedonian or English, however it was typed. */
export function monthNumber(word: string): number | null {
  const lower = word.trim().toLowerCase();
  const cyrillic = /[а-ш]/.test(lower) ? [...lower].map(ch => LOOKALIKES[ch] ?? ch).join('') : lower;

  for (const [stem, month] of MONTH_STEMS) {
    if (stem.test(cyrillic) || stem.test(lower)) return month;
  }
  return null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `2026-10-02T22:00:00`, the local wall time the caller reads in venue time. */
export function localDateTime(year: number, month: number, day: number, time?: string | null): string | null {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const [hours, minutes] = (time ?? '00:00').split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59) return null;
  return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00`;
}

/** The first `21:00` in a text, as `HH:MM`. */
export function findTime(text: string): string | null {
  // Bounded by digits, not word breaks: "19:30h" and "19:30ч" are both a time.
  const match = /(?<!\d)([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)/.exec(text);
  return match ? `${pad(Number(match[1]))}:${match[2]}` : null;
}

/**
 * The lowest price in denars from a free-text price.
 *
 * "600 - 1000", "1990-4000 мкд" and "129 € + ДДВ (9.392 денари)" all occur. A
 * figure written in euros is not a price in denars, so it is skipped.
 */
export function lowestDenars(text: string): number | undefined {
  const figures = [...text.matchAll(/(\d[\d.,\s]*\d|\d)\s*(€|eur|евр)?/gi)]
    .filter(match => !match[2])
    .map(match => Number(match[1].replace(/[.,\s]/g, '')))
    .filter(value => value > 0);
  return figures.length > 0 ? Math.min(...figures) : undefined;
}

/** Whitespace and HTML entities collapsed, for text read out of markup. */
export function clean(text: string | undefined | null): string {
  return (text ?? '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8220;|&#8221;|&bdquo;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#038;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Text of an HTML fragment, paragraphs kept apart. */
export function htmlToText(html: string | undefined | null): string {
  return clean((html ?? '').replace(/<\/(p|div|li|h\d)>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/ ?\n ?/g, '\n');
}

/**
 * A category from the words of a listing that does not state one.
 *
 * The title decides when it can. A description is weaker evidence: it
 * promises "забава" (fun) at a lecture and a tribute concert alike, so a party
 * read only from a description is not believed, and a concert named in it is.
 */
export function guessCategory(title: string, description?: string): EventCategory {
  const fromTitle = categorise({ name: title });
  if (fromTitle !== 'other') return fromTitle;

  if (/концерт|concert/i.test(description ?? '')) return 'concert';
  const fromText = categorise({ name: title, description: description ?? '' });
  return fromText === 'party' ? 'other' : fromText;
}

/** A path on a site made absolute. */
export function absolute(base: string, path: string | undefined | null): string | undefined {
  if (!path) return undefined;
  try {
    return new URL(path, base).toString();
  } catch {
    return undefined;
  }
}

const TIMEOUT_MS = 20_000;

/** JSON from a site's own data interface, honouring its robots.txt first. */
export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  if (!(await isAllowed(url))) {
    throw new WebsiteFetchError(`robots.txt disallows ${url}`, 'disallowed');
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'User-Agent': process.env.CRAWLER_USER_AGENT || DEFAULT_USER_AGENT,
      ...(init.headers as Record<string, string> | undefined),
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new WebsiteFetchError(`${url} returned ${response.status}`, 'unreachable');
  }
  return (await response.json()) as T;
}

/** A pause between page reads, so a whole listing is not fetched in one burst. */
export const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
