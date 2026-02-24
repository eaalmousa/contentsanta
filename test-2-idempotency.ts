/**
 * Test 2: Idempotency - rapid enqueue attempts
 */
import { db } from "./server/storage";
import { sql } from "drizzle-orm";

console.log("\n=== TEST 2: IDEMPOTENCY (RAPID ENQUEUE) ===\n");

// Get a live topic
const topicResult = await db.execute(sql`
  SELECT id, name FROM topics WHERE is_live = 'true' LIMIT 1
`);

const topicId = topicResult.rows[0].id;
const topicName = topicResult.rows[0].name;

console.log(`Target: ${topicName} (${topicId.substring(0, 12)}...)\n`);

// Clear any existing discovery jobs for this topic
await db.execute(sql`
  DELETE FROM automation_job_runs 
  WHERE topic_id = ${topicId} AND job_type = 'discovery'
`);
console.log("Cleared existing discovery jobs\n");

// Rapidly enqueue 5 times
console.log("Enqueuing 5 times rapidly...");

const { enqueueDiscoveryJob } = await import("./server/services/job-queue-service");

const results = await Promise.all([
  enqueueDiscoveryJob(topicId).catch(e => ({ error: e.message, code: e.code })),
  enqueueDiscoveryJob(topicId).catch(e => ({ error: e.message, code: e.code })),
  enqueueDiscoveryJob(topicId).catch(e => ({ error: e.message, code: e.code })),
  enqueueDiscoveryJob(topicId).catch(e => ({ error: e.message, code: e.code })),
  enqueueDiscoveryJob(topicId).catch(e => ({ error: e.message, code: e.code })),
]);

console.log("\nResults:");
results.forEach((r, idx) => {
  if ('error' in r) {
    console.log(`  [${idx + 1}] ❌ ERROR: ${r.error}`);
  } else {
    console.log(`  [${idx + 1}] ✅ jobId=${r.jobId.substring(0, 12)}..., status=${r.status}`);
  }
});

// Check database state
const jobsInDb = await db.execute(sql`
  SELECT id, status FROM automation_job_runs 
  WHERE topic_id = ${topicId} AND job_type = 'discovery'
  AND status IN ('queued', 'running')
`);

console.log(`\nActive jobs in DB: ${jobsInDb.rows.length}`);

if (jobsInDb.rows.length === 1) {
  console.log("✅ TEST 2 PASSED: Only 1 active job despite 5 enqueue attempts");
  console.log(`   Job ID: ${jobsInDb.rows[0].id}`);
  console.log(`   Status: ${jobsInDb.rows[0].status}`);
  
  // Check if all results returned same job ID
  const validResults = results.filter(r => 'jobId' in r);
  const uniqueJobIds = new Set(validResults.map(r => r.jobId));
  
  if (uniqueJobIds.size === 1) {
    console.log("✅ All successful requests returned the same job ID (idempotent)");
  } else {
    console.log(`⚠️ Multiple job IDs returned: ${uniqueJobIds.size} unique IDs`);
  }
} else if (jobsInDb.rows.length === 0) {
  console.log("⚠️ No jobs found (they may have completed already)");
} else {
  console.log(`❌ TEST 2 FAILED: ${jobsInDb.rows.length} active jobs (expected 1)`);
  jobsInDb.rows.forEach((j: any) => {
    console.log(`   ${j.id} - ${j.status}`);
  });
}

// Clean up: wait for job to finish then delete
console.log("\nWaiting 3 seconds for cleanup...");
await new Promise(resolve => setTimeout(resolve, 3000));

await db.execute(sql`
  DELETE FROM automation_job_runs 
  WHERE topic_id = ${topicId} AND job_type = 'discovery'
`);
console.log("Cleaned up test jobs");
