import { db } from "../db";
import { sources } from "@shared/schema";
import { sql, eq } from "drizzle-orm";

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
  // UAE Arabic Official Media (Tier 1) - Using Google News RSS for reliable access
  {
    name: "البيان",
    domain: "albayan.ae",
    feedUrl: "https://news.google.com/rss/search?q=site:albayan.ae+when:3d&hl=ar&gl=AE&ceid=AE:ar",
    language: "ar",
    region: "gcc",
    country: "AE",
    tier: 1,
    isOfficial: true,
    description: "Al Bayan - UAE official Arabic newspaper (via Google News)",
  },
  {
    name: "الاتحاد",
    domain: "alittihad.ae",
    feedUrl: "https://news.google.com/rss/search?q=site:alittihad.ae+when:3d&hl=ar&gl=AE&ceid=AE:ar",
    language: "ar",
    region: "gcc",
    country: "AE",
    tier: 1,
    isOfficial: true,
    description: "Al Ittihad - UAE official Arabic newspaper (via Google News)",
  },
  {
    name: "الإمارات اليوم",
    domain: "emaratalyoum.com",
    feedUrl: "https://news.google.com/rss/search?q=site:emaratalyoum.com+when:3d&hl=ar&gl=AE&ceid=AE:ar",
    language: "ar",
    region: "gcc",
    country: "AE",
    tier: 1,
    isOfficial: true,
    description: "Emarat Al Youm - UAE official Arabic newspaper (via Google News)",
  },
  {
    name: "وكالة أنباء الإمارات",
    domain: "wam.ae",
    feedUrl: "https://news.google.com/rss/search?q=site:wam.ae+when:3d&hl=ar&gl=AE&ceid=AE:ar",
    language: "ar",
    region: "gcc",
    country: "AE",
    tier: 1,
    isOfficial: true,
    description: "WAM - Emirates News Agency Arabic (via Google News)",
  },
  // UAE English Official Media (Tier 1)
  {
    name: "The National",
    domain: "thenationalnews.com",
    feedUrl: "https://news.google.com/rss/search?q=site:thenationalnews.com+when:3d&hl=en&gl=AE&ceid=AE:en",
    language: "en",
    region: "gcc",
    country: "AE",
    tier: 1,
    isOfficial: true,
    description: "The National - UAE's leading English newspaper (via Google News)",
  },
  {
    name: "WAM English",
    domain: "wam.ae",
    feedUrl: "https://news.google.com/rss/search?q=site:wam.ae+when:3d&hl=en&gl=AE&ceid=AE:en",
    language: "en",
    region: "gcc",
    country: "AE",
    tier: 1,
    isOfficial: true,
    description: "WAM - Emirates News Agency English (via Google News)",
  },
  {
    name: "Gulf News",
    domain: "gulfnews.com",
    feedUrl: "https://news.google.com/rss/search?q=site:gulfnews.com+when:3d&hl=en&gl=AE&ceid=AE:en",
    language: "en",
    region: "gcc",
    country: "AE",
    tier: 1,
    isOfficial: false,
    description: "Gulf News - UAE leading English daily (via Google News)",
  },
];

// UAE Mainstream English Media (Tier 2 - NOT official government outlets)
const MAINSTREAM_UAE_SOURCES: OfficialSource[] = [
  {
    name: "Khaleej Times",
    domain: "khaleejtimes.com",
    feedUrl: "https://www.khaleejtimes.com/stories.rss",
    language: "en",
    region: "gcc",
    country: "AE",
    tier: 2,
    isOfficial: false,
    description: "Khaleej Times - UAE mainstream English newspaper",
  },
];

const OFFICIAL_KSA_SOURCES: OfficialSource[] = [
  {
    name: "واس - وكالة الأنباء السعودية",
    domain: "spa.gov.sa",
    feedUrl: "https://news.google.com/rss/search?q=site:spa.gov.sa+when:3d&hl=ar&gl=SA&ceid=SA:ar",
    language: "ar",
    region: "gcc",
    country: "SA",
    tier: 1,
    isOfficial: true,
    description: "Saudi Press Agency Arabic (via Google News)",
  },
  {
    name: "SPA English",
    domain: "spa.gov.sa",
    feedUrl: "https://news.google.com/rss/search?q=site:spa.gov.sa+when:3d&hl=en&gl=SA&ceid=SA:en",
    language: "en",
    region: "gcc",
    country: "SA",
    tier: 1,
    isOfficial: true,
    description: "Saudi Press Agency English (via Google News)",
  },
];

// KSA Mainstream Media (Tier 2)
const MAINSTREAM_KSA_SOURCES: OfficialSource[] = [
  {
    name: "Arab News",
    domain: "arabnews.com",
    feedUrl: "https://news.google.com/rss/search?q=site:arabnews.com+when:3d&hl=en&gl=SA&ceid=SA:en",
    language: "en",
    region: "gcc",
    country: "SA",
    tier: 2,
    isOfficial: false,
    description: "Arab News - Saudi Arabia English daily (via Google News)",
  },
];

const OFFICIAL_QATAR_SOURCES: OfficialSource[] = [
  {
    name: "وكالة الأنباء القطرية",
    domain: "qna.org.qa",
    feedUrl: "https://news.google.com/rss/search?q=site:qna.org.qa+when:3d&hl=ar&gl=QA&ceid=QA:ar",
    language: "ar",
    region: "gcc",
    country: "QA",
    tier: 1,
    isOfficial: true,
    description: "Qatar News Agency Arabic (via Google News)",
  },
  {
    name: "QNA English",
    domain: "qna.org.qa",
    feedUrl: "https://news.google.com/rss/search?q=site:qna.org.qa+when:3d&hl=en&gl=QA&ceid=QA:en",
    language: "en",
    region: "gcc",
    country: "QA",
    tier: 1,
    isOfficial: true,
    description: "Qatar News Agency English (via Google News)",
  },
];

// Qatar Mainstream Media (Tier 2)
const MAINSTREAM_QATAR_SOURCES: OfficialSource[] = [
  {
    name: "Gulf Times",
    domain: "gulf-times.com",
    feedUrl: "https://www.gulf-times.com/rssFeed/0",
    language: "en",
    region: "gcc",
    country: "QA",
    tier: 2,
    isOfficial: false,
    description: "Gulf Times - Qatar leading English daily newspaper",
  },
  {
    name: "Doha News",
    domain: "dohanews.co",
    feedUrl: "https://dohanews.co/feed/",
    language: "en",
    region: "gcc",
    country: "QA",
    tier: 2,
    isOfficial: false,
    description: "Doha News - Qatar independent English news",
  },
];

const OFFICIAL_KUWAIT_SOURCES: OfficialSource[] = [
  {
    name: "وكالة الأنباء الكويتية",
    domain: "kuna.net.kw",
    feedUrl: "https://news.google.com/rss/search?q=site:kuna.net.kw+when:3d&hl=ar&gl=KW&ceid=KW:ar",
    language: "ar",
    region: "gcc",
    country: "KW",
    tier: 1,
    isOfficial: true,
    description: "Kuwait News Agency Arabic (via Google News)",
  },
  {
    name: "KUNA English",
    domain: "kuna.net.kw",
    feedUrl: "https://news.google.com/rss/search?q=site:kuna.net.kw+when:3d&hl=en&gl=KW&ceid=KW:en",
    language: "en",
    region: "gcc",
    country: "KW",
    tier: 1,
    isOfficial: true,
    description: "Kuwait News Agency English (via Google News)",
  },
];

// Kuwait Mainstream Media (Tier 2)
const MAINSTREAM_KUWAIT_SOURCES: OfficialSource[] = [
  {
    name: "Arab Times",
    domain: "arabtimesonline.com",
    feedUrl: "https://www.arabtimesonline.com/rssFeed/92/",
    language: "en",
    region: "gcc",
    country: "KW",
    tier: 2,
    isOfficial: false,
    description: "Arab Times - Kuwait mainstream English newspaper",
  },
];

const OFFICIAL_BAHRAIN_SOURCES: OfficialSource[] = [
  {
    name: "وكالة أنباء البحرين",
    domain: "bna.bh",
    feedUrl: "https://news.google.com/rss/search?q=site:bna.bh+when:3d&hl=ar&gl=BH&ceid=BH:ar",
    language: "ar",
    region: "gcc",
    country: "BH",
    tier: 1,
    isOfficial: true,
    description: "Bahrain News Agency Arabic (via Google News)",
  },
  {
    name: "BNA English",
    domain: "bna.bh",
    feedUrl: "https://news.google.com/rss/search?q=site:bna.bh+when:3d&hl=en&gl=BH&ceid=BH:en",
    language: "en",
    region: "gcc",
    country: "BH",
    tier: 1,
    isOfficial: true,
    description: "Bahrain News Agency English (via Google News)",
  },
];

// Bahrain Mainstream Media (Tier 2)
const MAINSTREAM_BAHRAIN_SOURCES: OfficialSource[] = [];

const OFFICIAL_OMAN_SOURCES: OfficialSource[] = [
  {
    name: "وكالة الأنباء العمانية",
    domain: "omannews.gov.om",
    feedUrl: "https://news.google.com/rss/search?q=site:omannews.gov.om+when:3d&hl=ar&gl=OM&ceid=OM:ar",
    language: "ar",
    region: "gcc",
    country: "OM",
    tier: 1,
    isOfficial: true,
    description: "Oman News Agency Arabic (via Google News)",
  },
  {
    name: "ONA English",
    domain: "omannews.gov.om",
    feedUrl: "https://news.google.com/rss/search?q=site:omannews.gov.om+when:3d&hl=en&gl=OM&ceid=OM:en",
    language: "en",
    region: "gcc",
    country: "OM",
    tier: 1,
    isOfficial: true,
    description: "Oman News Agency English (via Google News)",
  },
];

// Oman Mainstream Media (Tier 2)
const MAINSTREAM_OMAN_SOURCES: OfficialSource[] = [];

const TIER_2_REGIONAL_BUSINESS: OfficialSource[] = [
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
    name: "Al Jazeera English",
    domain: "aljazeera.com",
    feedUrl: "https://www.aljazeera.com/xml/rss/all.xml",
    language: "en",
    region: "mena",
    country: "QA",
    tier: 2,
    isOfficial: false,
    description: "Al Jazeera English - International news from Qatar",
  },
];

const ALL_SOURCES = [
  // Official government sources (Tier 1)
  ...OFFICIAL_UAE_SOURCES,
  ...OFFICIAL_KSA_SOURCES,
  ...OFFICIAL_QATAR_SOURCES,
  ...OFFICIAL_KUWAIT_SOURCES,
  ...OFFICIAL_BAHRAIN_SOURCES,
  ...OFFICIAL_OMAN_SOURCES,
  // Mainstream media (Tier 2)
  ...MAINSTREAM_UAE_SOURCES,
  ...MAINSTREAM_KSA_SOURCES,
  ...MAINSTREAM_QATAR_SOURCES,
  ...MAINSTREAM_KUWAIT_SOURCES,
  ...MAINSTREAM_BAHRAIN_SOURCES,
  ...MAINSTREAM_OMAN_SOURCES,
  // Regional business media (Tier 2)
  ...TIER_2_REGIONAL_BUSINESS,
];

export async function seedOfficialSources(workspaceId: string): Promise<{ inserted: number; updated: number; skipped: number }> {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const source of ALL_SOURCES) {
    try {
      const existing = await db.query.sources.findFirst({
        where: (s, { eq, and }) => and(
          eq(s.workspaceId, workspaceId),
          eq(s.domain, source.domain),
          eq(s.language, source.language)
        ),
      });

      if (existing) {
        // Update existing source with correct tier, isOfficial, feedUrl, and enable it
        const needsUpdate = 
          existing.tier !== source.tier || 
          existing.isOfficial !== (source.isOfficial ? "true" : "false") ||
          existing.feedUrl !== source.feedUrl ||
          existing.isActive !== "true";
        
        if (needsUpdate) {
          await db.update(sources)
            .set({
              tier: source.tier,
              isOfficial: source.isOfficial ? "true" : "false",
              mediaTier: source.tier === 1 ? "tier_1" : source.tier === 2 ? "tier_2" : "tier_3",
              description: source.description,
              feedUrl: source.feedUrl, // Update to Google News RSS if needed
              isActive: "true", // Ensure source is enabled
              lastError: null, // Clear any previous errors
              updatedAt: new Date(),
            })
            .where(eq(sources.id, existing.id));
          updated++;
        } else {
          skipped++;
        }
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

  return { inserted, updated, skipped };
}

export function getOfficialSourcesForRegion(region: string): OfficialSource[] {
  return ALL_SOURCES.filter(s => 
    s.region === region || s.region === "mena" && region === "gcc"
  );
}

export function getOfficialTier1Domains(): string[] {
  return ALL_SOURCES
    .filter(s => s.tier === 1 && s.isOfficial)
    .map(s => s.domain);
}
