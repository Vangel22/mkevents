"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WAYIN_BASE = void 0;
exports.parseWayinPeriod = parseWayinPeriod;
exports.mapWayinProduct = mapWayinProduct;
exports.readWayin = readWayin;
const listing_1 = require("./listing");
/**
 * wayin.mk, read from the shop interface its own pages call. Festivals such as
 * the Skopje City Festival sell here and nowhere else.
 *
 * The interface answers only when told which shop it serves; this id is the
 * one wayin.mk's own pages send.
 */
exports.WAYIN_BASE = 'https://wayin.mk/';
const ENDPOINT = 'https://api.wayin.mk/api/v1/shop/products';
const TENANT = '0af23713-960a-430e-8f53-845bab01e672';
/** "19.10.2026", "6.12.2025", or a range "28.08.2026 - 29.08.2026". */
function parseWayinPeriod(text) {
    const days = [...text.matchAll(/(\d{1,2})\.(\d{1,2})\.(\d{4})/g)].map(match => [Number(match[3]), Number(match[2]), Number(match[1])]);
    if (days.length === 0)
        return null;
    return days.length > 1 ? { start: days[0], end: days[days.length - 1] } : { start: days[0] };
}
function mapWayinProduct(product) {
    const title = (0, listing_1.clean)(product.title);
    const venueName = (0, listing_1.clean)(product.event_location);
    const period = parseWayinPeriod(product.event_date_period ?? '');
    // "Почеток: 20:00 часот" or "Вратите се отвараат во 19:30h": doors or start,
    // either is when to turn up.
    const time = (0, listing_1.findTime)(product.event_start_time ?? '');
    if (!title || !venueName || !period || !time || !product.slug)
        return null;
    const startDate = (0, listing_1.localDateTime)(...period.start, time);
    if (!startDate)
        return null;
    const description = (0, listing_1.htmlToText)(product.description) || undefined;
    const page = `${exports.WAYIN_BASE}shop/events/${product.slug}`;
    return {
        origin: 'wayin',
        sourceUrl: page,
        title,
        description,
        image: product.thumbnail?.url || undefined,
        startDate,
        endDate: period.end ? ((0, listing_1.localDateTime)(...period.end, time) ?? undefined) : undefined,
        venueName,
        // Every product carries the same placeholder price; the real one is only
        // chosen at checkout, so none is claimed here.
        isPaid: true,
        ticketUrl: page,
        category: (0, listing_1.guessCategory)(title, description),
        isSoldOut: product.stock_status === 'out_of_stock',
    };
}
/** Every event on sale at wayin.mk, page by page. */
async function readWayin() {
    const products = [];
    for (let page = 1; page <= 20; page += 1) {
        const body = await (0, listing_1.fetchJson)(`${ENDPOINT}?per_page=50&page=${page}`, { headers: { 'X-Tenant': TENANT } });
        products.push(...body.data);
        if (body.data.length === 0 || page >= (body.meta?.last_page ?? 1))
            break;
    }
    return products.map(mapWayinProduct).filter((event) => event !== null);
}
