/**
 * mkevents — reads events out of the places venues actually publish them.
 *
 * Fetching and parsing only: nothing here touches a database, a queue or an
 * HTTP server. Every function returns plain data for the caller to persist,
 * which is what lets the same code serve a website, a worker or a script.
 *
 * Credentials are passed in rather than read from the environment, so a caller
 * decides where its secrets come from.
 */
export * from './types';

export {
  scrapeInstagramProfile,
  mapPost,
  isConfigured,
  ScraperError,
  type ScrapedPost,
} from './instagram';

export {
  fetchThrough,
  unblockRequest,
  unblockProvider,
  isUnblockConfigured,
} from './unblock';

export {
  readInstagramProfile,
  readTimeline,
  mapTimelineNode,
  profileUrl,
  profileHeaders,
} from './instagram-web';

export {
  parseEventFromPost,
  parseEventFromImage,
  isSupportedMedia,
  SUPPORTED_MEDIA,
  type InlineImage,
  type SupportedMedia,
} from './vision';

export {
  readEventsFromPage,
  extractJsonLd,
  isEventNode,
  categorise,
  mapEvent,
  fetchPage,
  WebsiteFetchError,
  type WebsiteEvent,
} from './website';

export {
  isAllowed,
  parseRobots,
  isAllowedByRules,
  clearRobotsCache,
  DEFAULT_USER_AGENT,
} from './robots';

export {
  fetchMovies,
  fetchScreenings,
  screeningSourceUrl,
  mapMovie,
  CinemaApiError,
  type CinemaMovie,
  type Screening,
} from './cinema';
