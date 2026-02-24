/**
 * Test 3: Reaper - times out stuck jobs
 */
import { db } from "./server/storage";
import { sql } from "drizzle-orm";

console.log("\n=== TEST 3: REAPER (STUCK JOB CLEANUP) ===\n");

// Get a live topic
const topicResult = await db.execute(sql`
  SELECT id, name, workspace_id FROM topics WHERE is_live = 'true' LIMIT 1
`);

const topicId = topicResult.rows[0].id;
const topicName = topicResult.rows[0].name;
const workspaceId = topicResult.rows[0].workspace_id;

console.log(`Target: ${topicName} (${topicId.substring(0, 12)}...)\n`);

// Create a fake stuck job (15 minutes ago)
console.log("Creating fake stuck job (started 15 minutes ago)...");

const fakeJobResult = await db.execute(sql`
  INSERT INTO automation_job_runs 
    (topic_id, workspace_id, job_type, status, started_at)
  VALUES 
    (${topicId}, ${workspaceId}, 'discovery', 'running', NOW() - INTERVAL '15 minutes')
  RETURNING id, started_at
`);

const fakeJobId = fakeJobResult.rows[0].id;
const startedAt = fakeJobResult.rows[0].started_at;

console.log(`   Job ID: ${fakeJobId}`);
console.log(`   Started: ${startedAt}`);
console.log(`   Status: running (stuck)\n`);

// Check current state
const beforeReap = await db.execute(sql`
  SELECT status, ended_at FROM automation_job_runs WHERE id = ${fakeJobId}
`);
console.log(`Before reaper: status=${beforeReap.rows[0].status}, ended_at=${beforeReap.rows[0].ended_at || 'NULL'}`);

// Manually trigger reaper
console.log("\nManually triggering reaper...");
const { reapStaleJobs } = await import("./server/services/reaper-service");
const { reaped, jobs } = await reapStaleJobs();

console.log(`Reaper completed: ${reaped} jobs reaped`);
if (reaped > 0) {
  console.log(`   Job IDs: ${jobs.join(", ")}`);
}

// Check if our fake job was reaped
const afterReap = await db.execute(sql`
  SELECT status, ended_at FROM automation_job_runs WHERE id = ${fakeJobId}
`);

const finalStatus = afterReap.rows[0].status;
const finalEndedAt = afterReap.rows[0].ended_at;

console.log(`\nAfter reaper: status=${finalStatus}, ended_at=${finalEndedAt || 'NULL'}`);

if (finalStatus === 'timeout' && finalEndedAt) {
  console.log("\n✅ TEST 3 PASSED: Reaper successfully timed out stuck job");
  console.log(`   running → timeout`);
  console.log(`   ended_at was set: ${finalEndedAt}`);
  
  // Verify it was included in the reaped list
  if (jobs.includes(fakeJobId)) {
    console.log("✅ Job ID was included in reaper's return value");
  }
} else if (finalStatus === 'running') {
  console.log("\n❌ TEST 3 FAILED: Job still in running state (reaper didn't catch it)");
} else {
  console.log(`\n❌ TEST 3 FAILED: Unexpected final status: ${finalStatus}`);
}

// Clean up
await db.execute(sql`DELETE FROM automation_job_runs WHERE id = ${fakeJobId}`);
console.log("\nCleaned up test job");
