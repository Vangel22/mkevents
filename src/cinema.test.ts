import { afterEach, describe, expect, it, vi } from 'vitest';

import { CinemaApiError, fetchMovies, fetchScreenings, mapMovie, screeningSourceUrl } from './cinema';

afterEach(() => vi.restoreAllMocks());

function respond(byPath: Record<string, unknown>) {
  return vi.spyOn(global, 'fetch').mockImplementation(async (input: string | URL | Request) => {
    const url = String(input);
    const key = Object.keys(byPath).find(path => url.includes(path));

    if (!key) return { ok: false, status: 404, json: async () => ({}) } as Response;

    return { ok: true, status: 200, json: async () => byPath[key] } as Response;
  });
}

describe('mapMovie', () => {
  it('reads the catalogue shape', () => {
    expect(
      mapMovie({ id: 12969, title: 'Crazy Day', picture: 'https://cdn/p.jpg', duration: 118 }),
    ).toMatchObject({ id: '12969', title: 'Crazy Day', posterImage: 'https://cdn/p.jpg', durationMinutes: 118 });
  });

  it('falls back through the title fields the api uses inconsistently', () => {
    expect(mapMovie({ id: '1', titlecalculated: 'Спа викенд' })?.title).toBe('Спа викенд');
    expect(mapMovie({ id: '1', titleEn: 'Spa Weekend' })?.title).toBe('Spa Weekend');
  });

  it('accepts a film code as the identifier', () => {
    expect(mapMovie({ HOFilmCode: 'HO00020334', title: 'The Odyssey' })?.id).toBe('HO00020334');
  });

  it('flattens genres given as objects', () => {
    expect(mapMovie({ id: '1', title: 'X', genres: [{ name: 'Хорор' }, { name: 'Трилер' }] })?.genres)
      .toEqual(['Хорор', 'Трилер']);
  });

  it('drops a row with no title or no id', () => {
    expect(mapMovie({ id: '1' })).toBeNull();
    expect(mapMovie({ title: 'X' })).toBeNull();
  });

  it('ignores a nonsense duration rather than storing it', () => {
    expect(mapMovie({ id: '1', title: 'X', duration: 0 })?.durationMinutes).toBeUndefined();
  });
});

describe('fetchMovies', () => {
  it('returns only the films showing at the requested cinema', async () => {
    respond({
      '/api/v1/cinemasweb/with-movies': [
        { cinema: { id: '1141' }, movies: [{ id: 'A' }] },
        { cinema: { id: '9999' }, movies: [{ id: 'B' }] },
      ],
      '/api/v2/movies': [
        { id: 'A', title: 'Showing in Skopje' },
        { id: 'B', title: 'Showing elsewhere' },
      ],
    });

    const movies = await fetchMovies('1141');
    expect(movies).toHaveLength(1);
    expect(movies[0].title).toBe('Showing in Skopje');
  });

  it('skips a film the catalogue has no entry for', async () => {
    respond({
      '/api/v1/cinemasweb/with-movies': [{ cinema: { id: '1141' }, movies: [{ id: 'A' }, { id: 'GONE' }] }],
      '/api/v2/movies': [{ id: 'A', title: 'Known' }],
    });

    expect(await fetchMovies('1141')).toHaveLength(1);
  });

  it('raises a typed error when the api refuses', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 503, json: async () => ({}) } as Response);
    await expect(fetchMovies('1141')).rejects.toBeInstanceOf(CinemaApiError);
  });
});

describe('fetchScreenings', () => {
  const groups = [
    {
      date: '2026-09-17T00:00:00+02:00',
      sessions: [
        { showtime: '2026-09-17T21:15:00+02:00', cinemaId: '1141', screenName: 'САЛА 9', technologies: [['2D'], []] },
      ],
    },
    {
      date: '2026-09-18T00:00:00+02:00',
      sessions: [
        { showtime: '2026-09-18T19:30:00+02:00', cinemaId: '1141', screenName: 'САЛА 2', technologies: [['3D'], []] },
        { showtime: '2026-09-18T21:20:00+02:00', cinemaId: '9999', screenName: 'Elsewhere' },
      ],
    },
  ];

  it('flattens the date groups into screenings in time order', async () => {
    respond({ '/sessions': groups });

    const screenings = await fetchScreenings('HO1', '1141');
    expect(screenings).toHaveLength(2);
    expect(screenings[0].showtime.toISOString()).toBe('2026-09-17T19:15:00.000Z');
    expect(screenings[1].showtime.getTime()).toBeGreaterThan(screenings[0].showtime.getTime());
  });

  it('keeps the offset the api sends rather than reading it as server time', async () => {
    respond({ '/sessions': groups });
    const [first] = await fetchScreenings('HO1', '1141');

    expect(first.showtime.toLocaleString('en-GB', { timeZone: 'Europe/Skopje' })).toContain('21:15');
  });

  it('ignores screenings at another cinema', async () => {
    respond({ '/sessions': groups });
    const screenings = await fetchScreenings('HO1', '1141');

    expect(screenings.map(s => s.screenName)).not.toContain('Elsewhere');
  });

  it('flattens the nested technologies array and drops the empty inner ones', async () => {
    respond({ '/sessions': groups });
    expect((await fetchScreenings('HO1', '1141'))[0].technologies).toEqual(['2D']);
  });

  it('skips an unparseable showtime rather than storing an invalid date', async () => {
    respond({ '/sessions': [{ sessions: [{ showtime: 'soon', cinemaId: '1141' }] }] });
    expect(await fetchScreenings('HO1', '1141')).toEqual([]);
  });

  it('returns nothing for a film that has finished its run', async () => {
    respond({ '/sessions': [] });
    expect(await fetchScreenings('HO1', '1141')).toEqual([]);
  });
});

describe('screeningSourceUrl', () => {
  it('is stable per film and cinema, so a re-sync updates rather than duplicates', () => {
    expect(screeningSourceUrl('HO1', '1141')).toBe(screeningSourceUrl('HO1', '1141'));
    expect(screeningSourceUrl('HO1', '1141')).not.toBe(screeningSourceUrl('HO2', '1141'));
  });
});
