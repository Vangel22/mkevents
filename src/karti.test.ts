import { describe, expect, it } from 'vitest';

import { kartiCategory, mapKartiCard, parseKartiDate, parseKartiDetail, parseKartiListing } from './karti';

// Trimmed from karti.com.mk/aktuelno.nspx: attributes unquoted, as the site writes them.
const LISTING = `
<a class="k_event_link col-xs-12 col-md-4 mix concerts other" href=autechre.nspx title=AUTECHRE>
  <div class="event-list-wrapper-top">
    <div class="k-events-event-image"><img src=content/autechre333.jpeg?ver001 alt=AUTECHRE /></div>
    <div class="k-events-event-date">02&nbsp;<span class="mm">Октомври</span>&nbsp;<span class="yy">2026</span></div>
  </div>
  <div class="event-list-wrapper-bottom">
    <h2 class="k-event-list-event-title entry-title summary">AUTECHRE</h2>
    <div class="k-events-venue-details">МКЦ Дансинг сала, Скопје</div>
    <div class="wraper-bottom-right valign-wrapper"><span class="cost">1500</span><span class="currency">мкд</span></div>
  </div>
</a>
<a class="k_event_link col-xs-12 col-md-4 mix theater deca_mladinci" href=teatar-za-deca.nspx>
  <h2 class="k-event-list-event-title">Театар за деца и младинци</h2>
  <div class="k-events-venue-details">Месечен репертоар</div>
</a>`;

const DETAIL = `
<div class="row inner-event-details-row ptb20"> 1500 мкд </div>
<div class="row inner-event-details-row mr10"> 22:00 </div>
<div class="row inner-event-details-row mr10 bb0"> МКЦ, Дансинг Сала </div>
<div class="col-sm-8 col-md-8 inner-event-details-content"><p>Британското електронско дуо Autechre во Скопје.</p></div>`;

describe('parseKartiDate', () => {
  it('reads a single day, in either language', () => {
    expect(parseKartiDate('02 Октомври 2026')).toEqual({ start: [2026, 10, 2] });
    expect(parseKartiDate('11 October 2026')).toEqual({ start: [2026, 10, 11] });
  });

  it('reads a range within a month and across months', () => {
    expect(parseKartiDate('15-18 Октомври 2026')).toEqual({ start: [2026, 10, 15], end: [2026, 10, 18] });
    expect(parseKartiDate('23.09-05.10 Септември/Октомври 2026')).toEqual({
      start: [2026, 9, 23],
      end: [2026, 10, 5],
    });
  });

  it('carries a range over the new year into the next year', () => {
    expect(parseKartiDate('28.12-03.01 Декември/Јануари 2026')?.end).toEqual([2027, 1, 3]);
  });

  it('answers null for a monthly repertoire with no date', () => {
    expect(parseKartiDate('')).toBeNull();
  });
});

describe('reading the listing and an event page', () => {
  it('reads a card with its absolute link and image', () => {
    const [card] = parseKartiListing(LISTING);

    expect(card).toMatchObject({
      url: 'https://www.karti.com.mk/autechre.nspx',
      title: 'AUTECHRE',
      dateText: '02 Октомври 2026',
      venueText: 'МКЦ Дансинг сала, Скопје',
      image: 'https://www.karti.com.mk/content/autechre333.jpeg?ver001',
    });
  });

  it('reads the start time and description from the event page', () => {
    expect(parseKartiDetail(DETAIL)).toEqual({
      time: '22:00',
      description: 'Британското електронско дуо Autechre во Скопје.',
    });
  });

  it('joins the two into an event at that time', () => {
    const [card] = parseKartiListing(LISTING);

    expect(mapKartiCard(card, parseKartiDetail(DETAIL))).toMatchObject({
      origin: 'karti',
      sourceUrl: 'https://www.karti.com.mk/autechre.nspx',
      startDate: '2026-10-02T22:00:00',
      venueName: 'МКЦ Дансинг сала, Скопје',
      price: 1500,
      category: 'concert',
    });
  });

  it('drops an event whose page gave no time, rather than saying midnight', () => {
    const [card] = parseKartiListing(LISTING);

    expect(mapKartiCard(card, { time: null })).toBeNull();
  });
});

describe('kartiCategory', () => {
  it('files the sport events class as sports', () => {
    expect(kartiCategory(['sport_events', 'other'])).toBe('sports');
  });

  it('puts theatre ahead of the festival it is part of', () => {
    expect(kartiCategory(['festivals', 'theater', 'other'])).toBe('cultural');
  });

  it('puts a concert at the Opera with the concerts', () => {
    expect(kartiCategory(['concerts', 'festivals', 'mob', 'other'])).toBe('concert');
  });

  it('says nothing for classes that say nothing', () => {
    expect(kartiCategory(['festivals', 'other'])).toBeNull();
  });
});
