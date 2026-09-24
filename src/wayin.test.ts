import { describe, expect, it } from 'vitest';

import { mapWayinProduct, parseWayinPeriod, type WayinProduct } from './wayin';

// Trimmed from api.wayin.mk/api/v1/shop/products.
const NUMB: WayinProduct = {
  id: 298,
  title: 'NUMB - Tribute to Pink Floyd - Skopje',
  slug: 'numb-tribute-to-pink-floyd-skopje',
  description: '<p>NUMB – Tribute to Pink Floyd на 20 ноември доаѓа во Скопје.</p><p>Концертно доживување.</p>',
  thumbnail: { url: 'https://content.wayin.mk/tenant/images/baner-2.jpg' },
  stock_status: 'in_stock',
  event_date_period: '20.11.2026',
  event_location: 'Македонска Филхармонија - Скопје',
  event_start_time: 'Почеток: 21:00 часот',
};

describe('parseWayinPeriod', () => {
  it('reads a day, with or without a leading zero', () => {
    expect(parseWayinPeriod('19.10.2026')).toEqual({ start: [2026, 10, 19] });
    expect(parseWayinPeriod('6.12.2025')).toEqual({ start: [2025, 12, 6] });
  });

  it('reads a range', () => {
    expect(parseWayinPeriod('28.08.2026 - 29.08.2026')).toEqual({ start: [2026, 8, 28], end: [2026, 8, 29] });
  });

  it('answers null for no date', () => {
    expect(parseWayinPeriod('')).toBeNull();
  });
});

describe('mapWayinProduct', () => {
  it('reads the event fields and links to the shop page', () => {
    expect(mapWayinProduct(NUMB)).toMatchObject({
      origin: 'wayin',
      sourceUrl: 'https://wayin.mk/shop/events/numb-tribute-to-pink-floyd-skopje',
      startDate: '2026-11-20T21:00:00',
      venueName: 'Македонска Филхармонија - Скопје',
      image: 'https://content.wayin.mk/tenant/images/baner-2.jpg',
      category: 'concert',
      isSoldOut: false,
    });
  });

  it('claims no price, since every product carries the same placeholder', () => {
    expect(mapWayinProduct({ ...NUMB })?.price).toBeUndefined();
  });

  it('takes the doors time when that is the time given', () => {
    expect(mapWayinProduct({ ...NUMB, event_start_time: 'Вратите се отвараат во 19:30h' })?.startDate).toBe(
      '2026-11-20T19:30:00',
    );
  });

  it('skips a product with no time, place or date', () => {
    expect(mapWayinProduct({ ...NUMB, event_start_time: null })).toBeNull();
    expect(mapWayinProduct({ ...NUMB, event_location: '' })).toBeNull();
    expect(mapWayinProduct({ ...NUMB, event_date_period: null })).toBeNull();
  });
});
