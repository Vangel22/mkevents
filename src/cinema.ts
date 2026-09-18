import { DEFAULT_USER_AGENT } from './robots';

const API_BASE = process.env.CINEPLEXX_API || 'https://app.cineplexx.mk';
const TIMEOUT_MS = 20_000;

/** The Skopje multiplex. Other cinemas exist under other ids on the same API. */
export const SKOPJE_CINEMA_ID = process.env.CINEPLEXX_CINEMA_ID || '1141';

export class CinemaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'CinemaApiError';
  }
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': process.env.CRAWLER_USER_AGENT || DEFAULT_USER_AGENT,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new CinemaApiError(`${path} returned ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}

export interface CinemaMovie {
  id: string;
  title: string;
  posterImage?: string;
  description?: string;
  durationMinutes?: number;
  genres?: string[];
  ageRestriction?: number;
}

interface RawMovie {
  id?: string | number;
  HOFilmCode?: string;
  title?: string;
  titlecalculated?: string;
  titleEn?: string;
  picture?: string;
  posterImage?: string;
  description?: string;
  shortDescription?: string;
  duration?: number | string;
  length?: number | string;
  genres?: Array<{ name?: string } | string>;
  ageRating?: string | number;
}

function genreNames(genres: RawMovie['genres']): string[] {
  if (!Array.isArray(genres)) return [];

  return genres
    .map(genre => (typeof genre === 'string' ? genre : genre?.name))
    .filter((name): name is string => Boolean(name));
}

function toMinutes(value: unknown): number | undefined {
  const minutes = Number(value);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : undefined;
}

export function mapMovie(raw: RawMovie): CinemaMovie | null {
  const id = String(raw.id ?? raw.HOFilmCode ?? '');
  const title = raw.title || raw.titlecalculated || raw.titleEn;

  if (!id || !title) return null;

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
export async function fetchMovies(cinemaId = SKOPJE_CINEMA_ID): Promise<CinemaMovie[]> {
  const cinemas = await get<Array<{ cinema?: { id?: string }; movies?: RawMovie[] }>>(
    '/api/v1/cinemasweb/with-movies',
  );

  const match = cinemas.find(entry => String(entry.cinema?.id) === String(cinemaId));
  const showing = new Set((match?.movies ?? []).map(movie => String(movie.id ?? movie.HOFilmCode)));

  // The per-cinema list carries ids but little else; the catalogue has the
  // titles, posters and runtimes, so the two are joined here.
  const catalogue = await get<RawMovie[]>('/api/v2/movies');

  const byId = new Map<string, CinemaMovie>();

  for (const raw of catalogue) {
    const movie = mapMovie(raw);
    if (movie) byId.set(movie.id, movie);
  }

  return [...showing]
    .map(id => byId.get(id))
    .filter((movie): movie is CinemaMovie => Boolean(movie));
}

export interface Screening {
  showtime: Date;
  screenName?: string;
  technologies: string[];
}

interface RawSessionGroup {
  date?: string;
  sessions?: Array<{
    showtime?: string;
    cinemaId?: string | number;
    screenName?: string;
    technologies?: unknown;
  }>;
}

function technologyNames(value: unknown): string[] {
  // Arrives as a nested array, often with empty inner arrays: [["2D"], []]
  if (!Array.isArray(value)) return [];

  return value
    .flat(2)
    .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

/** Every screening of one film at one cinema, in time order. */
export async function fetchScreenings(
  movieId: string,
  cinemaId = SKOPJE_CINEMA_ID,
): Promise<Screening[]> {
  const groups = await get<RawSessionGroup[]>(
    `/api/v3/movies/${encodeURIComponent(movieId)}/sessions`,
  );

  const screenings: Screening[] = [];

  for (const group of groups) {
    for (const session of group.sessions ?? []) {
      if (String(session.cinemaId) !== String(cinemaId)) continue;
      if (!session.showtime) continue;

      const showtime = new Date(session.showtime);
      if (Number.isNaN(showtime.getTime())) continue;

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
export function screeningSourceUrl(movieId: string, cinemaId = SKOPJE_CINEMA_ID): string {
  return `https://cineplexx.mk/film/${encodeURIComponent(movieId)}?cinema=${cinemaId}`;
}
