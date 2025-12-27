import cron from "node-cron";
import type { ScheduledTask } from "node-cron";
import { fetchAllActiveSources } from "./rss-service";
import { runAllActiveAutomations } from "./automation-service";
import { runAllLiveTopics, type TopicRunLog } from "./topic-run-service";

let rssFetchJob: ScheduledTask | null = null;
let automationJob: ScheduledTask | null = null;
let topicDiscoveryJob: ScheduledTask | null = null;

export function startScheduler() {
  console.log("[Scheduler] Starting background jobs...");
  
  rssFetchJob = cron.schedule("*/30 * * * *", async () => {
    console.log("[Scheduler] Running RSS fetch job...");
    try {
      const results = await fetchAllActiveSources();
      console.log(`[Scheduler] RSS fetch completed: ${results.size} sources processed`);
    } catch (error: any) {
      console.error("[Scheduler] RSS fetch error:", error.message);
    }
  });
  
  automationJob = cron.schedule("*/15 * * * *", async () => {
    console.log("[Scheduler] Running automation job...");
    try {
      const results = await runAllActiveAutomations();
      console.log(`[Scheduler] Automations completed: ${results.size} automations processed`);
    } catch (error: any) {
      console.error("[Scheduler] Automation error:", error.message);
    }
  });
  
  topicDiscoveryJob = cron.schedule("*/20 * * * *", async () => {
    console.log("[Scheduler] Running topic discovery job...");
    try {
      const logs = await runAllLiveTopics();
      const completed = logs.filter(l => l.status === "completed").length;
      const skipped = logs.filter(l => l.status === "skipped").length;
      console.log(`[Scheduler] Topic discovery: ${completed} completed, ${skipped} skipped (no sources)`);
    } catch (error: any) {
      console.error("[Scheduler] Topic discovery error:", error.message);
    }
  });
  
  console.log("[Scheduler] Background jobs started:");
  console.log("  - RSS Fetch: every 30 minutes");
  console.log("  - Automations: every 15 minutes");
  console.log("  - Topic Discovery: every 20 minutes");
}

export function stopScheduler() {
  if (rssFetchJob) {
    rssFetchJob.stop();
    rssFetchJob = null;
  }
  if (automationJob) {
    automationJob.stop();
    automationJob = null;
  }
  if (topicDiscoveryJob) {
    topicDiscoveryJob.stop();
    topicDiscoveryJob = null;
  }
  console.log("[Scheduler] Background jobs stopped");
}

export async function triggerRSSFetch() {
  console.log("[Scheduler] Manual RSS fetch triggered");
  return await fetchAllActiveSources();
}

export async function triggerAutomations() {
  console.log("[Scheduler] Manual automation run triggered");
  return await runAllActiveAutomations();
}

export async function triggerTopicDiscovery(): Promise<TopicRunLog[]> {
  console.log("[Scheduler] Manual topic discovery triggered");
  return await runAllLiveTopics();
}
