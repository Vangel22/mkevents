"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KARTI_LISTING = exports.KARTI_BASE = void 0;
exports.parseKartiDate = parseKartiDate;
exports.kartiCategory = kartiCategory;
exports.parseKartiListing = parseKartiListing;
exports.parseKartiDetail = parseKartiDetail;
exports.mapKartiCard = mapKartiCard;
exports.readKarti = readKarti;
const node_html_parser_1 = require("node-html-parser");
const website_1 = require("./website");
const listing_1 = require("./listing");
/**
 * karti.com.mk: the widest ticket listing in the country, the same catalogue
 * mktickets.mk shows in English. Its listing page has no start times, so each
 * event's own page is read for the time and the description.
 */
exports.KARTI_BASE = 'https://www.karti.com.mk/';
exports.KARTI_LISTING = `${exports.KARTI_BASE}aktuelno.nspx`;
/**
 * The days a card's date covers.
 *
 * "02 Октомври 2026", "11 October 2026", "15-18 Октомври 2026" and
 * "23.09-05.10 Септември/Октомври 2026" all occur. A card with no date is a
 * monthly repertoire rather than an event, and is skipped.
 */
function parseKartiDate(text) {
    const numeric = /^(\d{1,2})\.(\d{1,2})\s*-\s*(\d{1,2})\.(\d{1,2})\s+\S+\s+(\d{4})$/.exec(text);
    if (numeric) {
        const [, d1, m1, d2, m2, y] = numeric.map(Number);
        return { start: [y, m1, d1], end: [m2 < m1 ? y + 1 : y, m2, d2] };
    }
    const named = /^(\d{1,2})(?:\s*-\s*(\d{1,2}))?\s+(\S+)\s+(\d{4})$/.exec(text);
    if (!named)
        return null;
    const month = (0, listing_1.monthNumber)(named[3]);
    if (!month)
        return null;
    const year = Number(named[4]);
    const start = [year, month, Number(named[1])];
    return named[2] ? { start, end: [year, month, Number(named[2])] } : { start };
}
// Karti's filter classes to our categories. The first match wins, so a jazz
// festival at the Opera is a concert and a comedy festival is theatre.
// "festivals" and "other" on their own say nothing, so they are not listed.
const CLASS_CATEGORY = [
    ['concerts', 'concert'],
    ['theater', 'cultural'],
    ['deca_mladinci', 'cultural'],
    ['turski', 'cultural'],
    ['philharmonic', 'concert'],
    ['mob', 'cultural'],
    ['sport_events', 'sports'],
];
/** The category Karti's classes state, or null when they state none. */
function kartiCategory(classes) {
    return CLASS_CATEGORY.find(([name]) => classes.includes(name))?.[1] ?? null;
}
function parseKartiListing(html) {
    const doc = (0, node_html_parser_1.parse)(html);
    return doc.querySelectorAll('a.k_event_link').flatMap(card => {
        const url = (0, listing_1.absolute)(exports.KARTI_BASE, card.getAttribute('href'));
        const title = (0, listing_1.clean)(card.querySelector('.k-event-list-event-title')?.text);
        if (!url || !title)
            return [];
        return [
            {
                url,
                title,
                dateText: (0, listing_1.clean)(card.querySelector('.k-events-event-date')?.text),
                venueText: (0, listing_1.clean)(card.querySelector('.k-events-venue-details')?.text),
                priceText: (0, listing_1.clean)(card.querySelector('.wraper-bottom-right')?.text),
                image: (0, listing_1.absolute)(exports.KARTI_BASE, card.querySelector('img')?.getAttribute('src')),
                classes: card.classList.value,
            },
        ];
    });
}
/** The start time and description from an event's own page. */
function parseKartiDetail(html) {
    const doc = (0, node_html_parser_1.parse)(html);
    const time = doc
        .querySelectorAll('.inner-event-details-row')
        .map(row => (0, listing_1.clean)(row.text))
        .find(text => /^\d{1,2}:\d{2}$/.test(text)) ?? null;
    const description = (0, listing_1.clean)(doc.querySelector('.inner-event-details-content')?.text);
    return { time: time ? (0, listing_1.findTime)(time) : null, description: description || undefined };
}
function mapKartiCard(card, detail) {
    const days = parseKartiDate(card.dateText);
    // Without a time the listing would say midnight, which is a wrong fact
    // rather than a missing one. The next read will have it.
    if (!days || !detail.time)
        return null;
    const startDate = (0, listing_1.localDateTime)(...days.start, detail.time);
    if (!startDate)
        return null;
    const price = (0, listing_1.lowestDenars)(card.priceText);
    return {
        origin: 'karti',
        sourceUrl: card.url,
        title: card.title,
        description: detail.description,
        image: card.image,
        startDate,
        endDate: days.end ? ((0, listing_1.localDateTime)(...days.end, detail.time) ?? undefined) : undefined,
        venueName: card.venueText,
        price,
        // A ticket shop lists what it sells.
        isPaid: true,
        ticketUrl: card.url,
        category: kartiCategory(card.classes) ?? (0, listing_1.guessCategory)(card.title, detail.description),
    };
}
/** Every dated event on karti.com.mk, with its time read from its own page. */
async function readKarti(options = {}) {
    const cards = parseKartiListing(await (0, website_1.fetchPage)(exports.KARTI_LISTING, options)).filter(card => parseKartiDate(card.dateText));
    const events = [];
    for (const card of cards) {
        await (0, listing_1.pause)(400);
        try {
            const event = mapKartiCard(card, parseKartiDetail(await (0, website_1.fetchPage)(card.url, options)));
            if (event)
                events.push(event);
        }
        catch {
            // One page that fails to load costs one event this run, not the run.
        }
    }
    return events;
}
