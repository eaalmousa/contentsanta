/**
 * Test 1: Trigger discovery directly via service (bypass auth)
 */
import { db } from "./server/storage";
import { sql } from "drizzle-orm";

console.log("\n=== TEST 1: DISCOVERY JOB LIFECYCLE ===\n");

// Get a live topic
const topicResult = await db.execute(sql`
  SELECT id, name FROM topics WHERE is_live = 'true' LIMIT 1
`);

if (topicResult.rows.length === 0) {
  console.error("❌ No live topics");
  process.exit(1);
}

const topicId = topicResult.rows[0].id;
const topicName = topicResult.rows[0].name;

console.log(`Target: ${topicName} (${topicId.substring(0, 12)}...)\n`);

// Check before
const beforeJobs = await db.execute(sql`
  SELECT COUNT(*) as count FROM automation_job_runs 
  WHERE topic_id = ${topicId} AND job_type = 'discovery'
`);
console.log(`Discovery jobs BEFORE: ${beforeJobs.rows[0].count}`);

// Trigger directly via service
console.log("\nEnqueuing discovery job directly...");

try {
  const { enqueueDiscoveryJob } = await import("./server/services/job-queue-service");
  const result = await enqueueDiscoveryJob(topicId);
  
  console.log("✅ Job enqueued:");
  console.log(`   Job ID: ${result.jobId}`);
  console.log(`   Status: ${result.status}`);
} catch (error: any) {
  console.error("❌ Enqueue failed:", error.message);
  if (error.code === '23505') {
    console.log("   (This is expected if duplicate - checking for existing job...)");
  } else {
    process.exit(1);
  }
}

// Wait for processing
console.log("\nWaiting 10 seconds for job to process...");
await new Promise(resolve => setTimeout(resolve, 10000));

// Check after
const afterJobs = await db.execute(sql`
  SELECT id, job_type, status, started_at, ended_at,
         EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at)) as duration_seconds
  FROM automation_job_runs 
  WHERE topic_id = ${topicId} AND job_type = 'discovery'
  ORDER BY started_at DESC
  LIMIT 3
`);

console.log(`\nDiscovery jobs AFTER: ${afterJobs.rows.length} total`);

if (afterJobs.rows.length > 0) {
  console.log("\nJob Details:");
  afterJobs.rows.forEach((job: any, idx: number) => {
    console.log(`  [${idx + 1}] ${job.id.substring(0, 12)}...`);
    console.log(`      Status: ${job.status}`);
    console.log(`      Duration: ${job.duration_seconds ? parseFloat(job.duration_seconds).toFixed(2) + 's' : 'N/A'}`);
    console.log(`      Started: ${job.started_at}`);
    console.log(`      Ended: ${job.ended_at || 'NULL'}`);
  });
  
  // Check if most recent transitioned correctly
  const latestJob = afterJobs.rows[0];
  if (latestJob.status === 'success') {
    console.log("\n✅ TEST 1 PASSED: Job completed successfully");
    console.log(`   queued → running → success (${parseFloat(latestJob.duration_seconds).toFixed(2)}s)`);
  } else if (latestJob.status === 'fail') {
    console.log("\n⚠️ Job failed (but lifecycle worked)");
  } else if (latestJob.status === 'running') {
    console.log("\n⚠️ Job still running (may need more time)");
  } else if (latestJob.status === 'queued') {
    console.log("\n❌ FAILED: Job stuck in queued state");
  }
} else {
  console.log("\n❌ FAILED: NO DISCOVERY JOBS CREATED");
}
