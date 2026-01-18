import { storage } from "../storage";
import type { Topic, Source, InsertTopicStory } from "@shared/schema";
import crypto from "crypto";
import { filterItemsByRelevance, scoreStoryRelevance, MIN_RELEVANCE_SCORE, TIER1_SOURCE_BOOST } from "./topic-relevance-service";

export interface TopicRunLog {
  requestId: string;
  topicId: string;
  topicName: string;
  enabledSourceCount: number;
  enabledSourceDomains: string[];
  status: "started" | "skipped" | "completed" | "error";
  itemsProcessed?: number;
  itemsAccepted?: number;
  itemsRejected?: number;
  error?: string;
  timestamp: string;
}

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export async function runTopicDiscovery(topic: Topic): Promise<TopicRunLog> {
  const requestId = crypto.randomUUID().slice(0, 8);
  const timestamp = new Date().toISOString();
  
  console.log(`[TopicRun:${requestId}] Starting discovery for topic: ${topic.name} (${topic.id})`);
  
  const enabledSourceIds = await storage.getEnabledSourceIdsForTopic(topic.id);
  
  if (enabledSourceIds.length === 0) {
    const log: TopicRunLog = {
      requestId,
      topicId: topic.id,
      topicName: topic.name,
      enabledSourceCount: 0,
      enabledSourceDomains: [],
      status: "skipped",
      timestamp,
    };
    
    console.warn(`[TopicRun:${requestId}] SKIPPED - No enabled sources for topic "${topic.name}"`);
    console.warn(`[TopicRun:${requestId}] To fix: Enable sources in topic settings or via API`);
    
    return log;
  }
  
  const allEnabledSources = await storage.getSourcesByIds(enabledSourceIds);
  const enabledSources = allEnabledSources.filter(s => s.isActive === "true");
  
  const domains = enabledSources.slice(0, 5).map(s => extractDomain(s.feedUrl));
  
  console.log(`[TopicRun:${requestId}] topic_id=${topic.id}`);
  console.log(`[TopicRun:${requestId}] enabled_source_count=${enabledSources.length}`);
  console.log(`[TopicRun:${requestId}] enabled_source_domains=[${domains.join(", ")}]${enabledSources.length > 5 ? ` (+${enabledSources.length - 5} more)` : ""}`);
  
  try {
    const recentItems = await storage.getRecentSourceItemsBySourceIds(
      enabledSourceIds,
      24,
      200
    );
    
    console.log(`[TopicRun:${requestId}] Found ${recentItems.length} recent items from enabled sources`);
    
    const { relevantItems, stats } = filterItemsByRelevance(
      recentItems,
      { query: topic.query, name: topic.name },
      { minScore: MIN_RELEVANCE_SCORE, maxItems: 50, logResults: true }
    );
    
    console.log(`[TopicRun:${requestId}] Relevance filtering: ${stats.accepted} accepted, ${stats.rejected} rejected`);
    
    // Clear stale topic_stories before re-scoring
    await storage.deleteTopicStories(topic.id);
    
    // Build source lookup for tier-1 boost
    const sourceLookup = new Map<string, { tier: number | null; isOfficial: string | null }>();
    for (const source of enabledSources) {
      sourceLookup.set(source.id, { tier: source.tier, isOfficial: source.isOfficial });
    }
    
    // Persist relevance scores for stories in the workspace
    const workspaceStories = await storage.getStories(topic.workspaceId);
    let storiesLinked = 0;
    
    for (const story of workspaceStories) {
      const relevance = scoreStoryRelevance(
        { canonicalTitle: story.canonicalTitle, excerpt: story.excerpt },
        { query: topic.query, name: topic.name }
      );
      
      // Apply tier-1 source boost (+0.05) if story comes from tier-1 or official source
      let adjustedScore = relevance.score;
      const linkedItems = await storage.getStoryItems(story.id);
      let hasTier1Source = false;
      
      for (const linkItem of linkedItems) {
        const sourceItem = await storage.getSourceItem(linkItem.sourceItemId);
        if (sourceItem) {
          const sourceInfo = sourceLookup.get(sourceItem.sourceId);
          if (sourceInfo && (sourceInfo.tier === 1 || sourceInfo.isOfficial === "true")) {
            hasTier1Source = true;
            break;
          }
        }
      }
      
      if (hasTier1Source) {
        adjustedScore = Math.min(1, adjustedScore + TIER1_SOURCE_BOOST);
      }
      
      if (relevance.matchedTerms.length >= 1 && adjustedScore >= MIN_RELEVANCE_SCORE) {
        await storage.upsertTopicStory({
          topicId: topic.id,
          storyId: story.id,
          relevanceScore: adjustedScore.toFixed(4),
          matchedTerms: relevance.matchedTerms.slice(0, 10),
          reason: hasTier1Source ? `${relevance.reason} (+tier1)` : relevance.reason,
        });
        storiesLinked++;
      }
    }
    
    console.log(`[TopicRun:${requestId}] Cleared stale links, linked ${storiesLinked} relevant stories to topic`);
    
    const log: TopicRunLog = {
      requestId,
      topicId: topic.id,
      topicName: topic.name,
      enabledSourceCount: enabledSources.length,
      enabledSourceDomains: domains,
      status: "completed",
      itemsProcessed: recentItems.length,
      itemsAccepted: stats.accepted,
      itemsRejected: stats.rejected,
      timestamp,
    };
    
    console.log(`[TopicRun:${requestId}] COMPLETED - processed ${recentItems.length} items, ${storiesLinked} stories linked`);
    
    return log;
  } catch (error: any) {
    const log: TopicRunLog = {
      requestId,
      topicId: topic.id,
      topicName: topic.name,
      enabledSourceCount: enabledSources.length,
      enabledSourceDomains: domains,
      status: "error",
      error: error.message,
      timestamp,
    };
    
    console.error(`[TopicRun:${requestId}] ERROR - ${error.message}`);
    
    return log;
  }
}

export async function runAllLiveTopics(): Promise<TopicRunLog[]> {
  const liveTopics = await storage.getLiveTopics();
  
  console.log(`[TopicRun] Running discovery for ${liveTopics.length} live topics`);
  
  const logs: TopicRunLog[] = [];
  
  for (const topic of liveTopics) {
    const log = await runTopicDiscovery(topic);
    logs.push(log);
  }
  
  const completed = logs.filter(l => l.status === "completed").length;
  const skipped = logs.filter(l => l.status === "skipped").length;
  const errors = logs.filter(l => l.status === "error").length;
  
  console.log(`[TopicRun] Summary: ${completed} completed, ${skipped} skipped (no sources), ${errors} errors`);
  
  return logs;
}

export async function getTopicDiscoveryStatus(topicId: string): Promise<{
  hasEnabledSources: boolean;
  enabledSourceCount: number;
  enabledSourceDomains: string[];
  canRun: boolean;
  warning?: string;
}> {
  const enabledSourceIds = await storage.getEnabledSourceIdsForTopic(topicId);
  
  if (enabledSourceIds.length === 0) {
    return {
      hasEnabledSources: false,
      enabledSourceCount: 0,
      enabledSourceDomains: [],
      canRun: false,
      warning: "No sources enabled for this topic. Enable sources to start discovery.",
    };
  }
  
  const allEnabledSources = await storage.getSourcesByIds(enabledSourceIds);
  const enabledSources = allEnabledSources.filter(s => s.isActive === "true");
  
  const domains = enabledSources.slice(0, 5).map(s => extractDomain(s.feedUrl));
  
  return {
    hasEnabledSources: true,
    enabledSourceCount: enabledSources.length,
    enabledSourceDomains: domains,
    canRun: enabledSources.length > 0,
  };
}
