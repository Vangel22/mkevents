"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FILHARMONIJA_PROGRAMME = exports.FILHARMONIJA_BASE = void 0;
exports.parseDayMonthYear = parseDayMonthYear;
exports.parseFilharmonija = parseFilharmonija;
exports.readFilharmonija = readFilharmonija;
const node_html_parser_1 = require("node-html-parser");
const website_1 = require("./website");
const listing_1 = require("./listing");
/**
 * The Macedonian Philharmonic's season, from its "events and tickets" page.
 *
 * Each concert appears twice on the page: a card with the full date and time,
 * and a section with the hall and the programme. The card's data-tab names the
 * section, which is how the two are joined.
 */
exports.FILHARMONIJA_BASE = 'https://www.filharmonija.mk/';
exports.FILHARMONIJA_PROGRAMME = `${exports.FILHARMONIJA_BASE}nastani-i-bileti/`;
const HOME = 'Македонска филхармонија';
/** "8 Oктомври 2026". */
function parseDayMonthYear(text) {
    const match = /(\d{1,2})\s+(\S+)\s+(\d{4})/.exec(text);
    const month = match ? (0, listing_1.monthNumber)(match[2]) : null;
    return match && month ? [Number(match[3]), month, Number(match[1])] : null;
}
function backgroundImage(el) {
    return /url\(['"]?([^'")]+)['"]?\)/.exec(el?.getAttribute('style') ?? '')?.[1];
}
function parseFilharmonija(html) {
    const doc = (0, node_html_parser_1.parse)(html);
    const seen = new Set();
    const events = [];
    for (const card of doc.querySelectorAll('.event.c--pointer')) {
        const tab = card.getAttribute('data-tab');
        if (!tab || seen.has(tab))
            continue;
        seen.add(tab);
        const [dateLine, timeLine] = card.querySelectorAll('.event-content-date h5').map(h5 => (0, listing_1.clean)(h5.text));
        const day = parseDayMonthYear(dateLine ?? '');
        const time = (0, listing_1.findTime)(timeLine ?? '');
        let title = (0, listing_1.clean)(card.querySelector('.event-content h4')?.text);
        if (!day || !time || !title)
            continue;
        const section = doc.querySelector(`.event-section.${tab}`);
        const more = section?.querySelectorAll('a').find(a => /\/events\//.test(a.getAttribute('href') ?? ''));
        const ticket = section?.querySelectorAll('a').find(a => /Купи/i.test(a.text));
        // A concert given on tour is billed "Гостување во <venue>"; that venue is
        // where to go, not the Philharmonic.
        const guest = /^Гостување во\s+(.+)$/i.exec(title)?.[1];
        if (guest)
            title = `${HOME} – гостување во ${guest}`;
        const startDate = (0, listing_1.localDateTime)(...day, time);
        if (!startDate)
            continue;
        const page = more?.getAttribute('href') ?? exports.FILHARMONIJA_PROGRAMME;
        const description = (0, listing_1.clean)(section?.querySelector('.event-section-body, .event-section-content')?.text)
            || (0, listing_1.clean)(card.querySelector('.navLink')?.text).replace(/\.\.\.$/, '')
            || undefined;
        events.push({
            origin: 'filharmonija',
            // Two matinees of one programme share a page, so the date keeps them apart.
            sourceUrl: `${page}#${startDate.slice(0, 10)}`,
            title,
            description,
            image: backgroundImage(card.querySelector('.event-img')),
            startDate,
            venueName: guest ?? HOME,
            cityName: guest ? undefined : 'Скопје',
            isPaid: true,
            ticketUrl: ticket?.getAttribute('href') ?? undefined,
            category: 'concert',
        });
    }
    return events;
}
/** The Philharmonic's published season. */
async function readFilharmonija(options = {}) {
    return parseFilharmonija(await (0, website_1.fetchPage)(exports.FILHARMONIJA_PROGRAMME, options));
}
