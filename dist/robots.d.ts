export declare const DEFAULT_USER_AGENT: string;
interface Rules {
    disallow: string[];
    allow: string[];
    crawlDelaySeconds?: number;
}
/** Test seam, and a way to force a refetch after a site changes its rules. */
export declare function clearRobotsCache(): void;
/**
 * Parses the directives that apply to us: our own user agent if the file names
 * it, falling back to the wildcard group. Other agents' groups are ignored, which
 * is the whole point of the grouping.
 */
export declare function parseRobots(body: string, userAgent?: string): Rules;
export declare function isAllowedByRules(rules: Rules, path: string): boolean;
/**
 * Whether a site's own robots.txt permits us to read a page.
 *
 * A site that has not published rules is treated as permitting it, which is the
 * convention; a site that cannot be reached is treated the same way, because an
 * outage is not a refusal. An explicit refusal is honoured.
 */
export declare function isAllowed(targetUrl: string): Promise<boolean>;
export {};
