/**
 * Test 1: Trigger discovery and observe job lifecycle
 */

// Get DB state before
const before = await fetch("http://localhost:5000/api/debug/db").then(r => r.json());
console.log("\n=== BEFORE TRIGGER ===");
console.log("Active jobs:", before.counts.active_jobs);
console.log("Recent jobs (last 3):");
before.recent_jobs_detail.slice(0, 3).forEach((j: any) => {
  console.log(`  ${j.job_type}/${j.status} - ${j.id.substring(0, 8)}`);
});

// Get first live topic
const liveTopic = before.counts.topics.find((t: any) => t.is_live === 'true');
if (!liveTopic) {
  console.error("\n❌ No live topics found");
  process.exit(1);
}

// Get actual topic ID from topics table
const topicsResponse = await fetch("http://localhost:5000/api/debug/db");
const topicsData = await topicsResponse.json();

// We need to get a specific topic ID - let me query it directly
import { db } from "./server/storage";
import { sql } from "drizzle-orm";

const topicResult = await db.execute(sql`
  SELECT id, name FROM topics WHERE is_live = 'true' LIMIT 1
`);

if (topicResult.rows.length === 0) {
  console.error("\n❌ No live topics found in database");
  process.exit(1);
}

const topicId = topicResult.rows[0].id;
const topicName = topicResult.rows[0].name;

console.log(`\nTarget topic: ${topicName} (${topicId})`);

// Trigger discovery via API (need to authenticate first in dev mode)
console.log("\n=== TRIGGERING DISCOVERY ===");

const triggerResponse = await fetch(`http://localhost:5000/api/topics/${topicId}/run-discovery`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
});

const triggerResult = await triggerResponse.json();
console.log("Trigger response:", JSON.stringify(triggerResult, null, 2));

if (!triggerResponse.ok) {
  console.error(`\n❌ Failed to trigger discovery: ${triggerResult.error || triggerResult.message}`);
  process.exit(1);
}

// Wait 2 seconds for job to process
console.log("\nWaiting 5 seconds for job to process...");
await new Promise(resolve => setTimeout(resolve, 5000));

// Get DB state after
const after = await fetch("http://localhost:5000/api/debug/db").then(r => r.json());
console.log("\n=== AFTER TRIGGER ===");
console.log("Active jobs:", after.counts.active_jobs);
console.log("Recent jobs (last 5):");
after.recent_jobs_detail.slice(0, 5).forEach((j: any) => {
  console.log(`  ${j.job_type}/${j.status} (${j.duration_seconds}s) - ${j.id.substring(0, 8)}`);
});

// Check for discovery job
const discoveryJobs = after.recent_jobs_detail.filter((j: any) => j.job_type === 'discovery');
if (discoveryJobs.length > 0) {
  console.log("\n✅ DISCOVERY JOB FOUND:");
  discoveryJobs.forEach((j: any) => {
    console.log(`   ${j.id}`);
    console.log(`   Status: ${j.status}`);
    console.log(`   Duration: ${j.duration_seconds}s`);
    console.log(`   Topic: ${j.topic_id}`);
  });
} else {
  console.log("\n❌ NO DISCOVERY JOBS FOUND - routing may be broken");
}

process.exit(0);
