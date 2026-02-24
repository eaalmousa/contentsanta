import "dotenv/config";
import { db } from "./server/db";
import { wpPullJobs } from "./shared/schema";
import { sql } from "drizzle-orm";

/**
 * TEST: Prove wp_pull_jobs unique index prevents duplicates
 * 
 * This test confirms the deduplication guarantee is REAL by:
 * 1. Inserting a job with (target_id, story_hash, status='queued')
 * 2. Attempting to insert a duplicate with same (target_id, story_hash, status='queued')
 * 3. Verifying the second insert FAILS with unique violation
 * 
 * This is the production-critical test that proves jobs cannot be duplicated.
 */

async function testDuplicatePrevention() {
  console.log("\n🧪 Testing wp_pull_jobs deduplication enforcement...\n");
  console.log("This test proves the unique index ACTUALLY prevents duplicates.\n");

  const testTargetId = "test-target-" + Date.now();
  const testStoryHash = "test-story-hash-" + Math.random().toString(36).substring(7);
  const testSiteId = "test-site-" + Date.now();

  try {
    // Step 1: Insert first job
    console.log("STEP 1: Insert first job");
    console.log(`  target_id: ${testTargetId}`);
    console.log(`  story_hash: ${testStoryHash}`);
    console.log(`  status: queued\n`);

    await db.insert(wpPullJobs).values({
      targetId: testTargetId,
      siteId: testSiteId,
      storyId: "test-story-id",
      pipelineItemId: "test-pipeline-item-id",
      title: "Test Job 1",
      contentHtml: "<p>Test content</p>",
      postStatus: "draft",
      categories: [],
      tags: [],
      excerpt: "Test excerpt",
      slug: "test-slug-1",
      sourceUrl: "https://example.com/test-1",
      storyHash: testStoryHash,
      status: "queued",
    });

    console.log("✅ First job inserted successfully\n");

    // Step 2: Attempt to insert duplicate (SHOULD FAIL)
    console.log("STEP 2: Attempt to insert duplicate job (SHOULD FAIL)");
    console.log(`  target_id: ${testTargetId} (SAME)`);
    console.log(`  story_hash: ${testStoryHash} (SAME)`);
    console.log(`  status: queued (SAME)\n`);

    let duplicateFailed = false;
    let errorMessage = "";

    try {
      await db.insert(wpPullJobs).values({
        targetId: testTargetId,
        siteId: testSiteId,
        storyId: "test-story-id-2",
        pipelineItemId: "test-pipeline-item-id-2",
        title: "Test Job 2 (DUPLICATE)",
        contentHtml: "<p>Test content 2</p>",
        postStatus: "draft",
        categories: [],
        tags: [],
        excerpt: "Test excerpt 2",
        slug: "test-slug-2",
        sourceUrl: "https://example.com/test-2",
        storyHash: testStoryHash,
        status: "queued",
      });

      console.log("❌ ERROR: Duplicate job was inserted (CONSTRAINT NOT WORKING)");
      duplicateFailed = false;
    } catch (error: any) {
      duplicateFailed = true;
      errorMessage = error.message || String(error);
      
      if (errorMessage.includes("unique") || errorMessage.includes("duplicate")) {
        console.log("✅ Duplicate insert REJECTED by database");
        console.log(`   Error: ${errorMessage.substring(0, 200)}\n`);
      } else {
        console.log("⚠️  Insert failed but NOT due to unique constraint:");
        console.log(`   Error: ${errorMessage}\n`);
      }
    }

    // Step 3: Verify only ONE job exists
    console.log("STEP 3: Verify job count");
    const jobs = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM wp_pull_jobs 
      WHERE target_id = ${testTargetId} 
      AND story_hash = ${testStoryHash}
    `);

    const jobCount = parseInt((jobs.rows[0] as any).count, 10);
    console.log(`  Jobs in database: ${jobCount}`);

    if (jobCount === 1) {
      console.log("✅ Correct: Only 1 job exists (duplicate prevented)\n");
    } else {
      console.log(`❌ ERROR: ${jobCount} jobs exist (should be 1)\n`);
    }

    // Cleanup
    console.log("STEP 4: Cleanup test data");
    await db.execute(sql`
      DELETE FROM wp_pull_jobs 
      WHERE target_id = ${testTargetId}
    `);
    console.log("✅ Test data cleaned up\n");

    // Final result
    console.log("=".repeat(60));
    if (duplicateFailed && jobCount === 1) {
      console.log("✅ TEST PASSED: Deduplication constraint is ENFORCED");
      console.log("   Production guarantee: wp_pull_jobs prevents duplicate jobs");
    } else {
      console.log("❌ TEST FAILED: Deduplication constraint is NOT working");
      if (!duplicateFailed) {
        console.log("   Issue: Duplicate insert succeeded");
      }
      if (jobCount !== 1) {
        console.log(`   Issue: Found ${jobCount} jobs (expected 1)`);
      }
    }
    console.log("=".repeat(60));

    process.exit(duplicateFailed && jobCount === 1 ? 0 : 1);

  } catch (error) {
    console.error("\n❌ Test execution error:", error);
    
    // Cleanup on error
    try {
      await db.execute(sql`
        DELETE FROM wp_pull_jobs 
        WHERE target_id = ${testTargetId}
      `);
    } catch {}
    
    throw error;
  }
}

testDuplicatePrevention();
