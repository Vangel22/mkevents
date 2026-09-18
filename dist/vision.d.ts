import type { AnthropicOptions, ParsedEvent } from './types';
export declare const SUPPORTED_MEDIA: readonly ["image/jpeg", "image/png", "image/webp", "image/gif"];
export type SupportedMedia = (typeof SUPPORTED_MEDIA)[number];
export interface InlineImage {
    data: string;
    mediaType: SupportedMedia;
}
export declare function isSupportedMedia(mediaType: string): mediaType is SupportedMedia;
export declare function parseEventFromPost(imageUrl: string, caption: string, postDate: string, options?: AnthropicOptions): Promise<ParsedEvent | null>;
export declare function parseEventFromImage(image: InlineImage | null, caption: string, postDate: string, options?: AnthropicOptions): Promise<ParsedEvent | null>;
