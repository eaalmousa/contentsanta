import Parser from "rss-parser";
import crypto from "crypto";
import { storage } from "../storage";
import type { Source, InsertSourceItem } from "@shared/schema";

const parser = new Parser({
  timeout: 30000,
  headers: {
    "User-Agent": "ContentSanta/1.0",
  },
});

export interface FetchResult {
  success: boolean;
  itemsFound: number;
  itemsAdded: number;
  error?: string;
}

function generateContentHash(url: string, title: string): string {
  const content = `${url}|${title}`.toLowerCase().trim();
  return crypto.createHash("sha256").update(content).digest("hex").substring(0, 32);
}

export async function fetchRSSSource(source: Source): Promise<FetchResult> {
  try {
    console.log(`[RSS] Fetching source: ${source.name} (${source.feedUrl})`);
    
    const feed = await parser.parseURL(source.feedUrl);
    const items = feed.items || [];
    
    let itemsAdded = 0;
    
    for (const item of items) {
      if (!item.link || !item.title) continue;
      
      const contentHash = generateContentHash(item.link, item.title);
      
      const exists = await storage.sourceItemExists(source.workspaceId, contentHash);
      if (exists) {
        continue;
      }
      
      const sourceItem: InsertSourceItem = {
        workspaceId: source.workspaceId,
        sourceId: source.id,
        title: item.title,
        url: item.link,
        publishedAt: item.pubDate ? new Date(item.pubDate) : null,
        author: item.creator || item.author || null,
        excerpt: item.contentSnippet || item.content?.substring(0, 500) || null,
        rawContent: item.content || null,
        contentHash,
        status: "new",
        metadataJson: {
          categories: item.categories || [],
          guid: item.guid,
        },
      };
      
      try {
        await storage.createSourceItem(sourceItem);
        itemsAdded++;
      } catch (err) {
        console.error(`[RSS] Error adding item: ${item.title}`, err);
      }
    }
    
    await storage.updateSource(source.id, {
      lastFetchedAt: new Date(),
      lastSuccessAt: new Date(),
      lastError: null,
      itemCount: (source.itemCount || 0) + itemsAdded,
    });
    
    console.log(`[RSS] Fetched ${source.name}: ${items.length} items found, ${itemsAdded} new items added`);
    
    return {
      success: true,
      itemsFound: items.length,
      itemsAdded,
    };
  } catch (error: any) {
    console.error(`[RSS] Error fetching ${source.name}:`, error.message);
    
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
  sampleItems?: Array<{ title: string; link: string }>;
  error?: string;
}> {
  try {
    const feed = await parser.parseURL(url);
    
    return {
      success: true,
      title: feed.title,
      itemCount: feed.items?.length || 0,
      sampleItems: (feed.items || []).slice(0, 3).map((item) => ({
        title: item.title || "Untitled",
        link: item.link || "",
      })),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}
