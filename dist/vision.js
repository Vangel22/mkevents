"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_MEDIA = void 0;
exports.isSupportedMedia = isSupportedMedia;
exports.parseEventFromPost = parseEventFromPost;
exports.parseEventFromImage = parseEventFromImage;
const z = __importStar(require("zod/v4"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const zod_1 = require("@anthropic-ai/sdk/helpers/zod");
/**
 * Built per call from the options given, falling back to the environment so a
 * caller that already keeps its keys there needs to pass nothing.
 */
function client(options = {}) {
    const workspaceId = options.workspaceId ?? process.env.ANTHROPIC_WORKSPACE_ID;
    return new sdk_1.default({
        apiKey: options.apiKey ?? process.env.ANTHROPIC_API_KEY,
        // An organisation-level key has to say which workspace to bill; a
        // workspace-scoped key already carries that and needs no header.
        ...(workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : {}),
    });
}
/**
 * Sonnet reads Macedonian Cyrillic correctly; Haiku drops the Ќ diacritic and
 * alters grammatical endings, which shows on the most visible field of every
 * listing. Measured against a real poster, the difference costs about four
 * dollars a month at fifty venues — not a trade worth making.
 *
 * Opus is paid for only on the uncertain tail, where a wrong reading is most
 * likely. Set both to the same value to turn escalation off.
 */
const DEFAULT_PRIMARY_MODEL = 'claude-sonnet-5';
const DEFAULT_ESCALATION_MODEL = 'claude-opus-5';
function models(options) {
    return {
        primary: options.primaryModel ?? process.env.AI_PRIMARY_MODEL ?? DEFAULT_PRIMARY_MODEL,
        escalation: options.escalationModel ?? process.env.AI_ESCALATION_MODEL ?? DEFAULT_ESCALATION_MODEL,
    };
}
// Below this, a "probably an event" result is worth a second, better look.
const ESCALATION_FLOOR = 0.45;
const ESCALATION_CEILING = 0.8;
exports.SUPPORTED_MEDIA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
// Anthropic caps images at 5MB base64-encoded; base64 inflates by ~4/3.
const MAX_IMAGE_BYTES = 3_500_000;
function isSupportedMedia(mediaType) {
    return exports.SUPPORTED_MEDIA.includes(mediaType);
}
const EventSchema = z.object({
    isEvent: z.boolean(),
    confidence: z.number(),
    title: z.string().nullable(),
    description: z.string().nullable(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
    isPaid: z.boolean(),
    price: z.number().nullable(),
    ageRestriction: z.number().nullable(),
    reservationNumber: z.string().nullable(),
    ticketUrl: z.string().nullable(),
    category: z.enum([
        'concert',
        'party',
        'cinema',
        'cultural',
        'tech',
        'food_wine',
        'corporate',
        'other',
    ]),
});
const SYSTEM_PROMPT = `You are an event extraction system for a city events platform in North Macedonia.

You read event posters and their Instagram captions. Content is in Macedonian, Albanian, Serbian, English, or a mix, and posters use decorative fonts, text over photography, and heavy stylisation. Read the poster image directly — the text on it is usually the authoritative source, and the caption fills in the gaps.

Rules:
- Extract ONLY information actually present in the image or caption. Never invent details.
- Transcribe the title character by character exactly as printed, keeping Macedonian letters intact: ќ, ѓ, џ, љ, њ, ѕ, ч, ш, ж, ц. Do not translate it, do not change its grammatical ending, and do not substitute a similar-looking letter — "НОЌ" is not "НОК". Match the poster's capitalisation.
- The poster wins when it disagrees with the caption, except for dates the caption states explicitly.
- Dates: "вечерва" is tonight, "утре" tomorrow, "викенд" this weekend, "петок" Friday, "сабота" Saturday, "недела" Sunday — all relative to the post timestamp you are given. "07.04" or "07/04" is day.month; choose the year that puts the event in the future relative to the post.
- Times written as "22:00h", "22h", or "10PM" all mean the same thing. Fold the time into startDate when present.
- Times on a poster are local time in North Macedonia. Always include the UTC offset: +02:00 during summer time, +01:00 otherwise. Write 2026-10-18T22:00:00+02:00, never a bare 2026-10-18T22:00:00.
- Price: numeric value only, in denars. "влезот слободен", "бесплатно", "free entry" mean isPaid false and price null. A poster showing only a ticket link is still isPaid true with price null.
- reservationNumber: every phone number listed for bookings, as printed. Separate several with " | " and keep each number whole — a venue often publishes two lines and both should reach the reader.
- ticketUrl: an absolute link to where tickets are sold, if the post gives one. Null when entry is at the door or no link is shown. Never invent a link.
- Unknown fields are null. Do not guess.
- confidence: 0.0-1.0, how sure you are this is a real, specific, upcoming public event. A legible poster with a clear date and venue is high. A blurry crop, or a date you had to infer, is low.
- isEvent false for menus, throwbacks, staff photos, generic promotion, "we're open today", or recaps of something that already happened.`;
function buildUserPrompt(caption, postDate) {
    return `Post timestamp: ${postDate}

Instagram caption:
"""
${caption || '(no caption)'}
"""

Extract the event.`;
}
async function fetchImageAsBase64(imageUrl) {
    try {
        const response = await fetch(imageUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Mapiks/1.0)' },
            signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
            console.warn(`[mkevents] Image fetch returned ${response.status} for ${imageUrl}`);
            return null;
        }
        const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim();
        const mediaType = isSupportedMedia(contentType) ? contentType : 'image/jpeg';
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.byteLength > MAX_IMAGE_BYTES) {
            console.warn(`[mkevents] Image too large (${buffer.byteLength} bytes), skipping: ${imageUrl}`);
            return null;
        }
        return { data: buffer.toString('base64'), mediaType };
    }
    catch (err) {
        console.warn(`[mkevents] Image fetch failed for ${imageUrl}:`, err.message);
        return null;
    }
}
async function extract(anthropic, model, image, caption, postDate) {
    const content = [];
    if (image) {
        content.push({
            type: 'image',
            source: { type: 'base64', media_type: image.mediaType, data: image.data },
        });
    }
    content.push({ type: 'text', text: buildUserPrompt(caption, postDate) });
    const response = await anthropic.messages.parse({
        model,
        max_tokens: 1024,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content }],
        output_config: { format: (0, zod_1.zodOutputFormat)(EventSchema) },
    });
    return response.parsed_output ?? null;
}
async function parseEventFromPost(imageUrl, caption, postDate, options = {}) {
    return parseEventFromImage(await fetchImageAsBase64(imageUrl), caption, postDate, options);
}
async function parseEventFromImage(image, caption, postDate, options = {}) {
    const anthropic = client(options);
    const { primary, escalation } = models(options);
    if (!image && !caption.trim()) {
        console.warn('[mkevents] No image and no caption — nothing to extract from');
        return null;
    }
    const parsed = await extract(anthropic, primary, image, caption, postDate);
    if (!parsed)
        return null;
    // Only escalate when the cheap pass thinks it found an event but hedged.
    const isUncertain = parsed.isEvent &&
        parsed.confidence >= ESCALATION_FLOOR &&
        parsed.confidence < ESCALATION_CEILING;
    if (!isUncertain || escalation === primary)
        return parsed;
    console.log(`[mkevents] Escalating to ${escalation} (${primary} confidence=${parsed.confidence})`);
    try {
        return (await extract(anthropic, escalation, image, caption, postDate)) ?? parsed;
    }
    catch (err) {
        console.warn('[mkevents] Escalation failed, keeping primary result:', err.message);
        return parsed;
    }
}
