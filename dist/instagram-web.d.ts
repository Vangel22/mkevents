import type { ScrapedPost } from './instagram';
import type { UnblockOptions } from './types';
/** Only the fields used; the node carries a great deal more. */
interface TimelineNode {
    shortcode?: string;
    display_url?: string;
    thumbnail_src?: string;
    taken_at_timestamp?: number;
    is_video?: boolean;
    edge_media_to_caption?: {
        edges?: {
            node?: {
                text?: string;
            };
        }[];
    };
}
export declare function profileUrl(handle: string): string;
export declare function profileHeaders(): Record<string, string>;
/**
 * Turns one timeline node into the same shape the Apify path produces, so the
 * pipeline above does not know or care which reader ran.
 *
 * For a Reel, display_url is the poster frame — which is the image worth
 * reading, since the event details are printed on it.
 */
export declare function mapTimelineNode(node: TimelineNode): ScrapedPost | null;
/**
 * Pulls the posts out of the profile payload.
 *
 * Exported because the shape is the part most likely to move, and a change is
 * far easier to diagnose against a saved body than against a live run that
 * costs a request.
 */
export declare function readTimeline(body: string, limit?: number): ScrapedPost[];
/**
 * The whole read: fetch through the provider, parse, return posts.
 *
 * Drop-in for scrapeInstagramProfile — same arguments in spirit, same
 * ScrapedPost out — so the worker chooses a reader rather than branching.
 */
export declare function readInstagramProfile(handle: string, options?: UnblockOptions & {
    limit?: number;
}): Promise<ScrapedPost[]>;
export {};
