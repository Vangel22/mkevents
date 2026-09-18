/** What kind of night this is. */
export type EventCategory =
  | 'concert'
  | 'party'
  | 'cinema'
  | 'cultural'
  | 'tech'
  | 'food_wine'
  | 'corporate'
  | 'other';

/** An event as read out of a poster, before anyone decides to publish it. */
export interface ParsedEvent {
  isEvent: boolean;
  confidence: number;
  title: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  isPaid: boolean;
  price: number | null;
  ageRestriction: number | null;
  reservationNumber: string | null;
  /** Where tickets are sold, if the post links one. This library never sells them. */
  ticketUrl: string | null;
  category: EventCategory;
}

/** Credentials and models, passed in rather than read from the environment. */
export interface AnthropicOptions {
  apiKey?: string;
  /** An organisation-level key must say which workspace to bill. */
  workspaceId?: string;
  /** Reads the poster. Needs to handle the script the poster is written in. */
  primaryModel?: string;
  /** Asked again when the first answer is uncertain. */
  escalationModel?: string;
}

export interface ApifyOptions {
  token?: string;
  /** How many posts to read per profile. */
  limit?: number;
}

/** Which service fetches a page we are not allowed to fetch ourselves. */
export type UnblockProvider = 'brightdata' | 'scraperapi' | 'direct';

export interface UnblockOptions {
  /** Left unset, whichever service has a credential is used. */
  provider?: UnblockProvider;
  brightDataToken?: string;
  /** The Web Unlocker zone the token belongs to. */
  brightDataZone?: string;
  scraperApiKey?: string;
  /** Two-letter country to appear to be browsing from, e.g. 'mk'. */
  countryCode?: string;
  /** Costs more and is rarely needed: Instagram's endpoint answers JSON. */
  renderJavaScript?: boolean;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export interface FetchOptions {
  /** Sent on every outbound request, so a site owner can identify the reader. */
  userAgent?: string;
}
