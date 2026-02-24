#!/usr/bin/env tsx
import { db } from "./server/db";
import { sql } from "drizzle-orm";
import { aiImageService } from "./server/services/ai-image-service";
import { storage } from "./server/storage";

/**
 * Batch fix all published articles without images
 * Regenerates AI images and resets status for republishing
 */

async function fixAllArticlesWithoutImages() {
  console.log("🔍 Scanning for published articles without featured images...\n");

  // Find all published articles without images in WordPress
  const items = await db.execute(
    sql`SELECT pi.id, pi.generated_title, pi.generated_excerpt, pi.status,
               pi.featured_image_url, pi.target_post_id, pi.target_permalink,
               pi.created_at, pi.updated_at
        FROM pipeline_items pi
        WHERE pi.status = 'published'
          AND pi.target_post_id IS NOT NULL
          AND pi.featured_image_url IS NOT NULL
        ORDER BY pi.created_at DESC
        LIMIT 20`
  );

  if (items.rows.length === 0) {
    console.log("✅ No published articles found that need fixing.");
    return;
  }

  console.log(`Found ${items.rows.length} published articles. Checking image status...\n`);

  const articlesToFix: any[] = [];
  
  for (const item of items.rows) {
    const articleData = item as any;
    let needsFix = false;
    let reason = "";

    // Check if DALL-E URL is expired
    if (articleData.featured_image_url?.includes('oaidalleapiprodscus.blob.core.windows.net')) {
      const match = articleData.featured_image_url.match(/se=([^&]+)/);
      if (match) {
        const expirationDate = new Date(decodeURIComponent(match[1]));
        const now = new Date();
        if (now > expirationDate) {
          needsFix = true;
          reason = "Expired DALL-E URL";
        }
      }
    }

    // Check if article was published within last 2 hours (likely affected by the bug)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const createdAt = new Date(articleData.created_at);
    if (createdAt > twoHoursAgo && !needsFix) {
      needsFix = true;
      reason = "Recently published (may be missing image)";
    }

    if (needsFix) {
      articlesToFix.push({ ...articleData, reason });
    }
  }

  if (articlesToFix.length === 0) {
    console.log("✅ No articles need fixing. All images are valid.");
    return;
  }

  console.log(`\n📋 Found ${articlesToFix.length} articles that need fixing:\n`);
  
  for (let i = 0; i < articlesToFix.length; i++) {
    const article = articlesToFix[i];
    console.log(`${i + 1}. ${article.generated_title.substring(0, 70)}...`);
    console.log(`   Reason: ${article.reason}`);
    console.log(`   WP Post ID: ${article.target_post_id}`);
    console.log("");
  }

  console.log("🔄 Processing articles...\n");

  let successCount = 0;
  let failCount = 0;

  for (const article of articlesToFix) {
    console.log(`\n📄 Processing: ${article.generated_title.substring(0, 60)}...`);
    
    try {
      // Generate fresh AI image
      console.log("   🎨 Generating AI image...");
      const result = await aiImageService.generateFeaturedImage(
        article.generated_title,
        article.generated_excerpt || article.generated_title,
        "realistic"
      );

      if (!result.success || !result.imageUrl) {
        console.log(`   ❌ Failed: ${result.error}`);
        failCount++;
        continue;
      }

      console.log(`   ✅ Image generated`);

      // Update pipeline item
      await storage.updatePipelineItem(article.id, {
        featuredImageUrl: result.imageUrl,
        aiGeneratedImageUrl: result.imageUrl,
        updatedAt: new Date(),
      });

      // Update WP pull job
      await db.execute(
        sql`UPDATE wp_pull_jobs
            SET featured_image_url = ${result.imageUrl},
                updated_at = NOW()
            WHERE pipeline_item_id = ${article.id}`
      );

      // Reset status for republishing
      await storage.updatePipelineItem(article.id, {
        status: "scheduled",
        targetPostId: null,
        targetPermalink: null,
        publishedAt: null,
        updatedAt: new Date(),
      });

      console.log(`   ✅ Reset to 'scheduled' status`);
      console.log(`   ⚠️  Delete WP post ${article.target_post_id} manually`);
      
      successCount++;
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      failCount++;
    }
  }

  console.log("\n\n" + "=".repeat(60));
  console.log("📊 BATCH FIX SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total articles found: ${articlesToFix.length}`);
  console.log(`✅ Successfully fixed: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log("");
  
  if (successCount > 0) {
    console.log("📋 NEXT STEPS:");
    console.log("");
    console.log("1. Delete old WordPress posts:");
    console.log("   WordPress Admin → Posts → Bulk Select → Move to Trash");
    console.log("   Post IDs to delete:");
    for (const article of articlesToFix) {
      console.log(`   - Post ID ${article.target_post_id}: ${article.generated_title.substring(0, 50)}...`);
    }
    console.log("");
    console.log("2. Republish articles:");
    console.log("   - Go to Topics page in Content Santa");
    console.log("   - Click 'Run Now' on each topic");
    console.log("   - Monitor Pipeline page for republishing");
    console.log("");
    console.log("3. Verify:");
    console.log("   - Check that new posts have featured images");
    console.log("   - Verify WordPress post IDs are different (new posts)");
  }
  
  console.log("\n🎉 Batch fix complete!");
}

fixAllArticlesWithoutImages()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
