/**
 * Job Queue Service
 * 
 * Manages asynchronous execution of topic discovery and pipeline jobs.
 * Implements concurrency control, idempotency, and timeout handling.
 */

import { storage } from "../storage";
import type { AutomationJobType, AutomationJobStatus, Topic } from "@shared/schema";
import crypto from "crypto";

// Externalized configuration - read from environment variables
const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || "3", 10);
const JOB_TIMEOUT_MS = parseInt(process.env.JOB_TIMEOUT_MINUTES || "5", 10) * 60 * 1000;

// In-memory job tracking (production should use Redis or database)
const activeJobs = new Map<string, { jobId: string; topicId: string; startedAt: Date }>();
const queuedJobs: Array<{ jobId: string; topicId: string; jobType: AutomationJobType }> = [];

/**
 * Enqueue a discovery job for a topic
 * Implements idempotency - won't create duplicate jobs for same topic
 */
export async function enqueueDiscoveryJob(topicId: string): Promise<{ jobId: string; status: "queued" | "running" }> {
  // Check if there's already a queued or running job for this topic
  const existingQueued = queuedJobs.find(j => j.topicId === topicId && j.jobType === "discovery");
  if (existingQueued) {
    console.log(`[JobQueue] Discovery job already queued for topic ${topicId}: ${existingQueued.jobId}`);
    return { jobId: existingQueued.jobId, status: "queued" };
  }

  const existingActive = Array.from(activeJobs.values()).find(j => j.topicId === topicId);
  if (existingActive) {
    console.log(`[JobQueue] Discovery job already running for topic ${topicId}: ${existingActive.jobId}`);
    return { jobId: existingActive.jobId, status: "running" };
  }

  // Create job record in database
  const topic = await storage.getTopic(topicId);
  if (!topic) {
    throw new Error(`Topic ${topicId} not found`);
  }

  // CRITICAL: Validate workspace_id exists (prevent FK constraint violations)
  if (!topic.workspaceId) {
    const errorMsg = `Topic "${topic.name}" (${topicId}) has no workspace_id - data integrity issue`;
    console.error(`[JobQueue] ${errorMsg}`);
    
    // Update topic status so UI can show the error
    await storage.updateTopic(topicId, {
      lastRunStatus: "fail",
      lastError: "Data integrity error: topic has no workspace_id. Contact support.",
      lastRunAt: new Date(),
    });
    
    throw new Error(errorMsg);
  }

  // Verify workspace exists (defensive check)
  const workspace = await storage.getWorkspace(topic.workspaceId);
  if (!workspace) {
    const errorMsg = 
      `Topic "${topic.name}" (${topicId}) has invalid workspace_id: ${topic.workspaceId}. ` +
      `This is a data integrity issue. Fix: migrate topic's workspace_id to a valid workspace UUID.`;
    console.error(`[JobQueue] ${errorMsg}`);
    
    // Update topic status so UI can show the error
    await storage.updateTopic(topicId, {
      lastRunStatus: "fail",
      lastError: `Invalid workspace reference (${topic.workspaceId}). Topic needs migration.`,
      lastRunAt: new Date(),
    });
    
    throw new Error(errorMsg);
  }

  try {
    const jobRun = await storage.createAutomationJobRun({
      topicId,
      workspaceId: topic.workspaceId,
      jobType: "discovery",
      status: "queued",
      startedAt: new Date(),
    });

    // Add to queue
    queuedJobs.push({
      jobId: jobRun.id,
      topicId,
      jobType: "discovery",
    });

    console.log(`[JobQueue] Enqueued discovery job ${jobRun.id} for topic ${topicId}`);

    // Process queue async (non-blocking)
    setImmediate(() => processQueue());

    return { jobId: jobRun.id, status: "queued" };
  } catch (error: any) {
    // Handle unique constraint violation gracefully
    if (error.code === '23505' || error.message?.includes('unique') || error.message?.includes('duplicate')) {
      console.log(`[JobQueue] Duplicate job detected, finding existing active job for topic ${topicId}`);
      
      // Query database for existing active job
      const existingJobs = await storage.getAutomationJobRuns(topicId, "discovery");
      const activeJob = existingJobs.find(j => j.status === "queued" || j.status === "running");
      
      if (activeJob) {
        console.log(`[JobQueue] Returning existing job ${activeJob.id} (${activeJob.status})`);
        return { 
          jobId: activeJob.id, 
          status: activeJob.status as "queued" | "running" 
        };
      }
    }
    
    // Re-throw if not a duplicate error
    throw error;
  }
}

/**
 * Process queued jobs respecting concurrency limits
 */
async function processQueue() {
  // Check if we can run more jobs
  if (activeJobs.size >= MAX_CONCURRENT_JOBS) {
    console.log(`[JobQueue] Max concurrency reached (${activeJobs.size}/${MAX_CONCURRENT_JOBS})`);
    return;
  }

  // Get next job from queue
  const job = queuedJobs.shift();
  if (!job) {
    return;
  }

  // **ATOMIC CLAIM**: Update status to running only if still queued
  // This prevents double-processing in multi-worker scenarios
  const claimed = await storage.claimQueuedJob(job.jobId);

  if (!claimed) {
    // Someone else claimed this job, skip
    console.log(`[JobQueue] Job ${job.jobId} already claimed by another worker`);
    setImmediate(() => processQueue());
    return;
  }

  // Mark as active
  activeJobs.set(job.jobId, {
    jobId: job.jobId,
    topicId: job.topicId,
    startedAt: new Date(),
  });

  console.log(`[JobQueue] Starting job ${job.jobId} (${job.jobType}) for topic ${job.topicId}`);

  // Execute job with timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Job timeout")), JOB_TIMEOUT_MS);
  });

  try {
    if (job.jobType === "discovery") {
      const { runTopicDiscoveryJob } = await import("./topic-discovery-job-service");
      await Promise.race([
        runTopicDiscoveryJob(job.topicId, job.jobId),
        timeoutPromise,
      ]);
    }
  } catch (error: any) {
    console.error(`[JobQueue] Job ${job.jobId} failed:`, error.message);
    
    // Update job status
    await storage.updateAutomationJobRun(job.jobId, {
      status: error.message === "Job timeout" ? "timeout" : "fail",
      endedAt: new Date(),
      errorSummary: error.message,
    });

    // Update topic status
    const topic = await storage.getTopic(job.topicId);
    if (topic) {
      await storage.updateTopic(job.topicId, {
        status: "error",
        lastError: error.message,
        lastRunId: job.jobId,
        lastRunAt: new Date(),
      });
    }
  } finally {
    // Remove from active jobs
    activeJobs.delete(job.jobId);
    
    // Process next job
    setImmediate(() => processQueue());
  }
}

/**
 * Get current queue status
 */
export function getQueueStatus() {
  return {
    active: activeJobs.size,
    queued: queuedJobs.length,
    maxConcurrent: MAX_CONCURRENT_JOBS,
    activeJobs: Array.from(activeJobs.values()),
    queuedJobs: queuedJobs.map(j => ({ jobId: j.jobId, topicId: j.topicId, jobType: j.jobType })),
  };
}

/**
 * Cancel a queued job (not yet started)
 */
export async function cancelQueuedJob(jobId: string): Promise<boolean> {
  const index = queuedJobs.findIndex(j => j.jobId === jobId);
  if (index === -1) {
    return false;
  }

  queuedJobs.splice(index, 1);
  
  await storage.updateAutomationJobRun(jobId, {
    status: "fail",
    endedAt: new Date(),
    errorSummary: "Cancelled by user",
  });

  console.log(`[JobQueue] Cancelled job ${jobId}`);
  return true;
}
