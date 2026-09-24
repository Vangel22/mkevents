import { parse, type HTMLElement } from 'node-html-parser';

import type { UnblockOptions } from './types';

import { fetchPage } from './website';
import { clean, findTime, localDateTime, monthNumber, type ListedEvent } from './listing';

/**
 * The Macedonian Philharmonic's season, from its "events and tickets" page.
 *
 * Each concert appears twice on the page: a card with the full date and time,
 * and a section with the hall and the programme. The card's data-tab names the
 * section, which is how the two are joined.
 */
export const FILHARMONIJA_BASE = 'https://www.filharmonija.mk/';
export const FILHARMONIJA_PROGRAMME = `${FILHARMONIJA_BASE}nastani-i-bileti/`;
const HOME = 'Македонска филхармонија';

/** "8 Oктомври 2026". */
export function parseDayMonthYear(text: string): [number, number, number] | null {
  const match = /(\d{1,2})\s+(\S+)\s+(\d{4})/.exec(text);
  const month = match ? monthNumber(match[2]) : null;
  return match && month ? [Number(match[3]), month, Number(match[1])] : null;
}

function backgroundImage(el: HTMLElement | null): string | undefined {
  return /url\(['"]?([^'")]+)['"]?\)/.exec(el?.getAttribute('style') ?? '')?.[1];
}

export function parseFilharmonija(html: string): ListedEvent[] {
  const doc = parse(html);
  const seen = new Set<string>();
  const events: ListedEvent[] = [];

  for (const card of doc.querySelectorAll('.event.c--pointer')) {
    const tab = card.getAttribute('data-tab');
    if (!tab || seen.has(tab)) continue;
    seen.add(tab);

    const [dateLine, timeLine] = card.querySelectorAll('.event-content-date h5').map(h5 => clean(h5.text));
    const day = parseDayMonthYear(dateLine ?? '');
    const time = findTime(timeLine ?? '');
    let title = clean(card.querySelector('.event-content h4')?.text);
    if (!day || !time || !title) continue;

    const section = doc.querySelector(`.event-section.${tab}`);
    const more = section?.querySelectorAll('a').find(a => /\/events\//.test(a.getAttribute('href') ?? ''));
    const ticket = section?.querySelectorAll('a').find(a => /Купи/i.test(a.text));

    // A concert given on tour is billed "Гостување во <venue>"; that venue is
    // where to go, not the Philharmonic.
    const guest = /^Гостување во\s+(.+)$/i.exec(title)?.[1];
    if (guest) title = `${HOME} – гостување во ${guest}`;

    const startDate = localDateTime(...day, time);
    if (!startDate) continue;

    const page = more?.getAttribute('href') ?? FILHARMONIJA_PROGRAMME;
    const description = clean(section?.querySelector('.event-section-body, .event-section-content')?.text)
      || clean(card.querySelector('.navLink')?.text).replace(/\.\.\.$/, '')
      || undefined;

    events.push({
      origin: 'filharmonija',
      // Two matinees of one programme share a page, so the date keeps them apart.
      sourceUrl: `${page}#${startDate.slice(0, 10)}`,
      title,
      description,
      image: backgroundImage(card.querySelector('.event-img')),
      startDate,
      venueName: guest ?? HOME,
      cityName: guest ? undefined : 'Скопје',
      isPaid: true,
      ticketUrl: ticket?.getAttribute('href') ?? undefined,
      category: 'concert',
    });
  }

  return events;
}

/** The Philharmonic's published season. */
export async function readFilharmonija(options: UnblockOptions = {}): Promise<ListedEvent[]> {
  return parseFilharmonija(await fetchPage(FILHARMONIJA_PROGRAMME, options));
}
