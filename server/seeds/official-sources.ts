import { db } from "../db";
import { sources } from "@shared/schema";
import { sql } from "drizzle-orm";

interface OfficialSource {
  name: string;
  domain: string;
  feedUrl: string;
  language: "ar" | "en";
  region: string;
  country: string;
  tier: 1 | 2;
  isOfficial: boolean;
  description?: string;
}

const OFFICIAL_UAE_SOURCES: OfficialSource[] = [
  // UAE Arabic Official Media (Tier 1)
  {
    name: "البيان",
    domain: "albayan.ae",
    feedUrl: "https://www.albayan.ae/rss/default.xml",
    language: "ar",
    region: "gcc",
    country: "AE",
    tier: 1,
    isOfficial: true,
    description: "Al Bayan - UAE official Arabic newspaper",
  },
  {
    name: "الاتحاد",
    domain: "alittihad.ae",
    feedUrl: "https://www.alittihad.ae/rss/default.xml",
    language: "ar",
    region: "gcc",
    country: "AE",
    tier: 1,
    isOfficial: true,
    description: "Al Ittihad - UAE official Arabic newspaper",
  },
  {
    name: "الإمارات اليوم",
    domain: "emaratalyoum.com",
    feedUrl: "https://www.emaratalyoum.com/rss/default.xml",
    language: "ar",
    region: "gcc",
    country: "AE",
    tier: 1,
    isOfficial: true,
    description: "Emarat Al Youm - UAE official Arabic newspaper",
  },
  {
    name: "وكالة أنباء الإمارات",
    domain: "wam.ae",
    feedUrl: "https://www.wam.ae/ar/rss/all.xml",
    language: "ar",
    region: "gcc",
    country: "AE",
    tier: 1,
    isOfficial: true,
    description: "WAM - Emirates News Agency (Arabic)",
  },
  // UAE English Official Media (Tier 1)
  {
    name: "The National",
    domain: "thenationalnews.com",
    feedUrl: "https://www.thenationalnews.com/rss",
    language: "en",
    region: "gcc",
    country: "AE",
    tier: 1,
    isOfficial: true,
    description: "The National - UAE's leading English newspaper",
  },
  {
    name: "WAM English",
    domain: "wam.ae",
    feedUrl: "https://www.wam.ae/en/rss/all.xml",
    language: "en",
    region: "gcc",
    country: "AE",
    tier: 1,
    isOfficial: true,
    description: "WAM - Emirates News Agency (English)",
  },
  {
    name: "Khaleej Times",
    domain: "khaleejtimes.com",
    feedUrl: "https://www.khaleejtimes.com/rss",
    language: "en",
    region: "gcc",
    country: "AE",
    tier: 1,
    isOfficial: true,
    description: "Khaleej Times - UAE English newspaper",
  },
  {
    name: "Gulf News",
    domain: "gulfnews.com",
    feedUrl: "https://gulfnews.com/rss/uae",
    language: "en",
    region: "gcc",
    country: "AE",
    tier: 1,
    isOfficial: true,
    description: "Gulf News - UAE English newspaper",
  },
];

const OFFICIAL_KSA_SOURCES: OfficialSource[] = [
  {
    name: "واس - وكالة الأنباء السعودية",
    domain: "spa.gov.sa",
    feedUrl: "https://www.spa.gov.sa/rss/ar/news.xml",
    language: "ar",
    region: "gcc",
    country: "SA",
    tier: 1,
    isOfficial: true,
    description: "Saudi Press Agency (Arabic)",
  },
  {
    name: "Arab News",
    domain: "arabnews.com",
    feedUrl: "https://www.arabnews.com/rss.xml",
    language: "en",
    region: "gcc",
    country: "SA",
    tier: 1,
    isOfficial: true,
    description: "Arab News - Saudi Arabia English newspaper",
  },
  {
    name: "الرياض",
    domain: "alriyadh.com",
    feedUrl: "https://www.alriyadh.com/rss.xml",
    language: "ar",
    region: "gcc",
    country: "SA",
    tier: 1,
    isOfficial: true,
    description: "Al Riyadh - Saudi Arabia official newspaper",
  },
];

const OFFICIAL_QATAR_SOURCES: OfficialSource[] = [
  {
    name: "Qatar News Agency",
    domain: "qna.org.qa",
    feedUrl: "https://www.qna.org.qa/en/rss.xml",
    language: "en",
    region: "gcc",
    country: "QA",
    tier: 1,
    isOfficial: true,
    description: "Qatar News Agency (English)",
  },
  {
    name: "The Peninsula",
    domain: "thepeninsulaqatar.com",
    feedUrl: "https://thepeninsulaqatar.com/rss.xml",
    language: "en",
    region: "gcc",
    country: "QA",
    tier: 1,
    isOfficial: true,
    description: "The Peninsula - Qatar English newspaper",
  },
];

const OFFICIAL_KUWAIT_SOURCES: OfficialSource[] = [
  {
    name: "KUNA - Kuwait News Agency",
    domain: "kuna.net.kw",
    feedUrl: "https://www.kuna.net.kw/rss/english.xml",
    language: "en",
    region: "gcc",
    country: "KW",
    tier: 1,
    isOfficial: true,
    description: "Kuwait News Agency (English)",
  },
  {
    name: "Kuwait Times",
    domain: "kuwaittimes.com",
    feedUrl: "https://www.kuwaittimes.com/feed/",
    language: "en",
    region: "gcc",
    country: "KW",
    tier: 1,
    isOfficial: true,
    description: "Kuwait Times - English newspaper",
  },
];

const OFFICIAL_BAHRAIN_SOURCES: OfficialSource[] = [
  {
    name: "BNA - Bahrain News Agency",
    domain: "bna.bh",
    feedUrl: "https://www.bna.bh/rss/en/news.xml",
    language: "en",
    region: "gcc",
    country: "BH",
    tier: 1,
    isOfficial: true,
    description: "Bahrain News Agency (English)",
  },
  {
    name: "Gulf Daily News",
    domain: "gdnonline.com",
    feedUrl: "https://www.gdnonline.com/rss.xml",
    language: "en",
    region: "gcc",
    country: "BH",
    tier: 1,
    isOfficial: true,
    description: "Gulf Daily News - Bahrain newspaper",
  },
];

const OFFICIAL_OMAN_SOURCES: OfficialSource[] = [
  {
    name: "ONA - Oman News Agency",
    domain: "omannews.gov.om",
    feedUrl: "https://omannews.gov.om/rss/english.xml",
    language: "en",
    region: "gcc",
    country: "OM",
    tier: 1,
    isOfficial: true,
    description: "Oman News Agency (English)",
  },
  {
    name: "Times of Oman",
    domain: "timesofoman.com",
    feedUrl: "https://timesofoman.com/rss.xml",
    language: "en",
    region: "gcc",
    country: "OM",
    tier: 1,
    isOfficial: true,
    description: "Times of Oman - English newspaper",
  },
];

const TIER_2_REGIONAL_BUSINESS: OfficialSource[] = [
  {
    name: "Zawya",
    domain: "zawya.com",
    feedUrl: "https://www.zawya.com/mena/en/rss.xml",
    language: "en",
    region: "mena",
    country: "AE",
    tier: 2,
    isOfficial: false,
    description: "Zawya - MENA business and financial news",
  },
  {
    name: "Arabian Business",
    domain: "arabianbusiness.com",
    feedUrl: "https://www.arabianbusiness.com/rss.xml",
    language: "en",
    region: "mena",
    country: "AE",
    tier: 2,
    isOfficial: false,
    description: "Arabian Business - Regional business news",
  },
  {
    name: "Gulf Business",
    domain: "gulfbusiness.com",
    feedUrl: "https://gulfbusiness.com/feed/",
    language: "en",
    region: "gcc",
    country: "AE",
    tier: 2,
    isOfficial: false,
    description: "Gulf Business - GCC business magazine",
  },
  {
    name: "MEED",
    domain: "meed.com",
    feedUrl: "https://www.meed.com/rss.xml",
    language: "en",
    region: "mena",
    country: "AE",
    tier: 2,
    isOfficial: false,
    description: "MEED - Middle East business intelligence",
  },
  {
    name: "Construction Week",
    domain: "constructionweekonline.com",
    feedUrl: "https://www.constructionweekonline.com/rss.xml",
    language: "en",
    region: "mena",
    country: "AE",
    tier: 2,
    isOfficial: false,
    description: "Construction Week - MENA construction news",
  },
  {
    name: "Property Finder",
    domain: "propertyfinder.ae",
    feedUrl: "https://www.propertyfinder.ae/blog/feed/",
    language: "en",
    region: "gcc",
    country: "AE",
    tier: 2,
    isOfficial: false,
    description: "Property Finder - UAE real estate market insights",
  },
];

const ALL_OFFICIAL_SOURCES = [
  ...OFFICIAL_UAE_SOURCES,
  ...OFFICIAL_KSA_SOURCES,
  ...OFFICIAL_QATAR_SOURCES,
  ...OFFICIAL_KUWAIT_SOURCES,
  ...OFFICIAL_BAHRAIN_SOURCES,
  ...OFFICIAL_OMAN_SOURCES,
  ...TIER_2_REGIONAL_BUSINESS,
];

export async function seedOfficialSources(workspaceId: string): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;

  for (const source of ALL_OFFICIAL_SOURCES) {
    try {
      const existing = await db.query.sources.findFirst({
        where: (s, { eq, and }) => and(
          eq(s.workspaceId, workspaceId),
          eq(s.domain, source.domain),
          eq(s.language, source.language)
        ),
      });

      if (existing) {
        skipped++;
        continue;
      }

      await db.insert(sources).values({
        workspaceId,
        name: source.name,
        domain: source.domain,
        feedUrl: source.feedUrl,
        type: "rss",
        language: source.language,
        region: source.region,
        country: source.country,
        tier: source.tier,
        isOfficial: source.isOfficial ? "true" : "false",
        mediaTier: source.tier === 1 ? "tier_1" : source.tier === 2 ? "tier_2" : "tier_3",
        description: source.description,
        isActive: "true",
      });
      inserted++;
    } catch (error) {
      console.error(`Failed to seed source ${source.name}:`, error);
    }
  }

  return { inserted, skipped };
}

export function getOfficialSourcesForRegion(region: string): OfficialSource[] {
  return ALL_OFFICIAL_SOURCES.filter(s => 
    s.region === region || s.region === "mena" && region === "gcc"
  );
}

export function getOfficialTier1Domains(): string[] {
  return ALL_OFFICIAL_SOURCES
    .filter(s => s.tier === 1 && s.isOfficial)
    .map(s => s.domain);
}
