import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface SourceSuggestion {
  name: string;
  feedUrl: string;
  domain: string;
  description: string;
  language: string;
  region: string;
  country: string;
  tier: number;
  isOfficial: boolean;
  tags: string[];
}

export async function discoverSources(
  region?: string,
  country?: string,
  topic?: string,
  language?: string
): Promise<SourceSuggestion[]> {
  const prompt = `You are a media source discovery expert. Find high-quality RSS news feeds based on the following criteria:

${region ? `Region: ${region}` : ''}
${country ? `Country: ${country}` : ''}
${topic ? `Topic: ${topic}` : ''}
${language ? `Language: ${language}` : ''}

Requirements:
1. Only suggest REAL, currently active RSS feeds with valid URLs
2. Focus on reputable news sources (newspapers, news agencies, official media)
3. Prefer official government/national media sources (mark as tier 1)
4. Include major regional outlets (tier 2)
5. Add quality local sources (tier 3)

Return a JSON array of sources with this structure:
{
  "name": "Source Name",
  "feedUrl": "https://example.com/rss",
  "domain": "example.com",
  "description": "Brief description of the source",
  "language": "en|ar|fr etc.",
  "region": "gcc|mena|europe|asia|global",
  "country": "AE|SA|US etc. ISO code",
  "tier": 1-3 (1=national/official, 2=major outlet, 3=quality local),
  "isOfficial": true if government/official media,
  "tags": ["business", "politics", "tech" etc.]
}

IMPORTANT: Only return sources you are CERTAIN exist. DO NOT make up RSS URLs.
Return ONLY the JSON array, no other text.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a media source discovery expert. You provide accurate, real RSS feed URLs for news sources. Only suggest feeds you are certain exist."
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    // Extract JSON from response (might be wrapped in markdown code blocks)
    let jsonText = content.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }

    const sources = JSON.parse(jsonText);
    return sources;
  } catch (error) {
    console.error("[Source Discovery] Error:", error);
    throw error;
  }
}

export async function validateRssFeed(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "ContentSanta/1.0 (Source Validator)",
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      return false;
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("xml") && !contentType?.includes("rss") && !contentType?.includes("atom")) {
      // Try to parse anyway (some feeds don't set proper content-type)
      const text = await response.text();
      return text.includes("<rss") || text.includes("<feed") || text.includes("<rdf:RDF");
    }

    return true;
  } catch (error) {
    console.error(`[RSS Validator] Failed to validate ${url}:`, error);
    return false;
  }
}
