"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileUrl = profileUrl;
exports.profileHeaders = profileHeaders;
exports.mapTimelineNode = mapTimelineNode;
exports.readTimeline = readTimeline;
exports.readInstagramProfile = readInstagramProfile;
const instagram_1 = require("./instagram");
const unblock_1 = require("./unblock");
/**
 * Reads a public profile through Instagram's own web endpoint.
 *
 * This is the endpoint instagram.com calls to render a profile page, so it
 * returns the same posts a logged-out visitor sees and nothing more. It refuses
 * a datacentre address, which is what the unblocking provider is for, and it
 * refuses a request that does not identify the web app — hence the app id
 * below, which is a public constant instagram.com ships in its own bundle.
 *
 * This remains against Instagram's terms of service, exactly as the Apify path
 * was. It is the bootstrap until venues connect their own accounts.
 */
const PROFILE_ENDPOINT = 'https://www.instagram.com/api/v1/users/web_profile_info/';
const WEB_APP_ID = process.env.INSTAGRAM_WEB_APP_ID || '936619743392459';
const DEFAULT_LIMIT = Number(process.env.UNBLOCK_RESULTS_LIMIT) || 12;
function profileUrl(handle) {
    const cleaned = handle.trim().replace(/^@/, '');
    return `${PROFILE_ENDPOINT}?username=${encodeURIComponent(cleaned)}`;
}
function profileHeaders() {
    return {
        'x-ig-app-id': WEB_APP_ID,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'application/json',
    };
}
/**
 * Turns one timeline node into the same shape the Apify path produces, so the
 * pipeline above does not know or care which reader ran.
 *
 * For a Reel, display_url is the poster frame — which is the image worth
 * reading, since the event details are printed on it.
 */
function mapTimelineNode(node) {
    const shortcode = node.shortcode;
    const imageUrl = node.display_url ?? node.thumbnail_src ?? '';
    if (!shortcode || !imageUrl)
        return null;
    const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text ?? '';
    const takenAt = node.taken_at_timestamp;
    return {
        url: `https://www.instagram.com/p/${shortcode}/`,
        imageUrl,
        caption,
        timestamp: takenAt ? new Date(takenAt * 1000).toISOString() : new Date().toISOString(),
    };
}
/**
 * Pulls the posts out of the profile payload.
 *
 * Exported because the shape is the part most likely to move, and a change is
 * far easier to diagnose against a saved body than against a live run that
 * costs a request.
 */
function readTimeline(body, limit = DEFAULT_LIMIT) {
    let payload;
    try {
        payload = JSON.parse(body);
    }
    catch {
        // A login wall or a block page answers with HTML, not JSON. Saying which
        // saves the next person guessing at a provider that is working fine.
        throw new instagram_1.ScraperError('Instagram answered with something that is not JSON — usually the login wall, which means the request was not unblocked', 'unreadable');
    }
    const user = payload.data?.user;
    if (!user) {
        throw new instagram_1.ScraperError('Instagram returned no profile — the handle is wrong, or the account is gone', 'unreadable');
    }
    if (user.is_private) {
        throw new instagram_1.ScraperError('The account is private. The venue has to connect its own account, or send posters directly.', 'unreadable');
    }
    const edges = user.edge_owner_to_timeline_media?.edges ?? [];
    return edges
        .slice(0, limit)
        .map(edge => (edge.node ? mapTimelineNode(edge.node) : null))
        .filter((post) => post !== null);
}
/**
 * The whole read: fetch through the provider, parse, return posts.
 *
 * Drop-in for scrapeInstagramProfile — same arguments in spirit, same
 * ScrapedPost out — so the worker chooses a reader rather than branching.
 */
async function readInstagramProfile(handle, options = {}) {
    const body = await (0, unblock_1.fetchThrough)(profileUrl(handle), {
        ...options,
        headers: { ...profileHeaders(), ...(options.headers ?? {}) },
    });
    return readTimeline(body, options.limit ?? DEFAULT_LIMIT);
}
