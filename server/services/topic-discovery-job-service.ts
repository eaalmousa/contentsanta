/**
 * Topic Discovery Job Service
 * 
 * Optimized discovery execution with batch queries and incremental updates.
 * This is the worker function called by the job queue.
 */

import { storage } from "../storage";
import type { Topic } from "@shared/schema";
import { filterItemsByRelevance, scoreStoryRelevance, MIN_RELEVANCE_SCORE, TIER1_SOURCE_BOOST } from "./topic-relevance-service";
import { processNewItemsForClustering } from "./story-clustering-service";
import { db } from "../db";
import { sourceItems, storyItems, stories } from "@shared/schema";
import { eq, inArray, and, gt } from "drizzle-orm";

function normalizeTopicQuery(query: string): string {
  return query
    .replace(/["']/g, "")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Main job execution function
 * Called by job queue service
 */
export async function runTopicDiscoveryJob(topicId: string, jobId: string): Promise<void> {
  console.log(`[DiscoveryJob:${jobId}] Starting for topic ${topicId}`);
  
  const topic = await storage.getTopic(topicId);
  if (!topic) {
    throw new Error(`Topic ${topicId} not found`);
  }

  // DON'T set topic status to "running" - keep it "live"
  // Job status in automation_job_runs tracks execution state

  try {
    // Get enabled sources
    const enabledSourceIds = await storage.getEnabledSourceIdsForTopic(topic.id);
    
    if (enabledSourceIds.length === 0) {
      console.log(`[DiscoveryJob:${jobId}] No enabled sources, marking as success`);
      await completeJob(jobId, topic, 0, 0);
      return;
    }

    const allEnabledSources = await storage.getSourcesByIds(enabledSourceIds);
    const enabledSources = allEnabledSources.filter(s => s.isActive === "true");

    console.log(`[DiscoveryJob:${jobId}] ${enabledSources.length} active sources`);

    // Normalize query
    const normalizedQuery = normalizeTopicQuery(topic.query);
    console.log(`[DiscoveryJob:${jobId}] Query: "${normalizedQuery}"`);

    // Get time window for incremental run
    const isFirstRun = !topic.firstRunAt;
    const hoursBack = isFirstRun ? 168 : 12; // 7 days first run, 12 hours subsequent
    
    console.log(`[DiscoveryJob:${jobId}] ${isFirstRun ? "First run" : "Incremental run"} - scanning last ${hoursBack} hours`);

    // Fetch recent items
    const recentItems = await storage.getRecentSourceItemsBySourceIds(
      enabledSourceIds,
      hoursBack,
      500
    );

    console.log(`[DiscoveryJob:${jobId}] Found ${recentItems.length} recent items`);

    // Filter by relevance
    const { relevantItems, stats } = filterItemsByRelevance(
      recentItems,
      { query: normalizedQuery, name: topic.name },
      { minScore: MIN_RELEVANCE_SCORE, maxItems: 50, logResults: true }
    );

    console.log(`[DiscoveryJob:${jobId}] Relevance: ${stats.accepted} accepted, ${stats.rejected} rejected`);

    // Fire-and-forget clustering
    processNewItemsForClustering(topic.workspaceId)
      .catch(error => console.error(`[DiscoveryJob:${jobId}] Clustering error:`, error.message));

    // Clear stale topic_stories
    await storage.deleteTopicStories(topic.id);

    // **OPTIMIZED BATCH QUERIES** - eliminate N+1
    const storiesLinked = await scoreAndLinkStories(
      jobId,
      topic,
      enabledSourceIds,
      enabledSources,
      normalizedQuery
    );

    console.log(`[DiscoveryJob:${jobId}] Linked ${storiesLinked} stories`);

    // Complete job
    await completeJob(jobId, topic, recentItems.length, storiesLinked);

  } catch (error: any) {
    console.error(`[DiscoveryJob:${jobId}] Error:`, error.message);
    
    // Update job status
    await storage.updateAutomationJobRun(jobId, {
      status: "fail",
      endedAt: new Date(),
      errorSummary: error.message,
    });

    // Update topic denormalized fields only (NOT status)
    await storage.updateTopic(topicId, {
      lastRunId: jobId,
      lastRunAt: new Date(),
      lastRunStatus: "fail",
      lastError: error.message,
    });

    throw error;
  }
}

/**
 * Optimized story scoring with TRUE batch queries (single JOIN, no redundancy)
 */
async function scoreAndLinkStories(
  jobId: string,
  topic: Topic,
  enabledSourceIds: string[],
  enabledSources: any[],
  normalizedQuery: string
): Promise<number> {
  // Build source tier lookup
  const sourceLookup = new Map<string, { tier: number | null; isOfficial: string | null }>();
  for (const source of enabledSources) {
    sourceLookup.set(source.id, { tier: source.tier, isOfficial: source.isOfficial });
  }

  // **SINGLE OPTIMIZED QUERY**: Get everything needed in one JOIN
  // This replaces all N+1 queries and redundant fetches
  const storiesWithSourceInfo = await db
    .select({
      storyId: stories.id,
      storyTitle: stories.canonicalTitle,
      storyExcerpt: stories.excerpt,
      sourceId: sourceItems.sourceId,
    })
    .from(stories)
    .innerJoin(storyItems, eq(storyItems.storyId, stories.id))
    .innerJoin(sourceItems, eq(sourceItems.id, storyItems.sourceItemId))
    .where(inArray(sourceItems.sourceId, enabledSourceIds))
    .groupBy(stories.id, stories.canonicalTitle, stories.excerpt, sourceItems.sourceId);

  console.log(`[DiscoveryJob:${jobId}] Single JOIN query: ${storiesWithSourceInfo.length} story-source pairs`);

  if (storiesWithSourceInfo.length === 0) {
    return 0;
  }

  // Group by story and check for tier-1 sources (in-memory, no DB queries)
  // This deduplicates the JOIN results (one story may have multiple sources)
  const storyMap = new Map<string, {
    title: string;
    excerpt: string | null;
    hasTier1: boolean;
  }>();

  for (const row of storiesWithSourceInfo) {
    if (!storyMap.has(row.storyId)) {
      storyMap.set(row.storyId, {
        title: row.storyTitle,
        excerpt: row.storyExcerpt,
        hasTier1: false,
      });
    }

    // Check if this source is tier-1
    const sourceInfo = sourceLookup.get(row.sourceId);
    if (sourceInfo && (sourceInfo.tier === 1 || sourceInfo.isOfficial === "true")) {
      storyMap.get(row.storyId)!.hasTier1 = true;
    }
  }

  const uniqueStories = storyMap.size;
  const joinRows = storiesWithSourceInfo.length;
  const multiplicity = joinRows - uniqueStories;
  const avgSourcesPerStory = uniqueStories > 0 ? (joinRows / uniqueStories) : 0;

  console.log(
    `[DiscoveryJob:${jobId}] JOIN rows=${joinRows}, uniqueStories=${uniqueStories}, ` +
    `multiplicity=${multiplicity}, avgSourcesPerStory=${avgSourcesPerStory.toFixed(2)}`
  );
  
  if (multiplicity > 0) {
    console.log(
      `[DiscoveryJob:${jobId}] JOIN multiplicity detected: ${multiplicity} extra rows beyond 1 per story ` +
      `(dedupe prevented scoring inflation)`
    );
  }

  // Score and link stories (in-memory, no more DB queries)
  let storiesLinked = 0;

  for (const [storyId, storyData] of storyMap.entries()) {
    const relevance = scoreStoryRelevance(
      { canonicalTitle: storyData.title, excerpt: storyData.excerpt },
      { query: normalizedQuery, name: topic.name }
    );

    // Apply tier-1 boost
    let adjustedScore = relevance.score;
    if (storyData.hasTier1) {
      adjustedScore = Math.min(1, adjustedScore + TIER1_SOURCE_BOOST);
    }

    if (relevance.matchedTerms.length >= 1 && adjustedScore >= MIN_RELEVANCE_SCORE) {
      await storage.upsertTopicStory({
        topicId: topic.id,
        storyId: storyId,
        relevanceScore: adjustedScore.toFixed(4),
        matchedTerms: relevance.matchedTerms.slice(0, 10),
        reason: storyData.hasTier1 ? `${relevance.reason} (+tier1)` : relevance.reason,
      });
      storiesLinked++;
    }
  }

  return storiesLinked;
}

/**
 * Complete job successfully
 */
async function completeJob(
  jobId: string,
  topic: Topic,
  itemsProcessed: number,
  storiesLinked: number
): Promise<void> {
  const now = new Date();

  // Update job status
  await storage.updateAutomationJobRun(jobId, {
    status: "success",
    endedAt: now,
    processedCount: itemsProcessed,
    successCount: storiesLinked,
  });

  // Update topic denormalized fields (NOT status - keep it "live")
  const updates: any = {
    lastRunId: jobId,
    lastRunAt: now,
    lastRunStatus: "success",
    lastError: null,
  };

  if (!topic.firstRunAt) {
    updates.firstRunAt = now;
  }

  await storage.updateTopic(topic.id, updates);

  console.log(`[DiscoveryJob:${jobId}] Completed - ${itemsProcessed} items, ${storiesLinked} stories`);
}
