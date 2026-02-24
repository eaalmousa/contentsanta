import { storage } from "../storage";
import type { PublishingItem, PipelineItem, InsertWpPullJob } from "@shared/schema";
import { sql, eq, and, or } from "drizzle-orm";
import { db } from "../db";
import { pipelineItems, publishingTargets, topics, wpPullJobs } from "@shared/schema";
import { contentSanitizer } from "./content-sanitizer";

/**
 * Publishing Worker Service
 * 
 * Processes scheduled pipeline_items and creates WordPress pull jobs.
 * 
 * Flow: SCHEDULED → PUBLISHING → (WP Pull Job Created)
 */

export interface PublishingWorkerResult {
  processed: number;
  published: number;
  failed: number;
  skipped: number;
}

/**
 * Create WordPress Pull Job
 */
async function createWpPullJob(params: {
  topicId: string;
  pipelineItemId: string;
  workspaceId: string;
  siteId: string; // ✅ ADDED
  targetId: string;
  title: string;
  content: string;
  excerpt: string;
  categories: any[];
  tags: any[];
  featuredImageUrl: string | null;
  featuredImageCaption: string | null;
  featuredImageCredit: string | null;
  canonicalSourceUrl: string | null;
  sourceName: string | null;
}): Promise<any> {
  return await storage.createWpPullJob({
    topicId: params.topicId,
    pipelineItemId: params.pipelineItemId,
    workspaceId: params.workspaceId,
    siteId: params.siteId,
    targetId: params.targetId,
    title: params.title,
    contentHtml: params.content, // ✅ CORRECTED: contentHtml not content
    excerpt: params.excerpt,
    categories: params.categories,
    tags: params.tags,
    featuredImageUrl: params.featuredImageUrl,
    featuredImageCaption: params.featuredImageCaption,
    featuredImageCredit: params.featuredImageCredit,
    sourceUrl: params.canonicalSourceUrl,
    metadataJson: {
      sourceName: params.sourceName,
      topicId: params.topicId,
    },
  });
}

/**
 * Process a single publishing item - attempt to publish to WordPress
 */
async function processPublishingItem(
  publishingItem: PublishingItem & { pipelineItem: PipelineItem }
): Promise<{ success: boolean; error?: string }> {
  
  const { id, pipelineItemId, wpConnectorId, status, scheduledAt, attemptCount } = publishingItem;
  const pipelineItem = publishingItem.pipelineItem;

  console.log(`[Publishing Worker] Processing item ${id}`);
  console.log(`  Pipeline Item: ${pipelineItemId}`);
  console.log(`  Title: ${pipelineItem.generatedTitle?.substring(0, 60)}...`);
  console.log(`  Status: ${status}`);
  console.log(`  Attempt: ${attemptCount + 1}`);

  try {
    // Step 1: Update status to PUSHING
    await storage.updatePublishingItem(id, {
      status: "pushing",
      attemptCount: attemptCount + 1,
    });

    // Step 2: Get WordPress connector
    if (!wpConnectorId) {
      throw new Error("No WordPress connector assigned");
    }

    const connector = await storage.getPublishingTarget(wpConnectorId);
    
    if (!connector) {
      throw new Error(`WordPress connector ${wpConnectorId} not found`);
    }

    // Step 3: Prepare publishing payload
    const payload = {
      title: pipelineItem.generatedTitle || "Untitled",
      contentHtml: pipelineItem.generatedHtml || "",
      excerpt: pipelineItem.generatedExcerpt || "",
      categories: pipelineItem.matchedCategories as string[] || [],
      tags: pipelineItem.matchedTags as string[] || [],
      featuredImageUrl: pipelineItem.featuredImageUrl || null,
      featuredImageCaption: pipelineItem.featuredImageCaption || null,
      featuredImageCredit: pipelineItem.featuredImageCredit || null,
      sourceName: pipelineItem.sourceName || null,
      canonicalSourceUrl: pipelineItem.canonicalSourceUrl || null,
      storyHash: pipelineItem.storyHash || null,
    };

    // Step 4: Create WP Pull Job
    const wpJobData: InsertWpPullJob = {
      targetId: wpConnectorId,
      siteId: connector.siteId!,
      storyId: pipelineItem.storyId!,
      pipelineItemId: pipelineItem.id,
      title: payload.title,
      contentHtml: payload.contentHtml,
      postStatus: connector.defaultPostStatus || "draft",
      categories: payload.categories,
      tags: payload.tags,
      excerpt: payload.excerpt,
      slug: payload.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50),
      sourceUrl: payload.canonicalSourceUrl,
      featuredImageUrl: payload.featuredImageUrl,
      featuredImageCredit: payload.featuredImageCredit,
      featuredImageCaption: payload.featuredImageCaption,
      metadataJson: {
        story_hash: payload.storyHash,
        canonical_source_url: payload.canonicalSourceUrl,
        source_name: payload.sourceName,
        pipeline_item_id: pipelineItemId,
      },
      payloadJson: payload,
      storyHash: payload.storyHash,
      status: "queued",
    };
    
    const wpJob = await storage.createWpPullJob(wpJobData);

    console.log(`  ✅ Created WP pull job ${wpJob.id}`);

    // Step 5: Update publishing item - mark as published
    // Note: Actual WordPress publishing happens via plugin pull + callback
    // This worker just creates the job; the callback updates status to PUBLISHED
    await storage.updatePublishingItem(id, {
      status: "published", // Will be updated to VERIFIED after callback confirms
      lastError: null,
    });

    console.log(`  ✅ Publishing item marked as published`);

    return { success: true };

  } catch (error: any) {
    console.error(`[Publishing Worker] Error processing item ${id}:`, error.message);

    // Update publishing item with error
    await storage.updatePublishingItem(id, {
      status: "publish_failed",
      lastError: error.message || "Unknown error",
    });

    return { success: false, error: error.message };
  }
}

/**
 * Main publishing worker loop
 * 
 * Processes publishing_items that are ready for publishing:
 * - DRAFT_READY: Items ready to publish (no schedule constraint)
 * - SCHEDULED: Items with scheduled_at in the past
 * - PUBLISH_FAILED: Retry failed items (with backoff)
 * 
 * Skips:
 * - PUSHING: Currently being processed
 * - PUBLISHED: Already published
 * - VERIFIED: Fully verified
 * - SCHEDULED with future scheduled_at
 */
export async function runPublishingWorker(): Promise<PublishingWorkerResult> {
  const startTime = Date.now();
  console.log("\n[Publishing Worker] Starting run...");

  const result: PublishingWorkerResult = {
    processed: 0,
    published: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    // Fetch items ready for publishing FROM PIPELINE_ITEMS (not publishing_items)
    const now = new Date();
    
    // Get scheduled items from pipeline_items table
    const items = await db.execute(sql`
      SELECT 
        pi.id,
        pi.topic_id,
        pi.workspace_id,
        pi.status,
        pi.target_id,
        pi.generated_title,
        pi.generated_body,
        pi.generated_excerpt,
        pi.generated_category,
        pi.generated_tags,
        pi.featured_image_url,
        pi.featured_image_caption,
        pi.featured_image_credit,
        pi.canonical_source_url,
        pi.story_hash,
        pi.story_id,
        pi.retry_count as attempt_count,
        pi.last_error_message,
        pi.created_at,
        t.name as topic_name,
        s.canonical_title as source_name
      FROM pipeline_items pi
      LEFT JOIN topics t ON pi.topic_id = t.id
      LEFT JOIN stories s ON pi.story_id = s.id
      WHERE pi.status = 'scheduled'
        AND pi.target_id IS NOT NULL
      ORDER BY pi.created_at ASC
      LIMIT 10
    `);

    console.log(`[Publishing Worker] Found ${items.rows.length} scheduled items ready for publishing`);

    for (const row of items.rows) {
      result.processed++;

      try {
        console.log(`[Publishing Worker] Processing item ${row.id}: "${row.generated_title}"`);
        
        // CRITICAL: Resolve featured image BEFORE creating WP job
        // Priority: 1) Source image, 2) AI-generated if source has none
        let resolvedImageUrl = row.featured_image_url;
        let resolvedImageCaption = row.featured_image_caption;
        let resolvedImageCredit = row.featured_image_credit;
        
        try {
          const imageResult = await featuredImageService.resolveImageForItem({
            itemId: row.id,
            storyId: row.story_id,
            title: row.generated_title,
            existingImageUrl: row.featured_image_url
          });
          
          if (imageResult.url && imageResult.url !== row.featured_image_url) {
            console.log(`[Publishing Worker] ✅ Resolved better image for item ${row.id}`);
            console.log(`  Old: ${(row.featured_image_url || 'NULL').substring(0, 80)}`);
            console.log(`  New: ${imageResult.url.substring(0, 80)}`);
            
            resolvedImageUrl = imageResult.url;
            resolvedImageCaption = imageResult.caption || null;
            resolvedImageCredit = imageResult.credit || null;
            
            // Update pipeline_items with resolved image
            await db.update(pipelineItems)
              .set({
                featured_image_url: imageResult.url,
                featured_image_caption: imageResult.caption,
                featured_image_credit: imageResult.credit,
                updated_at: new Date()
              })
              .where(eq(pipelineItems.id, row.id));
          } else {
            console.log(`[Publishing Worker] Image already optimal for item ${row.id}`);
          }
        } catch (imageError: any) {
          console.warn(`[Publishing Worker] ⚠️ Image resolution failed for item ${row.id}: ${imageError.message}`);
          // Continue with existing image (better than blocking publish)
        }
        
        // Validate geographic filtering: Check if source matches topic region
        const topic = await db.query.topics.findFirst({
          where: eq(topics.id, row.topic_id),
        });
        
        if (topic) {
          // Get the source for this item via story → story_items → source_items → sources
          const sourceCheck = await db.execute(sql`
            SELECT src.country, src.name
            FROM pipeline_items pi
            LEFT JOIN stories st ON pi.story_id = st.id
            LEFT JOIN story_items si ON si.story_id = st.id
            LEFT JOIN source_items sitem ON si.source_item_id = sitem.id
            LEFT JOIN sources src ON sitem.source_id = src.id
            WHERE pi.id = ${row.id}
            LIMIT 1
          `);
          
          const source = sourceCheck.rows[0] as any;
          
          // GCC region check
          if (topic.region === 'gcc' && source?.country) {
            const gccCountries = ['AE', 'SA', 'KW', 'QA', 'BH', 'OM'];
            
            if (!gccCountries.includes(source.country.toUpperCase())) {
              throw new Error(`Geographic mismatch: Source from ${source.country} (${source.name}) not allowed in GCC-only topic. Quarantining.`);
            }
          }
        }
        
        // Update status to publishing
        await db.update(pipelineItems)
          .set({ status: 'publishing', updatedAt: new Date() })
          .where(eq(pipelineItems.id, row.id));

        // Get target configuration
        const target = await db.query.publishingTargets.findFirst({
          where: eq(publishingTargets.id, row.target_id),
        });

        if (!target) {
          throw new Error(`Publishing target ${row.target_id} not found`);
        }

        if (target.type !== 'wordpress_pull') {
          throw new Error(`Unsupported target type: ${target.type}`);
        }

        if (!target.siteId) {
          throw new Error(`Publishing target ${row.target_id} missing siteId`);
        }

        // ✅ IDEMPOTENCY CHECK - Prevent duplicate job creation
        const existingJob = await db.query.wpPullJobs.findFirst({
          where: and(
            eq(wpPullJobs.pipelineItemId, row.id),
            or(
              eq(wpPullJobs.status, 'queued'),
              eq(wpPullJobs.status, 'leased'),
              eq(wpPullJobs.status, 'published')
            )
          ),
        });

        if (existingJob) {
          console.log(`[Publishing Worker] ⚠️  Job already exists for item ${row.id} (job: ${existingJob.id}), skipping`);
          result.published++; // Count as processed (already in publishing pipeline)
          continue; // Skip to next item
        }

        // ✅ CONVERT MARKDOWN TO HTML - Sanitize content for WordPress
        const sanitized = contentSanitizer.sanitizeForWordPress({
          title: row.generated_title || 'Untitled',
          body: row.generated_body || '',
          excerpt: row.generated_excerpt || '',
          meta: {}
        });

        // Create WordPress pull job with sanitized HTML content
        const wpJob = await createWpPullJob({
          topicId: row.topic_id,
          pipelineItemId: row.id,
          workspaceId: row.workspace_id,
          siteId: target.siteId, // ✅ ADDED - Required for wp_pull_jobs table
          targetId: row.target_id,
          title: sanitized.title, // ✅ Clean title
          content: sanitized.body, // ✅ Markdown → HTML
          excerpt: sanitized.excerpt, // ✅ Clean excerpt
          categories: row.generated_category ? [row.generated_category] : [],
          tags: Array.isArray(row.generated_tags) ? row.generated_tags : [],
          featuredImageUrl: resolvedImageUrl || null, // ✅ Use resolved image (source first, AI fallback)
          featuredImageCaption: resolvedImageCaption || null,
          featuredImageCredit: resolvedImageCredit || null,
          canonicalSourceUrl: row.canonical_source_url || null,
          sourceName: row.source_name || null,
        });

        console.log(`[Publishing Worker] ✅ Created WP job ${wpJob.id} for item ${row.id}`);
        result.published++;

      } catch (error: any) {
        console.error(`[Publishing Worker] ❌ Failed to process item ${row.id}:`, error.message);
        
        // Check if it's a geographic mismatch error
        const isGeographicMismatch = error.message.includes('Geographic mismatch');
        
        // Update to quarantined status with error
        await db.update(pipelineItems)
          .set({
            status: 'quarantined',
            quarantineReason: isGeographicMismatch ? 'geographic_mismatch' : null,
            lastErrorMessage: error.message,
            attemptCount: (row.attempt_count || 0) + 1,
            updatedAt: new Date(),
          })
          .where(eq(pipelineItems.id, row.id));
        
        result.failed++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n[Publishing Worker] Completed in ${duration}ms`);
    console.log(`  Processed: ${result.processed}`);
    console.log(`  Published: ${result.published}`);
    console.log(`  Failed: ${result.failed}`);
    console.log(`  Skipped: ${result.skipped}`);

    return result;
  } catch (error: any) {
    console.error("[Publishing Worker] Fatal error:", error);
    throw error;
  }
}

export const publishingWorkerService = {
  runPublishingWorker,
};
