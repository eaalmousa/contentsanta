import type { Topic } from "@shared/schema";

// Shared relevance scoring constants
export const MIN_RELEVANCE_SCORE = 0.15;
export const TIER1_SOURCE_BOOST = 0.05;

// Common stop-words that should not be used for topic matching
// These are truly generic terms that appear in all articles regardless of topic
// NOTE: Domain-specific terms like "property", "market", "investment" are NOT here
// because they have meaning in context (e.g., "real estate market" vs "stock market")
const STOP_WORDS = new Set([
  // English grammatical stop-words
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "as", "into", "through", "during", "before",
  "after", "above", "below", "between", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how", "all", "each", "few",
  "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own",
  "same", "so", "than", "too", "very", "just", "also", "now", "even", "still",
  "already", "yet", "ever", "never", "always", "often", "sometimes", "usually",
  "this", "that", "these", "those", "what", "which", "who", "whom", "whose",
  "it", "its", "itself", "he", "him", "his", "himself", "she", "her", "hers",
  "herself", "they", "them", "their", "theirs", "themselves", "we", "us", "our",
  "ours", "ourselves", "you", "your", "yours", "yourself", "yourselves", "my",
  "me", "i", "up", "down", "out", "off", "over", "about", "any", "both",
  
  // News-specific generic terms (appear in headlines regardless of topic)
  "news", "new", "says", "said", "according", "announced", "report", "reports",
  "reported", "latest", "today", "yesterday", "tomorrow", "week", "month", "year",
  "million", "billion", "percent", "people", "first", "last", "next", "previous",
  "official", "officials", "world", "global", "international", "national", "local",
  "regional", "country", "countries", "state", "states", "city", "cities",
  "major", "key", "top", "big", "small", "large", "high", "low",
  "launched", "signed", "approved", "rise", "fall", "growth", "increase", "decrease",
  
  // Arabic stop-words
  "في", "من", "إلى", "على", "عن", "مع", "هذا", "هذه", "التي", "الذي", "أن", "كان",
  "بعد", "قبل", "خلال", "حول", "بين", "أو", "ثم", "لكن", "وقد", "كما", "أيضا",
]);

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
  // Food & Agriculture (NOT real estate)
  "infant formula", "baby formula", "recall", "food safety", "food recall",
  "egg prices", "food prices", "grocery", "groceries", "supermarket", "produce",
  "agriculture", "farming", "crop", "harvest", "livestock", "poultry",
  
  // Energy & Resources (NOT real estate)
  "gas deal", "lng deal", "natural gas", "petroleum deal", "crude oil", "oil prices",
  "oil field", "gas field", "drilling", "refinery", "pipeline",
  
  // Transportation (NOT real estate)
  "airline deal", "flight", "aviation deal", "aircraft order", "airline",
  "airport", "cargo", "shipping", "logistics", "freight",
  
  // Healthcare & Pharma (NOT real estate)
  "pharmaceutical", "medicine", "drug approval", "vaccine",
  "hospital", "clinic", "medical", "healthcare", "patient",
  
  // Technology & Telecom (NOT real estate unless specifically PropTech)
  "telecom deal", "5g network", "network deal",
  "cryptocurrency", "bitcoin", "fintech",
  "software", "startup tech", "app launch", "cybersecurity",
  
  // Military & Defense (NOT real estate)
  "military", "defense contract", "armament", "weapons", "army", "navy",
  "military base", "defense", "security forces", "armed forces",
  
  // Politics & Diplomacy (NOT real estate unless policy directly affects real estate)
  "ceasefire", "protest", "election", "political", "diplomatic",
  "sovereignty", "territorial", "border dispute", "sanctions",
  "embassy", "consulate", "foreign minister", "foreign relations",
  "parliament", "legislation", "bill passed", "referendum",
  
  // Sports & Entertainment (NOT real estate)
  "football", "cricket", "tennis", "golf tournament", "sports",
  "movie", "film", "concert", "festival", "entertainment",
  "marathon", "championship", "tournament", "match", "athlete",
  
  // Retail & Consumer Goods (NOT real estate)
  "fashion", "clothing", "apparel", "retail chain", "store opening",
  "restaurant", "cuisine", "chef", "menu", "dining",
  
  // Finance (NOT real estate unless REIT/property investment)
  "insurance claims", "insurance policy", "life insurance",
  "stock market", "equity", "trading", "forex", "currency",
  
  // Education (NOT real estate)
  "university", "school", "college", "education", "students",
  "examination", "curriculum", "academic",
  
  // Automotive (NOT real estate)
  "car sales", "vehicle sales", "automotive", "automobile",
  "showroom", "car dealer", "auto parts",
  
  // Tourism & Travel (NOT real estate unless hospitality development)
  "travel visa", "holiday", "tourism", "tourist", "vacation",
  "beach resort", "theme park", "attraction",
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
  // Filter out words that are too short or are stop-words
  const words = normalized.split(' ')
    .filter(w => w.length > 2)
    .filter(w => !STOP_WORDS.has(w));
  
  const phrases: string[] = [];
  
  // Generate 2-word and 3-word phrases from non-stop-words
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
  let highWeightMatches = 0;
  let mediumWeightMatches = 0;
  
  // Match query keywords (from topic query, already filtered for stop-words)
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
  
  // High-weight domain vocabulary (strong real estate indicators)
  for (const term of REAL_ESTATE_VOCABULARY_HIGH_WEIGHT) {
    if (title.includes(term)) {
      score += 0.20;
      highWeightMatches++;
      if (!matchedTerms.includes(term)) matchedTerms.push(term);
    } else if (summary.includes(term)) {
      score += 0.12;
      highWeightMatches++;
      if (!matchedTerms.includes(term)) matchedTerms.push(term);
    } else if (content.includes(term)) {
      score += 0.05;
      highWeightMatches++;
      if (!matchedTerms.includes(term)) matchedTerms.push(term);
    }
  }
  
  // Medium-weight vocabulary (require context to be meaningful)
  for (const term of REAL_ESTATE_VOCABULARY_MEDIUM_WEIGHT) {
    if (title.includes(term)) {
      score += 0.08;  // Reduced from 0.10 - single medium terms less impactful
      mediumWeightMatches++;
      if (!matchedTerms.includes(term)) matchedTerms.push(term);
    } else if (summary.includes(term)) {
      score += 0.04;  // Reduced from 0.05
      mediumWeightMatches++;
      if (!matchedTerms.includes(term)) matchedTerms.push(term);
    } else if (content.includes(term)) {
      score += 0.02;  // Reduced from 0.05
      mediumWeightMatches++;
      if (!matchedTerms.includes(term)) matchedTerms.push(term);
    }
  }
  
  // Negative keywords (off-topic indicators)
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
  
  // Relevance requires EITHER:
  // 1. At least one high-weight term (strong domain signal), OR
  // 2. At least two medium-weight terms (combined context signal)
  // Single medium-weight terms alone (like "market", "prices") are not enough
  const hasStrongSignal = highWeightMatches >= 1 || mediumWeightMatches >= 2;
  const isRelevant = score >= MIN_RELEVANCE_SCORE && matchedTerms.length >= 1 && hasStrongSignal;
  
  let reason: string;
  if (isRelevant) {
    reason = `Matched: ${matchedTerms.slice(0, 5).join(', ')}`;
  } else if (negativeMatches.length > 0) {
    reason = `Off-topic: ${negativeMatches.slice(0, 3).join(', ')}`;
  } else if (matchedTerms.length >= 1 && !hasStrongSignal) {
    reason = `Weak signal: ${matchedTerms.slice(0, 3).join(', ')} (need more context)`;
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
  const { minScore = MIN_RELEVANCE_SCORE, maxItems = 50, logResults = true } = options;
  
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
