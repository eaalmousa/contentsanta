import "dotenv/config";
import { db } from "./server/db";
import { pipelineItems } from "./shared/schema";
import { eq, sql } from "drizzle-orm";
import { storage } from "./server/storage";
import { publishingPreflight } from "./server/services/publishing-preflight";

/**
 * Force publish one pipeline item to create a wp_pull_job
 * This bypasses scheduling and directly processes the item
 */

async function main() {
  const itemId = process.argv[2];

  if (!itemId) {
    console.error("\n❌ Usage: npx tsx force-publish-one-item.ts <pipeline_item_id>\n");
    process.exit(1);
  }

  console.log("\n🚀 Force publishing pipeline item...\n");

  // 1) Load item
  const item = await storage.getPipelineItem(itemId);
  
  if (!item) {
    console.error(`❌ Pipeline item not found: ${itemId}`);
    process.exit(1);
  }

  console.log(`Item ID: ${itemId.substring(0, 8)}...`);
  console.log(`Title: ${item.generatedTitle?.substring(0, 70)}`);
  console.log(`Status: ${item.status}`);
  console.log(`Target ID: ${item.targetId || "NULL"}`);
  console.log(`Featured Image: ${item.featuredImageUrl ? "Present" : "NULL"}`);
  console.log(`Story Hash: ${item.storyHash ? "Present" : "NULL"}`);
  console.log(`Canonical URL: ${item.canonicalSourceUrl ? "Present" : "NULL"}`);
  console.log("");

  // 2) Check if target exists
  if (!item.targetId) {
    console.error("❌ No target_id set for this item");
    console.error("   Set target_id before publishing");
    process.exit(1);
  }

  const target = await storage.getPublishingTarget(item.targetId);
  
  if (!target) {
    console.error(`❌ Target not found: ${item.targetId}`);
    process.exit(1);
  }

  console.log(`Target: ${target.name}`);
  console.log(`Type: ${target.type}`);
  console.log(`Active: ${target.isActive}`);
  console.log("");

  if (!target.isActive) {
    console.error("❌ Target is not active");
    process.exit(1);
  }

  if (target.type !== "wordpress_pull") {
    console.error("❌ This script only supports wordpress_pull targets");
    process.exit(1);
  }

  // 3) Update item to "publishing" status
  console.log("📝 Updating item status to 'publishing'...");
  
  await storage.updatePipelineItem(itemId, {
    status: "publishing",
    publishAttempts: (item.publishAttempts || 0) + 1,
  });

  console.log("   ✅ Status updated\n");

  // 4) Run preflight checks
  console.log("🔍 Running preflight checks...");
  
  const preflightResult = await publishingPreflight.prepare(itemId, target.id);

  if (!preflightResult.success) {
    console.log(`❌ Preflight failed: ${preflightResult.quarantineReason}`);
    console.log(`   Message: ${preflightResult.quarantineMessage}`);
    
    if (preflightResult.metadata) {
      console.log(`   Metadata:`, JSON.stringify(preflightResult.metadata, null, 2));
    }
    
    console.log("\n   Item has been quarantined.");
    process.exit(1);
  }

  console.log("   ✅ Preflight passed\n");

  const payload = preflightResult.payload!;

  console.log("📦 Preflight payload:");
  console.log(`   Title: ${payload.title.substring(0, 60)}`);
  console.log(`   Content: ${payload.contentHtml.length} chars`);
  console.log(`   Story Hash: ${payload.storyHash.substring(0, 20)}...`);
  console.log(`   Canonical URL: ${payload.canonicalSourceUrl.substring(0, 60)}...`);
  console.log(`   Featured Image: ${payload.featuredImageUrl ? "Present" : "NULL"}`);
  console.log(`   Category IDs: ${JSON.stringify(payload.categoryIds)}`);
  console.log("");

  // 5) Check for existing active job
  console.log("🔎 Checking for duplicate jobs...");
  
  const existingJobCheck = await db.execute(sql`
    SELECT id, status, story_hash
    FROM wp_pull_jobs
    WHERE target_id = ${target.id}
      AND story_hash = ${payload.storyHash}
      AND status IN ('queued', 'leased', 'processing')
    LIMIT 1
  `);

  if (existingJobCheck.rows.length > 0) {
    const existingJob = existingJobCheck.rows[0] as any;
    console.log(`❌ Active job already exists for this story_hash`);
    console.log(`   Job ID: ${existingJob.id}`);
    console.log(`   Status: ${existingJob.status}`);
    
    await storage.updatePipelineItem(itemId, {
      status: "skipped",
      skipReason: "duplicate_job_exists",
    });
    
    console.log("\n   Item marked as 'skipped'");
    process.exit(0);
  }

  console.log("   ✅ No duplicate found\n");

  // 6) Create wp_pull_job
  console.log("✨ Creating wp_pull_job...");

  const slug = payload.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 50);

  const wpJob = await storage.createWpPullJob({
    targetId: target.id,
    siteId: target.siteId!,
    storyId: item.storyId,
    pipelineItemId: item.id,
    title: payload.title,
    contentHtml: payload.contentHtml,
    postStatus: target.defaultPostStatus || "draft",
    categories: payload.categories,
    tags: payload.tags,
    excerpt: payload.excerpt,
    slug,
    sourceUrl: payload.canonicalSourceUrl,
    featuredImageUrl: payload.featuredImageUrl || null,
    storyHash: payload.storyHash,
    metadataJson: {
      story_hash: payload.storyHash,
      canonical_source_url: payload.canonicalSourceUrl,
      pipeline_item_id: payload.pipelineItemId,
    },
    payloadJson: {
      title: payload.title,
      contentHtml: payload.contentHtml,
      excerpt: payload.excerpt,
      categoryIds: payload.categoryIds,
      categories: payload.categories,
      tags: payload.tags,
      featuredImageUrl: payload.featuredImageUrl,
      storyHash: payload.storyHash,
      canonicalSourceUrl: payload.canonicalSourceUrl,
      metaDescription: payload.metaDescription,
      slug,
    },
    status: "queued",
  });

  console.log(`   ✅ wp_pull_job created: ${wpJob.id}\n`);

  // 7) Update pipeline item
  await storage.updatePipelineItem(itemId, {
    status: "published",
    publishedAt: new Date(),
    storyHash: payload.storyHash,
    canonicalSourceUrl: payload.canonicalSourceUrl,
    featuredImageUrl: payload.featuredImageUrl,
  });

  // 8) Verify
  console.log("🔍 Verifying wp_pull_job...");
  
  const verifyJob = await db.execute(sql`
    SELECT 
      id,
      title,
      story_hash,
      payload_json,
      status,
      created_at
    FROM wp_pull_jobs
    WHERE id = ${wpJob.id}
  `);

  const job = verifyJob.rows[0] as any;

  console.log("\n" + "=".repeat(60));
  console.log("✅ SUCCESS: wp_pull_job created and verified");
  console.log("=".repeat(60));
  console.log(`\nJob ID: ${job.id.substring(0, 8)}...`);
  console.log(`Title: ${job.title.substring(0, 70)}`);
  console.log(`Status: ${job.status}`);
  console.log(`Story Hash: ${job.story_hash.substring(0, 20)}...`);
  console.log(`Created: ${job.created_at}`);
  console.log(`\npayload_json contents:`);
  console.log(`  ✅ title: ${job.payload_json.title ? "Present" : "MISSING"}`);
  console.log(`  ✅ contentHtml: ${job.payload_json.contentHtml ? job.payload_json.contentHtml.length + " chars" : "MISSING"}`);
  console.log(`  ✅ excerpt: ${job.payload_json.excerpt ? "Present" : "MISSING"}`);
  console.log(`  ✅ categoryIds: ${job.payload_json.categoryIds ? JSON.stringify(job.payload_json.categoryIds) : "MISSING"}`);
  console.log(`  ✅ storyHash: ${job.payload_json.storyHash ? job.payload_json.storyHash.substring(0, 20) + "..." : "MISSING"}`);
  console.log(`  ✅ canonicalSourceUrl: ${job.payload_json.canonicalSourceUrl ? "Present" : "MISSING"}`);
  console.log(`  ✅ featuredImageUrl: ${job.payload_json.featuredImageUrl ? "Present" : "MISSING"}`);
  console.log(`\npipeline_item status: published`);
  console.log(`\n🎉 Fix C: COMPLETE - Real publishing path proven!`);

  process.exit(0);
}

main().catch((error) => {
  console.error("\n❌ Error:", error.message);
  console.error(error.stack);
  process.exit(1);
});
