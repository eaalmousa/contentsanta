import { storage } from "../storage";
import type { Topic, Source } from "@shared/schema";
import crypto from "crypto";

export interface TopicRunLog {
  requestId: string;
  topicId: string;
  topicName: string;
  enabledSourceCount: number;
  enabledSourceDomains: string[];
  status: "started" | "skipped" | "completed" | "error";
  itemsProcessed?: number;
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
      100
    );
    
    console.log(`[TopicRun:${requestId}] Found ${recentItems.length} recent items from enabled sources`);
    
    const log: TopicRunLog = {
      requestId,
      topicId: topic.id,
      topicName: topic.name,
      enabledSourceCount: enabledSources.length,
      enabledSourceDomains: domains,
      status: "completed",
      itemsProcessed: recentItems.length,
      timestamp,
    };
    
    console.log(`[TopicRun:${requestId}] COMPLETED - processed ${recentItems.length} items`);
    
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
