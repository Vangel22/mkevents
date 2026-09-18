import type { EventCategory } from './types';
export declare class WebsiteFetchError extends Error {
    readonly reason: 'disallowed' | 'unreachable' | 'too-large' | 'not-html';
    constructor(message: string, reason: 'disallowed' | 'unreachable' | 'too-large' | 'not-html');
}
/** Every JSON-LD block on a page, flattened out of @graph and arrays. */
export declare function extractJsonLd(html: string): Record<string, unknown>[];
export declare function isEventNode(node: Record<string, unknown>): boolean;
/**
 * schema.org gives a type, which is a far better signal than reading the text.
 * Keywords and the venue's own type are only consulted when the publisher used
 * the bare Event type.
 */
export declare function categorise(node: Record<string, unknown>, venueType?: string): EventCategory;
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
export declare function mapEvent(node: Record<string, unknown>, pageUrl: string, venue: {
    type?: string;
}): WebsiteEvent | null;
/**
 * Reads a venue's own page, honouring its robots.txt.
 *
 * This is the one ingestion path with neither a cost nor a terms problem: the
 * venue published this data as structured markup precisely so that machines
 * would read it.
 */
export declare function fetchPage(pageUrl: string): Promise<string>;
/** Everything a page publishes as a schema.org Event. */
export declare function readEventsFromPage(pageUrl: string, venue: {
    type?: string;
}): Promise<WebsiteEvent[]>;
