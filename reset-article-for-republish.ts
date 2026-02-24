#!/usr/bin/env tsx
import { db } from "./server/db";
import { sql } from "drizzle-orm";
import { storage } from "./server/storage";

/**
 * Reset article status to allow republishing with fresh image
 * This will mark the article as 'scheduled' so the pipeline can republish it
 */

async function resetForRepublish() {
  const targetTitle = "%US consumer price index%";
  
  console.log("🔍 Finding article...\n");
  
  const items = await db.execute(
    sql`SELECT id, generated_title, status, target_post_id, target_permalink
        FROM pipeline_items
        WHERE generated_title LIKE ${targetTitle}
        ORDER BY created_at DESC
        LIMIT 1`
  );

  if (items.rows.length === 0) {
    console.log("❌ Article not found!");
    return;
  }

  const item = items.rows[0] as any;
  
  console.log("📄 Article Found:");
  console.log(`   ID: ${item.id}`);
  console.log(`   Title: ${item.generated_title}`);
  console.log(`   Current Status: ${item.status}`);
  console.log(`   WP Post ID: ${item.target_post_id || "N/A"}`);
  console.log(`   WP URL: ${item.target_permalink || "N/A"}`);
  console.log("");

  if (item.status !== "published") {
    console.log("✅ Article is not in 'published' status. No reset needed.");
    console.log(`   Current status: ${item.status}`);
    console.log("   The article will be published automatically on next pipeline run.");
    return;
  }

  console.log("⚠️  IMPORTANT:");
  console.log("   This will reset the article status to 'scheduled'");
  console.log("   The pipeline will republish it with the fresh image");
  console.log("");
  console.log("   ⚠️  You should DELETE the existing WordPress post first:");
  console.log(`   WordPress Post ID: ${item.target_post_id}`);
  console.log(`   WordPress URL: ${item.target_permalink}`);
  console.log("");
  console.log("   Steps:");
  console.log("   1. Go to WordPress Admin → Posts");
  console.log(`   2. Find post ID ${item.target_post_id} and TRASH it`);
  console.log("   3. Run this script again to reset status");
  console.log("");

  // Check if user confirmed deletion
  console.log("🔄 Resetting article status to 'scheduled'...");
  
  await storage.updatePipelineItem(item.id, {
    status: "scheduled",
    targetPostId: null,
    targetPermalink: null,
    publishedAt: null,
    updatedAt: new Date(),
  });

  console.log("✅ Article status reset to 'scheduled'");
  console.log("");
  console.log("📋 Next Steps:");
  console.log("   1. The article is now in the pipeline queue");
  console.log("   2. It will be published on the next pipeline run");
  console.log("   3. The new AI image will be included");
  console.log("");
  console.log("   To publish immediately:");
  console.log("   - Go to Topics page");
  console.log("   - Click 'Run Now' on the topic");
  console.log("");
  console.log("🎉 Reset complete!");
}

resetForRepublish()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
