import type { Topic } from "@shared/schema";

interface RelevanceItem {
  title: string | null;
  excerpt: string | null;
  rawContent: string | null;
}

const REAL_ESTATE_VOCABULARY_HIGH_WEIGHT = [
  "real estate", "property development", "housing prices", "commercial real estate",
  "property transactions", "real estate investment", "real estate market",
  "home loan", "mortgage rates", "property prices", "housing market",
  "residential property", "office space", "retail space", "industrial property",
  "freehold property", "leasehold property", "off-plan property", "off-plan sales",
  "property developer", "real estate developer", "property investment",
  "luxury property", "affordable housing", "property sector", "housing sector",
  "property sales", "home sales", "apartment sales", "villa sales",
  "rent increase", "rental rates", "rental market", "lease agreement",
  "land plot", "land sale", "land auction", "land prices",
  "property launch", "project launch", "handover date", "completion date",
  "rera", "dld", "dubai land department", "land department",
  "emaar", "aldar", "nakheel", "damac", "meraas", "sobha", "deyaar", "azizi",
  "عقار", "عقارات", "سوق العقارات", "تطوير عقاري",
];

const REAL_ESTATE_VOCABULARY_MEDIUM_WEIGHT = [
  "property", "properties", "housing", "homes", "mortgage",
  "rent", "rental", "rentals", "lease", "leasing", "tenants",
  "residential", "warehouse", "industrial park",
  "construction project", "development project", "masterplan",
  "villa", "villas", "apartment", "apartments", "penthouse", "townhouse",
  "condo", "condominium", "flat", "flats",
  "realtor", "broker", "brokerage", "realty",
  "sqft", "square feet", "sqm", "square meters",
  "bedroom", "bhk", "studio apartment",
  "developer", "developers", "tower", "towers",
  "plot", "plots", "zoning", "permit", "permits",
  "landlord", "landlords", "occupancy", "vacancy",
  "hotel project", "resort development", "mall development",
  "إيجار", "شقة", "فيلا", "بناء", "مشروع",
];

const NEGATIVE_KEYWORDS = [
  "infant formula", "baby formula", "recall", "food safety", "food recall",
  "gas deal", "lng deal", "natural gas", "petroleum deal", "crude oil", "oil prices",
  "airline deal", "flight", "aviation deal", "aircraft order", "airline",
  "pharmaceutical", "medicine", "drug approval", "vaccine",
  "telecom deal", "5g network", "network deal",
  "military", "defense contract", "armament", "weapons",
  "football", "cricket", "tennis", "golf tournament", "sports",
  "movie", "film", "concert", "festival", "entertainment",
  "fashion", "clothing", "apparel",
  "restaurant", "cuisine", "chef",
  "cryptocurrency", "bitcoin", "fintech",
  "insurance claims",
  "hospital", "clinic", "medical",
  "university", "school", "college",
  "software", "startup tech", "app launch",
  "car sales", "vehicle sales", "automotive",
  "travel visa", "holiday", "tourism",
  "ceasefire", "protest", "election", "political", "military",
  "marathon", "championship", "tournament", "match",
];

export interface RelevanceResult {
  score: number;
  matchedTerms: string[];
  negativeMatches: string[];
  isRelevant: boolean;
  reason: string;
}

function normalizeText(text: string): string {
  return text.toLowerCase()
    .replace(/[^\w\sأ-ي]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractQueryKeywords(query: string): string[] {
  const normalized = normalizeText(query);
  const words = normalized.split(' ').filter(w => w.length > 2);
  
  const phrases: string[] = [];
  const queryLower = query.toLowerCase();
  
  for (let i = 0; i < words.length - 1; i++) {
    phrases.push(words[i] + ' ' + words[i + 1]);
  }
  for (let i = 0; i < words.length - 2; i++) {
    phrases.push(words[i] + ' ' + words[i + 1] + ' ' + words[i + 2]);
  }
  
  return [...words, ...phrases];
}

export function calculateTopicRelevance(
  item: RelevanceItem,
  topic: Pick<Topic, 'query' | 'name'>
): RelevanceResult {
  const title = normalizeText(item.title || '');
  const summary = normalizeText(item.excerpt || '');
  const content = normalizeText(item.rawContent || '');
  const combinedText = `${title} ${summary} ${content}`;
  
  const topicQuery = topic.query || topic.name || '';
  const queryKeywords = extractQueryKeywords(topicQuery);
  
  let score = 0;
  const matchedTerms: string[] = [];
  const negativeMatches: string[] = [];
  
  for (const keyword of queryKeywords) {
    if (title.includes(keyword)) {
      score += 0.15;
      if (!matchedTerms.includes(keyword)) matchedTerms.push(keyword);
    }
    if (summary.includes(keyword)) {
      score += 0.08;
      if (!matchedTerms.includes(keyword)) matchedTerms.push(keyword);
    }
    if (content.includes(keyword)) {
      score += 0.03;
      if (!matchedTerms.includes(keyword)) matchedTerms.push(keyword);
    }
  }
  
  for (const term of REAL_ESTATE_VOCABULARY_HIGH_WEIGHT) {
    if (title.includes(term)) {
      score += 0.20;
      if (!matchedTerms.includes(term)) matchedTerms.push(term);
    } else if (summary.includes(term)) {
      score += 0.12;
      if (!matchedTerms.includes(term)) matchedTerms.push(term);
    } else if (content.includes(term)) {
      score += 0.04;
      if (!matchedTerms.includes(term)) matchedTerms.push(term);
    }
  }
  
  for (const term of REAL_ESTATE_VOCABULARY_MEDIUM_WEIGHT) {
    if (title.includes(term)) {
      score += 0.10;
      if (!matchedTerms.includes(term)) matchedTerms.push(term);
    } else if (summary.includes(term)) {
      score += 0.05;
      if (!matchedTerms.includes(term)) matchedTerms.push(term);
    } else if (content.includes(term)) {
      score += 0.02;
      if (!matchedTerms.includes(term)) matchedTerms.push(term);
    }
  }
  
  for (const term of NEGATIVE_KEYWORDS) {
    if (title.includes(term)) {
      score -= 0.25;
      negativeMatches.push(term);
    } else if (combinedText.includes(term)) {
      score -= 0.1;
      if (!negativeMatches.includes(term)) negativeMatches.push(term);
    }
  }
  
  score = Math.max(0, Math.min(1, score));
  
  const isRelevant = score >= 0.20 && matchedTerms.length >= 1;
  
  let reason: string;
  if (isRelevant) {
    reason = `Matched: ${matchedTerms.slice(0, 5).join(', ')}`;
  } else if (negativeMatches.length > 0) {
    reason = `Off-topic: ${negativeMatches.slice(0, 3).join(', ')}`;
  } else {
    reason = 'No relevant keywords found';
  }
  
  return {
    score,
    matchedTerms,
    negativeMatches,
    isRelevant,
    reason,
  };
}

export function filterItemsByRelevance<T extends RelevanceItem>(
  items: T[],
  topic: Pick<Topic, 'query' | 'name'>,
  options: {
    minScore?: number;
    maxItems?: number;
    logResults?: boolean;
  } = {}
): { relevantItems: T[]; stats: { total: number; accepted: number; rejected: number } } {
  const { minScore = 0.20, maxItems = 50, logResults = true } = options;
  
  const scoredItems = items.map(item => ({
    item,
    result: calculateTopicRelevance(item, topic),
  }));
  
  const relevantItems = scoredItems
    .filter(({ result }) => result.isRelevant && result.score >= minScore)
    .sort((a, b) => b.result.score - a.result.score)
    .slice(0, maxItems)
    .map(({ item }) => item);
  
  const stats = {
    total: items.length,
    accepted: relevantItems.length,
    rejected: items.length - relevantItems.length,
  };
  
  if (logResults) {
    console.log(`[Relevance] Topic: "${topic.name || topic.query}"`);
    console.log(`[Relevance] Total items: ${stats.total}, Accepted: ${stats.accepted}, Rejected: ${stats.rejected}`);
    
    if (stats.accepted > 0) {
      const topMatches = scoredItems
        .filter(({ result }) => result.isRelevant)
        .sort((a, b) => b.result.score - a.result.score)
        .slice(0, 3);
      
      console.log(`[Relevance] Top matches:`);
      for (const { item, result } of topMatches) {
        console.log(`[Relevance]   - "${item.title?.slice(0, 60)}..." (score: ${result.score.toFixed(2)}, matches: ${result.matchedTerms.slice(0, 3).join(', ')})`);
      }
    }
    
    if (stats.rejected > 0) {
      const rejectedSamples = scoredItems
        .filter(({ result }) => !result.isRelevant)
        .slice(0, 3);
      
      console.log(`[Relevance] Rejected samples:`);
      for (const { item, result } of rejectedSamples) {
        console.log(`[Relevance]   - "${item.title?.slice(0, 60)}..." (reason: ${result.reason})`);
      }
    }
  }
  
  return { relevantItems, stats };
}

export function isRealEstateRelated(text: string): boolean {
  const normalized = normalizeText(text);
  
  for (const term of REAL_ESTATE_VOCABULARY_HIGH_WEIGHT) {
    if (normalized.includes(term)) {
      return true;
    }
  }
  
  let matchCount = 0;
  for (const term of REAL_ESTATE_VOCABULARY_MEDIUM_WEIGHT) {
    if (normalized.includes(term)) {
      matchCount++;
      if (matchCount >= 2) return true;
    }
  }
  
  return false;
}

export function scoreStoryRelevance(
  story: { canonicalTitle: string | null; excerpt: string | null },
  topic: Pick<Topic, 'query' | 'name'>
): RelevanceResult {
  return calculateTopicRelevance(
    { title: story.canonicalTitle, excerpt: story.excerpt, rawContent: null },
    topic
  );
}
