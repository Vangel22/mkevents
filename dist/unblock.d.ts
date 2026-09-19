import type { UnblockOptions, UnblockProvider } from './types';
export declare function unblockProvider(options?: UnblockOptions): UnblockProvider | null;
export declare function isUnblockConfigured(options?: UnblockOptions): boolean;
/**
 * Builds the request that asks a provider to fetch `url` for us.
 *
 * Separate from sending it so the shape each service expects can be asserted
 * without a network or a key — which is the only part of this that can be
 * tested for free.
 */
export declare function unblockRequest(provider: UnblockProvider, url: string, options?: UnblockOptions): {
    url: string;
    init: RequestInit;
};
/** Fetches `url` through the configured provider and returns the body as text. */
export declare function fetchThrough(url: string, options?: UnblockOptions): Promise<string>;
