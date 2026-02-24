import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface AIImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  revisedPrompt?: string;
}

/**
 * AI Image Generation Service
 * Uses OpenAI DALL-E 3 to generate featured images when source articles don't have suitable images
 */
export class AIImageService {
  /**
   * Generate a featured image for an article using DALL-E 3
   * 
   * @param articleTitle - The article headline/title
   * @param articleExcerpt - Brief excerpt or summary of the article
   * @param style - Image style preference (realistic, artistic, minimalist)
   * @returns Generation result with image URL or error
   */
  async generateFeaturedImage(
    articleTitle: string,
    articleExcerpt: string,
    style: "realistic" | "artistic" | "minimalist" = "realistic"
  ): Promise<AIImageGenerationResult> {
    const requestId = `ai-img-${Date.now().toString(36).substring(5)}`;
    
    try {
      console.log(`[${requestId}] Generating AI image for: ${articleTitle.substring(0, 60)}...`);
      
      // Create a focused prompt for DALL-E 3
      const imagePrompt = this.createImagePrompt(articleTitle, articleExcerpt, style);
      
      console.log(`[${requestId}] Prompt: ${imagePrompt.substring(0, 100)}...`);
      
      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: imagePrompt,
        n: 1,
        size: "1024x1024", // Reduced from 1792x1024 for faster loading
        quality: "standard", // Standard quality is sufficient for web
        style: style === "artistic" ? "vivid" : "natural",
      });
      
      const imageUrl = response.data[0]?.url;
      const revisedPrompt = response.data[0]?.revised_prompt;
      
      if (!imageUrl) {
        console.error(`[${requestId}] No image URL returned from DALL-E`);
        return {
          success: false,
          error: "No image generated",
        };
      }
      
      console.log(`[${requestId}] ✅ AI image generated successfully`);
      console.log(`[${requestId}] URL: ${imageUrl.substring(0, 80)}...`);
      
      return {
        success: true,
        imageUrl,
        revisedPrompt,
      };
    } catch (error: any) {
      console.error(`[${requestId}] Error generating AI image:`, error);
      return {
        success: false,
        error: error.message || "Unknown error during AI image generation",
      };
    }
  }
  
  /**
   * Create an optimized DALL-E prompt from article content
   * Focuses on creating news-appropriate, professional imagery
   */
  private createImagePrompt(title: string, excerpt: string, style: string): string {
    // Extract key themes and entities from title
    const cleanTitle = title.replace(/[^\w\s-]/g, "").trim();
    const cleanExcerpt = excerpt.substring(0, 200).replace(/[^\w\s-.,]/g, "").trim();
    
    let styleInstructions = "";
    
    switch (style) {
      case "realistic":
        styleInstructions = "Professional photograph, high quality, journalistic style, natural lighting, sharp focus";
        break;
      case "artistic":
        styleInstructions = "Modern digital art, clean composition, vibrant colors, professional design";
        break;
      case "minimalist":
        styleInstructions = "Minimalist design, clean lines, simple composition, limited color palette";
        break;
    }
    
    // Build the prompt
    const prompt = `Create a professional featured image for a news article titled "${cleanTitle}". 
    
Context: ${cleanExcerpt}

Style requirements: ${styleInstructions}

The image should:
- Be appropriate for publication on a professional news website
- Clearly relate to the article topic without being too literal
- Avoid text overlays or watermarks
- Use a landscape orientation suitable for article headers
- Be visually engaging and professional`;
    
    return prompt.trim();
  }
  
  /**
   * Determine if AI image generation should be used as fallback
   * Based on topic settings, content type, and workspace preferences
   */
  shouldGenerateAIImage(topicSettings: any, hasSourceImage: boolean): boolean {
    // Don't generate if source has a good image
    if (hasSourceImage) {
      return false;
    }
    
    // Check if topic/workspace has AI image generation enabled
    if (topicSettings?.autoGenerateVisuals === "true" || topicSettings?.autoGenerateVisuals === true) {
      return true;
    }
    
    // Default to generating for topics without images
    return true;
  }
}

export const aiImageService = new AIImageService();
