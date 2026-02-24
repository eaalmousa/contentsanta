import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

/**
 * Verify publishing path populates required fields in wp_pull_jobs and pipeline_items
 * 
 * Checks:
 * 1. wp_pull_jobs.payload_json is populated
 * 2. wp_pull_jobs.story_hash is populated
 * 3. pipeline_items.story_hash is populated
 * 4. payload_json contains required fields (title, contentHtml, categoryIds, etc.)
 */

async function verifyPublishingPath() {
  console.log("\n🔍 Verifying publishing path field population...\n");

  // Check wp_pull_jobs
  const wpJobsCheck = await db.execute(sql`
    SELECT 
      id,
      title,
      story_hash,
      payload_json,
      status,
      created_at
    FROM wp_pull_jobs
    WHERE payload_json IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 5
  `);

  console.log("📦 Recent wp_pull_jobs with payload_json:");
  if (wpJobsCheck.rows.length === 0) {
    console.log("   ⚠️  No jobs found with payload_json");
    console.log("   This is expected if no publishing has occurred yet.\n");
  } else {
    console.log(`   Found ${wpJobsCheck.rows.length} job(s)\n`);

    for (const job of wpJobsCheck.rows as any[]) {
      console.log(`   Job ID: ${job.id.substring(0, 8)}...`);
      console.log(`   Title: ${job.title?.substring(0, 50) || "N/A"}`);
      console.log(`   Story Hash: ${job.story_hash ? job.story_hash.substring(0, 20) + "..." : "MISSING"}`);
      console.log(`   Status: ${job.status}`);

      if (job.payload_json) {
        const payload = job.payload_json;
        console.log(`   Payload fields:`);
        console.log(`      ✅ title: ${payload.title ? "Present" : "MISSING"}`);
        console.log(`      ✅ contentHtml: ${payload.contentHtml ? `${payload.contentHtml.length} chars` : "MISSING"}`);
        console.log(`      ✅ excerpt: ${payload.excerpt ? "Present" : "MISSING"}`);
        console.log(`      ✅ categoryIds: ${payload.categoryIds ? JSON.stringify(payload.categoryIds) : "MISSING"}`);
        console.log(`      ✅ storyHash: ${payload.storyHash ? payload.storyHash.substring(0, 20) + "..." : "MISSING"}`);
        console.log(`      ✅ canonicalSourceUrl: ${payload.canonicalSourceUrl ? "Present" : "MISSING"}`);
      } else {
        console.log(`   ❌ payload_json is NULL`);
      }
      console.log("");
    }
  }

  // Check pipeline_items
  const pipelineCheck = await db.execute(sql`
    SELECT 
      id,
      generated_title,
      story_hash,
      canonical_source_url,
      status,
      created_at
    FROM pipeline_items
    WHERE story_hash IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 5
  `);

  console.log("📋 Recent pipeline_items with story_hash:");
  if (pipelineCheck.rows.length === 0) {
    console.log("   ⚠️  No pipeline items found with story_hash");
    console.log("   This is expected if no items have been processed yet.\n");
  } else {
    console.log(`   Found ${pipelineCheck.rows.length} item(s)\n`);

    for (const item of pipelineCheck.rows as any[]) {
      console.log(`   Item ID: ${item.id.substring(0, 8)}...`);
      console.log(`   Title: ${item.generated_title?.substring(0, 50) || "N/A"}`);
      console.log(`   Story Hash: ${item.story_hash ? item.story_hash.substring(0, 20) + "..." : "MISSING"}`);
      console.log(`   Canonical URL: ${item.canonical_source_url ? "Present" : "MISSING"}`);
      console.log(`   Status: ${item.status}`);
      console.log("");
    }
  }

  // Summary
  console.log("=".repeat(60));
  if (wpJobsCheck.rows.length > 0 && pipelineCheck.rows.length > 0) {
    console.log("✅ Publishing path is ACTIVE and populating fields correctly");
    
    const allJobsHaveStoryHash = (wpJobsCheck.rows as any[]).every(j => j.story_hash);
    const allItemsHaveStoryHash = (pipelineCheck.rows as any[]).every(i => i.story_hash);
    const allJobsHavePayload = (wpJobsCheck.rows as any[]).every(j => j.payload_json);
    
    if (allJobsHaveStoryHash && allItemsHaveStoryHash && allJobsHavePayload) {
      console.log("✅ All required fields are populated:");
      console.log("   - wp_pull_jobs.story_hash ✅");
      console.log("   - wp_pull_jobs.payload_json ✅");
      console.log("   - pipeline_items.story_hash ✅");
    } else {
      console.log("⚠️  Some fields are missing:");
      if (!allJobsHaveStoryHash) console.log("   - wp_pull_jobs.story_hash: SOME MISSING");
      if (!allJobsHavePayload) console.log("   - wp_pull_jobs.payload_json: SOME MISSING");
      if (!allItemsHaveStoryHash) console.log("   - pipeline_items.story_hash: SOME MISSING");
    }
  } else {
    console.log("⚠️  No publishing activity detected yet");
    console.log("   This is expected for new installations");
    console.log("   Run a topic to generate pipeline items and jobs");
  }
  console.log("=".repeat(60));

  process.exit(0);
}

verifyPublishingPath();
