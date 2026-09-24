"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pause = void 0;
exports.monthNumber = monthNumber;
exports.localDateTime = localDateTime;
exports.findTime = findTime;
exports.lowestDenars = lowestDenars;
exports.clean = clean;
exports.htmlToText = htmlToText;
exports.guessCategory = guessCategory;
exports.absolute = absolute;
exports.fetchJson = fetchJson;
const robots_1 = require("./robots");
const website_1 = require("./website");
// Latin letters that look Cyrillic. Sites type month names on whichever
// keyboard is open: the Philharmonic writes "Oктомври" with a Latin O.
const LOOKALIKES = {
    a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т', h: 'н', b: 'в', j: 'ј',
};
// Cyrillic, English, and Macedonian typed in Latin ("Oktomvri", "Avgust").
const MONTH_STEMS = [
    [/^(јан|jan)/, 1], [/^(фев|feb)/, 2], [/^(мар|mar)/, 3], [/^(апр|apr)/, 4],
    [/^(мај|maj|may)/, 5], [/^(јун|jun)/, 6], [/^(јул|jul)/, 7], [/^(авг|avg|aug)/, 8],
    [/^(сеп|sep)/, 9], [/^(окт|okt|oct)/, 10], [/^(ное|noe|nov)/, 11], [/^(дек|dek|dec)/, 12],
];
/** 1–12 for a month name in Macedonian or English, however it was typed. */
function monthNumber(word) {
    const lower = word.trim().toLowerCase();
    const cyrillic = /[а-ш]/.test(lower) ? [...lower].map(ch => LOOKALIKES[ch] ?? ch).join('') : lower;
    for (const [stem, month] of MONTH_STEMS) {
        if (stem.test(cyrillic) || stem.test(lower))
            return month;
    }
    return null;
}
const pad = (n) => String(n).padStart(2, '0');
/** `2026-10-02T22:00:00`, the local wall time the caller reads in venue time. */
function localDateTime(year, month, day, time) {
    if (!year || month < 1 || month > 12 || day < 1 || day > 31)
        return null;
    const [hours, minutes] = (time ?? '00:00').split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes) || hours > 23 || minutes > 59)
        return null;
    return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00`;
}
/** The first `21:00` in a text, as `HH:MM`. */
function findTime(text) {
    // Bounded by digits, not word breaks: "19:30h" and "19:30ч" are both a time.
    const match = /(?<!\d)([01]?\d|2[0-3])[:.]([0-5]\d)(?!\d)/.exec(text);
    return match ? `${pad(Number(match[1]))}:${match[2]}` : null;
}
/**
 * The lowest price in denars from a free-text price.
 *
 * "600 - 1000", "1990-4000 мкд" and "129 € + ДДВ (9.392 денари)" all occur. A
 * figure written in euros is not a price in denars, so it is skipped.
 */
function lowestDenars(text) {
    const figures = [...text.matchAll(/(\d[\d.,\s]*\d|\d)\s*(€|eur|евр)?/gi)]
        .filter(match => !match[2])
        .map(match => Number(match[1].replace(/[.,\s]/g, '')))
        .filter(value => value > 0);
    return figures.length > 0 ? Math.min(...figures) : undefined;
}
/** Whitespace and HTML entities collapsed, for text read out of markup. */
function clean(text) {
    return (text ?? '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#8211;|&ndash;/g, '–')
        .replace(/&#8220;|&#8221;|&bdquo;|&ldquo;|&rdquo;/g, '"')
        .replace(/&#038;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
}
/** Text of an HTML fragment, paragraphs kept apart. */
function htmlToText(html) {
    return clean((html ?? '').replace(/<\/(p|div|li|h\d)>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '))
        .replace(/ ?\n ?/g, '\n');
}
/**
 * A category from the words of a listing that does not state one.
 *
 * The title decides when it can. A description is weaker evidence: it
 * promises "забава" (fun) at a lecture and a tribute concert alike, so a party
 * read only from a description is not believed, and a concert named in it is.
 */
function guessCategory(title, description) {
    const fromTitle = (0, website_1.categorise)({ name: title });
    if (fromTitle !== 'other')
        return fromTitle;
    if (/концерт|concert/i.test(description ?? ''))
        return 'concert';
    const fromText = (0, website_1.categorise)({ name: title, description: description ?? '' });
    return fromText === 'party' ? 'other' : fromText;
}
/** A path on a site made absolute. */
function absolute(base, path) {
    if (!path)
        return undefined;
    try {
        return new URL(path, base).toString();
    }
    catch {
        return undefined;
    }
}
const TIMEOUT_MS = 20_000;
/** JSON from a site's own data interface, honouring its robots.txt first. */
async function fetchJson(url, init = {}) {
    if (!(await (0, robots_1.isAllowed)(url))) {
        throw new website_1.WebsiteFetchError(`robots.txt disallows ${url}`, 'disallowed');
    }
    const response = await fetch(url, {
        ...init,
        headers: {
            Accept: 'application/json',
            'User-Agent': process.env.CRAWLER_USER_AGENT || robots_1.DEFAULT_USER_AGENT,
            ...init.headers,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
        throw new website_1.WebsiteFetchError(`${url} returned ${response.status}`, 'unreachable');
    }
    return (await response.json());
}
/** A pause between page reads, so a whole listing is not fetched in one burst. */
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));
exports.pause = pause;
