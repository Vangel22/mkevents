"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KINOVERZUM_PROGRAMME = void 0;
exports.parseKinoverzum = parseKinoverzum;
exports.readKinoverzum = readKinoverzum;
const node_html_parser_1 = require("node-html-parser");
const website_1 = require("./website");
const listing_1 = require("./listing");
/**
 * Kinoverzum's weekly programme: every film at all five of its cinemas on one
 * page, a row per film and a column per day, each screening written "22:10 Штип".
 *
 * A film becomes one event per cinema, carrying that cinema's screenings, the
 * way a Cineplexx film does.
 */
exports.KINOVERZUM_PROGRAMME = 'https://kinoverzum.mk/nedelna-programa/';
const TICKETS = 'https://tickets.kinoverzum.mk/';
/** Branches named by neighbourhood are in Skopje; the others by their town. */
const BRANCH_CITY = {
    'Кисела Вода': 'Скопје',
    'Драчево': 'Скопје',
    'Штип': 'Штип',
    'Велес': 'Велес',
    'Свети Николе': 'Свети Николе',
};
/** "24 септември 2026 (четврток)". */
function parseDay(text) {
    const match = /(\d{1,2})\s+(\S+)\s+(\d{4})/.exec(text);
    const month = match ? (0, listing_1.monthNumber)(match[2]) : null;
    return match && month ? [Number(match[3]), month, Number(match[1])] : null;
}
function parseKinoverzum(html) {
    const doc = (0, node_html_parser_1.parse)(html);
    const events = [];
    for (const row of doc.querySelectorAll('.amy-movie-showtimews-row')) {
        const title = (0, listing_1.clean)(row.querySelector('.amy-movie-field-title')?.text);
        const filmUrl = row.querySelectorAll('a').map(a => a.getAttribute('href') ?? '').find(href => href.includes('/film/'));
        // The first row is the header of weekdays and has no film.
        if (!title || !filmUrl)
            continue;
        const byBranch = new Map();
        for (const cell of row.querySelectorAll('.amy-movie-showtimews-cell')) {
            const day = parseDay((0, listing_1.clean)(cell.querySelector('.intro-date-time .date')?.text));
            if (!day)
                continue;
            for (const slot of cell.querySelectorAll('.amy-movie-intro-times span')) {
                const text = (0, listing_1.clean)(slot.text);
                const time = (0, listing_1.findTime)(text);
                const branch = (0, listing_1.clean)(text.replace(/^\d{1,2}[:.]\d{2}/, ''));
                const at = time && branch ? (0, listing_1.localDateTime)(...day, time) : null;
                if (!at)
                    continue;
                byBranch.set(branch, [...(byBranch.get(branch) ?? []), at]);
            }
        }
        const age = Number(/(\d{1,2})\+/.exec((0, listing_1.clean)(row.querySelector('.amy-movie-field-mpaa')?.text))?.[1]);
        // Each field is printed on both faces of the poster card, and some are
        // empty, so the facts are deduplicated and blanks dropped.
        const facts = [
            ...new Set(row
                .querySelectorAll('.amy-movie-custom-field-group')
                .map(group => (0, listing_1.clean)(group.text))
                .filter(fact => /:\s*\S/.test(fact) && !/^Премиера/.test(fact))),
        ];
        const poster = row.querySelector('img');
        for (const [branch, times] of byBranch) {
            const showtimes = [...times].sort();
            events.push({
                origin: 'kinoverzum',
                sourceUrl: `${filmUrl}#${encodeURIComponent(branch)}`,
                title,
                description: facts.join(' · ') || undefined,
                image: poster?.getAttribute('src') ?? poster?.getAttribute('data-src') ?? undefined,
                startDate: showtimes[0],
                endDate: showtimes[showtimes.length - 1],
                showtimes,
                venueName: `Киноверзум ${branch}`,
                cityName: BRANCH_CITY[branch] ?? branch,
                isPaid: true,
                ticketUrl: TICKETS,
                category: 'cinema',
                ageRestriction: age > 0 ? age : undefined,
            });
        }
    }
    return events;
}
/** This week's screenings at every Kinoverzum cinema. */
async function readKinoverzum(options = {}) {
    return parseKinoverzum(await (0, website_1.fetchPage)(exports.KINOVERZUM_PROGRAMME, options));
}
