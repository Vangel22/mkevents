import type { EventCategory, UnblockOptions } from './types';
import { type ListedEvent } from './listing';
/**
 * karti.com.mk: the widest ticket listing in the country, the same catalogue
 * mktickets.mk shows in English. Its listing page has no start times, so each
 * event's own page is read for the time and the description.
 */
export declare const KARTI_BASE = "https://www.karti.com.mk/";
export declare const KARTI_LISTING = "https://www.karti.com.mk/aktuelno.nspx";
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
export declare function parseKartiDate(text: string): {
    start: Day;
    end?: Day;
} | null;
/** The category Karti's classes state, or null when they state none. */
export declare function kartiCategory(classes: string[]): EventCategory | null;
export declare function parseKartiListing(html: string): KartiCard[];
/** The start time and description from an event's own page. */
export declare function parseKartiDetail(html: string): {
    time: string | null;
    description?: string;
};
export declare function mapKartiCard(card: KartiCard, detail: {
    time: string | null;
    description?: string;
}): ListedEvent | null;
/** Every dated event on karti.com.mk, with its time read from its own page. */
export declare function readKarti(options?: UnblockOptions): Promise<ListedEvent[]>;
export {};
