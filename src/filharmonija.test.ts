import { describe, expect, it } from 'vitest';

import { parseDayMonthYear, parseFilharmonija } from './filharmonija';

const card = (tab: string, date: string, time: string, title: string, sub: string) => `
<div class="event c--pointer" data-tab="${tab}">
  <div class="event-header"><div class="event-img bg-properties" style="background:url('https://www.filharmonija.mk/wp-content/uploads/${tab}.jpg')"></div></div>
  <div class="event-content">
    <div class="event-content-date mb-32"><h5 class="txt--uppercase grey-txt">${date}</h5><h5 class="grey-txt">${time}</h5></div>
    <h4>${title}</h4><p class="navLink">${sub}...</p>
  </div>
</div>`;

const section = (tab: string, slug: string, ticket?: string) => `
<div class="event-section container close-section ${tab}">
  ${ticket ? `<a href="${ticket}">Купи Билет</a>` : ''}
  <a href="https://www.filharmonija.mk/events/${slug}/">Повеќе</a>
</div>`;

// Trimmed from filharmonija.mk/nastani-i-bileti: the slider repeats a card.
const PAGE = [
  card('event-2', '8 Oктомври 2026', '20:00 часот', 'Музички код', 'Диригент: Борјан Цанев'),
  card('event-2', '8 Oктомври 2026', '20:00 часот', 'Музички код', 'Диригент: Борјан Цанев'),
  card('event-3', '14 Oктомври 2026', '20:00 часот', 'Гостување во НУ Центар за култура – Битола', 'Диригент: Борјан Цанев'),
  section('event-2', 'muzicki-kod', 'https://filharmonijaonline.mk/index.php?id=763'),
  section('event-3', 'gostuvanje-bitola'),
].join('');

describe('parseDayMonthYear', () => {
  it('reads the date with the Latin O the site types', () => {
    expect(parseDayMonthYear('8 Oктомври 2026')).toEqual([2026, 10, 8]);
  });
});

describe('parseFilharmonija', () => {
  const events = parseFilharmonija(PAGE);

  it('reads each concert once, though the slider repeats it', () => {
    expect(events).toHaveLength(2);
  });

  it('reads a concert at home with its page, ticket link and image', () => {
    expect(events[0]).toMatchObject({
      origin: 'filharmonija',
      sourceUrl: 'https://www.filharmonija.mk/events/muzicki-kod/#2026-10-08',
      title: 'Музички код',
      startDate: '2026-10-08T20:00:00',
      venueName: 'Македонска филхармонија',
      cityName: 'Скопје',
      ticketUrl: 'https://filharmonijaonline.mk/index.php?id=763',
      image: 'https://www.filharmonija.mk/wp-content/uploads/event-2.jpg',
      description: 'Диригент: Борјан Цанев',
      category: 'concert',
    });
  });

  it('places a concert on tour at the venue it tours to', () => {
    expect(events[1]).toMatchObject({
      title: 'Македонска филхармонија – гостување во НУ Центар за култура – Битола',
      venueName: 'НУ Центар за култура – Битола',
      cityName: undefined,
    });
  });
});
