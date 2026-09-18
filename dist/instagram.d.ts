import type { ApifyOptions } from './types';
export interface ScrapedPost {
    url: string;
    imageUrl: string;
    caption: string;
    timestamp: string;
}
export declare class ScraperError extends Error {
    readonly reason: 'unconfigured' | 'failed' | 'timeout' | 'unreadable';
    constructor(message: string, reason: 'unconfigured' | 'failed' | 'timeout' | 'unreadable');
}
export declare function isConfigured(options?: ApifyOptions): boolean;
/** What the actor returns per post; only these fields are used. */
interface ApifyPost {
    url?: string;
    shortCode?: string;
    caption?: string;
    timestamp?: string;
    displayUrl?: string;
    images?: string[];
    type?: string;
}
export declare function mapPost(post: ApifyPost): ScrapedPost | null;
/**
 * Fetches a profile's recent posts through Apify.
 *
 * Instagram's login wall makes direct scraping fail from any server, so this
 * delegates to a maintained actor that handles the proxies and fingerprinting.
 * The posts still go through extraction afterwards, because what comes back is a
 * caption and an image — Instagram has no event object.
 *
 * This remains against Instagram's terms of service. It is the bootstrap until
 * venues connect their own accounts, not the long-term source.
 */
export declare function scrapeInstagramProfile(handle: string, options?: ApifyOptions): Promise<ScrapedPost[]>;
export {};
