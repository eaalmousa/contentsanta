import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

interface TaxonomyMatchResult {
  categoryIds: number[];
  tags: string[];
  reasoning: string;
}

interface AvailableCategory {
  id: number;
  name: string;
  count: number;
}

interface AvailableTag {
  name: string;
  count: number;
}

export class TaxonomyMatcherService {
  /**
   * Use AI to intelligently select WordPress categories/tags from existing taxonomy
   * based on article content and topic context
   */
  async selectTaxonomy(
    articleTitle: string,
    articleContent: string,
    topicName: string,
    topicDescription: string,
    availableCategories: AvailableCategory[],
    availableTags: AvailableTag[],
    defaultCategoryId: number
  ): Promise<TaxonomyMatchResult> {
    // Fallback if AI fails
    const fallback: TaxonomyMatchResult = {
      categoryIds: [defaultCategoryId],
      tags: [],
      reasoning: "AI service unavailable, using default category",
    };

    if (!process.env.OPENAI_API_KEY) {
      console.warn("[TaxonomyMatcher] OpenAI API key not configured, using defaults");
      return fallback;
    }

    if (availableCategories.length === 0) {
      console.warn("[TaxonomyMatcher] No categories available, using default");
      return fallback;
    }

    try {
      const categoriesText = availableCategories
        .map((c) => `- [${c.id}] ${c.name} (${c.count} posts)`)
        .join("\n");

      const tagsText =
        availableTags.length > 0
          ? availableTags.map((t) => `- ${t.name} (${t.count} posts)`).join("\n")
          : "No tags available";

      const prompt = `You are a WordPress content categorization expert. Your job is to analyze an article and select the MOST RELEVANT categories and tags from the EXISTING WordPress taxonomy.

**CRITICAL RULES - FOLLOW EXACTLY:**
1. ⚠️ YOU MUST ONLY USE CATEGORY IDs FROM THE PROVIDED LIST BELOW
2. ⚠️ NEVER CREATE, INVENT, OR SUGGEST NEW CATEGORY NAMES
3. ⚠️ ONLY USE THE EXACT IDs [NUMBER] FROM THE AVAILABLE CATEGORIES LIST
4. Select EXACTLY 2 categories (primary + secondary)
5. Select 3-5 tags maximum from available tags
6. If no perfect match exists, choose the CLOSEST RELEVANT categories from the list
7. Match based on semantic meaning and article topic

**TOPIC CONTEXT:**
Topic: ${topicName}
Description: ${topicDescription || "General content"}

**ARTICLE TO CATEGORIZE:**
Title: ${articleTitle}
Content Preview: ${articleContent.substring(0, 500)}...

**AVAILABLE WORDPRESS CATEGORIES (YOU MUST CHOOSE FROM THESE ONLY):**
${categoriesText}

**AVAILABLE WORDPRESS TAGS (YOU MUST CHOOSE FROM THESE ONLY):**
${tagsText}

**YOUR TASK:**
1. Read the article title and content carefully
2. Find the 2 MOST RELEVANT category IDs from the list above
3. Find 3-5 most relevant tags from the list above
4. CRITICAL: Only use IDs that appear in the brackets [ID] above

**EXAMPLE RESPONSE FORMAT:**
{
  "categoryIds": [19, 20],
  "tags": ["business", "companies", "economy"],
  "reasoning": "Article about business expansion fits [19] Business and [20] Countries categories. Tags match business and economic themes."
}

**NOW RESPOND WITH YOUR CATEGORIZATION:**`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a WordPress content categorization expert. You respond only with valid JSON.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const responseText = completion.choices[0]?.message?.content || "";

      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("[TaxonomyMatcher] AI response not in JSON format");
        return fallback;
      }

      const result = JSON.parse(jsonMatch[0]) as TaxonomyMatchResult;

      // STRICT validation: Only accept category IDs that exist in availableCategories
      const validCategoryIds = result.categoryIds.filter((id) => {
        const exists = availableCategories.some((c) => c.id === id);
        if (!exists) {
          console.warn(`[TaxonomyMatcher] ⚠️ AI returned invalid category ID ${id} - not in WordPress categories! Filtering out.`);
        }
        return exists;
      });

      // STRICT validation: Only accept tags that exist in availableTags
      const validTags = result.tags.filter((tag) => {
        const exists = availableTags.some((t) => t.name.toLowerCase() === tag.toLowerCase());
        if (!exists) {
          console.warn(`[TaxonomyMatcher] ⚠️ AI returned invalid tag "${tag}" - not in WordPress tags! Filtering out.`);
        }
        return exists;
      });

      // Ensure EXACTLY 2 categories (if possible)
      if (validCategoryIds.length === 0) {
        console.warn(`[TaxonomyMatcher] ⚠️ AI returned NO valid categories! Using default [${defaultCategoryId}]`);
        validCategoryIds.push(defaultCategoryId);
        // Add a second category (first available, excluding default)
        const secondCategory = availableCategories.find(c => c.id !== defaultCategoryId);
        if (secondCategory) {
          validCategoryIds.push(secondCategory.id);
        }
      } else if (validCategoryIds.length === 1) {
        // Add a second category if only one was selected
        const otherCategory = availableCategories.find(c => 
          c.id !== validCategoryIds[0] && c.id !== defaultCategoryId
        );
        if (otherCategory) {
          validCategoryIds.push(otherCategory.id);
        }
      } else if (validCategoryIds.length > 2) {
        // Limit to 2 categories
        validCategoryIds.length = 2;
      }

      console.log(
        `[TaxonomyMatcher] Selected categories: [${validCategoryIds.join(", ")}], tags: [${validTags.join(", ")}]`
      );
      console.log(`[TaxonomyMatcher] Reasoning: ${result.reasoning}`);

      return {
        categoryIds: validCategoryIds,
        tags: validTags,
        reasoning: result.reasoning,
      };
    } catch (error: any) {
      console.error("[TaxonomyMatcher] Error:", error.message);
      return fallback;
    }
  }
}

export const taxonomyMatcher = new TaxonomyMatcherService();
