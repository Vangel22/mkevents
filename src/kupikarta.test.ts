import { describe, expect, it } from 'vitest';

import { aspNetDate, macedonian, mapKupiKartaEvent, type KupiKartaEvent } from './kupikarta';

// Trimmed from services/exportdata.asmx/GetEvents.
const KALIOPI: KupiKartaEvent = {
  Id: 5744,
  NameFirst: 'КАЛИОПИ',
  NameSecond: 'КАЛИОПИ',
  DateTime: '/Date(1792260000000)/',
  DescriptionFirst: '<p>КАЛИОПИ</p>',
  DescriptionSecond: '<p>Спектакуларен концерт на најголемата македонска поп-дива.</p>',
  PriceCurrencyFirst: 0,
  PriceCurrencySecond: 700,
  Thumbnail: 'images/event/5744.jpg?v=1',
  ObjectMap: {
    NameFirst: 'Arena Boris Trajkovski',
    Object: { NameFirst: 'Nacionalna Arena', NameSecond: 'Арена Борис Трајковски', AddressFirst: 'Скопје' },
  },
};

describe('macedonian', () => {
  it('picks the Cyrillic name, whichever field it is in', () => {
    expect(macedonian({ NameFirst: 'Nacionalna Opera i Balet', NameSecond: 'Национална Опера и Балет' })).toBe(
      'Национална Опера и Балет',
    );
  });

  it('falls back to the first name when none is Cyrillic', () => {
    expect(macedonian({ NameFirst: 'Base42' })).toBe('Base42');
  });
});

describe('aspNetDate', () => {
  it('reads the ASP.NET date as an instant', () => {
    expect(aspNetDate('/Date(1790438400000)/')).toBe('2026-09-26T16:00:00.000Z');
    expect(aspNetDate('tomorrow')).toBeNull();
  });
});

describe('mapKupiKartaEvent', () => {
  it('reads the venue, its city, the price and the real description', () => {
    expect(mapKupiKartaEvent(KALIOPI)).toMatchObject({
      origin: 'kupikarta',
      sourceUrl: 'https://kupikarta.com/event-details.nspx?eventid=5744',
      ticketUrl: 'https://kupikarta.com/tickets.nspx?eventid=5744',
      title: 'КАЛИОПИ',
      venueName: 'Арена Борис Трајковски',
      cityName: 'Скопје',
      price: 700,
      description: 'Спектакуларен концерт на најголемата македонска поп-дива.',
      image: 'https://kupikarta.com/images/event/5744.jpg?v=1',
      category: 'concert',
    });
  });

  it('skips an event whose sale is closed', () => {
    expect(mapKupiKartaEvent({ ...KALIOPI, IsClosed: true })).toBeNull();
  });

  it('skips an event with no date', () => {
    expect(mapKupiKartaEvent({ ...KALIOPI, DateTime: undefined })).toBeNull();
  });
});
