import { clean, absolute, fetchJson, htmlToText, guessCategory, type ListedEvent } from './listing';

/**
 * kupikarta.com, read from the data interface its own event list calls.
 *
 * Every event carries its venue with a stable id and the venue's city, which
 * makes it the most reliable of the ticket sites to place on a map.
 */
export const KUPIKARTA_BASE = 'https://kupikarta.com/';
const ENDPOINT = `${KUPIKARTA_BASE}services/exportdata.asmx/GetEvents`;
const PAGE_SIZE = 50;

type Localised = { NameFirst?: string | null; NameSecond?: string | null; NameThird?: string | null };

export interface KupiKartaEvent extends Localised {
  Id: number;
  DateTime?: string;
  DescriptionFirst?: string | null;
  DescriptionSecond?: string | null;
  DescriptionThird?: string | null;
  PriceCurrencyFirst?: number;
  PriceCurrencySecond?: number;
  Thumbnail?: string | null;
  IsClosed?: boolean;
  IsSoldOut?: boolean;
  ObjectMap?: Localised & { Object?: Localised & { AddressFirst?: string | null } };
}

/**
 * The Macedonian of the three name fields.
 *
 * Which field holds which language differs from record to record: an event's
 * first name is Cyrillic while its venue's first name is "Nacionalna Opera i
 * Balet". Cyrillic is preferred, since that is what readers search in.
 */
export function macedonian(record: Localised | undefined | null): string {
  const names = [record?.NameFirst, record?.NameSecond, record?.NameThird].map(clean).filter(Boolean);
  return names.find(name => /[Ѐ-ӿ]/.test(name)) ?? names[0] ?? '';
}

/** "/Date(1790438400000)/" as an instant. */
export function aspNetDate(value: string | undefined): string | null {
  const match = /\/Date\((-?\d+)\)\//.exec(value ?? '');
  return match ? new Date(Number(match[1])).toISOString() : null;
}

export function mapKupiKartaEvent(event: KupiKartaEvent): ListedEvent | null {
  const title = macedonian(event);
  const startDate = aspNetDate(event.DateTime);
  const venue = event.ObjectMap?.Object;
  const venueName = macedonian(venue) || macedonian(event.ObjectMap);

  if (!title || !startDate || !venueName || event.IsClosed) return null;

  // One description field is only the title again; the longest one is the text.
  const description = [event.DescriptionFirst, event.DescriptionSecond, event.DescriptionThird]
    .map(htmlToText)
    .sort((a, b) => b.length - a.length)[0];

  const price = [event.PriceCurrencySecond, event.PriceCurrencyFirst].find(value => (value ?? 0) > 0);
  const page = `${KUPIKARTA_BASE}event-details.nspx?eventid=${event.Id}`;

  return {
    origin: 'kupikarta',
    sourceUrl: page,
    title,
    description: description && description !== title ? description : undefined,
    image: absolute(KUPIKARTA_BASE, event.Thumbnail),
    startDate,
    venueName,
    cityName: clean(venue?.AddressFirst) || undefined,
    price,
    isPaid: true,
    ticketUrl: `${KUPIKARTA_BASE}tickets.nspx?eventid=${event.Id}`,
    category: guessCategory(title, description),
    isSoldOut: Boolean(event.IsSoldOut),
  };
}

/** Every open event on kupikarta.com, page by page. */
export async function readKupiKarta(): Promise<ListedEvent[]> {
  const events: KupiKartaEvent[] = [];

  for (let page = 1; page <= 20; page += 1) {
    const { d } = await fetchJson<{ d: { events: KupiKartaEvent[]; total: number } }>(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', lang: 'mk' },
      body: JSON.stringify({ filter: { Page: page, Size: PAGE_SIZE, MobileEnabled: true } }),
    });

    events.push(...d.events);
    if (d.events.length === 0 || events.length >= d.total) break;
  }

  return events.map(mapKupiKartaEvent).filter((event): event is ListedEvent => event !== null);
}
