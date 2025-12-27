import Parser from "rss-parser";
import crypto from "crypto";
import { storage } from "../storage";
import type { Source, InsertSourceItem } from "@shared/schema";

// Create parser with BBC-compatible settings
const parser = new Parser({
  timeout: 30000,
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
  },
  customFields: {
    item: [
      ["media:thumbnail", "mediaThumbnail"],
      ["media:content", "mediaContent"],
      ["enclosure", "enclosure"],
    ],
  },
});

export interface FetchResult {
  success: boolean;
  itemsFound: number;
  itemsAdded: number;
  error?: string;
}

// Normalize link by stripping common tracking parameters
function normalizeLink(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove common tracking params
    const trackingParams = [
      "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
      "at_medium", "at_campaign", "at_custom1", "at_custom2", "at_custom3", "at_custom4",
      "ns_mchannel", "ns_source", "ns_campaign", "ns_linkname", "ns_fee",
    ];
    trackingParams.forEach(param => parsed.searchParams.delete(param));
    return parsed.toString();
  } catch {
    return url;
  }
}

function generateContentHash(url: string, title: string, guid?: string): string {
  // Use guid if available (most reliable), else normalized URL + title
  const content = guid 
    ? `guid:${guid}` 
    : `${normalizeLink(url)}|${title}`.toLowerCase().trim();
  return crypto.createHash("sha256").update(content).digest("hex").substring(0, 32);
}

// Extract thumbnail from various RSS formats
function extractThumbnail(item: any): string | null {
  // BBC format: media:thumbnail
  if (item.mediaThumbnail?.$.url) {
    return item.mediaThumbnail.$.url;
  }
  // Media content
  if (item.mediaContent?.$.url) {
    return item.mediaContent.$.url;
  }
  // Enclosure (common for podcasts/media)
  if (item.enclosure?.url && item.enclosure.type?.startsWith("image")) {
    return item.enclosure.url;
  }
  return null;
}

export async function fetchRSSSource(source: Source): Promise<FetchResult> {
  const requestId = crypto.randomUUID().substring(0, 8);
  const startTime = Date.now();
  
  console.log(`[RSS:${requestId}] Starting fetch for source: ${source.name}`);
  console.log(`[RSS:${requestId}] URL: ${source.feedUrl}`);
  console.log(`[RSS:${requestId}] Source ID: ${source.id}`);
  
  try {
    const feed = await parser.parseURL(source.feedUrl);
    const items = feed.items || [];
    
    console.log(`[RSS:${requestId}] Fetch successful`);
    console.log(`[RSS:${requestId}] Feed title: ${feed.title}`);
    console.log(`[RSS:${requestId}] Items found: ${items.length}`);
    
    // Debug: log first 2 items
    if (process.env.NODE_ENV === "development" && items.length > 0) {
      console.log(`[RSS:${requestId}] Sample items:`);
      items.slice(0, 2).forEach((item, i) => {
        console.log(`[RSS:${requestId}]   [${i + 1}] title: ${item.title?.substring(0, 60)}...`);
        console.log(`[RSS:${requestId}]       link: ${item.link}`);
        console.log(`[RSS:${requestId}]       pubDate: ${item.pubDate || item.isoDate}`);
        console.log(`[RSS:${requestId}]       guid: ${item.guid}`);
      });
    }
    
    let itemsAdded = 0;
    
    for (const item of items) {
      if (!item.link || !item.title) {
        console.log(`[RSS:${requestId}] Skipping item - missing link or title`);
        continue;
      }
      
      const contentHash = generateContentHash(item.link, item.title, item.guid);
      
      const exists = await storage.sourceItemExists(source.workspaceId, contentHash);
      if (exists) {
        continue; // Skip duplicate (normal, not an error)
      }
      
      const thumbnail = extractThumbnail(item);
      const dateStr = item.pubDate || item.isoDate;
      const publishedAt = dateStr ? new Date(dateStr) : null;
      
      // Access item properties with type assertion for extended fields
      const itemAny = item as any;
      
      const sourceItem: InsertSourceItem = {
        workspaceId: source.workspaceId,
        sourceId: source.id,
        title: item.title,
        url: normalizeLink(item.link),
        publishedAt,
        author: item.creator || itemAny.author || null,
        excerpt: item.contentSnippet || item.content?.substring(0, 500) || item.summary || null,
        rawContent: item.content || itemAny["content:encoded"] || null,
        contentHash,
        status: "new",
        metadataJson: {
          categories: item.categories || [],
          guid: item.guid,
          thumbnail,
        },
      };
      
      try {
        await storage.createSourceItem(sourceItem);
        itemsAdded++;
      } catch (err: any) {
        // Unique constraint violation is expected for concurrent/rapid fetches
        if (err.code === "23505") {
          console.log(`[RSS:${requestId}] Duplicate detected (constraint): ${item.title?.substring(0, 40)}...`);
        } else {
          console.error(`[RSS:${requestId}] Error adding item: ${item.title}`, err.message);
        }
      }
    }
    
    await storage.updateSource(source.id, {
      lastFetchedAt: new Date(),
      lastSuccessAt: new Date(),
      lastError: null,
      itemCount: (source.itemCount || 0) + itemsAdded,
    });
    
    const elapsed = Date.now() - startTime;
    console.log(`[RSS:${requestId}] Completed in ${elapsed}ms: ${items.length} items found, ${itemsAdded} new items saved`);
    
    return {
      success: true,
      itemsFound: items.length,
      itemsAdded,
    };
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[RSS:${requestId}] Fetch failed after ${elapsed}ms:`, error.message);
    
    await storage.updateSource(source.id, {
      lastFetchedAt: new Date(),
      lastError: error.message,
    });
    
    return {
      success: false,
      itemsFound: 0,
      itemsAdded: 0,
      error: error.message,
    };
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
}> {
  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`[RSS:${requestId}] Testing feed: ${url}`);
  
  try {
    const feed = await parser.parseURL(url);
    
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
    return {
      success: false,
      error: error.message,
    };
  }
}
