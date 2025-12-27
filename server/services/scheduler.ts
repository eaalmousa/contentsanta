import cron from "node-cron";
import { fetchAllActiveSources } from "./rss-service";
import { runAllActiveAutomations } from "./automation-service";

let rssFetchJob: cron.ScheduledTask | null = null;
let automationJob: cron.ScheduledTask | null = null;

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
  
  console.log("[Scheduler] Background jobs started:");
  console.log("  - RSS Fetch: every 30 minutes");
  console.log("  - Automations: every 15 minutes");
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
