/**
 * Image URL utilities for safe rendering
 * Blocks known problematic domains and provides fallback handling
 */

const BLOCKED_DOMAINS = [
  "via.placeholder.com",
  "placeholder.com",
  "placeholdit.imgix.net",
  // Add other placeholder services here
];

/**
 * Check if a URL points to a blocked placeholder domain
 */
export function isBlockedPlaceholder(url?: string | null): boolean {
  if (!url) return false;
  return BLOCKED_DOMAINS.some((domain) => url.includes(domain));
}

/**
 * Sanitize image URL - returns undefined if blocked
 * Use this for Avatar src and other image components
 * 
 * @example
 * <AvatarImage src={sanitizeImageUrl(user.profileImageUrl)} />
 */
export function sanitizeImageUrl(url?: string | null): string | undefined {
  if (!url || isBlockedPlaceholder(url)) {
    return undefined;
  }
  return url;
}

/**
 * Get safe image URL with explicit fallback
 * 
 * @example
 * const imgSrc = getSafeImageUrl(item.featuredImageUrl, FALLBACK_DATA_URI);
 */
export function getSafeImageUrl(
  url?: string | null,
  fallback?: string
): string | undefined {
  if (!url || isBlockedPlaceholder(url)) {
    return fallback;
  }
  return url;
}
