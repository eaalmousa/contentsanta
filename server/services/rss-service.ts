import Parser from "rss-parser";
import crypto from "crypto";
import { storage } from "../storage";
import type { Source, InsertSourceItem, InsertFetchRun } from "@shared/schema";
import zlib from "zlib";
import https from "https";
import http from "http";
import { promisify } from "util";

const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const brotliDecompress = promisify(zlib.brotliDecompress);

const parser = new Parser({
  customFields: {
    item: [
      ["media:thumbnail", "mediaThumbnail"],
      ["media:content", "mediaContent"],
      ["enclosure", "enclosure"],
      ["source", "source"], // For Google News RSS publisher name
    ],
  },
});

const MAX_REDIRECTS = 5;
const MAX_RETRIES = 3;
const TIMEOUT_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;

interface FetchResponse {
  xml: string;
  status: number;
  contentType: string;
  contentEncoding: string | null;
  contentLength: number | null;
  bytesCompressed: number;
  bytesDecompressed: number;
  finalUrl: string;
}

interface RetryableError extends Error {
  statusCode?: number;
  isTimeout?: boolean;
  isRetryable?: boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithDecompression(
  url: string,
  redirectCount: number = 0
): Promise<FetchResponse> {
  if (redirectCount > MAX_REDIRECTS) {
    throw Object.assign(new Error(`Too many redirects (max ${MAX_REDIRECTS})`), { isRetryable: false });
  }

  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
      },
      timeout: 30000,
    };

    const req = client.get(url, options, async (response) => {
      const chunks: Buffer[] = [];
      const status = response.statusCode || 0;
      const contentType = response.headers["content-type"] || "unknown";
      const contentEncoding = response.headers["content-encoding"] || null;
      const contentLength = response.headers["content-length"] ? parseInt(response.headers["content-length"], 10) : null;

      if (status >= 300 && status < 400 && response.headers.location) {
        try {
          const redirectUrl = new URL(response.headers.location, url).toString();
          const result = await fetchWithDecompression(redirectUrl, redirectCount + 1);
          resolve(result);
        } catch (err) {
          reject(err);
        }
        return;
      }

      if (status === 429 || status >= 500) {
        const error = new Error(`HTTP ${status}`) as RetryableError;
        error.statusCode = status;
        error.isRetryable = true;
        reject(error);
        return;
      }

      if (status >= 400) {
        const error = new Error(`HTTP ${status}`) as RetryableError;
        error.statusCode = status;
        error.isRetryable = false;
        reject(error);
        return;
      }

      response.on("data", (chunk) => chunks.push(chunk));
      response.on("error", reject);
      response.on("end", async () => {
        try {
          const buffer = Buffer.concat(chunks);
          const bytesCompressed = buffer.length;
          let xml: string;
          let bytesDecompressed: number;

          if (contentEncoding === "gzip") {
            const decompressed = await gunzip(buffer);
            xml = decompressed.toString("utf-8");
            bytesDecompressed = decompressed.length;
          } else if (contentEncoding === "deflate") {
            const decompressed = await inflate(buffer);
            xml = decompressed.toString("utf-8");
            bytesDecompressed = decompressed.length;
          } else if (contentEncoding === "br") {
            const decompressed = await brotliDecompress(buffer);
            xml = decompressed.toString("utf-8");
            bytesDecompressed = decompressed.length;
          } else {
            xml = buffer.toString("utf-8");
            bytesDecompressed = bytesCompressed;
          }

          resolve({
            xml,
            status,
            contentType,
            contentEncoding,
            contentLength,
            bytesCompressed,
            bytesDecompressed,
            finalUrl: url,
          });
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      const error = new Error("Request timeout") as RetryableError;
      error.isTimeout = true;
      error.isRetryable = true;
      reject(error);
    });
  });
}

async function fetchWithRetry(url: string): Promise<FetchResponse> {
  let lastError: Error | null = null;
  let attempt = 0;
  let timeoutAttempts = 0;

  while (attempt < MAX_RETRIES) {
    try {
      return await fetchWithDecompression(url);
    } catch (err: any) {
      lastError = err;
      
      if (err.isTimeout) {
        timeoutAttempts++;
        if (timeoutAttempts >= TIMEOUT_RETRIES) {
          throw err;
        }
        console.log(`[RSS] Timeout, attempt ${timeoutAttempts + 1}/${TIMEOUT_RETRIES}...`);
        await sleep(INITIAL_BACKOFF_MS);
        continue;
      }

      if (!err.isRetryable) {
        throw err;
      }

      attempt++;
      if (attempt >= MAX_RETRIES) {
        throw err;
      }

      const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      console.log(`[RSS] Retryable error (${err.statusCode || err.message}), attempt ${attempt + 1}/${MAX_RETRIES} after ${backoffMs}ms...`);
      await sleep(backoffMs);
    }
  }

  throw lastError || new Error("Unknown fetch error");
}

export function isValidXML(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.includes("<rss") || trimmed.includes("<feed") || trimmed.includes("<RDF");
}

export function normalizeLink(url: string): string {
  try {
    const parsed = new URL(url);
    const trackingParams = [
      "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
      "at_medium", "at_campaign", "at_custom1", "at_custom2", "at_custom3", "at_custom4",
      "ns_mchannel", "ns_source", "ns_campaign", "ns_linkname", "ns_fee",
    ];
    trackingParams.forEach((param) => parsed.searchParams.delete(param));
    return parsed.toString();
  } catch {
    return url;
  }
}

export function generateContentHash(url: string, title: string, guid?: string): string {
  const content = guid
    ? `guid:${guid}`
    : `${normalizeLink(url)}|${title}`.toLowerCase().trim();
  return crypto.createHash("sha256").update(content).digest("hex").substring(0, 32);
}

export function generateGuidNormalized(guid: string | undefined, link: string, title: string, pubDate?: string): string {
  if (guid) {
    return crypto.createHash("sha256").update(`guid:${guid}`).digest("hex").substring(0, 32);
  }
  const fallback = `${normalizeLink(link)}|${title}|${pubDate || ""}`.toLowerCase().trim();
  return crypto.createHash("sha256").update(fallback).digest("hex").substring(0, 32);
}

// ========== Google News RSS Support ==========

/**
 * Detect if a feed URL is from Google News RSS
 */
export function isGoogleNewsFeed(feedUrl: string): boolean {
  return feedUrl.includes("news.google.com/rss");
}

/**
 * Extract the canonical article URL from Google News RSS item content HTML.
 * Google News embeds the real article link in the content HTML.
 */
export function extractCanonicalUrlFromGoogleNews(contentHtml: string | undefined, fallbackLink: string): string {
  if (!contentHtml) return fallbackLink;
  
  // Google News embeds real article links in the content HTML
  // Look for href="..." pattern - the first link is usually the canonical article
  const match = contentHtml.match(/href="([^"]+)"/);
  if (match && match[1]) {
    const extractedUrl = match[1];
    // Validate it's not another Google News URL
    if (!extractedUrl.includes("news.google.com")) {
      return extractedUrl;
    }
  }
  
  return fallbackLink;
}

/**
 * Parse geo (country) and language from Google News RSS feed URL parameters.
 * Example: ?hl=en&gl=AE&ceid=AE:en → { country: "AE", language: "en" }
 */
export function parseGoogleNewsGeoParams(feedUrl: string): { country: string | null; language: string | null } {
  try {
    const url = new URL(feedUrl);
    const gl = url.searchParams.get("gl"); // Country code (e.g., AE, SA)
    const hl = url.searchParams.get("hl"); // Language code (e.g., en, ar)
    const ceid = url.searchParams.get("ceid"); // Combined (e.g., AE:en)
    
    let country = gl || null;
    let language = hl || null;
    
    // Fallback: parse from ceid if gl/hl missing
    if (ceid && (!country || !language)) {
      const parts = ceid.split(":");
      if (parts.length === 2) {
        if (!country) country = parts[0];
        if (!language) language = parts[1];
      }
    }
    
    return { country, language };
  } catch {
    return { country: null, language: null };
  }
}

/**
 * Extract the publisher name from Google News RSS item's <source> element
 */
export function extractGoogleNewsPublisher(item: any): string | null {
  // rss-parser may store <source> in different ways
  if (item.source && typeof item.source === "string") {
    return item.source;
  }
  if (item.source && item.source._) {
    return item.source._;
  }
  if (item.source && item.source.$text) {
    return item.source.$text;
  }
  return null;
}

export function parsePublishedAt(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

interface ExtractedImage {
  url: string;
  source: "media:thumbnail" | "media:content" | "enclosure";
  width?: number;
  height?: number;
  type?: string;
}

function extractAllImages(item: any): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  const seenUrls = new Set<string>();
  
  // Helper to add image if not duplicate
  const addImage = (img: ExtractedImage) => {
    if (img.url && !seenUrls.has(img.url)) {
      seenUrls.add(img.url);
      images.push(img);
    }
  };
  
  // Handle media:thumbnail (can be object or array)
  if (item.mediaThumbnail) {
    const thumbnails = Array.isArray(item.mediaThumbnail) ? item.mediaThumbnail : [item.mediaThumbnail];
    for (const thumb of thumbnails) {
      if (thumb?.$?.url) {
        addImage({
          url: thumb.$.url,
          source: "media:thumbnail",
          width: thumb.$.width ? parseInt(thumb.$.width, 10) : undefined,
          height: thumb.$.height ? parseInt(thumb.$.height, 10) : undefined,
        });
      }
    }
  }
  
  // Handle media:content (can be object or array)
  if (item.mediaContent) {
    const contents = Array.isArray(item.mediaContent) ? item.mediaContent : [item.mediaContent];
    for (const content of contents) {
      if (content?.$?.url && content?.$?.type?.startsWith("image")) {
        addImage({
          url: content.$.url,
          source: "media:content",
          width: content.$.width ? parseInt(content.$.width, 10) : undefined,
          height: content.$.height ? parseInt(content.$.height, 10) : undefined,
          type: content.$.type,
        });
      } else if (content?.$?.url && content?.$?.medium === "image") {
        addImage({
          url: content.$.url,
          source: "media:content",
          width: content.$.width ? parseInt(content.$.width, 10) : undefined,
          height: content.$.height ? parseInt(content.$.height, 10) : undefined,
        });
      }
    }
  }
  
  // Handle enclosure (can be object or array)
  if (item.enclosure) {
    const enclosures = Array.isArray(item.enclosure) ? item.enclosure : [item.enclosure];
    for (const enc of enclosures) {
      if (enc?.url && enc?.type?.startsWith("image")) {
        addImage({
          url: enc.url,
          source: "enclosure",
          type: enc.type,
        });
      }
    }
  }
  
  return images;
}

function extractThumbnail(item: any): string | null {
  const images = extractAllImages(item);
  return images.length > 0 ? images[0].url : null;
}

export interface FetchResult {
  success: boolean;
  itemsFound: number;
  itemsAdded: number;
  error?: string;
  errorName?: string;
}

export async function fetchRSSSource(source: Source): Promise<FetchResult> {
  const requestId = crypto.randomUUID().substring(0, 8);
  const startTime = Date.now();

  console.log(`[RSS:${requestId}] ========== FETCH START ==========`);
  console.log(`[RSS:${requestId}] sourceId: ${source.id}`);
  console.log(`[RSS:${requestId}] sourceName: ${source.name}`);
  console.log(`[RSS:${requestId}] url: ${source.feedUrl}`);

  let fetchRunData: InsertFetchRun = {
    sourceId: source.id,
    status: "failed",
  };

  try {
    const response = await fetchWithRetry(source.feedUrl);

    console.log(`[RSS:${requestId}] ========== RESPONSE HEADERS ==========`);
    console.log(`[RSS:${requestId}] httpStatus: ${response.status}`);
    console.log(`[RSS:${requestId}] contentType: ${response.contentType}`);
    console.log(`[RSS:${requestId}] contentEncoding: ${response.contentEncoding || "none"}`);
    console.log(`[RSS:${requestId}] contentLength: ${response.contentLength ?? "not set"}`);
    console.log(`[RSS:${requestId}] bytesCompressed: ${response.bytesCompressed}`);
    console.log(`[RSS:${requestId}] bytesDecompressed: ${response.bytesDecompressed}`);
    console.log(`[RSS:${requestId}] finalUrl: ${response.finalUrl}`);

    fetchRunData.httpStatus = response.status;
    fetchRunData.contentType = response.contentType;
    fetchRunData.contentEncoding = response.contentEncoding;
    fetchRunData.bytesCompressed = response.bytesCompressed;
    fetchRunData.bytesDecompressed = response.bytesDecompressed;

    if (!isValidXML(response.xml)) {
      const errorMsg = "Response is not valid RSS/Atom XML (missing <rss>, <feed>, or <RDF> tag)";
      console.error(`[RSS:${requestId}] ${errorMsg}`);
      fetchRunData.errorName = "INVALID_XML";
      fetchRunData.errorDetail = errorMsg;
      fetchRunData.durationMs = Date.now() - startTime;
      await storage.createFetchRun(fetchRunData);
      await storage.updateSource(source.id, { lastFetchedAt: new Date(), lastError: errorMsg });
      return { success: false, itemsFound: 0, itemsAdded: 0, error: errorMsg, errorName: "INVALID_XML" };
    }

    const feed = await parser.parseString(response.xml);
    const items = feed.items || [];

    console.log(`[RSS:${requestId}] feedTitle: ${feed.title}`);
    console.log(`[RSS:${requestId}] parsedItemsCount: ${items.length}`);

    // Detect Google News feed and parse geo params
    const isGoogleNews = isGoogleNewsFeed(source.feedUrl);
    const googleNewsGeo = isGoogleNews ? parseGoogleNewsGeoParams(source.feedUrl) : null;
    
    if (isGoogleNews) {
      console.log(`[RSS:${requestId}] Google News feed detected - country: ${googleNewsGeo?.country}, language: ${googleNewsGeo?.language}`);
    }

    const existingCountBefore = await storage.getSourceItemCount(source.workspaceId);
    console.log(`[RSS:${requestId}] existingCountBefore: ${existingCountBefore}`);

    let insertedCount = 0;
    let dedupedCount = 0;
    let skippedCount = 0;
    let missingGuidCount = 0;
    let missingLinkCount = 0;

    for (const item of items) {
      if (!item.guid) missingGuidCount++;
      if (!item.link) missingLinkCount++;

      if (!item.link || !item.title) {
        skippedCount++;
        continue;
      }

      const itemAny = item as any;
      
      // For Google News feeds, extract the canonical article URL from content HTML
      let articleUrl = item.link;
      let originalGoogleNewsLink: string | undefined;
      let publisherName: string | null = null;
      
      if (isGoogleNews) {
        const contentHtml = item.content || itemAny["content:encoded"] || item.contentSnippet || "";
        const extractedUrl = extractCanonicalUrlFromGoogleNews(contentHtml, item.link);
        
        if (extractedUrl !== item.link) {
          originalGoogleNewsLink = item.link;
          articleUrl = extractedUrl;
        }
        
        // Extract publisher name from <source> element
        publisherName = extractGoogleNewsPublisher(itemAny);
      }

      const contentHash = generateContentHash(articleUrl, item.title, item.guid);
      const guidNormalized = generateGuidNormalized(item.guid, articleUrl, item.title, item.pubDate || item.isoDate);

      const exists = await storage.sourceItemExists(source.workspaceId, contentHash);
      if (exists) {
        dedupedCount++;
        continue;
      }

      const images = extractAllImages(item);
      const thumbnail = images.length > 0 ? images[0].url : null;
      const publishedAt = parsePublishedAt(item.pubDate || item.isoDate);

      // Build metadata with Google News-specific fields
      const metadata: Record<string, any> = {
        categories: item.categories || [],
        guid: item.guid,
        thumbnail,
        images,
      };
      
      if (isGoogleNews) {
        metadata.sourceType = "google_news";
        if (originalGoogleNewsLink) {
          metadata.originalLink = originalGoogleNewsLink;
        }
        if (publisherName) {
          metadata.publisherName = publisherName;
        }
        if (googleNewsGeo?.country) {
          metadata.country = googleNewsGeo.country;
        }
        if (googleNewsGeo?.language) {
          metadata.language = googleNewsGeo.language;
        }
      }

      const sourceItem: InsertSourceItem = {
        workspaceId: source.workspaceId,
        sourceId: source.id,
        title: item.title,
        url: normalizeLink(articleUrl),
        publishedAt,
        author: item.creator || itemAny.author || publisherName || null,
        excerpt: item.contentSnippet || item.content?.substring(0, 500) || item.summary || null,
        rawContent: item.content || itemAny["content:encoded"] || null,
        contentHash,
        guidNormalized,
        status: "new",
        metadataJson: metadata,
      };

      try {
        await storage.createSourceItem(sourceItem);
        insertedCount++;
      } catch (err: any) {
        if (err.code === "23505") {
          dedupedCount++;
        } else {
          console.error(`[RSS:${requestId}] Error adding item: ${item.title}`, err.message);
        }
      }
    }

    await storage.updateSource(source.id, {
      lastFetchedAt: new Date(),
      lastSuccessAt: new Date(),
      lastError: null,
      itemCount: (source.itemCount || 0) + insertedCount,
    });

    const durationMs = Date.now() - startTime;
    const totalCountAfter = existingCountBefore + insertedCount;
    
    console.log(`[RSS:${requestId}] ========== FETCH COMPLETE ==========`);
    console.log(`[RSS:${requestId}] existingCountBefore: ${existingCountBefore}`);
    console.log(`[RSS:${requestId}] insertedCount: ${insertedCount}`);
    console.log(`[RSS:${requestId}] totalCountAfter: ${totalCountAfter}`);
    console.log(`[RSS:${requestId}] dedupedCount: ${dedupedCount} (already known)`);
    console.log(`[RSS:${requestId}] skippedCount: ${skippedCount}`);
    console.log(`[RSS:${requestId}] missingGuidCount: ${missingGuidCount}`);
    console.log(`[RSS:${requestId}] missingLinkCount: ${missingLinkCount}`);
    console.log(`[RSS:${requestId}] durationMs: ${durationMs}`);

    fetchRunData = {
      ...fetchRunData,
      status: "success",
      durationMs,
      parsedItemsCount: items.length,
      insertedCount,
      dedupedCount,
      missingGuidCount,
      missingLinkCount,
      existingCountBefore,
      totalCountAfter,
    };
    await storage.createFetchRun(fetchRunData);

    return { success: true, itemsFound: items.length, itemsAdded: insertedCount };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const errorName = error.statusCode ? `HTTP_${error.statusCode}` : error.isTimeout ? "TIMEOUT" : "FETCH_ERROR";
    console.error(`[RSS:${requestId}] Fetch failed after ${durationMs}ms:`, error.message);

    fetchRunData = {
      ...fetchRunData,
      status: "failed",
      errorName,
      errorDetail: error.message,
      httpStatus: error.statusCode,
      durationMs,
    };
    await storage.createFetchRun(fetchRunData);

    await storage.updateSource(source.id, {
      lastFetchedAt: new Date(),
      lastError: error.message,
    });

    return { success: false, itemsFound: 0, itemsAdded: 0, error: error.message, errorName };
  }
}

export async function fetchAllActiveSources(): Promise<Map<string, FetchResult>> {
  const sources = await storage.getActiveSources();
  const results = new Map<string, FetchResult>();

  console.log(`[RSS] Fetching ${sources.length} active sources`);

  for (const source of sources) {
    if (source.type !== "rss") continue;
    const result = await fetchRSSSource(source);
    results.set(source.id, result);
  }

  return results;
}

export async function testRSSFeed(url: string): Promise<{
  success: boolean;
  title?: string;
  itemCount?: number;
  sampleItems?: Array<{ title: string; link: string; pubDate?: string }>;
  error?: string;
  errorDetail?: string;
}> {
  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`[RSS:${requestId}] Testing feed: ${url}`);

  try {
    const response = await fetchWithRetry(url);
    console.log(`[RSS:${requestId}] Test fetch: status=${response.status}, contentType=${response.contentType}, bytesCompressed=${response.bytesCompressed}, bytesDecompressed=${response.bytesDecompressed}`);

    if (!isValidXML(response.xml)) {
      const htmlMatch = response.xml.match(/<title[^>]*>([^<]+)<\/title>/i);
      const pageTitle = htmlMatch ? htmlMatch[1] : "Unknown page";
      return {
        success: false,
        error: "Not a valid RSS/Atom feed",
        errorDetail: `Server returned HTML page instead of feed XML. Page title: "${pageTitle}"`,
      };
    }

    const feed = await parser.parseString(response.xml);

    console.log(`[RSS:${requestId}] Test successful - title: ${feed.title}, items: ${feed.items?.length || 0}`);

    return {
      success: true,
      title: feed.title,
      itemCount: feed.items?.length || 0,
      sampleItems: (feed.items || []).slice(0, 3).map((item) => ({
        title: item.title || "Untitled",
        link: item.link || "",
        pubDate: item.pubDate || item.isoDate,
      })),
    };
  } catch (error: any) {
    console.error(`[RSS:${requestId}] Test failed:`, error.message);
    
    let errorDetail = error.message;
    if (error.statusCode === 403) {
      errorDetail = "Access denied (403 Forbidden). The server is blocking requests.";
    } else if (error.statusCode === 404) {
      errorDetail = "Feed not found (404). Check the URL is correct.";
    } else if (error.isTimeout) {
      errorDetail = "Request timed out. The server may be slow or unreachable.";
    } else if (error.code === "ENOTFOUND") {
      errorDetail = "DNS lookup failed. Check the domain name is correct.";
    }

    return {
      success: false,
      error: error.statusCode ? `HTTP ${error.statusCode}` : error.message,
      errorDetail,
    };
  }
}
