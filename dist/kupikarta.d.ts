import { type ListedEvent } from './listing';
/**
 * kupikarta.com, read from the data interface its own event list calls.
 *
 * Every event carries its venue with a stable id and the venue's city, which
 * makes it the most reliable of the ticket sites to place on a map.
 */
export declare const KUPIKARTA_BASE = "https://kupikarta.com/";
type Localised = {
    NameFirst?: string | null;
    NameSecond?: string | null;
    NameThird?: string | null;
};
export interface KupiKartaEvent extends Localised {
    Id: number;
    DateTime?: string;
    DescriptionFirst?: string | null;
    DescriptionSecond?: string | null;
    DescriptionThird?: string | null;
    PriceCurrencyFirst?: number;
    PriceCurrencySecond?: number;
    Thumbnail?: string | null;
    IsClosed?: boolean;
    IsSoldOut?: boolean;
    ObjectMap?: Localised & {
        Object?: Localised & {
            AddressFirst?: string | null;
        };
    };
}
/**
 * The Macedonian of the three name fields.
 *
 * Which field holds which language differs from record to record: an event's
 * first name is Cyrillic while its venue's first name is "Nacionalna Opera i
 * Balet". Cyrillic is preferred, since that is what readers search in.
 */
export declare function macedonian(record: Localised | undefined | null): string;
/** "/Date(1790438400000)/" as an instant. */
export declare function aspNetDate(value: string | undefined): string | null;
export declare function mapKupiKartaEvent(event: KupiKartaEvent): ListedEvent | null;
/** Every open event on kupikarta.com, page by page. */
export declare function readKupiKarta(): Promise<ListedEvent[]>;
export {};
