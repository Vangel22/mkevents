import { describe, expect, it } from 'vitest';

import { findTime, guessCategory, localDateTime, lowestDenars, monthNumber } from './listing';

describe('monthNumber', () => {
  it('reads Macedonian, English and Macedonian typed in Latin', () => {
    expect(monthNumber('Октомври')).toBe(10);
    expect(monthNumber('October')).toBe(10);
    expect(monthNumber('Oktomvri')).toBe(10);
    expect(monthNumber('Мај')).toBe(5);
    expect(monthNumber('декември')).toBe(12);
  });

  it('reads a Cyrillic word with a Latin letter in it', () => {
    // The Philharmonic types "Oктомври" with a Latin O.
    expect(monthNumber('Oктомври')).toBe(10);
  });

  it('answers null for a word that is no month', () => {
    expect(monthNumber('Месечен')).toBeNull();
  });
});

describe('localDateTime', () => {
  it('writes a local wall time, midnight when no time is given', () => {
    expect(localDateTime(2026, 10, 2, '22:00')).toBe('2026-10-02T22:00:00');
    expect(localDateTime(2026, 10, 2)).toBe('2026-10-02T00:00:00');
  });

  it('refuses an impossible date or time', () => {
    expect(localDateTime(2026, 13, 2, '22:00')).toBeNull();
    expect(localDateTime(2026, 10, 2, '25:00')).toBeNull();
  });
});

describe('findTime', () => {
  it('finds a time however it is dressed', () => {
    expect(findTime('Почеток: 20:00 часот')).toBe('20:00');
    expect(findTime('Вратите се отвараат во 19:30h')).toBe('19:30');
    expect(findTime('9.15 ч')).toBe('09:15');
    expect(findTime('Месечен репертоар')).toBeNull();
  });
});

describe('lowestDenars', () => {
  it('takes the lowest figure of a range', () => {
    expect(lowestDenars('600 - 1000 мкд')).toBe(600);
    expect(lowestDenars('1990-4000 мкд')).toBe(1990);
  });

  it('skips a figure in euros', () => {
    expect(lowestDenars('20€-1240 mkd')).toBe(1240);
    expect(lowestDenars('129 € + ДДВ (9.392 денари)')).toBe(9392);
  });

  it('answers undefined when there is no price', () => {
    expect(lowestDenars('Бесплатно')).toBeUndefined();
  });
});

describe('guessCategory', () => {
  it('trusts the title first', () => {
    expect(guessCategory('Бастион Плаза Парти')).toBe('party');
    expect(guessCategory('AirFlow Music Festival')).toBe('concert');
  });

  it('believes a concert named in the description', () => {
    expect(guessCategory('Калиопи', 'Спектакуларен концерт на најголемата поп-дива')).toBe('concert');
  });

  it('does not believe a party read only from a description', () => {
    // A lecture promising "забава" (fun) is not a party.
    expect(guessCategory('Психологија на успехот', 'Едукација и забава за целото семејство')).toBe('other');
  });
});
