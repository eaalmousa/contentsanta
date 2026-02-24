/**
 * Publishing Preflight Service
 * 
 * Single source of truth for publishing validation & sanitization.
 * Used by BOTH publishing paths:
 * - Direct push (enhanced-publisher.ts for wordpress targets)
 * - Plugin pull (wp-pull-service.ts for wordpress_pull targets)
 * 
 * Enforces:
 * - Content sanitization (removes markdown artifacts, SEO junk)
 * - Language policy (English-only for GEG, blocks Arabic content)
 * - Featured image requirements (uploads or quarantines)
 * - Category mapping (always returns at least one category)
 * - Deduplication (story_hash based on canonical URL)
 */

import type { PublishingTarget, PipelineItem, Story } from "@shared/schema";
import { storage } from "../storage";
import { contentSanitizer } from "./content-sanitizer";
import { featuredImageService } from "./featured-image-service";
import { wpCategoryService } from "./wp-category-service";
import { taxonomyMatcher } from "./taxonomy-matcher";
import { aiImageService } from "./ai-image-service";
import { contentFilterService } from "./content-filter-service";
import { db } from "../db";
import { sql } from "drizzle-orm";

export interface PreflightResult {
  success: boolean;
  
  // If success=false, quarantine details
  quarantineReason?: "language_mismatch" | "missing_featured_image" | "duplicate" | "policy_block" | "invalid_content" | "restricted_content";
  quarantineMessage?: string;
  
  // If success=true, sanitized payload ready for publishing
  payload?: PublishPayload;
  
  // Metadata for debugging
  metadata?: {
    storyHash: string;
    canonicalUrl: string;
    arabicRatio?: number;
    imageSource?: string;
  };
}

export interface PublishPayload {
  title: string;
  contentHtml: string;
  excerpt: string;
  categories: string[];
  categoryIds: number[]; // WordPress category IDs
  tags: string[];
  
  // WordPress-specific fields
  featuredImageMediaId?: number;
  featuredImageUrl?: string;
  featuredImageCredit?: string; // NEW: Image attribution (e.g., "Al Khaleej Newspaper" or "AI Generated Image")
  featuredImageCaption?: string; // NEW: Image caption/alt text
  
  // Metadata for tracking
  storyHash: string;
  canonicalSourceUrl: string;
  sourceName?: string; // NEW: Source attribution (e.g., "Al Khaleej Newspaper")
  
  // For WP meta fields
  sourceUrl: string;
  pipelineItemId: string;
}

export class PublishingPreflightService {
  /**
   * Main preflight validation
   * 
   * Steps:
   * 1. Load pipeline_item + story + target policy
   * 2. Generate canonical story_hash (URL-based, most stable)
   * 3. Check for duplicate (target_id + story_hash)
   * 4. Language detection (block Arabic if english_only)
   * 5. Content sanitization (remove markdown, SEO junk)
   * 6. Featured image extraction/upload (quarantine if required but missing)
   * 7. Category resolution (always return at least one)
   * 8. Update pipeline_item with story_hash + canonical_url
   */
  async prepare(
    pipelineItemId: string,
    targetId: string
  ): Promise<PreflightResult> {
    const requestId = `preflight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[${requestId}] Starting preflight for pipeline_item: ${pipelineItemId}`);

    try {
      // Step 1: Load entities
      const item = await storage.getPipelineItem(pipelineItemId);
      if (!item) {
        return {
          success: false,
          quarantineReason: "invalid_content",
          quarantineMessage: "Pipeline item not found",
        };
      }

      const target = await storage.getPublishingTarget(targetId);
      if (!target) {
        return {
          success: false,
          quarantineReason: "policy_block",
          quarantineMessage: "Publishing target not found",
        };
      }

      if (!target.isActive) {
        return {
          success: false,
          quarantineReason: "policy_block",
          quarantineMessage: "Publishing target is inactive",
        };
      }

      const story = await storage.getStory(item.storyId);
      if (!story) {
        return {
          success: false,
          quarantineReason: "invalid_content",
          quarantineMessage: "Story not found",
        };
      }

      // Step 1.5: Content filter - Block sex/politics content
      console.log(`[${requestId}] Checking content restrictions...`);
      const contentCheck = await contentFilterService.filterRestrictedContent(
        item.generatedTitle || story.canonicalTitle,
        item.generatedBody || ''
      );

      if (contentCheck.isRestricted) {
        console.log(`[${requestId}] ❌ Content restricted: ${contentCheck.reason}`);
        
        // Update pipeline item with quarantine
        await storage.updatePipelineItem(pipelineItemId, {
          status: 'quarantined',
          quarantineReason: 'restricted_content',
          lastErrorMessage: contentCheck.reason,
        });

        return {
          success: false,
          quarantineReason: "restricted_content",
          quarantineMessage: contentCheck.reason,
        };
      }

      // Step 2: Get canonical source URL (most stable identifier)
      const storyItems = await storage.getStoryItems(item.storyId);
      const primaryItem = storyItems.find((si) => si.isPrimary === "true") || storyItems[0];
      const canonicalUrl = primaryItem?.sourceUrl || story.sourceUrl || "";

      if (!canonicalUrl) {
        console.warn(`[${requestId}] No canonical URL found, falling back to title-only hash`);
      }

      // Step 3: Generate story_hash (prefer canonical URL only for stability)
      const storyHash = contentSanitizer.generateStoryHash(
        canonicalUrl,
        item.generatedTitle || story.canonicalTitle
      );

      console.log(`[${requestId}] Story hash: ${storyHash.substring(0, 12)}... (canonical: ${canonicalUrl.substring(0, 50)})`);

      // Step 4: Check for duplicate (same story_hash + target_id already published)
      const existingPublished = await db
        .select()
        .from(storage.schema.pipelineItems)
        .where(
          sql`target_id = ${targetId} 
              AND story_hash = ${storyHash} 
              AND status IN ('published', 'scheduled')
              AND id != ${pipelineItemId}`
        )
        .limit(1);

      if (existingPublished.length > 0) {
        console.log(`[${requestId}] Duplicate detected: ${existingPublished[0].id} already published`);
        
        // Update current item with story_hash for tracking
        await storage.updatePipelineItem(pipelineItemId, {
          storyHash,
          canonicalSourceUrl: canonicalUrl,
        });

        return {
          success: false,
          quarantineReason: "duplicate",
          quarantineMessage: `Already published as ${existingPublished[0].targetPostId || existingPublished[0].id}`,
          metadata: {
            storyHash,
            canonicalUrl,
          },
        };
      }

      // Step 5: Language detection (enforce policy)
      const fullText = `${item.generatedTitle || ""}\n\n${item.generatedBody || ""}`;
      
      let languageCheck = { hasIssue: false, reason: "", arabicRatio: 0 };
      
      // Check if target enforces language policy
      if (target.languageMode === "english_only" || 
          (target.allowedLanguages && target.allowedLanguages.length > 0 && target.allowedLanguages.includes("en"))) {
        languageCheck = contentSanitizer.detectLanguageIssue(
          fullText,
          target.allowedLanguages || ["en"],
          0.03 // 3% Arabic threshold
        );
      }

      if (languageCheck.hasIssue) {
        console.log(`[${requestId}] Language policy violation: ${languageCheck.reason} (Arabic ratio: ${languageCheck.arabicRatio?.toFixed(2)})`);
        
        await storage.updatePipelineItem(pipelineItemId, {
          status: "quarantined",
          quarantineReason: "language_mismatch",
          lastErrorMessage: languageCheck.reason,
          storyHash,
          canonicalSourceUrl: canonicalUrl,
        });

        return {
          success: false,
          quarantineReason: "language_mismatch",
          quarantineMessage: languageCheck.reason,
          metadata: {
            storyHash,
            canonicalUrl,
            arabicRatio: languageCheck.arabicRatio,
          },
        };
      }

      // Step 6: Sanitize content (remove markdown artifacts, SEO junk, "SEO Blog" etc.)
      console.log(`[${requestId}] Sanitizing content...`);
      const sanitized = contentSanitizer.sanitizeForWordPress({
        title: item.generatedTitle || story.canonicalTitle,
        body: item.generatedBody || story.excerpt || "",
        excerpt: item.generatedExcerpt || story.excerpt || "",
      });

      // Step 7: Resolve featured image (source extraction → AI generation → quarantine)
      console.log(`[${requestId}] Resolving featured image...`);
      let featuredMediaId: number | undefined;
      let imageUrl: string | undefined;
      let imageSource = "none";
      let imageCredit = "";
      let imageCaption = "";

      const imageResult = await featuredImageService.extractImageFromStory(item.storyId);

      if (imageResult.url) {
        imageUrl = imageResult.url;
        imageSource = imageResult.source;
        imageCredit = imageResult.credit || story.sourceName || "Source Article";
        imageCaption = imageResult.caption || item.generatedTitle || story.canonicalTitle;
        console.log(`[${requestId}] ✅ Extracted image from ${imageSource}: ${imageUrl.substring(0, 60)}`);
        
        // Note: We do NOT upload to WordPress here for wordpress_pull targets
        // The plugin will handle upload based on featuredImageUrl in the job payload
        // For direct wordpress targets, enhanced-publisher.ts will handle upload
      } else {
        // No source image found - try AI generation
        console.log(`[${requestId}] No source image found, attempting AI generation...`);
        
        try {
          const aiImageResult = await aiImageService.generateFeaturedImage(
            item.generatedTitle || story.canonicalTitle,
            item.generatedBody || "",
            "realistic"
          );
          
          if (aiImageResult.success && aiImageResult.imageUrl) {
            imageUrl = aiImageResult.imageUrl;
            imageSource = "ai_generated";
            imageCredit = "AI Generated Image (DALL-E 3)";
            imageCaption = item.generatedTitle || story.canonicalTitle;
            console.log(`[${requestId}] ✅ AI image generated successfully: ${imageUrl.substring(0, 60)}`);
          } else {
            console.warn(`[${requestId}] ⚠️ AI image generation failed: ${aiImageResult.error}`);
          }
        } catch (aiError: any) {
          console.error(`[${requestId}] ❌ AI image generation error:`, aiError.message);
        }
      }

      // Enforce featured image requirement (only quarantine if both source + AI failed)
      if (target.requireFeaturedImage && !imageUrl) {
        console.log(`[${requestId}] ❌ Featured image required but could not be obtained from source or AI`);
        
        await storage.updatePipelineItem(pipelineItemId, {
          status: "quarantined",
          quarantineReason: "missing_featured_image",
          lastErrorMessage: "Required featured image could not be obtained (source extraction failed, AI generation failed)",
          storyHash,
          canonicalSourceUrl: canonicalUrl,
        });

        return {
          success: false,
          quarantineReason: "missing_featured_image",
          quarantineMessage: "Required featured image could not be obtained (source extraction failed, AI generation failed)",
          metadata: {
            storyHash,
            canonicalUrl,
          },
        };
      }

      console.log(`[${requestId}] Final image: ${imageUrl || "none"} (source: ${imageSource}, credit: ${imageCredit})`);

      // Step 8: AI-powered category/tag resolution from existing WordPress taxonomy
      let categoryIds: number[] = [];
      let tags: string[] = [];
      
      const config = target.configJson as any;
      const defaultCategoryId = config?.default_category_id;
      const categoryIdConfirmed = config?.default_category_id_confirmed === true;
      
      // CRITICAL: wordpress_pull MUST have default_category_id
      if (target.type === "wordpress_pull" && !defaultCategoryId) {
        console.log(`[${requestId}] ❌ wordpress_pull target missing default_category_id`);
        await storage.updatePipelineItem(pipelineItemId, {
          status: "quarantined",
          quarantineReason: "policy_block",
          lastErrorMessage: "wordpress_pull requires config_json.default_category_id",
          storyHash,
          canonicalSourceUrl: canonicalUrl,
        });
        
        return {
          success: false,
          quarantineReason: "policy_block",
          quarantineMessage: "wordpress_pull requires config_json.default_category_id",
          metadata: {
            storyHash,
            canonicalUrl,
          },
        };
      }
      
      // CRITICAL: Category ID must be confirmed in WP admin
      if (target.type === "wordpress_pull" && !categoryIdConfirmed) {
        console.log(`[${requestId}] ❌ wordpress_pull default_category_id not confirmed (ID: ${defaultCategoryId})`);
        await storage.updatePipelineItem(pipelineItemId, {
          status: "quarantined",
          quarantineReason: "policy_block",
          lastErrorMessage: `default_category_id=${defaultCategoryId} must be confirmed in WP admin. Set config_json.default_category_id_confirmed=true after verification.`,
          storyHash,
          canonicalSourceUrl: canonicalUrl,
        });
        
        return {
          success: false,
          quarantineReason: "policy_block",
          quarantineMessage: `default_category_id=${defaultCategoryId} must be confirmed in WP admin. Set config_json.default_category_id_confirmed=true after verification.`,
          metadata: {
            storyHash,
            canonicalUrl,
          },
        };
      }
      
      // Fetch available WordPress categories and tags from cache
      try {
        console.log(`[${requestId}] Fetching WordPress taxonomy from cache...`);
        const wpCategories = await storage.getWpTaxonomyCache(target.id, "category");
        const wpTags = await storage.getWpTaxonomyCache(target.id, "tag");
        
        if (wpCategories.length === 0) {
          console.warn(`[${requestId}] No WordPress categories in cache, using default`);
          categoryIds = defaultCategoryId ? [defaultCategoryId] : [];
          tags = [];
        } else {
          // Get topic details for context
          const topic = item.topicId ? await storage.getTopic(item.topicId) : null;
          
          // Prepare data for AI matcher
          const availableCategories = wpCategories.map(c => ({
            id: c.wpId,
            name: c.name,
            count: c.count || 0,
          }));
          
          const availableTags = wpTags.map(t => ({
            name: t.name,
            count: t.count || 0,
          }));
          
          // Use AI to intelligently select categories/tags
          const aiResult = await taxonomyMatcher.selectTaxonomy(
            item.generatedTitle || story.canonicalTitle,
            item.generatedBody || "",
            topic?.name || "General Content",
            topic?.description || "",
            availableCategories,
            availableTags,
            defaultCategoryId || wpCategories[0].wpId
          );
          
          categoryIds = aiResult.categoryIds;
          tags = aiResult.tags;
          
          console.log(`[${requestId}] AI-selected taxonomy: categories=[${categoryIds.join(", ")}], tags=[${tags.join(", ")}]`);
          console.log(`[${requestId}] AI reasoning: ${aiResult.reasoning}`);
        }
      } catch (error) {
        console.error(`[${requestId}] Error resolving taxonomy:`, error instanceof Error ? error.message : error);
        // Fallback to default category
        categoryIds = defaultCategoryId ? [defaultCategoryId] : [];
        tags = [];
      }

      console.log(`[${requestId}] Final taxonomy: categories=[${categoryIds.join(", ")}] | tags=[${tags.join(", ")}]`);

      // Get category names from IDs for payload (backwards compatibility)
      const categoryNames: string[] = [];
      if (categoryIds.length > 0) {
        try {
          const wpCategories = await storage.getWpTaxonomyCache(target.id, "category");
          for (const catId of categoryIds) {
            const cat = wpCategories.find(c => c.wpId === catId);
            if (cat) {
              categoryNames.push(cat.name);
            }
          }
        } catch (error) {
          console.warn(`[${requestId}] Failed to resolve category names from IDs`);
        }
      }


      // Step 9: Update pipeline_item with normalized data
      await storage.updatePipelineItem(pipelineItemId, {
        storyHash,
        canonicalSourceUrl: canonicalUrl,
        featuredImageUrl: imageUrl,
      });

      // Step 10: Return sanitized payload with image metadata
      const payload: PublishPayload = {
        title: sanitized.title,
        contentHtml: sanitized.body,
        excerpt: sanitized.excerpt,
        categories: categoryNames,
        categoryIds,
        tags,
        featuredImageMediaId: featuredMediaId,
        featuredImageUrl: imageUrl,
        featuredImageCredit: imageCredit || undefined,
        featuredImageCaption: imageCaption || undefined,
        storyHash,
        canonicalSourceUrl: canonicalUrl,
        sourceName: story.sourceName || undefined, // Source attribution
        sourceUrl: canonicalUrl,
        pipelineItemId,
      };

      console.log(`[${requestId}] ✅ Preflight passed`);

      return {
        success: true,
        payload,
        metadata: {
          storyHash,
          canonicalUrl,
          arabicRatio: languageCheck.arabicRatio,
          imageSource,
        },
      };

    } catch (error) {
      console.error(`[${requestId}] Preflight failed:`, error);
      
      return {
        success: false,
        quarantineReason: "invalid_content",
        quarantineMessage: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

}

export const publishingPreflight = new PublishingPreflightService();
