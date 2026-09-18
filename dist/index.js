"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CinemaApiError = exports.mapMovie = exports.screeningSourceUrl = exports.fetchScreenings = exports.fetchMovies = exports.DEFAULT_USER_AGENT = exports.clearRobotsCache = exports.isAllowedByRules = exports.parseRobots = exports.isAllowed = exports.WebsiteFetchError = exports.fetchPage = exports.mapEvent = exports.categorise = exports.isEventNode = exports.extractJsonLd = exports.readEventsFromPage = exports.SUPPORTED_MEDIA = exports.isSupportedMedia = exports.parseEventFromImage = exports.parseEventFromPost = exports.ScraperError = exports.isConfigured = exports.mapPost = exports.scrapeInstagramProfile = void 0;
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
__exportStar(require("./types"), exports);
var instagram_1 = require("./instagram");
Object.defineProperty(exports, "scrapeInstagramProfile", { enumerable: true, get: function () { return instagram_1.scrapeInstagramProfile; } });
Object.defineProperty(exports, "mapPost", { enumerable: true, get: function () { return instagram_1.mapPost; } });
Object.defineProperty(exports, "isConfigured", { enumerable: true, get: function () { return instagram_1.isConfigured; } });
Object.defineProperty(exports, "ScraperError", { enumerable: true, get: function () { return instagram_1.ScraperError; } });
var vision_1 = require("./vision");
Object.defineProperty(exports, "parseEventFromPost", { enumerable: true, get: function () { return vision_1.parseEventFromPost; } });
Object.defineProperty(exports, "parseEventFromImage", { enumerable: true, get: function () { return vision_1.parseEventFromImage; } });
Object.defineProperty(exports, "isSupportedMedia", { enumerable: true, get: function () { return vision_1.isSupportedMedia; } });
Object.defineProperty(exports, "SUPPORTED_MEDIA", { enumerable: true, get: function () { return vision_1.SUPPORTED_MEDIA; } });
var website_1 = require("./website");
Object.defineProperty(exports, "readEventsFromPage", { enumerable: true, get: function () { return website_1.readEventsFromPage; } });
Object.defineProperty(exports, "extractJsonLd", { enumerable: true, get: function () { return website_1.extractJsonLd; } });
Object.defineProperty(exports, "isEventNode", { enumerable: true, get: function () { return website_1.isEventNode; } });
Object.defineProperty(exports, "categorise", { enumerable: true, get: function () { return website_1.categorise; } });
Object.defineProperty(exports, "mapEvent", { enumerable: true, get: function () { return website_1.mapEvent; } });
Object.defineProperty(exports, "fetchPage", { enumerable: true, get: function () { return website_1.fetchPage; } });
Object.defineProperty(exports, "WebsiteFetchError", { enumerable: true, get: function () { return website_1.WebsiteFetchError; } });
var robots_1 = require("./robots");
Object.defineProperty(exports, "isAllowed", { enumerable: true, get: function () { return robots_1.isAllowed; } });
Object.defineProperty(exports, "parseRobots", { enumerable: true, get: function () { return robots_1.parseRobots; } });
Object.defineProperty(exports, "isAllowedByRules", { enumerable: true, get: function () { return robots_1.isAllowedByRules; } });
Object.defineProperty(exports, "clearRobotsCache", { enumerable: true, get: function () { return robots_1.clearRobotsCache; } });
Object.defineProperty(exports, "DEFAULT_USER_AGENT", { enumerable: true, get: function () { return robots_1.DEFAULT_USER_AGENT; } });
var cinema_1 = require("./cinema");
Object.defineProperty(exports, "fetchMovies", { enumerable: true, get: function () { return cinema_1.fetchMovies; } });
Object.defineProperty(exports, "fetchScreenings", { enumerable: true, get: function () { return cinema_1.fetchScreenings; } });
Object.defineProperty(exports, "screeningSourceUrl", { enumerable: true, get: function () { return cinema_1.screeningSourceUrl; } });
Object.defineProperty(exports, "mapMovie", { enumerable: true, get: function () { return cinema_1.mapMovie; } });
Object.defineProperty(exports, "CinemaApiError", { enumerable: true, get: function () { return cinema_1.CinemaApiError; } });
