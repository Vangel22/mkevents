import type { UnblockOptions } from './types';
import { type ListedEvent } from './listing';
/**
 * The Macedonian Philharmonic's season, from its "events and tickets" page.
 *
 * Each concert appears twice on the page: a card with the full date and time,
 * and a section with the hall and the programme. The card's data-tab names the
 * section, which is how the two are joined.
 */
export declare const FILHARMONIJA_BASE = "https://www.filharmonija.mk/";
export declare const FILHARMONIJA_PROGRAMME = "https://www.filharmonija.mk/nastani-i-bileti/";
/** "8 Oктомври 2026". */
export declare function parseDayMonthYear(text: string): [number, number, number] | null;
export declare function parseFilharmonija(html: string): ListedEvent[];
/** The Philharmonic's published season. */
export declare function readFilharmonija(options?: UnblockOptions): Promise<ListedEvent[]>;
