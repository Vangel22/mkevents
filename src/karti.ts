import { parse } from 'node-html-parser';

import type { EventCategory, UnblockOptions } from './types';

import { fetchPage } from './website';
import {
  pause,
  clean,
  absolute,
  findTime,
  monthNumber,
  lowestDenars,
  guessCategory,
  localDateTime,
  type ListedEvent,
} from './listing';

/**
 * karti.com.mk: the widest ticket listing in the country, the same catalogue
 * mktickets.mk shows in English. Its listing page has no start times, so each
 * event's own page is read for the time and the description.
 */
export const KARTI_BASE = 'https://www.karti.com.mk/';
export const KARTI_LISTING = `${KARTI_BASE}aktuelno.nspx`;

/** One card on the listing page, as written. */
export interface KartiCard {
  url: string;
  title: string;
  dateText: string;
  venueText: string;
  priceText: string;
  image?: string;
  classes: string[];
}

type Day = [year: number, month: number, day: number];

/**
 * The days a card's date covers.
 *
 * "02 Октомври 2026", "11 October 2026", "15-18 Октомври 2026" and
 * "23.09-05.10 Септември/Октомври 2026" all occur. A card with no date is a
 * monthly repertoire rather than an event, and is skipped.
 */
export function parseKartiDate(text: string): { start: Day; end?: Day } | null {
  const numeric = /^(\d{1,2})\.(\d{1,2})\s*-\s*(\d{1,2})\.(\d{1,2})\s+\S+\s+(\d{4})$/.exec(text);
  if (numeric) {
    const [, d1, m1, d2, m2, y] = numeric.map(Number);
    return { start: [y, m1, d1], end: [m2 < m1 ? y + 1 : y, m2, d2] };
  }

  const named = /^(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s+(\S+)\s+(\d{4})$/.exec(text);
  if (!named) return null;

  const month = monthNumber(named[3]);
  if (!month) return null;

  const year = Number(named[4]);
  const start: Day = [year, month, Number(named[1])];
  return named[2] ? { start, end: [year, month, Number(named[2])] } : { start };
}

// Karti's filter classes to our categories. The first match wins, so a jazz
// festival at the Opera is a concert and a comedy festival is theatre.
// "festivals" and "other" on their own say nothing, so they are not listed.
const CLASS_CATEGORY: Array<[string, EventCategory]> = [
  ['concerts', 'concert'],
  ['theater', 'cultural'],
  ['deca_mladinci', 'cultural'],
  ['turski', 'cultural'],
  ['philharmonic', 'concert'],
  ['mob', 'cultural'],
  ['sport_events', 'other'],
];

/** The category Karti's classes state, or null when they state none. */
export function kartiCategory(classes: string[]): EventCategory | null {
  return CLASS_CATEGORY.find(([name]) => classes.includes(name))?.[1] ?? null;
}

export function parseKartiListing(html: string): KartiCard[] {
  const doc = parse(html);

  return doc.querySelectorAll('a.k_event_link').flatMap(card => {
    const url = absolute(KARTI_BASE, card.getAttribute('href'));
    const title = clean(card.querySelector('.k-event-list-event-title')?.text);
    if (!url || !title) return [];

    return [
      {
        url,
        title,
        dateText: clean(card.querySelector('.k-events-event-date')?.text),
        venueText: clean(card.querySelector('.k-events-venue-details')?.text),
        priceText: clean(card.querySelector('.wraper-bottom-right')?.text),
        image: absolute(KARTI_BASE, card.querySelector('img')?.getAttribute('src')),
        classes: card.classList.value,
      },
    ];
  });
}

/** The start time and description from an event's own page. */
export function parseKartiDetail(html: string): { time: string | null; description?: string } {
  const doc = parse(html);
  const time =
    doc
      .querySelectorAll('.inner-event-details-row')
      .map(row => clean(row.text))
      .find(text => /^\d{1,2}:\d{2}$/.test(text)) ?? null;

  const description = clean(doc.querySelector('.inner-event-details-content')?.text);
  return { time: time ? findTime(time) : null, description: description || undefined };
}

export function mapKartiCard(card: KartiCard, detail: { time: string | null; description?: string }): ListedEvent | null {
  const days = parseKartiDate(card.dateText);
  // Without a time the listing would say midnight, which is a wrong fact
  // rather than a missing one. The next read will have it.
  if (!days || !detail.time) return null;

  const startDate = localDateTime(...days.start, detail.time);
  if (!startDate) return null;

  const price = lowestDenars(card.priceText);

  return {
    origin: 'karti',
    sourceUrl: card.url,
    title: card.title,
    description: detail.description,
    image: card.image,
    startDate,
    endDate: days.end ? (localDateTime(...days.end, detail.time) ?? undefined) : undefined,
    venueName: card.venueText,
    price,
    // A ticket shop lists what it sells.
    isPaid: true,
    ticketUrl: card.url,
    category: kartiCategory(card.classes) ?? guessCategory(card.title, detail.description),
  };
}

/** Every dated event on karti.com.mk, with its time read from its own page. */
export async function readKarti(options: UnblockOptions = {}): Promise<ListedEvent[]> {
  const cards = parseKartiListing(await fetchPage(KARTI_LISTING, options)).filter(card => parseKartiDate(card.dateText));
  const events: ListedEvent[] = [];

  for (const card of cards) {
    await pause(400);
    try {
      const event = mapKartiCard(card, parseKartiDetail(await fetchPage(card.url, options)));
      if (event) events.push(event);
    } catch {
      // One page that fails to load costs one event this run, not the run.
    }
  }

  return events;
}
