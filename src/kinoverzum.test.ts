import { describe, expect, it } from 'vitest';

import { parseKinoverzum } from './kinoverzum';

const day = (date: string, slots: string[]) => `
<div class="amy-movie-showtimews-cell">
  <div class="intro-date-time"><div class="th">ден</div><div class="date">${date}</div></div>
  <div class="amy-movie-intro-list">
    ${slots.map(slot => `<div class="amy-movie-intro-times"><span>${slot}</span></div><a class="button" href="https://tickets.kinoverzum.mk/">Купи билет</a>`).join('')}
  </div>
</div>`;

// Trimmed from kinoverzum.mk/nedelna-programa: a header row, then a film row.
const PAGE = `
<div class="amy-movie-showtimews-row row-0"><div class="amy-movie-showtimews-cell"></div></div>
<div class="amy-movie-showtimews-row row-1">
  <div class="amy-movie-showtimews-cell">
    <div class="amy-movie-item">
      <img src="https://kinoverzum.mk/wp-content/uploads/spa.jpg" />
      <h3 class="amy-movie-field-title"><a href="https://kinoverzum.mk/film/spa-vikend/">СПА ВИКЕНД</a></h3>
      <span class="amy-movie-field-mpaa">12+</span>
      <div class="amy-movie-custom-field-group">Премиера датум: 17 септември 2026</div>
      <div class="amy-movie-custom-field-group">Жанр: Комедија</div>
      <div class="amy-movie-custom-field-group">Жанр: Комедија</div>
      <div class="amy-movie-custom-field-group">Режисер:</div>
    </div>
  </div>
  ${day('24 септември 2026 (четврток)', ['17:00 Штип', '17:00 Кисела Вода'])}
  ${day('25 септември 2026 (петок)', ['19:30 Штип'])}
</div>`;

describe('parseKinoverzum', () => {
  const events = parseKinoverzum(PAGE);

  it('makes one event per film per cinema, skipping the header row', () => {
    expect(events.map(event => event.venueName)).toEqual(['Киноверзум Штип', 'Киноверзум Кисела Вода']);
  });

  it('carries that cinema’s screenings only', () => {
    expect(events[0]).toMatchObject({
      origin: 'kinoverzum',
      sourceUrl: `https://kinoverzum.mk/film/spa-vikend/#${encodeURIComponent('Штип')}`,
      title: 'СПА ВИКЕНД',
      startDate: '2026-09-24T17:00:00',
      endDate: '2026-09-25T19:30:00',
      showtimes: ['2026-09-24T17:00:00', '2026-09-25T19:30:00'],
      cityName: 'Штип',
      ageRestriction: 12,
      image: 'https://kinoverzum.mk/wp-content/uploads/spa.jpg',
      category: 'cinema',
    });
  });

  it('places a Skopje branch named by its neighbourhood in Skopje', () => {
    expect(events[1].cityName).toBe('Скопје');
  });

  it('describes the film once, without blank or premiere fields', () => {
    expect(events[0].description).toBe('Жанр: Комедија');
  });
});
