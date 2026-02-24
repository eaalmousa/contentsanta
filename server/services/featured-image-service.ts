import type { Story } from "@shared/schema";
import { storage } from "../storage";

export interface ImageExtractionResult {
  url?: string;
  source: "story_item" | "opengraph" | "rss" | "content" | "ai_generated" | "none";
  credit?: string; // Attribution/credit for the image
  caption?: string; // Alt text or caption
  error?: string;
}

export interface WordPressMediaUpload {
  id: number;
  url: string;
  mimeType: string;
}

export class FeaturedImageService {
  /**
   * Extract featured image from story with production-grade fallbacks
   * 
   * Priority order:
   * 1. RSS metadata (enclosure, media:content, media:thumbnail)
   * 2. Source HTML og:image / twitter:image
   * 3. First large in-article <img> (filtered for icons/logos)
   * 
   * Validation:
   * - Must be http(s) URL
   * - Must not be data: URL
   * - Must not be .svg (unless explicitly allowed)
   * - Must not be icon/logo/sprite (min size heuristic)
   */
  async extractImageFromStory(storyId: string): Promise<ImageExtractionResult> {
    const requestId = `img-${Date.now().toString(36).substring(5)}`;
    
    try {
      const storyItems = await storage.getStoryItems(storyId);
      
      if (storyItems.length === 0) {
        console.log(`[${requestId}] No story items found for story ${storyId}`);
        return { source: "none", error: "No story items found" };
      }

      const primaryItem = storyItems.find((item) => item.isPrimary === "true") || storyItems[0];
      
      if (!primaryItem.sourceItemId) {
        console.log(`[${requestId}] No source item ID in primary story item`);
        return { source: "none", error: "No source item ID" };
      }

      const sourceItem = await storage.getSourceItem(primaryItem.sourceItemId);
      
      if (!sourceItem) {
        console.log(`[${requestId}] Source item not found: ${primaryItem.sourceItemId}`);
        return { source: "none", error: "Source item not found" };
      }

      // Step 1: Try RSS metadata (highest priority - publisher-provided)
      const metadata = sourceItem.metadataJson as any;
      if (metadata?.thumbnail) {
        const url = metadata.thumbnail;
        if (this.isValidImageUrl(url)) {
          console.log(`[${requestId}] ✅ Found RSS thumbnail: ${url.substring(0, 60)}`);
          const credit = metadata.credit || metadata.author || metadata.sourceName || "Source RSS Feed";
          const caption = metadata.description || sourceItem.title || "";
          return { url, source: "rss", credit, caption };
        }
      }
      
      if (metadata?.images && Array.isArray(metadata.images) && metadata.images.length > 0) {
        // Try first valid image from RSS
        for (const img of metadata.images) {
          const url = typeof img === "string" ? img : img.url;
          if (url && this.isValidImageUrl(url)) {
            console.log(`[${requestId}] ✅ Found RSS image: ${url.substring(0, 60)}`);
            const credit = (typeof img === "object" ? img.credit : null) || metadata.credit || "Source RSS Feed";
            const caption = (typeof img === "object" ? img.title || img.alt : null) || sourceItem.title || "";
            return { url, source: "rss", credit, caption };
          }
        }
      }

      // Step 2: Fetch source URL and extract from HTML
      const sourceUrl = sourceItem.url;
      if (sourceUrl && sourceUrl.startsWith("http")) {
        console.log(`[${requestId}] Fetching source HTML for og:image: ${sourceUrl.substring(0, 60)}`);
        
        try {
          const htmlImageResult = await this.fetchAndExtractImage(sourceUrl);
          if (htmlImageResult?.url) {
            console.log(`[${requestId}] ✅ Found image from source HTML: ${htmlImageResult.url.substring(0, 60)}`);
            return { 
              url: htmlImageResult.url, 
              source: "opengraph",
              credit: htmlImageResult.credit || sourceItem.sourceName || "Source Article",
              caption: htmlImageResult.caption || sourceItem.title || ""
            };
          }
        } catch (fetchError) {
          console.warn(`[${requestId}] Failed to fetch source HTML:`, fetchError instanceof Error ? fetchError.message : fetchError);
        }
      }

      // Step 3: Try rawContent HTML (already stored from RSS)
      if (sourceItem.rawContent) {
        const imageUrl = this.extractImageFromHTML(sourceItem.rawContent);
        if (imageUrl) {
          console.log(`[${requestId}] ✅ Found image from raw content: ${imageUrl.substring(0, 60)}`);
          return { url: imageUrl, source: "content" };
        }
      }

      console.log(`[${requestId}] ❌ No image found after all extraction methods`);
      return { source: "none", error: "No image found in RSS, source HTML, or content" };
    } catch (error) {
      console.error(`[${requestId}] Error extracting image from story:`, error);
      return {
        source: "none",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Fetch source URL and extract og:image or twitter:image with credits
   */
  private async fetchAndExtractImage(url: string): Promise<{ url: string; credit?: string; caption?: string } | null> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html",
        },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return null;
      }

      const html = await response.text();
      return this.extractImageAndCreditsFromHTML(html);
    } catch (error) {
      // Timeout or fetch error - not critical, we have fallbacks
      return null;
    }
  }

  /**
   * Extract image URL, credits, and caption from HTML
   */
  extractImageAndCreditsFromHTML(html: string): { url: string; credit?: string; caption?: string } | null {
    try {
      let imageUrl: string | null = null;
      let credit: string | undefined;
      let caption: string | undefined;
      
      // Priority 1: og:image (most reliable)
      const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
      if (ogImageMatch && this.isValidImageUrl(ogImageMatch[1])) {
        imageUrl = ogImageMatch[1];
      }

      if (!imageUrl) {
        const ogImageMatch2 = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        if (ogImageMatch2 && this.isValidImageUrl(ogImageMatch2[1])) {
          imageUrl = ogImageMatch2[1];
        }
      }

      // Priority 2: twitter:image
      if (!imageUrl) {
        const twitterImageMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
        if (twitterImageMatch && this.isValidImageUrl(twitterImageMatch[1])) {
          imageUrl = twitterImageMatch[1];
        }
      }

      if (!imageUrl) {
        const twitterImageMatch2 = html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
        if (twitterImageMatch2 && this.isValidImageUrl(twitterImageMatch2[1])) {
          imageUrl = twitterImageMatch2[1];
        }
      }

      // Extract image credit from meta tags or schema.org
      const creditMatch = html.match(/<meta[^>]+(?:name|property)=["'](?:image:credit|article:author|credit)["'][^>]+content=["']([^"']+)["']/i);
      if (creditMatch) {
        credit = creditMatch[1];
      }
      
      // Extract image caption/alt
      const captionMatch = html.match(/<meta[^>]+(?:name|property)=["'](?:og:image:alt|twitter:image:alt)["'][^>]+content=["']([^"']+)["']/i);
      if (captionMatch) {
        caption = captionMatch[1];
      }

      // Priority 3: First large in-article <img> with credit extraction
      if (!imageUrl) {
        const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);
        for (const match of imgMatches) {
          const fullTag = match[0];
          const src = match[1];
          
          if (!this.isValidImageUrl(src)) {
            continue;
          }
          
          // Skip common icon/logo patterns in URL
          if (this.isLikelyIconOrLogo(src)) {
            continue;
          }
          
          // If we have width/height attributes, check minimum size
          const widthMatch = fullTag.match(/width=["']?(\d+)/i);
          const heightMatch = fullTag.match(/height=["']?(\d+)/i);
          
          if (widthMatch && heightMatch) {
            const width = parseInt(widthMatch[1]);
            const height = parseInt(heightMatch[1]);
            
            // Skip small images (likely icons)
            if (width < 200 || height < 150) {
              continue;
            }
          }
          
          // Extract alt text as caption
          const altMatch = fullTag.match(/alt=["']([^"']+)["']/i);
          if (altMatch) {
            caption = altMatch[1];
          }
          
          // This looks like a legitimate content image
          imageUrl = src;
          break;
        }
      }

      if (!imageUrl) {
        return null;
      }

      return { url: imageUrl, credit, caption };
    } catch (error) {
      console.error("Error extracting image from HTML:", error);
      return null;
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  extractImageFromHTML(html: string): string | null {
    const result = this.extractImageAndCreditsFromHTML(html);
    return result?.url || null;
  }

  /**
   * Check if URL path suggests an icon or logo
   */
  private isLikelyIconOrLogo(url: string): boolean {
    const lowerUrl = url.toLowerCase();
    const iconPatterns = [
      "icon",
      "logo",
      "favicon",
      "sprite",
      "avatar",
      "badge",
      "button",
      "thumbnail", // small thumbnails, not featured images
      "/icons/",
      "/logos/",
      "/favicons/",
      "data:image", // data URLs
    ];
    
    return iconPatterns.some(pattern => lowerUrl.includes(pattern));
  }

  isValidImageUrl(url: string): boolean {
    if (!url) return false;
    
    // Must be http(s) URL
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return false;
    }
    
    // Must not be data: URL
    if (url.startsWith("data:")) {
      return false;
    }

    try {
      const parsed = new URL(url);
      const path = parsed.pathname.toLowerCase();
      
      // Must not be SVG (can be exploited, often icons)
      if (path.endsWith(".svg")) {
        return false;
      }
      
      // Check for valid image extensions (allow URLs without extension too, for CDN rewriting)
      const validExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
      const hasValidExtension = validExtensions.some((ext) => path.endsWith(ext));
      
      // Also allow URLs with no extension (e.g., CDN-rewritten URLs like /image/12345)
      const hasNoExtension = !path.includes(".") || path.split(".").pop()!.length > 5;
      
      return hasValidExtension || hasNoExtension;
    } catch {
      return false;
    }
  }

  async uploadToWordPress(
    imageUrl: string,
    wpSiteUrl: string,
    username: string,
    appPassword: string,
    title?: string
  ): Promise<WordPressMediaUpload> {
    try {
      const imageResponse = await fetch(imageUrl);
      
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const contentType = imageResponse.headers.get("content-type") || "image/jpeg";

      const filename = this.getFilenameFromUrl(imageUrl);

      const credentials = Buffer.from(`${username}:${appPassword}`).toString("base64");

      const uploadUrl = `${wpSiteUrl.replace(/\/$/, "")}/wp-json/wp/v2/media`;
      
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${filename}"`,
          Authorization: `Basic ${credentials}`,
        },
        body: imageBuffer,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`WP media upload failed: ${uploadResponse.status} ${errorText}`);
      }

      const mediaData = (await uploadResponse.json()) as any;

      if (title && mediaData.id) {
        await fetch(`${wpSiteUrl.replace(/\/$/, "")}/wp-json/wp/v2/media/${mediaData.id}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${credentials}`,
          },
          body: JSON.stringify({
            title: title,
            alt_text: title,
          }),
        });
      }

      return {
        id: mediaData.id,
        url: mediaData.source_url || mediaData.guid?.rendered || imageUrl,
        mimeType: contentType,
      };
    } catch (error) {
      console.error("Error uploading image to WordPress:", error);
      throw error;
    }
  }

  private getFilenameFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;
      const parts = pathname.split("/");
      const filename = parts[parts.length - 1];
      
      if (filename && /\.(jpe?g|png|gif|webp)$/i.test(filename)) {
        return filename;
      }
      
      return `image-${Date.now()}.jpg`;
    } catch {
      return `image-${Date.now()}.jpg`;
    }
  }
}

export const featuredImageService = new FeaturedImageService();
