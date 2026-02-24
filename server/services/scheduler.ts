import cron from "node-cron";
import type { ScheduledTask } from "node-cron";
import { fetchAllActiveSources } from "./rss-service";
import { runAllActiveAutomations } from "./automation-service";
import { runAllLiveTopics, type TopicRunLog } from "./topic-run-service";
import { runAllLivePipelines } from "./pipeline-jobs-service";
import { reapStaleJobs } from "./reaper-service";
import { publishingWorkerService } from "./publishing-worker-service";
import { storage } from "../storage";

let rssFetchJob: ScheduledTask | null = null;
let automationJob: ScheduledTask | null = null;
let topicDiscoveryJob: ScheduledTask | null = null;
let pipelineAutomationJob: ScheduledTask | null = null;
let publishingWorkerJob: ScheduledTask | null = null;
let wpPullLeaseCleanupJob: ScheduledTask | null = null;
let reaperJob: ScheduledTask | null = null;

export function startScheduler() {
  console.log("[Scheduler] Starting background jobs...");
  
  // Read intervals from environment variables (fallback to defaults)
  const RSS_FETCH_INTERVAL = parseInt(process.env.RSS_FETCH_INTERVAL_MINUTES || "30", 10);
  const AUTOMATION_INTERVAL = parseInt(process.env.AUTOMATION_INTERVAL_MINUTES || "15", 10);
  const TOPIC_DISCOVERY_INTERVAL = parseInt(process.env.TOPIC_DISCOVERY_INTERVAL_MINUTES || "20", 10);
  const PIPELINE_INTERVAL = parseInt(process.env.PIPELINE_INTERVAL_MINUTES || "10", 10);
  const PUBLISHING_WORKER_INTERVAL = parseInt(process.env.PUBLISHING_WORKER_INTERVAL_MINUTES || "3", 10);
  const WP_PULL_CLEANUP_INTERVAL = parseInt(process.env.WP_PULL_CLEANUP_INTERVAL_MINUTES || "2", 10);
  const REAPER_INTERVAL = parseInt(process.env.REAPER_INTERVAL_MINUTES || "5", 10);
  
  rssFetchJob = cron.schedule(`*/${RSS_FETCH_INTERVAL} * * * *`, async () => {
    console.log("[Scheduler] Running RSS fetch job...");
    try {
      const results = await fetchAllActiveSources();
      console.log(`[Scheduler] RSS fetch completed: ${results.size} sources processed`);
    } catch (error: any) {
      console.error("[Scheduler] RSS fetch error:", error.message);
    }
  });
  
  automationJob = cron.schedule(`*/${AUTOMATION_INTERVAL} * * * *`, async () => {
    console.log("[Scheduler] Running automation job...");
    try {
      const results = await runAllActiveAutomations();
      console.log(`[Scheduler] Automations completed: ${results.size} automations processed`);
    } catch (error: any) {
      console.error("[Scheduler] Automation error:", error.message);
    }
  });
  
  topicDiscoveryJob = cron.schedule(`*/${TOPIC_DISCOVERY_INTERVAL} * * * *`, async () => {
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
  
  pipelineAutomationJob = cron.schedule(`*/${PIPELINE_INTERVAL} * * * *`, async () => {
    console.log("[Scheduler] Running pipeline automation job...");
    try {
      const results = await runAllLivePipelines();
      console.log(`[Scheduler] Pipeline automation: ${results.length} pipelines processed`);
      for (const result of results) {
        const published = result.results.publish?.success || 0;
        const quarantined = result.results.publish?.quarantined || 0;
        console.log(`[Scheduler]   - ${result.topicName}: ${published} published, ${quarantined} quarantined`);
      }
    } catch (error: any) {
      console.error("[Scheduler] Pipeline automation error:", error.message);
    }
  });
  
  // Publishing Worker: Independent from discovery - processes publishing_items
  publishingWorkerJob = cron.schedule(`*/${PUBLISHING_WORKER_INTERVAL} * * * *`, async () => {
    console.log("[Scheduler] Running publishing worker job...");
    try {
      const result = await publishingWorkerService.runPublishingWorker();
      if (result.processed > 0) {
        console.log(`[Scheduler] Publishing worker: ${result.published} published, ${result.failed} failed`);
      }
    } catch (error: any) {
      console.error("[Scheduler] Publishing worker error:", error.message);
    }
  });
  
  wpPullLeaseCleanupJob = cron.schedule(`*/${WP_PULL_CLEANUP_INTERVAL} * * * *`, async () => {
    console.log("[Scheduler] Running WP Pull lease cleanup job...");
    try {
      const released = await storage.releaseExpiredWpPullJobLeases();
      if (released > 0) {
        console.log(`[Scheduler] WP Pull lease cleanup: ${released} expired leases released`);
      }
    } catch (error: any) {
      console.error("[Scheduler] WP Pull lease cleanup error:", error.message);
    }
  });
  
  // Reaper job: Clean up stale running jobs
  reaperJob = cron.schedule(`*/${REAPER_INTERVAL} * * * *`, async () => {
    console.log("[Scheduler] Running reaper job...");
    try {
      const { reaped, jobs } = await reapStaleJobs();
      if (reaped > 0) {
        console.log(`[Scheduler] Reaper: ${reaped} stale jobs timed out`);
      }
    } catch (error: any) {
      console.error("[Scheduler] Reaper error:", error.message);
    }
  });
  
  console.log("[Scheduler] Background jobs started:");
  console.log(`  - RSS Fetch: every ${RSS_FETCH_INTERVAL} minutes`);
  console.log(`  - Automations: every ${AUTOMATION_INTERVAL} minutes`);
  console.log(`  - Topic Discovery: every ${TOPIC_DISCOVERY_INTERVAL} minutes`);
  console.log(`  - Pipeline Automation: every ${PIPELINE_INTERVAL} minutes`);
  console.log(`  - Publishing Worker: every ${PUBLISHING_WORKER_INTERVAL} minutes`);
  console.log(`  - WP Pull Lease Cleanup: every ${WP_PULL_CLEANUP_INTERVAL} minutes`);
  console.log(`  - Reaper (stale job cleanup): every ${REAPER_INTERVAL} minutes`);
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
  if (pipelineAutomationJob) {
    pipelineAutomationJob.stop();
    pipelineAutomationJob = null;
  }
  if (publishingWorkerJob) {
    publishingWorkerJob.stop();
    publishingWorkerJob = null;
  }
  if (wpPullLeaseCleanupJob) {
    wpPullLeaseCleanupJob.stop();
    wpPullLeaseCleanupJob = null;
  }
  if (reaperJob) {
    reaperJob.stop();
    reaperJob = null;
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

export async function triggerPipelineAutomation() {
  console.log("[Scheduler] Manual pipeline automation triggered");
  return await runAllLivePipelines();
}
