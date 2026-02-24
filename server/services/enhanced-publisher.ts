import type { PublishingTarget, PipelineItem, Story } from "@shared/schema";
import { storage } from "../storage";
import { contentSanitizer } from "./content-sanitizer";
import { featuredImageService } from "./featured-image-service";
import { db } from "../db";
import { sql } from "drizzle-orm";

export interface PublishResult {
  success: boolean;
  postId?: number;
  permalink?: string;
  quarantineReason?: string;
  error?: string;
  metadata?: {
    storyHash?: string;
    imageUploaded?: boolean;
    arabicRatio?: number;
  };
}

export interface WordPressConfig {
  siteUrl: string;
  username: string;
  appPassword: string;
}

export class EnhancedWordPressPublisher {
  async publishPipelineItem(
    pipelineItemId: string,
    targetId: string
  ): Promise<PublishResult> {
    const requestId = `pub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[${requestId}] Starting enhanced WordPress publish`);

    try {
      const item = await storage.getPipelineItem(pipelineItemId);
      if (!item) {
        return { success: false, error: "Pipeline item not found" };
      }

      const target = await storage.getPublishingTarget(targetId);
      if (!target) {
        return { success: false, error: "Publishing target not found" };
      }

      if (!target.isActive) {
        return { success: false, error: "Publishing target is inactive" };
      }

      const story = await storage.getStory(item.storyId);
      if (!story) {
        return { success: false, error: "Story not found" };
      }

      console.log(`[${requestId}] Step 1: Check if already published`);
      if (item.targetPostId && item.targetId === targetId) {
        console.log(`[${requestId}] Already published to this target: ${item.targetPostId}`);
        return {
          success: true,
          postId: parseInt(item.targetPostId),
          permalink: item.targetPermalink || undefined,
        };
      }

      const storyItems = await storage.getStoryItems(item.storyId);
      const primaryItem = storyItems.find((si) => si.isPrimary === "true") || storyItems[0];
      const canonicalUrl = primaryItem?.sourceUrl || "";

      console.log(`[${requestId}] Step 2: Generate story hash for idempotency`);
      const storyHash = contentSanitizer.generateStoryHash(
        canonicalUrl,
        item.generatedTitle || story.canonicalTitle
      );

      const existingPublished = await db
        .select()
        .from(storage.schema.pipelineItems)
        .where(
          sql`target_id = ${targetId} AND story_hash = ${storyHash} AND status = 'published'`
        )
        .limit(1);

      if (existingPublished.length > 0 && existingPublished[0].id !== pipelineItemId) {
        console.log(`[${requestId}] Duplicate detected via story_hash, skipping`);
        await storage.updatePipelineItem(pipelineItemId, {
          status: "skipped",
          skipReason: "duplicate",
          storyHash,
        });
        return {
          success: false,
          quarantineReason: "duplicate",
          metadata: { storyHash },
        };
      }

      console.log(`[${requestId}] Step 3: Language detection`);
      const languageCheck = contentSanitizer.detectLanguageIssue(
        `${item.generatedTitle || ""}\n\n${item.generatedBody || ""}`,
        target.allowedLanguages || [],
        0.03
      );

      if (languageCheck.hasIssue) {
        console.log(`[${requestId}] Language mismatch: ${languageCheck.reason}`);
        await storage.updatePipelineItem(pipelineItemId, {
          status: "quarantined",
          quarantineReason: "language_mismatch",
          lastErrorMessage: languageCheck.reason,
          storyHash,
        });
        return {
          success: false,
          quarantineReason: "language_mismatch",
          metadata: {
            storyHash,
            arabicRatio: languageCheck.arabicRatio,
          },
        };
      }

      console.log(`[${requestId}] Step 4: Sanitize content`);
      const sanitized = contentSanitizer.sanitizeForWordPress({
        title: item.generatedTitle || story.canonicalTitle,
        body: item.generatedBody || story.excerpt || "",
        excerpt: item.generatedExcerpt || story.excerpt || "",
      });

      console.log(`[${requestId}] Step 5: Extract/upload featured image`);
      let featuredMediaId: number | undefined;
      let imageUrl: string | undefined;

      const imageResult = await featuredImageService.extractImageFromStory(item.storyId);

      if (imageResult.url) {
        console.log(`[${requestId}] Found image: ${imageResult.source}`);
        imageUrl = imageResult.url;

        const wpConfig = this.parseWordPressConfig(target);
        if (wpConfig) {
          try {
            const uploaded = await featuredImageService.uploadToWordPress(
              imageResult.url,
              wpConfig.siteUrl,
              wpConfig.username,
              wpConfig.appPassword,
              sanitized.title
            );
            featuredMediaId = uploaded.id;
            imageUrl = uploaded.url;
            console.log(`[${requestId}] Image uploaded to WP: ${featuredMediaId}`);
          } catch (uploadError) {
            console.error(`[${requestId}] Image upload failed:`, uploadError);
          }
        }
      }

      if (target.requireFeaturedImage && !featuredMediaId) {
        console.log(`[${requestId}] Featured image required but missing`);
        await storage.updatePipelineItem(pipelineItemId, {
          status: "quarantined",
          quarantineReason: "missing_featured_image",
          lastErrorMessage: "Required featured image could not be obtained",
          storyHash,
          canonicalSourceUrl: canonicalUrl,
        });
        return {
          success: false,
          quarantineReason: "missing_featured_image",
          metadata: { storyHash },
        };
      }

      console.log(`[${requestId}] Step 6: Prepare WordPress post data`);
      const wpConfig = this.parseWordPressConfig(target);
      if (!wpConfig) {
        return { success: false, error: "Invalid WordPress credentials" };
      }

      // Build post content with source attribution
      let finalContent = sanitized.body;
      
      // Add source attribution (e.g., "Source: Al Khaleej Newspaper")
      if (story.sourceName) {
        const sourceAttribution = `\n\n<p class="article-source"><em>Source: ${story.sourceName}</em></p>`;
        finalContent += sourceAttribution;
      }
      
      // Add image credit if available
      if (featuredMediaId && item.featuredImageCredit) {
        const creditNote = `\n\n<p class="image-credit"><em>Image credit: ${item.featuredImageCredit}</em></p>`;
        finalContent += creditNote;
      }

      const postData: any = {
        title: sanitized.title,
        content: finalContent,
        excerpt: sanitized.excerpt,
        status: target.defaultPostStatus || "draft",
        meta: {
          content_santa_story_hash: storyHash,
          content_santa_source_url: canonicalUrl,
          content_santa_pipeline_item_id: pipelineItemId,
          content_santa_source_name: story.sourceName || "",
          // Image credits and captions
          content_santa_image_credit: item.featuredImageCredit || "",
          content_santa_image_caption: item.featuredImageCaption || "",
          content_santa_ai_generated_image: item.aiGeneratedImageUrl ? "true" : "false",
        },
      };

      if (featuredMediaId) {
        postData.featured_media = featuredMediaId;
      }

      // Always resolve categories and tags (with fallback to topic-level defaults)
      const categories = await this.resolveCategoryIds(
        target,
        wpConfig,
        item.generatedCategory
      );
      if (categories.length > 0) {
        postData.categories = categories;
      }

      const tags = await this.resolveTagIds(target, wpConfig, item.generatedTags);
      if (tags.length > 0) {
        postData.tags = tags;
      }
      
      console.log(`[${requestId}] Publishing with ${categories.length} categories and ${tags.length} tags`);

      console.log(`[${requestId}] Step 7: Search for existing WP post by meta`);
      const existingPostId = await this.findExistingPostByMeta(
        wpConfig,
        storyHash,
        canonicalUrl
      );

      let wpPostId: number;
      let permalink: string;

      if (existingPostId) {
        console.log(`[${requestId}] Updating existing post: ${existingPostId}`);
        const updateResult = await this.updateWordPressPost(
          wpConfig,
          existingPostId,
          postData
        );
        wpPostId = updateResult.id;
        permalink = updateResult.link;
      } else {
        console.log(`[${requestId}] Creating new post`);
        const createResult = await this.createWordPressPost(wpConfig, postData);
        wpPostId = createResult.id;
        permalink = createResult.link;
      }

      console.log(`[${requestId}] Step 8: Update pipeline item as published`);
      await storage.updatePipelineItem(pipelineItemId, {
        status: "published",
        targetId,
        targetPostId: wpPostId.toString(),
        targetPermalink: permalink,
        publishedAt: new Date(),
        storyHash,
        canonicalSourceUrl: canonicalUrl,
        featuredImageUrl: imageUrl,
        featuredImageMediaId: featuredMediaId?.toString(),
      });

      console.log(`[${requestId}] ✅ Publish complete: ${permalink}`);
      return {
        success: true,
        postId: wpPostId,
        permalink,
        metadata: {
          storyHash,
          imageUploaded: !!featuredMediaId,
        },
      };
    } catch (error) {
      console.error(`[${requestId}] Publish failed:`, error);
      
      await storage.updatePipelineItem(pipelineItemId, {
        status: "quarantined",
        quarantineReason: "publish_failed",
        lastErrorMessage: error instanceof Error ? error.message : "Unknown error",
        lastErrorPayload: { error: String(error) },
        publishAttempts: (await storage.getPipelineItem(pipelineItemId))?.publishAttempts || 0 + 1,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private parseWordPressConfig(target: PublishingTarget): WordPressConfig | null {
    try {
      const config = target.configJson as any;
      if (!config || !config.siteUrl || !config.username || !config.appPassword) {
        return null;
      }
      return {
        siteUrl: config.siteUrl.replace(/\/$/, ""),
        username: config.username,
        appPassword: config.appPassword,
      };
    } catch {
      return null;
    }
  }

  private async findExistingPostByMeta(
    config: WordPressConfig,
    storyHash: string,
    canonicalUrl: string
  ): Promise<number | null> {
    try {
      const searchUrl = `${config.siteUrl}/wp-json/wp/v2/posts?meta_key=content_santa_story_hash&meta_value=${encodeURIComponent(
        storyHash
      )}&per_page=1`;

      const auth = Buffer.from(`${config.username}:${config.appPassword}`).toString("base64");

      const response = await fetch(searchUrl, {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
        },
      });

      if (response.ok) {
        const posts = (await response.json()) as any[];
        if (posts.length > 0) {
          return posts[0].id;
        }
      }
    } catch (error) {
      console.error("Error searching for existing post:", error);
    }

    return null;
  }

  private async createWordPressPost(
    config: WordPressConfig,
    postData: any
  ): Promise<{ id: number; link: string }> {
    const url = `${config.siteUrl}/wp-json/wp/v2/posts`;
    const auth = Buffer.from(`${config.username}:${config.appPassword}`).toString("base64");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(postData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WP post create failed: ${response.status} ${errorText}`);
    }

    const result = (await response.json()) as any;
    return { id: result.id, link: result.link };
  }

  private async updateWordPressPost(
    config: WordPressConfig,
    postId: number,
    postData: any
  ): Promise<{ id: number; link: string }> {
    const url = `${config.siteUrl}/wp-json/wp/v2/posts/${postId}`;
    const auth = Buffer.from(`${config.username}:${config.appPassword}`).toString("base64");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(postData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WP post update failed: ${response.status} ${errorText}`);
    }

    const result = (await response.json()) as any;
    return { id: result.id, link: result.link };
  }

  private async resolveCategoryIds(
    target: PublishingTarget,
    config: WordPressConfig,
    categoryName?: string
  ): Promise<number[]> {
    if (!categoryName) return [];

    try {
      const cached = await storage.getWpTaxonomyCache(target.id, "category");
      const match = cached.find(
        (c) => c.name.toLowerCase() === categoryName.toLowerCase()
      );
      if (match) {
        return [match.wpId];
      }
    } catch (error) {
      console.error("Error resolving category:", error);
    }

    return [];
  }

  private async resolveTagIds(
    target: PublishingTarget,
    config: WordPressConfig,
    tags?: any
  ): Promise<number[]> {
    if (!tags || !Array.isArray(tags)) return [];

    const tagNames = tags.filter((t) => typeof t === "string");
    if (tagNames.length === 0) return [];

    try {
      const cached = await storage.getWpTaxonomyCache(target.id, "tag");
      const tagIds: number[] = [];

      for (const tagName of tagNames) {
        const match = cached.find((t) => t.name.toLowerCase() === tagName.toLowerCase());
        if (match) {
          tagIds.push(match.wpId);
        }
      }

      return tagIds;
    } catch (error) {
      console.error("Error resolving tags:", error);
      return [];
    }
  }
}

export const enhancedPublisher = new EnhancedWordPressPublisher();
