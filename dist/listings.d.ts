import type { UnblockOptions } from './types';
import type { ListedEvent, ListingOrigin } from './listing';
/** Every listing this package reads, by name, so a caller can loop over them. */
export declare const LISTING_READERS: Record<ListingOrigin, (options?: UnblockOptions) => Promise<ListedEvent[]>>;
export declare const LISTING_ORIGINS: ListingOrigin[];
