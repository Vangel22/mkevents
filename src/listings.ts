import type { UnblockOptions } from './types';
import type { ListedEvent, ListingOrigin } from './listing';

import { readKarti } from './karti';
import { readWayin } from './wayin';
import { readKupiKarta } from './kupikarta';
import { readKinoverzum } from './kinoverzum';
import { readFilharmonija } from './filharmonija';

/** Every listing this package reads, by name, so a caller can loop over them. */
export const LISTING_READERS: Record<ListingOrigin, (options?: UnblockOptions) => Promise<ListedEvent[]>> = {
  karti: readKarti,
  kupikarta: () => readKupiKarta(),
  wayin: () => readWayin(),
  filharmonija: readFilharmonija,
  kinoverzum: readKinoverzum,
};

export const LISTING_ORIGINS = Object.keys(LISTING_READERS) as ListingOrigin[];
