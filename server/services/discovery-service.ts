import Parser from "rss-parser";
import https from "https";
import http from "http";
import zlib from "zlib";
import { promisify } from "util";
import { storage } from "../storage";
import type { ContentGoal, DiscoveryJob, InsertDiscoveredSource } from "@shared/schema";
import { isValidXML } from "./rss-service";

const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const brotliDecompress = promisify(zlib.brotliDecompress);

const parser = new Parser({
  timeout: 15000,
  customFields: {
    feed: ["language", "dc:language"],
  },
});

const COMMON_FEED_PATHS = [
  "/rss",
  "/rss.xml",
  "/feed",
  "/feed.xml",
  "/atom.xml",
  "/feeds/posts/default",
  "/blog/rss.xml",
  "/blog/feed",
  "/news/rss",
  "/news/feed",
  "/index.xml",
  "/?feed=rss2",
];

const FRESHNESS_DAYS = 14;

// Externalized configuration - read from environment variables
const MAX_CANDIDATES_PER_DOMAIN = parseInt(process.env.DISCOVERY_MAX_CANDIDATES || "3", 10);

interface DiscoveryLog {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

interface ScoreBreakdown {
  languageMatch: number;
  freshness: number;
  itemCount: number;
  domainQuality: number;
  total: number;
}

function addLog(logs: DiscoveryLog[], level: "info" | "warn" | "error", message: string) {
  logs.push({
    timestamp: new Date().toISOString(),
    level,
    message,
  });
  console.log(`[Discovery:${level.toUpperCase()}] ${message}`);
}

async function fetchPage(url: string, timeout = 10000): Promise<{ html: string; status: number } | null> {
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https : http;
    
    const req = client.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
      },
      timeout,
    }, async (response) => {
      const chunks: Buffer[] = [];
      const status = response.statusCode || 0;
      const contentEncoding = response.headers["content-encoding"] || null;

      if (status >= 300 && status < 400 && response.headers.location) {
        try {
          const redirectUrl = new URL(response.headers.location, url).toString();
          const result = await fetchPage(redirectUrl, timeout);
          resolve(result);
        } catch {
          resolve(null);
        }
        return;
      }

      if (status >= 400) {
        resolve(null);
        return;
      }

      response.on("data", (chunk) => chunks.push(chunk));
      response.on("error", () => resolve(null));
      response.on("end", async () => {
        try {
          const buffer = Buffer.concat(chunks);
          let html: string;

          if (contentEncoding === "gzip") {
            const decompressed = await gunzip(buffer);
            html = decompressed.toString("utf-8");
          } else if (contentEncoding === "deflate") {
            const decompressed = await inflate(buffer);
            html = decompressed.toString("utf-8");
          } else if (contentEncoding === "br") {
            const decompressed = await brotliDecompress(buffer);
            html = decompressed.toString("utf-8");
          } else {
            html = buffer.toString("utf-8");
          }

          resolve({ html, status });
        } catch {
          resolve(null);
        }
      });
    });

    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function fetchFeed(url: string, timeout = 15000): Promise<{
  xml: string;
  status: number;
} | null> {
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https : http;
    
    const req = client.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
      },
      timeout,
    }, async (response) => {
      const chunks: Buffer[] = [];
      const status = response.statusCode || 0;
      const contentEncoding = response.headers["content-encoding"] || null;

      if (status >= 300 && status < 400 && response.headers.location) {
        try {
          const redirectUrl = new URL(response.headers.location, url).toString();
          const result = await fetchFeed(redirectUrl, timeout);
          resolve(result);
        } catch {
          resolve(null);
        }
        return;
      }

      if (status >= 400) {
        resolve({ xml: "", status });
        return;
      }

      response.on("data", (chunk) => chunks.push(chunk));
      response.on("error", () => resolve(null));
      response.on("end", async () => {
        try {
          const buffer = Buffer.concat(chunks);
          let xml: string;

          if (contentEncoding === "gzip") {
            const decompressed = await gunzip(buffer);
            xml = decompressed.toString("utf-8");
          } else if (contentEncoding === "deflate") {
            const decompressed = await inflate(buffer);
            xml = decompressed.toString("utf-8");
          } else if (contentEncoding === "br") {
            const decompressed = await brotliDecompress(buffer);
            xml = decompressed.toString("utf-8");
          } else {
            xml = buffer.toString("utf-8");
          }

          resolve({ xml, status });
        } catch {
          resolve(null);
        }
      });
    });

    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

function extractFeedLinksFromHTML(html: string, baseUrl: string): string[] {
  const feedUrls: string[] = [];
  
  const linkRegex = /<link[^>]+rel=["']alternate["'][^>]*>/gi;
  const matches = html.match(linkRegex) || [];
  
  for (const match of matches) {
    const typeMatch = match.match(/type=["']([^"']+)["']/i);
    const hrefMatch = match.match(/href=["']([^"']+)["']/i);
    
    if (typeMatch && hrefMatch) {
      const type = typeMatch[1].toLowerCase();
      if (type.includes("rss") || type.includes("atom") || type.includes("xml")) {
        try {
          const feedUrl = new URL(hrefMatch[1], baseUrl).toString();
          feedUrls.push(feedUrl);
        } catch {}
      }
    }
  }
  
  return [...new Set(feedUrls)];
}

function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function scoreDomainQuality(domain: string): number {
  if (domain.endsWith(".gov") || domain.endsWith(".gov.uk") || domain.endsWith(".gov.ae")) {
    return 20;
  }
  if (domain.endsWith(".edu") || domain.endsWith(".ac.uk")) {
    return 15;
  }
  if (domain.endsWith(".org")) {
    return 10;
  }
  return 5;
}

function detectLanguage(text: string): string | null {
  const arabicPattern = /[\u0600-\u06FF]/;
  const chinesePattern = /[\u4e00-\u9fff]/;
  
  if (arabicPattern.test(text)) return "ar";
  if (chinesePattern.test(text)) return "zh";
  
  return null;
}

function calculateScore(
  feed: Parser.Output<any>,
  targetLanguage: string,
  domain: string
): ScoreBreakdown {
  let languageMatch = 0;
  let freshness = 0;
  let itemCount = 0;
  let domainQuality = scoreDomainQuality(domain);

  const feedLang = (feed as any).language || (feed as any)["dc:language"] || "";
  const feedLangLower = feedLang.toLowerCase();
  const titleText = feed.title || "";
  
  if (feedLangLower.startsWith(targetLanguage)) {
    languageMatch = 25;
  } else {
    const detectedLang = detectLanguage(titleText);
    if (detectedLang === targetLanguage) {
      languageMatch = 20;
    } else if (targetLanguage === "en" && !feedLangLower) {
      languageMatch = 10;
    }
  }

  const items = feed.items || [];
  if (items.length >= 10) {
    itemCount = 20;
  } else if (items.length >= 5) {
    itemCount = 15;
  } else if (items.length >= 1) {
    itemCount = 10;
  }

  const now = new Date();
  const freshnessThreshold = new Date(now.getTime() - FRESHNESS_DAYS * 24 * 60 * 60 * 1000);
  
  for (const item of items) {
    const pubDate = item.pubDate || item.isoDate;
    if (pubDate) {
      const itemDate = new Date(pubDate);
      if (!isNaN(itemDate.getTime()) && itemDate > freshnessThreshold) {
        freshness = 25;
        break;
      }
    }
  }

  const total = languageMatch + freshness + itemCount + domainQuality;

  return {
    languageMatch,
    freshness,
    itemCount,
    domainQuality,
    total,
  };
}

async function validateAndScoreFeed(
  feedUrl: string,
  targetLanguage: string,
  logs: DiscoveryLog[]
): Promise<{
  valid: boolean;
  feed?: Parser.Output<any>;
  score?: ScoreBreakdown;
  httpStatus?: number;
  error?: string;
}> {
  try {
    const response = await fetchFeed(feedUrl);
    
    if (!response) {
      return { valid: false, error: "Failed to fetch feed" };
    }

    if (response.status >= 400) {
      return { valid: false, httpStatus: response.status, error: `HTTP ${response.status}` };
    }

    if (!isValidXML(response.xml)) {
      return { valid: false, httpStatus: response.status, error: "Not valid RSS/Atom XML" };
    }

    const feed = await parser.parseString(response.xml);
    const domain = getDomainFromUrl(feedUrl);
    const score = calculateScore(feed, targetLanguage, domain);

    addLog(logs, "info", `Validated feed: ${feedUrl} (score: ${score.total})`);

    return {
      valid: true,
      feed,
      score,
      httpStatus: response.status,
    };
  } catch (err: any) {
    return { valid: false, error: err.message || "Parse error" };
  }
}

async function discoverFeedsFromDomain(
  domainUrl: string,
  logs: DiscoveryLog[]
): Promise<string[]> {
  const candidates: string[] = [];
  
  try {
    const baseUrl = domainUrl.startsWith("http") ? domainUrl : `https://${domainUrl}`;
    
    const pageResult = await fetchPage(baseUrl);
    if (pageResult?.html) {
      const linkFeeds = extractFeedLinksFromHTML(pageResult.html, baseUrl);
      candidates.push(...linkFeeds);
      if (linkFeeds.length > 0) {
        addLog(logs, "info", `Found ${linkFeeds.length} feed links in HTML of ${domainUrl}`);
      }
    }

    for (const path of COMMON_FEED_PATHS.slice(0, 5)) {
      try {
        const feedUrl = new URL(path, baseUrl).toString();
        if (!candidates.includes(feedUrl)) {
          candidates.push(feedUrl);
        }
      } catch {}
    }
  } catch (err: any) {
    addLog(logs, "warn", `Error discovering feeds from ${domainUrl}: ${err.message}`);
  }

  return candidates.slice(0, MAX_CANDIDATES_PER_DOMAIN * 2);
}

function generateSearchDomains(goal: ContentGoal): string[] {
  const domains: string[] = [];
  const categories = goal.categories || [];
  const topics = goal.topics || [];
  const country = goal.country?.toLowerCase() || "";
  const language = goal.language || "en";

  const majorNewsSources: Record<string, string[]> = {
    "us": ["reuters.com", "apnews.com", "npr.org"],
    "uk": ["bbc.com", "theguardian.com", "reuters.com"],
    "ae": ["gulfnews.com", "khaleejtimes.com", "thenationalnews.com"],
    "sa": ["arabnews.com", "saudigazette.com.sa"],
    "eg": ["egypttoday.com", "ahram.org.eg"],
    "": ["reuters.com", "apnews.com"],
  };

  const countryDomains = majorNewsSources[country] || majorNewsSources[""];
  domains.push(...countryDomains);

  if (language === "ar") {
    domains.push("aljazeera.net", "alarabiya.net", "skynewsarabia.com");
  }

  const categoryDomains: Record<string, string[]> = {
    "technology": ["techcrunch.com", "wired.com", "theverge.com", "arstechnica.com"],
    "business": ["bloomberg.com", "ft.com", "wsj.com"],
    "science": ["sciencedaily.com", "nature.com", "phys.org"],
    "health": ["webmd.com", "medicalnewstoday.com", "healthline.com"],
    "sports": ["espn.com", "sports.yahoo.com"],
    "entertainment": ["variety.com", "deadline.com", "ew.com"],
  };

  for (const cat of categories) {
    const catLower = cat.toLowerCase();
    if (categoryDomains[catLower]) {
      domains.push(...categoryDomains[catLower]);
    }
  }

  return [...new Set(domains)].slice(0, 15);
}

export async function runDiscoveryJob(jobId: string): Promise<void> {
  const logs: DiscoveryLog[] = [];
  
  const job = await storage.getDiscoveryJob(jobId);
  if (!job) {
    console.error(`[Discovery] Job not found: ${jobId}`);
    return;
  }

  const goal = await storage.getContentGoal(job.contentGoalId);
  if (!goal) {
    await storage.updateDiscoveryJob(jobId, {
      status: "failed",
      errorJson: { message: "Content goal not found" },
      completedAt: new Date(),
    });
    return;
  }

  addLog(logs, "info", `Starting discovery job ${jobId} for goal: ${goal.name}`);
  
  await storage.updateDiscoveryJob(jobId, {
    status: "running",
    startedAt: new Date(),
    logsJson: logs,
  });

  try {
    const targetLanguage = goal.language || "en";
    const domains = generateSearchDomains(goal);
    
    addLog(logs, "info", `Generated ${domains.length} candidate domains to search`);

    const allCandidates: string[] = [];
    
    for (const domain of domains) {
      try {
        const feedUrls = await discoverFeedsFromDomain(domain, logs);
        allCandidates.push(...feedUrls);
      } catch (err: any) {
        addLog(logs, "warn", `Failed to discover from ${domain}: ${err.message}`);
      }
    }

    addLog(logs, "info", `Found ${allCandidates.length} total candidate feed URLs`);
    
    await storage.updateDiscoveryJob(jobId, {
      candidatesFound: allCandidates.length,
      logsJson: logs,
    });

    const uniqueCandidates = [...new Set(allCandidates)];
    let validatedCount = 0;

    for (const feedUrl of uniqueCandidates) {
      try {
        const result = await validateAndScoreFeed(feedUrl, targetLanguage, logs);
        
        const domain = getDomainFromUrl(feedUrl);
        const lastItem = result.feed?.items?.[0];
        const lastPublishDate = lastItem?.pubDate || lastItem?.isoDate;

        const discoveredSource: InsertDiscoveredSource = {
          workspaceId: job.workspaceId,
          discoveryJobId: jobId,
          feedUrl,
          feedTitle: result.feed?.title || null,
          siteUrl: result.feed?.link || null,
          domain,
          description: result.feed?.description || null,
          language: (result.feed as any)?.language || null,
          lastPublishDate: lastPublishDate ? new Date(lastPublishDate) : null,
          itemCount: result.feed?.items?.length || 0,
          score: result.score?.total || 0,
          scoreBreakdown: result.score || {},
          status: result.valid ? "valid" : "invalid",
          validationError: result.error || null,
          httpStatus: result.httpStatus || null,
        };

        await storage.createDiscoveredSource(discoveredSource);
        
        if (result.valid) {
          validatedCount++;
        }
      } catch (err: any) {
        addLog(logs, "warn", `Error processing ${feedUrl}: ${err.message}`);
      }
    }

    addLog(logs, "info", `Discovery complete: ${validatedCount} valid feeds found`);

    await storage.updateDiscoveryJob(jobId, {
      status: "completed",
      validatedCount,
      completedAt: new Date(),
      logsJson: logs,
    });
  } catch (err: any) {
    addLog(logs, "error", `Discovery job failed: ${err.message}`);
    
    await storage.updateDiscoveryJob(jobId, {
      status: "failed",
      errorJson: { message: err.message },
      completedAt: new Date(),
      logsJson: logs,
    });
  }
}

export async function convertDiscoveredSourceToSource(
  discoveredSourceId: string,
  workspaceId: string
): Promise<{ success: boolean; sourceId?: string; error?: string }> {
  const discovered = await storage.getDiscoveredSource(discoveredSourceId);
  
  if (!discovered) {
    return { success: false, error: "Discovered source not found" };
  }

  if (discovered.status === "added" && discovered.convertedSourceId) {
    return { success: false, error: "Already converted to source" };
  }

  try {
    const source = await storage.createSource({
      workspaceId,
      name: discovered.feedTitle || discovered.domain || "Discovered Feed",
      type: "rss",
      feedUrl: discovered.feedUrl,
      description: discovered.description || undefined,
      language: discovered.language || "en",
      isActive: "true",
      fetchIntervalMinutes: 60,
    });

    await storage.updateDiscoveredSource(discoveredSourceId, {
      status: "added",
      convertedSourceId: source.id,
    });

    return { success: true, sourceId: source.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
