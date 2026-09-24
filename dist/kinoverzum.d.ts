import type { UnblockOptions } from './types';
import { type ListedEvent } from './listing';
/**
 * Kinoverzum's weekly programme: every film at all five of its cinemas on one
 * page, a row per film and a column per day, each screening written "22:10 Штип".
 *
 * A film becomes one event per cinema, carrying that cinema's screenings, the
 * way a Cineplexx film does.
 */
export declare const KINOVERZUM_PROGRAMME = "https://kinoverzum.mk/nedelna-programa/";
export declare function parseKinoverzum(html: string): ListedEvent[];
/** This week's screenings at every Kinoverzum cinema. */
export declare function readKinoverzum(options?: UnblockOptions): Promise<ListedEvent[]>;
