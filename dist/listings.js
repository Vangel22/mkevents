"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LISTING_ORIGINS = exports.LISTING_READERS = void 0;
const karti_1 = require("./karti");
const wayin_1 = require("./wayin");
const kupikarta_1 = require("./kupikarta");
const kinoverzum_1 = require("./kinoverzum");
const filharmonija_1 = require("./filharmonija");
/** Every listing this package reads, by name, so a caller can loop over them. */
exports.LISTING_READERS = {
    karti: karti_1.readKarti,
    kupikarta: () => (0, kupikarta_1.readKupiKarta)(),
    wayin: () => (0, wayin_1.readWayin)(),
    filharmonija: filharmonija_1.readFilharmonija,
    kinoverzum: kinoverzum_1.readKinoverzum,
};
exports.LISTING_ORIGINS = Object.keys(exports.LISTING_READERS);
