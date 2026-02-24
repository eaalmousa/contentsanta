/**
 * Reaper Service
 * 
 * Finds and cleans up stale "running" jobs that never completed
 * (due to worker crashes, timeouts, etc.)
 * 
 * Runs periodically to prevent stuck jobs blocking new runs.
 */

import { storage } from "../storage";
import { db } from "../db";
import { automationJobRuns } from "@shared/schema";
import { and, eq, lt, isNull, sql } from "drizzle-orm";

// Externalized configuration - read from environment variables
// Timeout threshold: jobs running longer than this are considered stale
const STALE_THRESHOLD_MINUTES = parseInt(process.env.STALE_JOB_THRESHOLD_MINUTES || "10", 10);

/**
 * Find and timeout stale running jobs
 * 
 * A job is stale if:
 * - status = 'running'
 * - started_at > STALE_THRESHOLD_MINUTES ago
 */
export async function reapStaleJobs(): Promise<{ reaped: number; jobs: string[] }> {
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000);
  
  console.log(`[Reaper] Checking for stale jobs older than ${STALE_THRESHOLD_MINUTES} minutes...`);

  // Find stale running jobs
  const staleJobs = await db
    .select({
      id: automationJobRuns.id,
      topicId: automationJobRuns.topicId,
      jobType: automationJobRuns.jobType,
      startedAt: automationJobRuns.startedAt,
    })
    .from(automationJobRuns)
    .where(
      and(
        eq(automationJobRuns.status, "running"),
        lt(automationJobRuns.startedAt, staleThreshold),
        isNull(automationJobRuns.endedAt) // Ensure not already completed
      )
    );

  if (staleJobs.length === 0) {
    console.log(`[Reaper] No stale jobs found`);
    return { reaped: 0, jobs: [] };
  }

  console.log(`[Reaper] Found ${staleJobs.length} stale jobs, marking as timeout...`);

  const reapedJobIds: string[] = [];

  for (const job of staleJobs) {
    try {
      // Mark job as timeout
      await storage.updateAutomationJobRun(job.id, {
        status: "timeout",
        endedAt: new Date(),
        errorSummary: `Job timed out after ${STALE_THRESHOLD_MINUTES} minutes (reaped by reaper)`,
      });

      // Update topic denormalized fields
      if (job.topicId) {
        await storage.updateTopic(job.topicId, {
          lastRunId: job.id,
          lastRunAt: new Date(),
          lastRunStatus: "timeout",
          lastError: `Job timed out after ${STALE_THRESHOLD_MINUTES} minutes`,
        });
      }

      reapedJobIds.push(job.id);
      console.log(`[Reaper] Reaped job ${job.id} (topic: ${job.topicId}, type: ${job.jobType})`);
    } catch (error: any) {
      console.error(`[Reaper] Failed to reap job ${job.id}:`, error.message);
    }
  }

  console.log(`[Reaper] Successfully reaped ${reapedJobIds.length}/${staleJobs.length} jobs`);

  return { reaped: reapedJobIds.length, jobs: reapedJobIds };
}

/**
 * Get reaper statistics for monitoring
 */
export async function getReaperStats() {
  const [running, queued, recent] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(automationJobRuns)
      .where(eq(automationJobRuns.status, "running")),
    
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(automationJobRuns)
      .where(eq(automationJobRuns.status, "queued")),
    
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(automationJobRuns)
      .where(
        and(
          eq(automationJobRuns.status, "timeout"),
          sql`${automationJobRuns.endedAt} > NOW() - INTERVAL '24 hours'`
        )
      ),
  ]);

  return {
    currentlyRunning: running[0]?.count ?? 0,
    currentlyQueued: queued[0]?.count ?? 0,
    reapedLast24h: recent[0]?.count ?? 0,
  };
}
