/**
 * Item pictures come from Steam's image CDN, the same place CSFloat and Steam show them from.
 * Only the Detailed view loads them, since every picture is a request Steam can see.
 */
const STEAM_IMAGE_BASE = 'https://community.cloudflare.steamstatic.com/economy/image/';

/** CSFloat gives items an image hash and stickers a full URL; both end up as a sized Steam URL. */
export function steamImageUrl(iconUrl: string | undefined, width: number, height = width): string | undefined {
  if (!iconUrl) return undefined;
  if (/^https?:\/\//.test(iconUrl)) return iconUrl;
  return `${STEAM_IMAGE_BASE}${iconUrl}/${width}fx${height}f`;
}
