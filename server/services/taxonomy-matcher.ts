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

      const prompt = `You are a WordPress content categorization expert. Your ONLY job is to SELECT existing categories from a provided list—NEVER create new ones.

**🚨 CRITICAL RULES - VIOLATION WILL FAIL THE TASK:**
1. ⚠️ YOU MUST ONLY USE CATEGORY IDs FROM THE PROVIDED LIST BELOW
2. ⚠️ ABSOLUTELY FORBIDDEN: Creating, inventing, or suggesting new category names
3. ⚠️ ABSOLUTELY FORBIDDEN: Using category IDs that are not in the list
4. ⚠️ ONLY USE THE EXACT NUMERIC IDs [NUMBER] FROM THE AVAILABLE CATEGORIES LIST
5. Select EXACTLY 2 categories that best match the article content
6. Select 3-5 tags maximum ONLY from the available tags list (no new tags)
7. If no perfect match exists, choose the CLOSEST RELEVANT categories from the list
8. Match based on semantic meaning and article topic, not exact keyword matching

**TOPIC CONTEXT:**
Topic: ${topicName}
Description: ${topicDescription || "General content"}

**ARTICLE TO CATEGORIZE:**
Title: ${articleTitle}
Content Preview: ${articleContent.substring(0, 500)}...

**AVAILABLE WORDPRESS CATEGORIES (SELECT 2 FROM THIS LIST ONLY):**
${categoriesText}

**AVAILABLE WORDPRESS TAGS (SELECT 3-5 FROM THIS LIST ONLY):**
${tagsText}

**DEFAULT CATEGORY (use if uncertain):** [${defaultCategoryId}]

**YOUR TASK:**
1. Read the article title and content carefully
2. Identify the 2 MOST RELEVANT category IDs from the list above (by semantic meaning)
3. Select 3-5 most relevant tag names from the tags list above
4. 🚨 CRITICAL CHECK: Verify every ID and tag name exists in the lists above
5. Provide brief reasoning for your selections

**VALID RESPONSE FORMAT (JSON only):**
{
  "categoryIds": [19, 20],
  "tags": ["business", "companies", "economy"],
  "reasoning": "Article about business expansion best matches [19] Business (primary focus) and [20] Countries (geographic scope). Tags align with business and economic themes from available tag list."
}

**🚨 REMINDER: Use ONLY the IDs and tag names from the lists above. Do not invent new categories or tags.**

Respond with JSON only:`;

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
          console.error(`[TaxonomyMatcher] 🚨 INVALID CATEGORY: AI returned category ID ${id} which does NOT exist in WordPress!`);
          console.error(`[TaxonomyMatcher] Available category IDs: [${availableCategories.map(c => c.id).join(", ")}]`);
        }
        return exists;
      });

      // STRICT validation: Only accept tags that exist in availableTags
      const validTags = result.tags.filter((tag) => {
        const exists = availableTags.some((t) => t.name.toLowerCase() === tag.toLowerCase());
        if (!exists) {
          console.error(`[TaxonomyMatcher] 🚨 INVALID TAG: AI returned tag "${tag}" which does NOT exist in WordPress!`);
          console.error(`[TaxonomyMatcher] Available tags: [${availableTags.map(t => t.name).slice(0, 20).join(", ")}...]`);
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
