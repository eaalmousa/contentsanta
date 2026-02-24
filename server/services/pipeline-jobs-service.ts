import { storage } from "../storage";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { processWorkflowWithAI } from "../ai-workflow";
import { enhancedPublisher } from "./enhanced-publisher";
import { publishingPreflight } from "./publishing-preflight";
import { aiImageService } from "./ai-image-service";
import { duplicateDetectionService } from "./duplicate-detection-service";
import type {
  Topic,
  PipelineItem,
  InsertPipelineItem,
  InsertAutomationJobRun,
  InsertPublishAttempt,
  InsertWpPullJob,
  PipelineItemStatus,
  AutomationJobType,
  AutomationJobStatus,
  WorkflowType,
  PublishingTarget,
} from "@shared/schema";
import crypto from "crypto";

// Externalized configuration - read from environment variables
const MAX_RETRY_COUNT = parseInt(process.env.PIPELINE_MAX_RETRIES || "5", 10);
const RETRY_BACKOFF_MINUTES = [1, 5, 20, 60, 360];

/**
 * Check if a DALL-E image URL has expired
 * DALL-E URLs expire after 2 hours based on the 'se' (expiry) parameter
 */
function isDallEUrlExpired(url: string): boolean {
  if (!url || !url.includes('oaidalleapiprodscus.blob.core.windows.net')) {
    return false; // Not a DALL-E URL
  }

  try {
    // Extract expiration time from URL (se= parameter)
    const match = url.match(/se=([^&]+)/);
    if (!match) return false;

    const expirationStr = decodeURIComponent(match[1]);
    const expirationDate = new Date(expirationStr);
    const now = new Date();

    // Add 30 second buffer to prevent race conditions
    return now.getTime() > (expirationDate.getTime() - 30000);
  } catch (error) {
    console.error("Error checking DALL-E URL expiration:", error);
    return false;
  }
}

/**
 * Regenerate expired DALL-E image and update pipeline item
 * Returns the new URL, or the original URL if regeneration fails
 */
async function regenerateExpiredImage(
  pipelineItemId: string,
  currentUrl: string,
  title: string,
  excerpt: string
): Promise<string> {
  const requestId = `img-regen-${Date.now().toString(36)}`;
  
  console.log(`[${requestId}] DALL-E URL expired for item ${pipelineItemId}, regenerating...`);
  
  try {
    const result = await aiImageService.generateFeaturedImage(title, excerpt, "realistic");
    
    if (!result.success || !result.imageUrl) {
      console.error(`[${requestId}] Failed to regenerate: ${result.error}`);
      return currentUrl; // Return original URL as fallback
    }
    
    console.log(`[${requestId}] ✅ New image generated: ${result.imageUrl.substring(0, 80)}...`);
    
    // Update pipeline item with new URL
    await storage.updatePipelineItem(pipelineItemId, {
      featuredImageUrl: result.imageUrl,
      aiGeneratedImageUrl: result.imageUrl,
      updatedAt: new Date(),
    });
    
    console.log(`[${requestId}] ✅ Pipeline item updated with new image URL`);
    return result.imageUrl;
  } catch (error) {
    console.error(`[${requestId}] Error regenerating image:`, error);
    return currentUrl; // Return original URL as fallback
  }
}

interface JobResult {
  jobRunId: string;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  quarantined: number;
  errors: string[];
}

async function createJobRun(
  workspaceId: string,
  topicId: string,
  jobType: AutomationJobType
): Promise<string> {
  // Validate workspace exists to prevent FK constraint violations
  const workspace = await storage.getWorkspace(workspaceId);
  if (!workspace) {
    throw new Error(`WORKSPACE_NOT_FOUND: Workspace ${workspaceId} does not exist. Cannot create job run.`);
  }
  
  // Validate topic exists
  const topic = await storage.getTopic(topicId);
  if (!topic) {
    throw new Error(`TOPIC_NOT_FOUND: Topic ${topicId} does not exist. Cannot create job run.`);
  }
  
  const run = await storage.createAutomationJobRun({
    workspaceId,
    topicId,
    jobType,
    status: "running" as AutomationJobStatus,
    startedAt: new Date(),
    processedCount: 0,
    successCount: 0,
    failCount: 0,
    skippedCount: 0,
    quarantinedCount: 0,
  });
  return run.id;
}

async function finalizeJobRun(
  jobRunId: string,
  result: JobResult,
  status: AutomationJobStatus = "success"
): Promise<void> {
  await storage.updateAutomationJobRun(jobRunId, {
    status,
    endedAt: new Date(),
    processedCount: result.processed,
    successCount: result.success,
    failCount: result.failed,
    skippedCount: result.skipped,
    quarantinedCount: result.quarantined,
    errorSummary: result.errors.length > 0 ? result.errors.join("; ") : null,
    logs: result.errors.length > 0 ? result.errors : null,
  });
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function generateDedupeHash(title: string): string {
  const normalized = normalizeText(title);
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

function matchesKeywords(
  text: string,
  includeKeywords: string[],
  excludeKeywords: string[]
): { matches: boolean; reason?: string } {
  const normalizedText = text.toLowerCase();

  if (excludeKeywords.length > 0) {
    for (const keyword of excludeKeywords) {
      if (normalizedText.includes(keyword.toLowerCase())) {
        return { matches: false, reason: `Excluded keyword: ${keyword}` };
      }
    }
  }

  if (includeKeywords.length > 0) {
    const hasInclude = includeKeywords.some((kw) =>
      normalizedText.includes(kw.toLowerCase())
    );
    if (!hasInclude) {
      return { matches: false, reason: "No include keywords matched" };
    }
  }

  return { matches: true };
}

/**
 * Detect language of text based on character sets
 * Returns: 'ar' for Arabic, 'en' for English, or 'unknown'
 */
function detectLanguage(text: string): string {
  if (!text) return 'unknown';
  
  // Arabic Unicode range: U+0600 to U+06FF
  const arabicRegex = /[\u0600-\u06FF]/;
  
  // Check if text contains Arabic characters
  if (arabicRegex.test(text)) {
    return 'ar';
  }
  
  // Default to English if no Arabic detected
  // (Could be enhanced with more sophisticated detection)
  return 'en';
}

function isInQuietHours(quietHours: { start: string; end: string; tz?: string } | null): boolean {
  if (!quietHours) return false;

  const now = new Date();
  const [startHour, startMin] = quietHours.start.split(":").map(Number);
  const [endHour, endMin] = quietHours.end.split(":").map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

async function getPipelineItemsByTopic(topicId: string): Promise<PipelineItem[]> {
  return storage.getPipelineItems(topicId);
}

async function getTopicStoryRelevance(topicId: string, storyId: string): Promise<{ relevanceScore: string } | null> {
  const topicStories = await storage.getTopicStories(topicId);
  const match = topicStories.find((ts: { storyId: string; relevanceScore?: string | null }) => ts.storyId === storyId);
  return match ? { relevanceScore: match.relevanceScore || "0.5" } : null;
}

export async function runFetchJob(topic: Topic): Promise<JobResult> {
  const jobRunId = await createJobRun(topic.workspaceId, topic.id, "fetch");
  const result: JobResult = {
    jobRunId,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    quarantined: 0,
    errors: [],
  };

  try {
    console.log(`[FetchJob:${topic.id}] Starting fetch for topic: ${topic.name}`);

    const enabledSourceIds = await storage.getEnabledSourceIdsForTopic(topic.id);
    if (enabledSourceIds.length === 0) {
      console.log(`[FetchJob:${topic.id}] No enabled sources, skipping`);
      result.skipped = 1;
      await finalizeJobRun(jobRunId, result, "success");
      return result;
    }

    // Get stories linked to this topic via topic_stories (from topic discovery)
    // This includes stories from any workspace that match this topic's keywords
    const topicStoriesWithStory = await storage.getTopicStories(topic.id);
    const recentStories = topicStoriesWithStory.map(ts => ts.story);
    console.log(`[FetchJob:${topic.id}] Found ${recentStories.length} stories linked to topic`);
    
    const existingItems = await getPipelineItemsByTopic(topic.id);
    const existingItemStoryIds = new Set(existingItems.map((i: PipelineItem) => i.storyId));

    let created = 0;
    for (const story of recentStories) {
      if (existingItemStoryIds.has(story.id)) continue;

      result.processed++;

      const newItem: InsertPipelineItem = {
        workspaceId: topic.workspaceId,
        topicId: topic.id,
        storyId: story.id,
        status: "fetched" as PipelineItemStatus,
        dedupeHash: generateDedupeHash(story.canonicalTitle),
      };

      await storage.createPipelineItem(newItem);
      created++;
      result.success++;
    }

    console.log(`[FetchJob:${topic.id}] Created ${created} new pipeline items`);
    await finalizeJobRun(jobRunId, result, "success");
  } catch (error: any) {
    result.errors.push(error.message);
    result.failed++;
    await finalizeJobRun(jobRunId, result, "fail");
    console.error(`[FetchJob:${topic.id}] Error:`, error.message);
  }

  return result;
}

export async function runMatchAndRankJob(topic: Topic): Promise<JobResult> {
  const jobRunId = await createJobRun(topic.workspaceId, topic.id, "match");
  const result: JobResult = {
    jobRunId,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    quarantined: 0,
    errors: [],
  };

  try {
    console.log(`[MatchJob:${topic.id}] Starting match/rank for topic: ${topic.name}`);

    const items = await getPipelineItemsByTopic(topic.id);
    const fetchedItems = items.filter((i: PipelineItem) => i.status === "fetched");

    const includeKeywords = (topic.includeKeywords as string[]) || [];
    const excludeKeywords = (topic.excludeKeywords as string[]) || [];

    const publishedHashes = new Set(
      items
        .filter((i: PipelineItem) => i.status === "published" || i.status === "verified")
        .map((i: PipelineItem) => i.dedupeHash)
    );

    for (const item of fetchedItems) {
      result.processed++;

      const story = await storage.getStory(item.storyId);
      if (!story) {
        await storage.updatePipelineItem(item.id, {
          status: "skipped" as PipelineItemStatus,
          lastErrorMessage: "Story not found",
        });
        result.skipped++;
        continue;
      }

      const searchText = `${story.canonicalTitle} ${story.excerpt || ""}`;
      const keywordMatch = matchesKeywords(searchText, includeKeywords, excludeKeywords);

      if (!keywordMatch.matches) {
        await storage.updatePipelineItem(item.id, {
          status: "skipped" as PipelineItemStatus,
          skipReason: keywordMatch.reason,
          lastErrorMessage: keywordMatch.reason,
        });
        result.skipped++;
        continue;
      }

      // Language filter: Skip if topic requires specific language
      if (topic.language) {
        const detectedLanguage = detectLanguage(story.canonicalTitle);
        if (detectedLanguage !== topic.language) {
          await storage.updatePipelineItem(item.id, {
            status: "skipped" as PipelineItemStatus,
            skipReason: `Language mismatch (detected: ${detectedLanguage}, required: ${topic.language})`,
            lastErrorMessage: `Language mismatch: expected ${topic.language}, got ${detectedLanguage}`,
            languageDetected: detectedLanguage,
          });
          result.skipped++;
          continue;
        }
        
        // Store detected language for items that pass the filter
        await storage.updatePipelineItem(item.id, { 
          status: "matched" as PipelineItemStatus,
          languageDetected: detectedLanguage,
        });
      } else {
        await storage.updatePipelineItem(item.id, { status: "matched" as PipelineItemStatus });
      }

      if (publishedHashes.has(item.dedupeHash)) {
        await storage.updatePipelineItem(item.id, {
          status: "skipped" as PipelineItemStatus,
          lastErrorMessage: "Duplicate of published content",
        });
        result.skipped++;
        continue;
      }

      await storage.updatePipelineItem(item.id, { status: "deduped" as PipelineItemStatus });

      const topicStory = await getTopicStoryRelevance(topic.id, story.id);
      const score = topicStory?.relevanceScore
        ? parseFloat(topicStory.relevanceScore)
        : 0.5;

      await storage.updatePipelineItem(item.id, {
        status: "ranked" as PipelineItemStatus,
        score: score.toString(),
      });

      result.success++;
    }

    console.log(`[MatchJob:${topic.id}] Processed ${result.processed}, success: ${result.success}, skipped: ${result.skipped}`);
    await finalizeJobRun(jobRunId, result, "success");
  } catch (error: any) {
    result.errors.push(error.message);
    result.failed++;
    await finalizeJobRun(jobRunId, result, "fail");
    console.error(`[MatchJob:${topic.id}] Error:`, error.message);
  }

  return result;
}

export async function runGenerateJob(topic: Topic): Promise<JobResult> {
  const jobRunId = await createJobRun(topic.workspaceId, topic.id, "generate");
  const result: JobResult = {
    jobRunId,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    quarantined: 0,
    errors: [],
  };

  try {
    console.log(`[GenerateJob:${topic.id}] Starting content generation for topic: ${topic.name}`);

    const items = await getPipelineItemsByTopic(topic.id);
    const rankedItems = items
      .filter((i: PipelineItem) => i.status === "ranked")
      .sort((a: PipelineItem, b: PipelineItem) => parseFloat(b.score || "0") - parseFloat(a.score || "0"))
      .slice(0, 5);

    for (const item of rankedItems) {
      result.processed++;

      const story = await storage.getStory(item.storyId);
      if (!story) {
        await storage.updatePipelineItem(item.id, {
          status: "quarantined" as PipelineItemStatus,
          lastErrorCode: "STORY_NOT_FOUND",
          lastErrorMessage: "Story data missing",
        });
        result.quarantined++;
        continue;
      }

      try {
        const storyItems = await storage.getStoryItems(story.id);
        const firstItem = storyItems[0];
        let sourceUrl = "";
        if (firstItem) {
          const sourceItem = await storage.getSourceItem(firstItem.sourceItemId);
          sourceUrl = sourceItem?.url || "";
        }

        const input = await storage.createInput({
          workspaceId: topic.workspaceId,
          type: "url",
          title: story.canonicalTitle,
          sourceUrl,
          rawText: story.excerpt || story.canonicalTitle,
          language: topic.language || "en",
        });

        const workflowType: WorkflowType = "seo_blog";
        const workflowRun = await storage.createWorkflowRun({
          workspaceId: topic.workspaceId,
          inputId: input.id,
          workflowType,
        });

        const aiResult = await processWorkflowWithAI(
          workflowRun.id,
          input.id,
          workflowType,
          topic.workspaceId,
          undefined
        );

        if (aiResult.success && aiResult.assetId) {
          const latestVersion = await storage.getLatestAssetVersion(aiResult.assetId);
          
          if (latestVersion?.title && latestVersion?.body) {
            // === STEP 1: Extract/Generate Featured Image ===
            const { FeaturedImageService } = await import("./featured-image-service");
            const { aiImageService } = await import("./ai-image-service");
            const imageService = new FeaturedImageService();
            
            let finalImageUrl = null;
            let finalImageCredit = null;
            let finalImageCaption = null;
            let aiGeneratedUrl = null;
            
            try {
              // Try to extract image from source article
              const imageResult = await imageService.extractImageFromStory(story.id);
              
              if (imageResult.url && imageResult.source !== "none") {
                finalImageUrl = imageResult.url;
                finalImageCredit = imageResult.credit || story.sourceName || "Source Article";
                finalImageCaption = imageResult.caption || latestVersion.title;
                console.log(`[GenerateJob:${topic.id}] ✅ Extracted featured image from ${imageResult.source}`);
              } else {
                // No source image found - generate with AI
                console.log(`[GenerateJob:${topic.id}] No source image found, generating with AI...`);
                const aiImageResult = await aiImageService.generateFeaturedImage(
                  latestVersion.title,
                  latestVersion.body.substring(0, 500),
                  "realistic"
                );
                
                if (aiImageResult.success && aiImageResult.imageUrl) {
                  aiGeneratedUrl = aiImageResult.imageUrl;
                  finalImageUrl = aiImageResult.imageUrl;
                  finalImageCredit = "AI Generated Image";
                  finalImageCaption = latestVersion.title;
                  console.log(`[GenerateJob:${topic.id}] ✅ AI image generated successfully`);
                } else {
                  console.warn(`[GenerateJob:${topic.id}] ⚠️ AI image generation failed: ${aiImageResult.error}`);
                }
              }
            } catch (imageError: any) {
              console.error(`[GenerateJob:${topic.id}] Error handling featured image:`, imageError.message);
              // Continue without image - not critical
            }
            
            // === STEP 2: Update Pipeline Item with Content + Images ===
            await storage.updatePipelineItem(item.id, {
              status: "generated" as PipelineItemStatus,
              generatedTitle: latestVersion.title,
              generatedBody: latestVersion.body,
              generatedExcerpt: latestVersion.body.slice(0, 200) + "...",
              generatedTags: [],
              generatedCategory: topic.name,
              featuredImageUrl: finalImageUrl,
              featuredImageCredit: finalImageCredit,
              featuredImageCaption: finalImageCaption,
              aiGeneratedImageUrl: aiGeneratedUrl,
            });
            
            const existingDraft = await storage.getDraftByPipelineItemId(item.id);
            if (!existingDraft) {
              const storyItems = await storage.getStoryItems(story.id);
              const sources = storyItems.slice(0, 5).map((si: any) => ({
                name: si.sourceName || "Unknown Source",
                url: si.sourceUrl || "",
              }));
              
              await storage.createDraft({
                workspaceId: topic.workspaceId,
                topicId: topic.id,
                storyId: story.id,
                pipelineItemId: item.id,
                title: latestVersion.title,
                angle: story.excerpt || undefined,
                body: latestVersion.body,
                provenance: sources,
                status: topic.automationMode === "auto" ? "approved" : "pending",
                automationSource: "pipeline",
              });
              console.log(`[GenerateJob:${topic.id}] Created draft for pipeline item ${item.id}`);
            }
            
            result.success++;
          } else {
            throw new Error("Generated content missing title or body");
          }
        } else {
          await storage.updatePipelineItem(item.id, {
            status: "retrying" as PipelineItemStatus,
            retryCount: (item.retryCount || 0) + 1,
            lastErrorCode: "GENERATION_FAILED",
            lastErrorMessage: aiResult.error || "AI generation failed",
          });
          result.failed++;
        }
      } catch (error: any) {
        await storage.updatePipelineItem(item.id, {
          status: "retrying" as PipelineItemStatus,
          retryCount: (item.retryCount || 0) + 1,
          lastErrorCode: "GENERATION_ERROR",
          lastErrorMessage: error.message,
        });
        result.failed++;
        result.errors.push(`Item ${item.id}: ${error.message}`);
      }
    }

    console.log(`[GenerateJob:${topic.id}] Generated ${result.success}/${result.processed} items`);
    await finalizeJobRun(jobRunId, result, "success");
  } catch (error: any) {
    result.errors.push(error.message);
    await finalizeJobRun(jobRunId, result, "fail");
    console.error(`[GenerateJob:${topic.id}] Error:`, error.message);
  }

  return result;
}

export async function runQualityGateJob(topic: Topic): Promise<JobResult> {
  const jobRunId = await createJobRun(topic.workspaceId, topic.id, "gate");
  const result: JobResult = {
    jobRunId,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    quarantined: 0,
    errors: [],
  };

  try {
    console.log(`[GateJob:${topic.id}] Running quality gate for topic: ${topic.name}`);

    const items = await getPipelineItemsByTopic(topic.id);
    const generatedItems = items.filter((i: PipelineItem) => i.status === "generated");

    for (const item of generatedItems) {
      result.processed++;

      if (!item.generatedTitle || !item.generatedBody) {
        await storage.updatePipelineItem(item.id, {
          status: "quarantined" as PipelineItemStatus,
          lastErrorCode: "INVALID_CONTENT",
          lastErrorMessage: "Missing generated title or body",
        });
        result.quarantined++;
        continue;
      }

      if (item.generatedBody.length < 100) {
        await storage.updatePipelineItem(item.id, {
          status: "quarantined" as PipelineItemStatus,
          lastErrorCode: "CONTENT_TOO_SHORT",
          lastErrorMessage: "Generated content is too short",
        });
        result.quarantined++;
        continue;
      }

      const score = parseFloat(item.score || "0");
      if (score < 0.3) {
        await storage.updatePipelineItem(item.id, {
          status: "skipped" as PipelineItemStatus,
          lastErrorMessage: "LOW_RELEVANCE: Score below threshold",
        });
        result.skipped++;
        continue;
      }

      await storage.updatePipelineItem(item.id, {
        status: "gated" as PipelineItemStatus,
      });
      result.success++;
    }

    console.log(`[GateJob:${topic.id}] Gated ${result.success}/${result.processed} items`);
    await finalizeJobRun(jobRunId, result, "success");
  } catch (error: any) {
    result.errors.push(error.message);
    await finalizeJobRun(jobRunId, result, "fail");
    console.error(`[GateJob:${topic.id}] Error:`, error.message);
  }

  return result;
}

function getTimezoneOffsetMs(timezone: string, utcDate: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(utcDate);
  
  const getPart = (type: string) => {
    const part = parts.find(p => p.type === type);
    return part ? parseInt(part.value, 10) : 0;
  };
  
  const tzYear = getPart("year");
  const tzMonth = getPart("month");
  const tzDay = getPart("day");
  const tzHour = getPart("hour") === 24 ? 0 : getPart("hour");
  const tzMinute = getPart("minute");
  const tzSecond = getPart("second");
  
  const tzAsUtc = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, tzSecond);
  return tzAsUtc - utcDate.getTime();
}

function createUtcFromWallClock(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  timezone: string
): Date {
  const estimateUtc = Date.UTC(year, month - 1, day, hours, minutes, 0);
  const offsetMs = getTimezoneOffsetMs(timezone, new Date(estimateUtc));
  return new Date(estimateUtc - offsetMs);
}

function getWallClockDate(utcDate: Date, timezone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(utcDate);
  
  const getPart = (type: string) => {
    const part = parts.find(p => p.type === type);
    return part ? parseInt(part.value, 10) : 0;
  };
  
  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
  };
}

/**
 * Get next publish time based on rapid publishing interval
 * Simpler logic for fast publishing (every N minutes sequentially)
 */
async function getNextPublishTimeForRapidPublishing(
  topic: Topic,
  storage: any
): Promise<Date> {
  const now = new Date();
  const intervalMinutes = topic.publishIntervalMinutes || 2; // Default 2 minutes
  
  // Get the most recent scheduled/published item for this topic
  const recentItems = await storage.getPipelineItems({
    topicId: topic.id,
    status: ["scheduled", "publishing", "published"],
    orderBy: "scheduledFor DESC",
    limit: 1
  });
  
  if (recentItems.length > 0) {
    const lastScheduledTime = recentItems[0].scheduledFor || recentItems[0].publishedAt;
    if (lastScheduledTime) {
      const lastTime = new Date(lastScheduledTime);
      // Schedule next item after interval from the last one
      const nextTime = new Date(lastTime.getTime() + intervalMinutes * 60 * 1000);
      
      // If calculated time is in the past, schedule immediately
      if (nextTime <= now) {
        return new Date(now.getTime() + 5000); // 5 seconds from now
      }
      
      return nextTime;
    }
  }
  
  // No previous items - schedule immediately
  return new Date(now.getTime() + 5000); // 5 seconds from now
}

function getNextPublishSlot(
  publishTimes: string[],
  timezone: string,
  articlesPerRun: number,
  runIntervalMinutes: number,
  existingScheduledItems: PipelineItem[],
  now: Date
): { slotTime: Date; offset: number } | null {
  if (!publishTimes || publishTimes.length === 0) {
    return null;
  }

  const nowWallClock = getWallClockDate(now, timezone);
  const sortedTimes = [...publishTimes].sort();

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const baseDate = new Date(Date.UTC(nowWallClock.year, nowWallClock.month - 1, nowWallClock.day));
    baseDate.setUTCDate(baseDate.getUTCDate() + dayOffset);
    const year = baseDate.getUTCFullYear();
    const month = baseDate.getUTCMonth() + 1;
    const day = baseDate.getUTCDate();

    for (const timeStr of sortedTimes) {
      const [hours, minutes] = timeStr.split(":").map(Number);
      
      try {
        const slotTimeUtc = createUtcFromWallClock(year, month, day, hours, minutes, timezone);
        
        if (slotTimeUtc <= now) {
          continue;
        }

        const slotEndUtc = new Date(slotTimeUtc.getTime() + articlesPerRun * runIntervalMinutes * 60 * 1000);
        const itemsInSlot = existingScheduledItems.filter((item) => {
          if (!item.scheduledFor) return false;
          const itemTime = new Date(item.scheduledFor);
          return itemTime >= slotTimeUtc && itemTime < slotEndUtc;
        });

        if (itemsInSlot.length < articlesPerRun) {
          const offset = itemsInSlot.length * runIntervalMinutes * 60 * 1000;
          return {
            slotTime: new Date(slotTimeUtc.getTime() + offset),
            offset: itemsInSlot.length,
          };
        }
      } catch (e) {
        console.error(`[ScheduleJob] Error parsing time slot:`, e);
        continue;
      }
    }
  }

  return null;
}

export async function runScheduleJob(topic: Topic): Promise<JobResult> {
  const jobRunId = await createJobRun(topic.workspaceId, topic.id, "schedule");
  const result: JobResult = {
    jobRunId,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    quarantined: 0,
    errors: [],
  };

  try {
    console.log(`[ScheduleJob:${topic.id}] Scheduling items for topic: ${topic.name}`);

    const items = await getPipelineItemsByTopic(topic.id);
    const gatedItems = items.filter((i: PipelineItem) => i.status === "gated");

    const dailyCap = topic.dailyCap || 5;
    const quietHours = topic.quietHours as { start: string; end: string; tz?: string } | null;
    
    const timezone = topic.timezone || "UTC";
    const publishTimes = (topic.publishTimes as string[] | null) || [];
    const articlesPerRun = Math.min(Math.max(topic.articlesPerRun || 3, 1), 5);
    const runIntervalMinutes = Math.max(topic.runIntervalMinutes || 5, 2);
    const minSpacing = topic.minSpacingMinutes || 30;

    const resetDate = topic.publishedTodayResetAt
      ? new Date(topic.publishedTodayResetAt).toDateString()
      : null;
    const today = new Date().toDateString();
    let publishedToday = resetDate === today ? (topic.publishedToday || 0) : 0;

    if (resetDate !== today) {
      await storage.updateTopic(topic.id, {
        publishedToday: 0,
        publishedTodayResetAt: new Date(),
      });
    }

    if (isInQuietHours(quietHours)) {
      console.log(`[ScheduleJob:${topic.id}] In quiet hours, skipping scheduling`);
      for (const _item of gatedItems) {
        result.processed++;
        result.skipped++;
      }
      await finalizeJobRun(jobRunId, result, "success");
      return result;
    }

    const scheduledItems = items.filter((i: PipelineItem) => i.status === "scheduled");
    const now = new Date();

    if (publishTimes.length > 0) {
      console.log(`[ScheduleJob:${topic.id}] Using publish times: ${publishTimes.join(", ")} (${timezone})`);
      
      for (const item of gatedItems) {
        result.processed++;

        if (publishedToday >= dailyCap) {
          await storage.updatePipelineItem(item.id, {
            status: "skipped" as PipelineItemStatus,
            lastErrorMessage: "DAILY_CAP: Daily publishing limit reached",
          });
          result.skipped++;
          continue;
        }

        const updatedScheduledItems = await getPipelineItemsByTopic(topic.id);
        const currentScheduled = updatedScheduledItems.filter((i: PipelineItem) => i.status === "scheduled");

        const slot = getNextPublishSlot(
          publishTimes,
          timezone,
          articlesPerRun,
          runIntervalMinutes,
          currentScheduled,
          now
        );

        if (!slot) {
          await storage.updatePipelineItem(item.id, {
            status: "skipped" as PipelineItemStatus,
            lastErrorMessage: "NO_SLOT: No available publish slot in next 7 days",
          });
          result.skipped++;
          continue;
        }

        await storage.updatePipelineItem(item.id, {
          status: "scheduled" as PipelineItemStatus,
          scheduledFor: slot.slotTime,
          targetId: topic.publishingTargetId,
        });

        publishedToday++;
        result.success++;
      }
    } else {
      let lastScheduledTime = scheduledItems.length > 0
        ? Math.max(...scheduledItems.map((i: PipelineItem) => new Date(i.scheduledFor || 0).getTime()))
        : Date.now();

      for (const item of gatedItems) {
        result.processed++;

        if (publishedToday >= dailyCap) {
          await storage.updatePipelineItem(item.id, {
            status: "skipped" as PipelineItemStatus,
            lastErrorMessage: "DAILY_CAP: Daily publishing limit reached",
          });
          result.skipped++;
          continue;
        }

        const intervalMinutes = topic.publishIntervalMinutes || topic.minSpacingMinutes || 2;
        const nextSlot = new Date(lastScheduledTime + intervalMinutes * 60 * 1000);

        await storage.updatePipelineItem(item.id, {
          status: "scheduled" as PipelineItemStatus,
          scheduledFor: nextSlot,
          targetId: topic.publishingTargetId,
        });

        lastScheduledTime = nextSlot.getTime();
        publishedToday++;
        result.success++;
      }
    }

    console.log(`[ScheduleJob:${topic.id}] Scheduled ${result.success} items`);
    await finalizeJobRun(jobRunId, result, "success");
  } catch (error: any) {
    result.errors.push(error.message);
    await finalizeJobRun(jobRunId, result, "fail");
    console.error(`[ScheduleJob:${topic.id}] Error:`, error.message);
  }

  return result;
}

export async function runPublishJob(topic: Topic): Promise<JobResult> {
  const jobRunId = await createJobRun(topic.workspaceId, topic.id, "publish");
  const result: JobResult = {
    jobRunId,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    quarantined: 0,
    errors: [],
  };

  try {
    console.log(`[PublishJob:${topic.id}] Publishing items for topic: ${topic.name}`);

    const items = await getPipelineItemsByTopic(topic.id);
    const now = new Date();
    
    // CRITICAL FIX: Filter out items already in "publishing" or "published" state to prevent duplicates
    const readyItems = items.filter(
      (i: PipelineItem) =>
        i.status === "scheduled" &&
        i.scheduledFor &&
        new Date(i.scheduledFor) <= now
    );
    
    // Additional safety check: quarantine any items stuck in "publishing" for > 5 minutes
    const stuckPublishingItems = items.filter(
      (i: PipelineItem) =>
        i.status === "publishing" &&
        i.updatedAt &&
        new Date(i.updatedAt).getTime() < Date.now() - 5 * 60 * 1000
    );
    
    if (stuckPublishingItems.length > 0) {
      console.log(`[PublishJob:${topic.id}] Found ${stuckPublishingItems.length} items stuck in "publishing" state - resetting to retrying`);
      for (const stuckItem of stuckPublishingItems) {
        await storage.updatePipelineItem(stuckItem.id, {
          status: "retrying" as PipelineItemStatus,
          lastErrorMessage: "Item stuck in publishing state - reset by reaper",
        });
      }
    }

    for (const item of readyItems) {
      result.processed++;

      if (!item.targetId) {
        await storage.updatePipelineItem(item.id, {
          status: "quarantined" as PipelineItemStatus,
          lastErrorCode: "NO_TARGET",
          lastErrorMessage: "No publishing target configured",
        });
        result.quarantined++;
        continue;
      }

      const target = await storage.getPublishingTarget(item.targetId);
      if (!target) {
        await storage.updatePipelineItem(item.id, {
          status: "quarantined" as PipelineItemStatus,
          lastErrorCode: "TARGET_NOT_FOUND",
          lastErrorMessage: "Publishing target not found",
        });
        result.quarantined++;
        continue;
      }

      // CRITICAL FIX: Language filter BEFORE publishing (catch items that bypassed match/rank)
      if (topic.language && item.generatedTitle) {
        const detectedLanguage = detectLanguage(item.generatedTitle);
        if (detectedLanguage !== topic.language && detectedLanguage !== 'unknown') {
          console.log(`[PublishJob:${topic.id}] Skipping item ${item.id}: Language mismatch (detected: ${detectedLanguage}, required: ${topic.language})`);
          await storage.updatePipelineItem(item.id, {
            status: "skipped" as PipelineItemStatus,
            skipReason: `Language mismatch (detected: ${detectedLanguage}, required: ${topic.language})`,
            lastErrorMessage: `Language mismatch: expected ${topic.language}, got ${detectedLanguage}`,
            languageDetected: detectedLanguage,
          });
          result.skipped++;
          continue;
        }
      }

      await storage.updatePipelineItem(item.id, {
        status: "publishing" as PipelineItemStatus,
        publishAttempts: (item.publishAttempts || 0) + 1,
      });

      const attemptNumber = (item.publishAttempts || 0) + 1;
      let errorCode = "PUBLISH_FAILED";
      let errorMessage = "";
      let responseStatus = 500;
      let responseBody: any = {};

      try {
        if (target.type === "wordpress_pull") {
          if (!target.siteId) {
            throw new Error("WP_PULL_NO_SITE_ID: WordPress Pull target missing siteId");
          }
          
          console.log(`[PublishJob:${topic.id}] Running preflight checks for item ${item.id}`);
          
          // CRITICAL: Apply preflight validation BEFORE creating wp_pull_job
          // This enforces sanitization, language policy, featured images, categories, and dedupe
          const preflightResult = await publishingPreflight.prepare(item.id, target.id);
          
          if (!preflightResult.success) {
            // Preflight failed - item is already quarantined by preflight service
            console.log(`[PublishJob:${topic.id}] Preflight failed for item ${item.id}: ${preflightResult.quarantineReason} - ${preflightResult.quarantineMessage}`);
            
            await storage.createPublishAttempt({
              pipelineItemId: item.id,
              targetId: item.targetId,
              attemptNumber,
              requestPayload: { title: item.generatedTitle, content: item.generatedBody },
              responseStatus: 400,
              responseBody: { 
                preflightFailed: true,
                quarantineReason: preflightResult.quarantineReason,
                message: preflightResult.quarantineMessage,
                metadata: preflightResult.metadata,
              },
              result: "quarantined",
            });
            
            result.quarantined++;
            continue;
          }
          
          // Preflight passed - use sanitized payload
          const payload = preflightResult.payload!;
          
          // Step 2G: Idempotency checks before creating job
          // 1. Check if pipeline_item already published
          if (item.targetPostId) {
            console.log(`[PublishJob:${topic.id}] Item ${item.id} already published (postId: ${item.targetPostId})`);
            result.skipped++;
            continue;
          }
          
          // 2. Check if active job already exists with same story_hash + target_id
          const existingJobCheck = await db.execute(sql`
            SELECT id FROM wp_pull_jobs
            WHERE target_id = ${target.id}
              AND story_hash = ${payload.storyHash}
              AND status IN ('queued', 'leased', 'processing')
            LIMIT 1
          `);
          
          if (existingJobCheck.rows.length > 0) {
            console.log(`[PublishJob:${topic.id}] Active job already exists for story_hash ${payload.storyHash.substring(0, 12)}`);
            await storage.updatePipelineItem(item.id, {
              status: "skipped" as PipelineItemStatus,
              skipReason: "duplicate_job_exists",
            });
            result.skipped++;
            continue;
          }
          
          // 3. ADVANCED DUPLICATE DETECTION: Check title similarity + content overlap
          const duplicateCheck = await duplicateDetectionService.checkDuplicateArticle(
            target.id,
            payload.storyHash,
            payload.title,
            item.id
          );
          
          if (duplicateCheck.isDuplicate) {
            console.log(`[PublishJob:${topic.id}] ⚠️  DUPLICATE DETECTED: ${duplicateCheck.reason}`);
            console.log(`  Current title: ${payload.title.substring(0, 60)}...`);
            console.log(`  Similarity score: ${((duplicateCheck.similarityScore || 0) * 100).toFixed(1)}%`);
            
            // Quarantine the duplicate
            await storage.updatePipelineItem(item.id, {
              status: "quarantined" as PipelineItemStatus,
              quarantineReason: `DUPLICATE: ${duplicateCheck.reason}`,
            });
            
            result.quarantined++;
            continue;
          }
          
          const slug = payload.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .slice(0, 50);
          
          // CRITICAL: Check if DALL-E image URL has expired and regenerate if needed
          let finalImageUrl = payload.featuredImageUrl;
          if (finalImageUrl && isDallEUrlExpired(finalImageUrl)) {
            console.log(`[PublishJob:${topic.id}] DALL-E URL expired for item ${item.id}, regenerating...`);
            finalImageUrl = await regenerateExpiredImage(
              item.id,
              finalImageUrl,
              payload.title,
              payload.excerpt || payload.title
            );
          }
          
          // Step 2F: Store sanitized payload in payload_json (canonical source for plugin)
          const wpJob: InsertWpPullJob = {
            targetId: target.id,
            siteId: target.siteId,
            storyId: item.storyId,
            pipelineItemId: item.id,
            title: payload.title,
            contentHtml: payload.contentHtml,
            postStatus: target.defaultPostStatus || "draft",
            categories: payload.categories,
            tags: payload.tags,
            excerpt: payload.excerpt,
            slug,
            sourceUrl: payload.canonicalSourceUrl,
            featuredImageUrl: finalImageUrl || null,
            featuredImageCredit: item.featuredImageCredit || null, // NEW: Image attribution
            featuredImageCaption: item.featuredImageCaption || null, // NEW: Image caption/alt
            metadataJson: {
              story_hash: payload.storyHash,
              canonical_source_url: payload.canonicalSourceUrl,
              source_name: payload.sourceName, // NEW: Source attribution
              pipeline_item_id: payload.pipelineItemId,
              image_credit: item.featuredImageCredit, // NEW: Store in metadata too
              image_caption: item.featuredImageCaption, // NEW: Store in metadata too
              ai_generated_image: item.aiGeneratedImageUrl ? true : false, // NEW: Flag AI images
            },
            // CRITICAL: Sanitized payload - plugin must read ONLY this field
            payloadJson: {
              title: payload.title,
              contentHtml: payload.contentHtml,
              excerpt: payload.excerpt,
              categoryIds: payload.categoryIds, // WordPress category IDs
              categories: payload.categories, // Category names (fallback)
              tags: payload.tags,
              featuredImageUrl: finalImageUrl,
              featuredImageCredit: item.featuredImageCredit, // NEW: For plugin to use
              featuredImageCaption: item.featuredImageCaption, // NEW: For plugin to use
              sourceName: payload.sourceName, // NEW: Source attribution for plugin
              storyHash: payload.storyHash,
              canonicalSourceUrl: payload.canonicalSourceUrl,
            },
            storyHash: payload.storyHash,
            status: "queued",
          };
          
          await storage.createWpPullJob(wpJob);
          
          // CRITICAL FIX: Mark item as published after job creation to prevent re-publishing
          // Mark as publishing (NOT published) - will be marked as published when WP plugin reports back
          await storage.updatePipelineItem(item.id, {
            status: "publishing" as PipelineItemStatus,
          });
          
          await storage.createPublishAttempt({
            pipelineItemId: item.id,
            targetId: item.targetId,
            attemptNumber,
            requestPayload: { 
              title: payload.title, 
              content: payload.contentHtml,
              categories: payload.categories,
              featuredImageUrl: payload.featuredImageUrl,
            },
            responseStatus: 200,
            responseBody: { 
              wpPullJobCreated: true,
              storyHash: payload.storyHash,
              preflightPassed: true,
              metadata: preflightResult.metadata,
            },
            result: "success",
          });
          
          console.log(`[PublishJob:${topic.id}] Created sanitized WP pull job for item ${item.id} (hash: ${payload.storyHash.substring(0, 12)}) - marked as published`);
          result.success++;
        } else {
          console.log(`[PublishJob:${topic.id}] Publishing with enhanced publisher for item ${item.id}`);
          
          const publishResult = await enhancedPublisher.publishPipelineItem(item.id, target.id);

          if (publishResult.success && publishResult.postId) {
            await storage.createPublishAttempt({
              pipelineItemId: item.id,
              targetId: item.targetId,
              attemptNumber,
              requestPayload: {
                title: item.generatedTitle,
                content: item.generatedBody,
                excerpt: item.generatedExcerpt,
              },
              responseStatus: 201,
              responseBody: { 
                postId: publishResult.postId, 
                postUrl: publishResult.permalink,
                metadata: publishResult.metadata,
              },
              result: "success",
            });

            await storage.updateTopic(topic.id, {
              publishedToday: (topic.publishedToday || 0) + 1,
              publishedTodayResetAt: new Date(),
            });

            console.log(`[PublishJob:${topic.id}] Published successfully: ${publishResult.permalink}`);
            result.success++;
          } else if (publishResult.quarantineReason) {
            console.log(`[PublishJob:${topic.id}] Item quarantined: ${publishResult.quarantineReason}`);
            result.quarantined++;
          } else {
            errorCode = "WP_PUBLISH_FAILED";
            errorMessage = publishResult.error || "WordPress publish failed";
            responseBody = { error: errorMessage };
            throw new Error(`${errorCode}: ${errorMessage}`);
          }
        }
      } catch (error: any) {
        // Parse structured error codes if present
        const errorStr = error.message || "Unknown error";
        if (errorStr.includes(":")) {
          const parts = errorStr.split(":");
          errorCode = parts[0].trim();
          errorMessage = parts.slice(1).join(":").trim();
        } else {
          errorMessage = errorStr;
        }
        
        const retryCount = (item.retryCount || 0) + 1;

        // ALWAYS create publish attempt, even for early failures
        await storage.createPublishAttempt({
          pipelineItemId: item.id,
          targetId: item.targetId,
          attemptNumber,
          requestPayload: {
            title: item.generatedTitle,
            content: item.generatedBody,
          },
          responseStatus,
          responseBody: responseBody.error ? responseBody : { error: errorMessage },
          result: "fail",
        });

        if (retryCount >= MAX_RETRY_COUNT) {
          await storage.updatePipelineItem(item.id, {
            status: "quarantined" as PipelineItemStatus,
            retryCount,
            lastErrorCode: errorCode,
            lastErrorMessage: errorMessage,
          });
          result.quarantined++;
        } else {
          await storage.updatePipelineItem(item.id, {
            status: "retrying" as PipelineItemStatus,
            retryCount,
            lastErrorCode: errorCode,
            lastErrorMessage: errorMessage,
          });
          result.failed++;
        }
        result.errors.push(`Item ${item.id}: ${errorMessage}`);
        console.error(`[PublishJob:${topic.id}] Item ${item.id} failed: [${errorCode}] ${errorMessage}`);
      }
    }

    console.log(`[PublishJob:${topic.id}] Published ${result.success}/${result.processed} items`);
    await finalizeJobRun(jobRunId, result, "success");
  } catch (error: any) {
    result.errors.push(error.message);
    await finalizeJobRun(jobRunId, result, "fail");
    console.error(`[PublishJob:${topic.id}] Error:`, error.message);
  }

  return result;
}

export async function runVerifyJob(topic: Topic): Promise<JobResult> {
  const jobRunId = await createJobRun(topic.workspaceId, topic.id, "verify");
  const result: JobResult = {
    jobRunId,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    quarantined: 0,
    errors: [],
  };

  try {
    console.log(`[VerifyJob:${topic.id}] Verifying published items for topic: ${topic.name}`);

    const items = await getPipelineItemsByTopic(topic.id);
    const publishedItems = items.filter((i: PipelineItem) => i.status === "published");

    for (const item of publishedItems) {
      result.processed++;

      if (!item.targetPostId || !item.targetId) {
        await storage.updatePipelineItem(item.id, {
          status: "quarantined" as PipelineItemStatus,
          lastErrorCode: "VERIFY_MISSING_DATA",
          lastErrorMessage: "Missing post ID or target for verification",
        });
        result.quarantined++;
        continue;
      }

      const target = await storage.getPublishingTarget(item.targetId);
      if (!target) {
        result.skipped++;
        continue;
      }

      try {
        const testResult = await testWordPressConnection(target);

        if (testResult.success) {
          await storage.updatePipelineItem(item.id, {
            status: "verified" as PipelineItemStatus,
            verifiedAt: new Date(),
          });
          result.success++;
        } else {
          const retryCount = (item.retryCount || 0) + 1;

          if (retryCount >= MAX_RETRY_COUNT) {
            await storage.updatePipelineItem(item.id, {
              status: "quarantined" as PipelineItemStatus,
              retryCount,
              lastErrorCode: "VERIFY_FAILED",
              lastErrorMessage: "Post verification failed after multiple attempts",
            });
            result.quarantined++;
          } else {
            await storage.updatePipelineItem(item.id, {
              status: "retrying" as PipelineItemStatus,
              retryCount,
              lastErrorCode: "VERIFY_NOT_FOUND",
              lastErrorMessage: "Post not found on target",
            });
            result.failed++;
          }
        }
      } catch (error: any) {
        result.failed++;
        result.errors.push(`Item ${item.id}: ${error.message}`);
      }
    }

    console.log(`[VerifyJob:${topic.id}] Verified ${result.success}/${result.processed} items`);
    await finalizeJobRun(jobRunId, result, "success");
  } catch (error: any) {
    result.errors.push(error.message);
    await finalizeJobRun(jobRunId, result, "fail");
    console.error(`[VerifyJob:${topic.id}] Error:`, error.message);
  }

  return result;
}

export async function runRetryJob(topic: Topic): Promise<JobResult> {
  const result: JobResult = {
    jobRunId: "",
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    quarantined: 0,
    errors: [],
  };

  try {
    console.log(`[RetryJob:${topic.id}] Processing retrying items for topic: ${topic.name}`);

    const items = await getPipelineItemsByTopic(topic.id);
    const retryingItems = items.filter((i: PipelineItem) => i.status === "retrying");

    for (const item of retryingItems) {
      result.processed++;

      const retryCount = item.retryCount || 0;
      if (retryCount >= MAX_RETRY_COUNT) {
        await storage.updatePipelineItem(item.id, {
          status: "quarantined" as PipelineItemStatus,
          lastErrorMessage: "Max retry attempts exceeded",
        });
        result.quarantined++;
        continue;
      }

      const backoffMinutes = RETRY_BACKOFF_MINUTES[retryCount] || 360;
      const lastUpdate = item.updatedAt ? new Date(item.updatedAt) : new Date(0);
      const nextRetry = new Date(lastUpdate.getTime() + backoffMinutes * 60 * 1000);

      if (new Date() < nextRetry) {
        result.skipped++;
        continue;
      }

      const errorCode = item.lastErrorCode || "";

      if (errorCode.includes("GENERATION") || errorCode === "CONTENT_TOO_SHORT") {
        await storage.updatePipelineItem(item.id, { status: "ranked" as PipelineItemStatus });
      } else if (errorCode.includes("PUBLISH") || errorCode === "MAX_RETRIES") {
        await storage.updatePipelineItem(item.id, { status: "scheduled" as PipelineItemStatus });
      } else if (errorCode.includes("VERIFY")) {
        await storage.updatePipelineItem(item.id, { status: "published" as PipelineItemStatus });
      } else {
        await storage.updatePipelineItem(item.id, { status: "ranked" as PipelineItemStatus });
      }

      result.success++;
    }

    console.log(`[RetryJob:${topic.id}] Processed ${result.success} retry items`);
  } catch (error: any) {
    result.errors.push(error.message);
    console.error(`[RetryJob:${topic.id}] Error:`, error.message);
  }

  return result;
}

export async function runFullPipelineForTopic(topic: Topic): Promise<{
  topicId: string;
  topicName: string;
  results: { [key: string]: JobResult };
  stoppedAtGate?: boolean;
}> {
  console.log(`[Pipeline:${topic.id}] Starting full pipeline run for: ${topic.name} (mode: ${topic.automationMode})`);

  const results: { [key: string]: JobResult } = {};

  // Step 1: Fetch RSS feeds for enabled sources (only if not fetched recently)
  try {
    const enabledSourceIds = await storage.getEnabledSourceIdsForTopic(topic.id);
    if (enabledSourceIds.length > 0) {
      const enabledSources = await storage.getSourcesByIds(enabledSourceIds);
      const activeSources = enabledSources.filter(s => s.isActive === "true");
      
      // Only fetch sources that haven't been fetched in the last 10 minutes
      const staleThresholdMinutes = 10;
      const staleThreshold = new Date(Date.now() - staleThresholdMinutes * 60 * 1000);
      const staleSources = activeSources.filter(s => 
        !s.lastFetchedAt || new Date(s.lastFetchedAt) < staleThreshold
      );
      
      console.log(`[Pipeline:${topic.id}] ${activeSources.length} enabled sources, ${staleSources.length} need fetching (>10min old)`);
      
      if (staleSources.length > 0) {
        const { fetchRSSSource } = await import("./rss-service");
        let fetchedCount = 0;
        
        // Limit to max 10 sources per pipeline run to prevent timeout
        const sourcesToFetch = staleSources.slice(0, 10);
        console.log(`[Pipeline:${topic.id}] Fetching ${sourcesToFetch.length} stale sources...`);
        
        for (const source of sourcesToFetch) {
          try {
            await fetchRSSSource(source);
            fetchedCount++;
          } catch (error: any) {
            console.error(`[Pipeline:${topic.id}] Failed to fetch source ${source.name}:`, error.message);
          }
        }
        console.log(`[Pipeline:${topic.id}] Fetched ${fetchedCount}/${sourcesToFetch.length} sources`);
      } else {
        console.log(`[Pipeline:${topic.id}] All sources recently fetched, skipping RSS fetch`);
      }
    }
  } catch (error: any) {
    console.error(`[Pipeline:${topic.id}] RSS fetch error (continuing):`, error.message);
  }

  // Step 2: Run topic discovery to link stories from enabled sources
  try {
    const { runTopicDiscovery } = await import("./topic-run-service");
    console.log(`[Pipeline:${topic.id}] Running topic discovery to link stories...`);
    await runTopicDiscovery(topic);
  } catch (error: any) {
    console.error(`[Pipeline:${topic.id}] Topic discovery error (continuing):`, error.message);
  }

  results.retry = await runRetryJob(topic);
  results.fetch = await runFetchJob(topic);
  results.match = await runMatchAndRankJob(topic);
  results.generate = await runGenerateJob(topic);
  results.gate = await runQualityGateJob(topic);
  
  if (topic.automationMode === "approval_required") {
    console.log(`[Pipeline:${topic.id}] Semi-auto mode - stopping at gate for human review`);
    return {
      topicId: topic.id,
      topicName: topic.name,
      results,
      stoppedAtGate: true,
    };
  }
  
  results.schedule = await runScheduleJob(topic);
  results.publish = await runPublishJob(topic);
  results.verify = await runVerifyJob(topic);

  console.log(`[Pipeline:${topic.id}] Completed full pipeline run`);

  return {
    topicId: topic.id,
    topicName: topic.name,
    results,
    stoppedAtGate: false,
  };
}

export async function runAllLivePipelines(): Promise<
  Array<{ topicId: string; topicName: string; results: { [key: string]: JobResult }; stoppedAtGate?: boolean; configError?: string }>
> {
  const liveTopics = await storage.getLiveTopics();
  const automatedTopics = liveTopics.filter(
    (t) => t.automationMode === "auto" || t.automationMode === "approval_required"
  );

  console.log(`[Pipeline] Running ${automatedTopics.length} automated/semi-auto pipelines`);

  const allResults = [];

  for (const topic of automatedTopics) {
    // Validate auto mode has publishing target configured
    if (topic.automationMode === "auto" && !topic.publishingTargetId) {
      console.error(`[Pipeline] Topic "${topic.name}" in auto mode but publishingTargetId is null`);
      
      const jobRunId = await createJobRun(topic.workspaceId, topic.id, "publish");
      const failResult: JobResult = {
        jobRunId,
        processed: 0,
        success: 0,
        failed: 0,
        skipped: 1,
        quarantined: 0,
        errors: ["AUTO_MODE_NO_TARGET: Topic in auto mode requires a publishing target to be configured"],
      };
      
      await finalizeJobRun(jobRunId, failResult, "fail");
      
      allResults.push({
        topicId: topic.id,
        topicName: topic.name,
        results: { publish: failResult },
        configError: "Auto mode requires publishing target",
      });
      continue;
    }
    
    // Validate publishing target exists and is reachable
    if (topic.publishingTargetId) {
      const target = await storage.getPublishingTarget(topic.publishingTargetId);
      if (!target) {
        console.error(`[Pipeline] Topic "${topic.name}" references non-existent target ${topic.publishingTargetId}`);
        
        const jobRunId = await createJobRun(topic.workspaceId, topic.id, "publish");
        const failResult: JobResult = {
          jobRunId,
          processed: 0,
          success: 0,
          failed: 0,
          skipped: 1,
          quarantined: 0,
          errors: [`TARGET_NOT_FOUND: Publishing target ${topic.publishingTargetId} does not exist`],
        };
        
        await finalizeJobRun(jobRunId, failResult, "fail");
        
        allResults.push({
          topicId: topic.id,
          topicName: topic.name,
          results: { publish: failResult },
          configError: "Publishing target not found",
        });
        continue;
      }
    }

    const result = await runFullPipelineForTopic(topic);
    allResults.push(result);
  }

  return allResults;
}
