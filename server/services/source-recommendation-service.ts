import { storage } from "../storage";
import type { Source, ContentIntent } from "@shared/schema";

export interface SourceRecommendationRequest {
  topicQuery: string;
  contentType: ContentIntent;
  region?: string;
  countries?: string[];
  language?: string;
  workspaceId: string;
}

export interface RecommendedSource {
  sourceId: string;
  candidateId?: string;
  name: string;
  domain: string;
  country?: string;
  region?: string;
  language?: string;
  tier: 1 | 2 | 3;
  score: number;
  reasons: string[];
  isVerified: boolean;
  isExisting: boolean;
  isOfficial: boolean;
}

export interface SourceRecommendationResult {
  candidates: RecommendedSource[];
  totalCount: number;
  defaultEnabled: string[];
}

const GCC_COUNTRIES = ["AE", "SA", "QA", "KW", "BH", "OM"];
const MENA_REGIONS = ["gcc", "mena", "levant", "north_africa"];

const GLOBAL_NEWS_DOMAINS = new Set([
  "bbc.com", "bbc.co.uk", "reuters.com", "apnews.com", "cnn.com",
  "bloomberg.com", "ft.com", "wsj.com", "nytimes.com", "washingtonpost.com",
  "theguardian.com", "aljazeera.com", "france24.com", "dw.com", "economist.com",
]);

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function isCountryInGeo(
  sourceCountry: string | null | undefined,
  sourceRegion: string | null | undefined,
  topicRegion: string | undefined,
  topicCountries: string[] | undefined
): boolean {
  if (topicCountries && topicCountries.length > 0) {
    if (sourceCountry && topicCountries.includes(sourceCountry)) {
      return true;
    }
  }
  
  if (topicRegion) {
    if (sourceRegion === topicRegion) return true;
    if (topicRegion === "gcc" && sourceRegion === "mena") return true;
    if (topicRegion === "mena" && sourceRegion === "gcc") return true;
    if (topicRegion === "gcc" && sourceCountry && GCC_COUNTRIES.includes(sourceCountry)) return true;
  }
  
  return false;
}

function isLanguageCompatible(
  sourceLanguage: string | null | undefined,
  topicLanguage: string | undefined
): boolean {
  if (!topicLanguage) return true;
  if (!sourceLanguage) return topicLanguage === "en";
  return sourceLanguage === topicLanguage;
}

function computeTier(
  source: Source,
  request: SourceRecommendationRequest
): { tier: 1 | 2 | 3; reasons: string[] } {
  const reasons: string[] = [];
  const domain = source.domain || extractDomain(source.feedUrl);
  const isOfficial = source.isOfficial === "true";
  const storedTier = source.tier;
  const inGeo = isCountryInGeo(source.country, source.region, request.region, request.countries);
  const langMatch = isLanguageCompatible(source.language, request.language);
  
  if (isOfficial && inGeo && langMatch) {
    reasons.push("Official national/regional media");
    if (source.country) reasons.push(`${source.country} outlet`);
    return { tier: 1, reasons };
  }
  
  if (isOfficial && langMatch) {
    reasons.push("Official media (different region)");
    return { tier: storedTier === 1 ? 2 : (storedTier as 1 | 2 | 3) || 2, reasons };
  }
  
  if (storedTier === 2 || (storedTier === 1 && !isOfficial)) {
    if (inGeo && langMatch) {
      reasons.push("Regional business/industry media");
      return { tier: 2, reasons };
    }
    reasons.push("Recognized source (different region)");
    return { tier: 3, reasons };
  }
  
  if (GLOBAL_NEWS_DOMAINS.has(domain)) {
    reasons.push("Global news outlet");
    return { tier: 3, reasons };
  }
  
  if (storedTier) {
    return { tier: storedTier as 1 | 2 | 3, reasons: ["Source tier from database"] };
  }
  
  const mediaTier = source.mediaTier;
  if (mediaTier === "tier_1") {
    reasons.push("Legacy tier 1 source");
    return { tier: inGeo ? 2 : 3, reasons };
  }
  if (mediaTier === "tier_2") {
    reasons.push("Legacy tier 2 source");
    return { tier: inGeo ? 2 : 3, reasons };
  }
  
  reasons.push("Other source");
  return { tier: 3, reasons };
}

function calculateScore(
  source: Source,
  tier: 1 | 2 | 3,
  request: SourceRecommendationRequest
): number {
  let score = 50;
  
  if (tier === 1) score += 40;
  else if (tier === 2) score += 20;
  
  if (source.isOfficial === "true") score += 10;
  
  if (request.language && source.language === request.language) score += 10;
  
  if (isCountryInGeo(source.country, source.region, request.region, request.countries)) {
    score += 15;
    if (request.countries?.includes(source.country || "")) score += 5;
  }
  
  score = Math.max(0, Math.min(100, score));
  return score;
}

function deduplicateByDomain(sources: RecommendedSource[]): RecommendedSource[] {
  const seen = new Map<string, RecommendedSource>();
  
  for (const source of sources) {
    const key = `${source.domain}:${source.language || "en"}`;
    const existing = seen.get(key);
    
    if (!existing || source.tier < existing.tier || 
        (source.tier === existing.tier && source.score > existing.score)) {
      seen.set(key, source);
    }
  }
  
  return Array.from(seen.values());
}

export async function getSourceRecommendations(
  request: SourceRecommendationRequest
): Promise<SourceRecommendationResult> {
  const allSources = await storage.getSources(request.workspaceId);
  
  const activeSources = allSources.filter(s => s.isActive === "true");
  
  const candidates: RecommendedSource[] = activeSources.map(source => {
    const domain = source.domain || extractDomain(source.feedUrl);
    const { tier, reasons } = computeTier(source, request);
    const score = calculateScore(source, tier, request);
    
    return {
      sourceId: source.id,
      name: source.name,
      domain,
      country: source.country || undefined,
      region: source.region || undefined,
      language: source.language || "en",
      tier,
      score,
      reasons,
      isVerified: true,
      isExisting: true,
      isOfficial: source.isOfficial === "true",
    };
  });

  const deduplicated = deduplicateByDomain(candidates);
  
  deduplicated.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return b.score - a.score;
  });

  const defaultEnabled = getDefaultEnabledSources(deduplicated);

  return {
    candidates: deduplicated,
    totalCount: deduplicated.length,
    defaultEnabled,
  };
}

export function getDefaultEnabledSources(candidates: RecommendedSource[]): string[] {
  const tier1Sources = candidates
    .filter(c => c.tier === 1 && c.sourceId)
    .slice(0, 5)
    .map(c => c.sourceId);
  
  if (tier1Sources.length >= 3) {
    return tier1Sources;
  }

  const tier2Sources = candidates
    .filter(c => c.tier === 2 && c.sourceId)
    .slice(0, 5 - tier1Sources.length)
    .map(c => c.sourceId);

  return [...tier1Sources, ...tier2Sources];
}
