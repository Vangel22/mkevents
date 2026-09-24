import type { EventCategory } from './types';
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
/** 1–12 for a month name in Macedonian or English, however it was typed. */
export declare function monthNumber(word: string): number | null;
/** `2026-10-02T22:00:00`, the local wall time the caller reads in venue time. */
export declare function localDateTime(year: number, month: number, day: number, time?: string | null): string | null;
/** The first `21:00` in a text, as `HH:MM`. */
export declare function findTime(text: string): string | null;
/**
 * The lowest price in denars from a free-text price.
 *
 * "600 - 1000", "1990-4000 мкд" and "129 € + ДДВ (9.392 денари)" all occur. A
 * figure written in euros is not a price in denars, so it is skipped.
 */
export declare function lowestDenars(text: string): number | undefined;
/** Whitespace and HTML entities collapsed, for text read out of markup. */
export declare function clean(text: string | undefined | null): string;
/** Text of an HTML fragment, paragraphs kept apart. */
export declare function htmlToText(html: string | undefined | null): string;
/**
 * A category from the words of a listing that does not state one.
 *
 * The title decides when it can. A description is weaker evidence: it
 * promises "забава" (fun) at a lecture and a tribute concert alike, so a party
 * read only from a description is not believed, and a concert named in it is.
 */
export declare function guessCategory(title: string, description?: string): EventCategory;
/** A path on a site made absolute. */
export declare function absolute(base: string, path: string | undefined | null): string | undefined;
/** JSON from a site's own data interface, honouring its robots.txt first. */
export declare function fetchJson<T>(url: string, init?: RequestInit): Promise<T>;
/** A pause between page reads, so a whole listing is not fetched in one burst. */
export declare const pause: (ms: number) => Promise<unknown>;
