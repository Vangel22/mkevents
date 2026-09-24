import { type ListedEvent } from './listing';
/**
 * wayin.mk, read from the shop interface its own pages call. Festivals such as
 * the Skopje City Festival sell here and nowhere else.
 *
 * The interface answers only when told which shop it serves; this id is the
 * one wayin.mk's own pages send.
 */
export declare const WAYIN_BASE = "https://wayin.mk/";
export interface WayinProduct {
    id: number;
    title?: string | null;
    slug?: string | null;
    description?: string | null;
    thumbnail?: {
        url?: string;
    } | null;
    stock_status?: string | null;
    event_date_period?: string | null;
    event_location?: string | null;
    event_start_time?: string | null;
}
/** "19.10.2026", "6.12.2025", or a range "28.08.2026 - 29.08.2026". */
export declare function parseWayinPeriod(text: string): {
    start: [number, number, number];
    end?: [number, number, number];
} | null;
export declare function mapWayinProduct(product: WayinProduct): ListedEvent | null;
/** Every event on sale at wayin.mk, page by page. */
export declare function readWayin(): Promise<ListedEvent[]>;
