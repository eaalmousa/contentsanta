import { storage } from "../storage";
import { processWorkflowWithAI } from "../ai-workflow";
import { publishToWordPress, testWordPressConnection } from "./wordpress-service";
import type {
  Topic,
  PipelineItem,
  InsertPipelineItem,
  InsertAutomationJobRun,
  InsertPublishAttempt,
  PipelineItemStatus,
  AutomationJobType,
  AutomationJobStatus,
  WorkflowType,
} from "@shared/schema";
import crypto from "crypto";

const MAX_RETRY_COUNT = 5;
const RETRY_BACKOFF_MINUTES = [1, 5, 20, 60, 360];

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

    const recentStories = await storage.getStories(topic.workspaceId);
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
          lastErrorMessage: keywordMatch.reason,
        });
        result.skipped++;
        continue;
      }

      await storage.updatePipelineItem(item.id, { status: "matched" as PipelineItemStatus });

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
            await storage.updatePipelineItem(item.id, {
              status: "generated" as PipelineItemStatus,
              generatedTitle: latestVersion.title,
              generatedBody: latestVersion.body,
              generatedExcerpt: latestVersion.body.slice(0, 200) + "...",
              generatedTags: [],
              generatedCategory: topic.name,
            });
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
    const minSpacing = topic.minSpacingMinutes || 120;
    const quietHours = topic.quietHours as { start: string; end: string; tz?: string } | null;

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

      const nextSlot = new Date(lastScheduledTime + minSpacing * 60 * 1000);

      await storage.updatePipelineItem(item.id, {
        status: "scheduled" as PipelineItemStatus,
        scheduledFor: nextSlot,
        targetId: topic.publishingTargetId,
      });

      lastScheduledTime = nextSlot.getTime();
      publishedToday++;
      result.success++;
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
    const readyItems = items.filter(
      (i: PipelineItem) =>
        i.status === "scheduled" &&
        i.scheduledFor &&
        new Date(i.scheduledFor) <= now
    );

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

      await storage.updatePipelineItem(item.id, {
        status: "publishing" as PipelineItemStatus,
        publishAttempts: (item.publishAttempts || 0) + 1,
      });

      try {
        const assetVersion = {
          id: item.id,
          assetId: item.id,
          title: item.generatedTitle || "Untitled",
          body: item.generatedBody || "",
          versionNo: 1,
          workflowType: "seo_blog" as const,
          createdAt: new Date(),
          language: topic.language || "en",
          channel: null,
          format: null,
          metadataJson: null,
          createdBy: null,
          runId: null,
        };

        const publishResult = await publishToWordPress(target, assetVersion, {
          status: "publish",
        });

        if (publishResult.success && publishResult.postId) {
          await storage.updatePipelineItem(item.id, {
            status: "published" as PipelineItemStatus,
            targetPostId: publishResult.postId,
            targetPermalink: publishResult.postUrl,
            publishedAt: new Date(),
          });

          await storage.createPublishAttempt({
            pipelineItemId: item.id,
            targetId: item.targetId,
            attemptNumber: (item.publishAttempts || 0) + 1,
            requestPayload: {
              title: item.generatedTitle,
              content: item.generatedBody,
              excerpt: item.generatedExcerpt,
            },
            responseStatus: 201,
            responseBody: { postId: publishResult.postId, postUrl: publishResult.postUrl },
            result: "success",
          });

          await storage.updateTopic(topic.id, {
            publishedToday: (topic.publishedToday || 0) + 1,
            publishedTodayResetAt: new Date(),
          });

          result.success++;
        } else {
          throw new Error(publishResult.error || "WordPress publish failed");
        }
      } catch (error: any) {
        const retryCount = (item.retryCount || 0) + 1;

        await storage.createPublishAttempt({
          pipelineItemId: item.id,
          targetId: item.targetId,
          attemptNumber: (item.publishAttempts || 0) + 1,
          requestPayload: {
            title: item.generatedTitle,
            content: item.generatedBody,
          },
          responseStatus: 500,
          responseBody: { error: error.message },
          result: "fail",
        });

        if (retryCount >= MAX_RETRY_COUNT) {
          await storage.updatePipelineItem(item.id, {
            status: "quarantined" as PipelineItemStatus,
            retryCount,
            lastErrorCode: "MAX_RETRIES",
            lastErrorMessage: error.message,
          });
          result.quarantined++;
        } else {
          await storage.updatePipelineItem(item.id, {
            status: "retrying" as PipelineItemStatus,
            retryCount,
            lastErrorCode: "PUBLISH_FAILED",
            lastErrorMessage: error.message,
          });
          result.failed++;
        }
        result.errors.push(`Item ${item.id}: ${error.message}`);
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
}> {
  console.log(`[Pipeline:${topic.id}] Starting full pipeline run for: ${topic.name}`);

  const results: { [key: string]: JobResult } = {};

  results.retry = await runRetryJob(topic);
  results.fetch = await runFetchJob(topic);
  results.match = await runMatchAndRankJob(topic);
  results.generate = await runGenerateJob(topic);
  results.gate = await runQualityGateJob(topic);
  results.schedule = await runScheduleJob(topic);
  results.publish = await runPublishJob(topic);
  results.verify = await runVerifyJob(topic);

  console.log(`[Pipeline:${topic.id}] Completed full pipeline run`);

  return {
    topicId: topic.id,
    topicName: topic.name,
    results,
  };
}

export async function runAllLivePipelines(): Promise<
  Array<{ topicId: string; topicName: string; results: { [key: string]: JobResult } }>
> {
  const liveTopics = await storage.getLiveTopics();
  const automatedTopics = liveTopics.filter(
    (t) => t.automationMode === "auto"
  );

  console.log(`[Pipeline] Running ${automatedTopics.length} automated pipelines`);

  const allResults = [];

  for (const topic of automatedTopics) {
    if (!topic.publishingTargetId) {
      console.log(`[Pipeline] Skipping ${topic.name} - no publishing target`);
      continue;
    }

    const result = await runFullPipelineForTopic(topic);
    allResults.push(result);
  }

  return allResults;
}
