import { storage } from "../storage";
import type { Source, DiscoveredSource, ContentIntent } from "@shared/schema";

export interface SourceRecommendationRequest {
  topicQuery: string;
  contentType: ContentIntent;
  region?: string;
  countries?: string[];
  language?: string;
  workspaceId: string;
}

export interface RecommendedSource {
  sourceId?: string;
  candidateId?: string;
  name: string;
  domain: string;
  country?: string;
  language?: string;
  tier: 1 | 2 | 3;
  score: number;
  reasons: string[];
  isVerified: boolean;
  isExisting: boolean;
}

export interface SourceRecommendationResult {
  candidates: RecommendedSource[];
  totalCount: number;
}

const TIER_1_DOMAINS = [
  "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "theguardian.com",
  "nytimes.com", "washingtonpost.com", "wsj.com", "ft.com", "bloomberg.com",
  "cnn.com", "aljazeera.com", "dw.com", "france24.com", "economist.com",
  "npr.org", "politico.com", "theatlantic.com", "newyorker.com", "time.com",
];

const TIER_2_DOMAINS = [
  "techcrunch.com", "wired.com", "arstechnica.com", "theverge.com", "engadget.com",
  "forbes.com", "businessinsider.com", "cnbc.com", "marketwatch.com",
  "axios.com", "vox.com", "buzzfeednews.com", "vice.com", "huffpost.com",
  "usatoday.com", "latimes.com", "chicagotribune.com", "bostonglobe.com",
];

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function getTierFromDomain(domain: string): 1 | 2 | 3 {
  const lowerDomain = domain.toLowerCase();
  if (TIER_1_DOMAINS.some(d => lowerDomain.includes(d))) return 1;
  if (TIER_2_DOMAINS.some(d => lowerDomain.includes(d))) return 2;
  return 3;
}

function getTierFromMediaTier(mediaTier?: string): 1 | 2 | 3 {
  if (mediaTier === "tier_1") return 1;
  if (mediaTier === "tier_2") return 2;
  return 3;
}

function calculateScore(
  source: { tier: 1 | 2 | 3; language?: string; region?: string },
  request: SourceRecommendationRequest
): { score: number; reasons: string[] } {
  let score = 50;
  const reasons: string[] = [];

  if (source.tier === 1) {
    score += 30;
    reasons.push("Tier 1 trusted outlet");
  } else if (source.tier === 2) {
    score += 15;
    reasons.push("Tier 2 recognized source");
  }

  if (request.language && source.language === request.language) {
    score += 10;
    reasons.push("Language match");
  }

  if (request.region && source.region === request.region) {
    score += 10;
    reasons.push("Region match");
  }

  score = Math.max(0, Math.min(100, score + Math.floor(Math.random() * 10)));

  if (reasons.length === 0) {
    reasons.push("Available source");
  }

  return { score, reasons };
}

export async function getSourceRecommendations(
  request: SourceRecommendationRequest
): Promise<SourceRecommendationResult> {
  const candidates: RecommendedSource[] = [];

  const existingSources = await storage.getSources(request.workspaceId);
  
  for (const source of existingSources) {
    if (source.isActive !== "true") continue;
    
    const domain = extractDomain(source.feedUrl);
    const tier = getTierFromMediaTier(source.mediaTier ?? undefined);
    const { score, reasons } = calculateScore(
      { tier, language: source.language ?? undefined, region: source.region ?? undefined },
      request
    );

    candidates.push({
      sourceId: source.id,
      name: source.name,
      domain,
      country: source.region ?? undefined,
      language: source.language || "en",
      tier,
      score,
      reasons,
      isVerified: true,
      isExisting: true,
    });
  }

  const discoveredSources = await storage.getDiscoveredSources(request.workspaceId);
  
  for (const ds of discoveredSources) {
    if (ds.status === "invalid") continue;
    
    const domain = ds.domain || extractDomain(ds.feedUrl);
    const tier = getTierFromDomain(domain);
    const { score, reasons } = calculateScore(
      { tier, language: ds.language ?? undefined, region: undefined },
      request
    );

    const alreadyExists = candidates.some(c => c.domain === domain);
    if (!alreadyExists) {
      candidates.push({
        candidateId: ds.id,
        name: ds.feedTitle || domain,
        domain,
        country: undefined,
        language: ds.language || "en",
        tier,
        score: Math.max(0, score - 10),
        reasons: [...reasons, ds.status === "valid" ? "RSS verified" : "Pending verification"],
        isVerified: ds.status === "valid",
        isExisting: false,
      });
    }
  }

  candidates.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return b.score - a.score;
  });

  return {
    candidates,
    totalCount: candidates.length,
  };
}

export function getDefaultEnabledSources(candidates: RecommendedSource[]): string[] {
  const tier1Sources = candidates.filter(c => c.tier === 1 && c.isExisting && c.sourceId);
  
  if (tier1Sources.length > 0) {
    return tier1Sources.map(c => c.sourceId!);
  }

  const tier2Sources = candidates.filter(c => c.tier === 2 && c.isExisting && c.sourceId);
  if (tier2Sources.length > 0) {
    return tier2Sources.slice(0, 5).map(c => c.sourceId!);
  }

  const anyExisting = candidates.filter(c => c.isExisting && c.sourceId);
  return anyExisting.slice(0, 3).map(c => c.sourceId!);
}
