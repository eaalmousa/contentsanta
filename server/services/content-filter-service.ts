import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Content Filter Service
 * 
 * Filters out restricted content (sex, politics) before publishing
 */

const RESTRICTED_KEYWORDS = {
  sex: [
    'sex', 'sexual', 'sexuality', 'porn', 'pornography', 'adult content',
    'explicit content', 'erotic', 'xxx', 'nsfw', 'prostitution',
    'sex worker', 'brothel', 'strip club', 'sex industry'
  ],
  politics: [
    'politics', 'political', 'politician', 'election', 'vote', 'voting',
    'government policy', 'minister', 'parliament', 'senate', 'congress',
    'president', 'prime minister', 'opposition party', 'ruling party',
    'political party', 'campaign', 'referendum', 'ballot', 'legislative',
    'diplomatic', 'embassy', 'ambassador', 'bilateral', 'sanctions',
    'government official', 'cabinet', 'ministry', 'parliamentary'
  ]
};

interface FilterResult {
  isRestricted: boolean;
  reason: string;
  category?: 'sex' | 'politics';
}

/**
 * Filter content for restricted topics using keyword matching + AI classification
 */
export async function filterRestrictedContent(
  title: string,
  body: string
): Promise<FilterResult> {
  
  // Step 1: Keyword-based filtering (fast, no API cost)
  const textLower = `${title} ${body}`.toLowerCase();
  
  // Check sex keywords
  for (const keyword of RESTRICTED_KEYWORDS.sex) {
    if (textLower.includes(keyword)) {
      return {
        isRestricted: true,
        reason: `Restricted content: contains '${keyword}' (sex-related)`,
        category: 'sex'
      };
    }
  }

  // Check politics keywords
  for (const keyword of RESTRICTED_KEYWORDS.politics) {
    if (textLower.includes(keyword)) {
      return {
        isRestricted: true,
        reason: `Restricted content: contains '${keyword}' (politics-related)`,
        category: 'politics'
      };
    }
  }

  // Step 2: AI-powered classification for edge cases
  // Only run if keywords didn't catch it (saves API costs)
  try {
    const aiCheck = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "system",
        content: `You are a content classifier. Determine if this content is primarily about SEX or POLITICS.

SEX includes: Sexual content, adult content, pornography, prostitution, sex industry
POLITICS includes: Elections, government policies, political parties, politicians, diplomatic relations, sanctions

Reply with ONE word only:
- "SEX" if primarily about sexual content
- "POLITICS" if primarily about political content  
- "CLEAN" if neither

Do NOT classify business news, economic policy, or real estate regulations as politics unless they mention specific politicians or parties.`
      }, {
        role: "user",
        content: `Title: ${title}\n\nFirst 500 chars: ${body.substring(0, 500)}`
      }],
      max_tokens: 10,
      temperature: 0
    });

    const aiResult = aiCheck.choices[0]?.message?.content?.trim().toUpperCase();

    if (aiResult === 'SEX') {
      return {
        isRestricted: true,
        reason: 'Restricted content: AI detected sex-related topic',
        category: 'sex'
      };
    }

    if (aiResult === 'POLITICS') {
      return {
        isRestricted: true,
        reason: 'Restricted content: AI detected politics-related topic',
        category: 'politics'
      };
    }

  } catch (error: any) {
    console.error('[Content Filter] AI classification failed:', error.message);
    // If AI fails, fall through to allow (better to let one through than block legitimate content)
  }

  return {
    isRestricted: false,
    reason: ''
  };
}

/**
 * Synchronous keyword-only filter (no AI, instant)
 * Use for quick pre-screening before expensive operations
 */
export function quickFilterRestrictedContent(
  title: string,
  body: string
): FilterResult {
  const textLower = `${title} ${body}`.toLowerCase();
  
  // Check sex keywords
  for (const keyword of RESTRICTED_KEYWORDS.sex) {
    if (textLower.includes(keyword)) {
      return {
        isRestricted: true,
        reason: `Restricted content: contains '${keyword}' (sex-related)`,
        category: 'sex'
      };
    }
  }

  // Check politics keywords
  for (const keyword of RESTRICTED_KEYWORDS.politics) {
    if (textLower.includes(keyword)) {
      return {
        isRestricted: true,
        reason: `Restricted content: contains '${keyword}' (politics-related)`,
        category: 'politics'
      };
    }
  }

  return {
    isRestricted: false,
    reason: ''
  };
}

export const contentFilterService = {
  filterRestrictedContent,
  quickFilterRestrictedContent,
};
