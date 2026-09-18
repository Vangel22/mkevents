"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CinemaApiError = exports.SKOPJE_CINEMA_ID = void 0;
exports.mapMovie = mapMovie;
exports.fetchMovies = fetchMovies;
exports.fetchScreenings = fetchScreenings;
exports.screeningSourceUrl = screeningSourceUrl;
const robots_1 = require("./robots");
const API_BASE = process.env.CINEPLEXX_API || 'https://app.cineplexx.mk';
const TIMEOUT_MS = 20_000;
/** The Skopje multiplex. Other cinemas exist under other ids on the same API. */
exports.SKOPJE_CINEMA_ID = process.env.CINEPLEXX_CINEMA_ID || '1141';
class CinemaApiError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = 'CinemaApiError';
    }
}
exports.CinemaApiError = CinemaApiError;
async function get(path) {
    const response = await fetch(`${API_BASE}${path}`, {
        headers: {
            Accept: 'application/json',
            'User-Agent': process.env.CRAWLER_USER_AGENT || robots_1.DEFAULT_USER_AGENT,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
        throw new CinemaApiError(`${path} returned ${response.status}`, response.status);
    }
    return (await response.json());
}
function genreNames(genres) {
    if (!Array.isArray(genres))
        return [];
    return genres
        .map(genre => (typeof genre === 'string' ? genre : genre?.name))
        .filter((name) => Boolean(name));
}
function toMinutes(value) {
    const minutes = Number(value);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : undefined;
}
function mapMovie(raw) {
    const id = String(raw.id ?? raw.HOFilmCode ?? '');
    const title = raw.title || raw.titlecalculated || raw.titleEn;
    if (!id || !title)
        return null;
    const age = Number(String(raw.ageRating ?? '').replace(/\D/g, ''));
    return {
        id,
        title: title.trim(),
        posterImage: raw.posterImage ?? raw.picture,
        description: raw.description ?? raw.shortDescription,
        durationMinutes: toMinutes(raw.duration ?? raw.length),
        genres: genreNames(raw.genres),
        ageRestriction: Number.isFinite(age) && age > 0 ? age : undefined,
    };
}
/** Films currently showing at a cinema, with the metadata the listing needs. */
async function fetchMovies(cinemaId = exports.SKOPJE_CINEMA_ID) {
    const cinemas = await get('/api/v1/cinemasweb/with-movies');
    const match = cinemas.find(entry => String(entry.cinema?.id) === String(cinemaId));
    const showing = new Set((match?.movies ?? []).map(movie => String(movie.id ?? movie.HOFilmCode)));
    // The per-cinema list carries ids but little else; the catalogue has the
    // titles, posters and runtimes, so the two are joined here.
    const catalogue = await get('/api/v2/movies');
    const byId = new Map();
    for (const raw of catalogue) {
        const movie = mapMovie(raw);
        if (movie)
            byId.set(movie.id, movie);
    }
    return [...showing]
        .map(id => byId.get(id))
        .filter((movie) => Boolean(movie));
}
function technologyNames(value) {
    // Arrives as a nested array, often with empty inner arrays: [["2D"], []]
    if (!Array.isArray(value))
        return [];
    return value
        .flat(2)
        .filter((entry) => typeof entry === 'string' && entry.length > 0);
}
/** Every screening of one film at one cinema, in time order. */
async function fetchScreenings(movieId, cinemaId = exports.SKOPJE_CINEMA_ID) {
    const groups = await get(`/api/v3/movies/${encodeURIComponent(movieId)}/sessions`);
    const screenings = [];
    for (const group of groups) {
        for (const session of group.sessions ?? []) {
            if (String(session.cinemaId) !== String(cinemaId))
                continue;
            if (!session.showtime)
                continue;
            const showtime = new Date(session.showtime);
            if (Number.isNaN(showtime.getTime()))
                continue;
            screenings.push({
                showtime,
                screenName: session.screenName?.trim(),
                technologies: technologyNames(session.technologies),
            });
        }
    }
    return screenings.sort((a, b) => a.showtime.getTime() - b.showtime.getTime());
}
/** A stable identity for a film at a cinema, so a re-sync updates rather than duplicates. */
function screeningSourceUrl(movieId, cinemaId = exports.SKOPJE_CINEMA_ID) {
    return `https://cineplexx.mk/film/${encodeURIComponent(movieId)}?cinema=${cinemaId}`;
}
