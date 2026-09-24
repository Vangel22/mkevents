"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KUPIKARTA_BASE = void 0;
exports.macedonian = macedonian;
exports.aspNetDate = aspNetDate;
exports.mapKupiKartaEvent = mapKupiKartaEvent;
exports.readKupiKarta = readKupiKarta;
const listing_1 = require("./listing");
/**
 * kupikarta.com, read from the data interface its own event list calls.
 *
 * Every event carries its venue with a stable id and the venue's city, which
 * makes it the most reliable of the ticket sites to place on a map.
 */
exports.KUPIKARTA_BASE = 'https://kupikarta.com/';
const ENDPOINT = `${exports.KUPIKARTA_BASE}services/exportdata.asmx/GetEvents`;
const PAGE_SIZE = 50;
/**
 * The Macedonian of the three name fields.
 *
 * Which field holds which language differs from record to record: an event's
 * first name is Cyrillic while its venue's first name is "Nacionalna Opera i
 * Balet". Cyrillic is preferred, since that is what readers search in.
 */
function macedonian(record) {
    const names = [record?.NameFirst, record?.NameSecond, record?.NameThird].map(listing_1.clean).filter(Boolean);
    return names.find(name => /[Ѐ-ӿ]/.test(name)) ?? names[0] ?? '';
}
/** "/Date(1790438400000)/" as an instant. */
function aspNetDate(value) {
    const match = /\/Date\((-?\d+)\)\//.exec(value ?? '');
    return match ? new Date(Number(match[1])).toISOString() : null;
}
function mapKupiKartaEvent(event) {
    const title = macedonian(event);
    const startDate = aspNetDate(event.DateTime);
    const venue = event.ObjectMap?.Object;
    const venueName = macedonian(venue) || macedonian(event.ObjectMap);
    if (!title || !startDate || !venueName || event.IsClosed)
        return null;
    // One description field is only the title again; the longest one is the text.
    const description = [event.DescriptionFirst, event.DescriptionSecond, event.DescriptionThird]
        .map(listing_1.htmlToText)
        .sort((a, b) => b.length - a.length)[0];
    const price = [event.PriceCurrencySecond, event.PriceCurrencyFirst].find(value => (value ?? 0) > 0);
    const page = `${exports.KUPIKARTA_BASE}event-details.nspx?eventid=${event.Id}`;
    return {
        origin: 'kupikarta',
        sourceUrl: page,
        title,
        description: description && description !== title ? description : undefined,
        image: (0, listing_1.absolute)(exports.KUPIKARTA_BASE, event.Thumbnail),
        startDate,
        venueName,
        cityName: (0, listing_1.clean)(venue?.AddressFirst) || undefined,
        price,
        isPaid: true,
        ticketUrl: `${exports.KUPIKARTA_BASE}tickets.nspx?eventid=${event.Id}`,
        category: (0, listing_1.guessCategory)(title, description),
        isSoldOut: Boolean(event.IsSoldOut),
    };
}
/** Every open event on kupikarta.com, page by page. */
async function readKupiKarta() {
    const events = [];
    for (let page = 1; page <= 20; page += 1) {
        const { d } = await (0, listing_1.fetchJson)(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', lang: 'mk' },
            body: JSON.stringify({ filter: { Page: page, Size: PAGE_SIZE, MobileEnabled: true } }),
        });
        events.push(...d.events);
        if (d.events.length === 0 || events.length >= d.total)
            break;
    }
    return events.map(mapKupiKartaEvent).filter((event) => event !== null);
}
