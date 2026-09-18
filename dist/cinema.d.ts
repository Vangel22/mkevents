/** The Skopje multiplex. Other cinemas exist under other ids on the same API. */
export declare const SKOPJE_CINEMA_ID: string;
export declare class CinemaApiError extends Error {
    readonly status: number;
    constructor(message: string, status: number);
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
    genres?: Array<{
        name?: string;
    } | string>;
    ageRating?: string | number;
}
export declare function mapMovie(raw: RawMovie): CinemaMovie | null;
/** Films currently showing at a cinema, with the metadata the listing needs. */
export declare function fetchMovies(cinemaId?: string): Promise<CinemaMovie[]>;
export interface Screening {
    showtime: Date;
    screenName?: string;
    technologies: string[];
}
/** Every screening of one film at one cinema, in time order. */
export declare function fetchScreenings(movieId: string, cinemaId?: string): Promise<Screening[]>;
/** A stable identity for a film at a cinema, so a re-sync updates rather than duplicates. */
export declare function screeningSourceUrl(movieId: string, cinemaId?: string): string;
export {};
