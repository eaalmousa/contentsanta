#!/usr/bin/env tsx
import { db } from "./server/db";
import { sql } from "drizzle-orm";
import { aiImageService } from "./server/services/ai-image-service";
import { storage } from "./server/storage";

/**
 * Republish specific article with fresh AI-generated image
 * Usage: npx tsx --env-file=.env republish-article-with-image.ts "search pattern"
 */

async function republishArticle(searchPattern: string) {
  const pattern = `%${searchPattern}%`;
  
  console.log(`🔍 Searching for article: "${searchPattern}"...\n`);
  
  // Find the article
  const items = await db.execute(
    sql`SELECT id, generated_title, generated_excerpt, status, 
               featured_image_url, target_post_id, target_permalink, topic_id, target_id
        FROM pipeline_items
        WHERE generated_title LIKE ${pattern}
        ORDER BY created_at DESC
        LIMIT 1`
  );

  if (items.rows.length === 0) {
    console.log("❌ Article not found!");
    console.log(`   Search pattern: "${searchPattern}"`);
    return;
  }

  const item = items.rows[0] as any;
  
  console.log("📄 Article Found:");
  console.log(`   ID: ${item.id}`);
  console.log(`   Title: ${item.generated_title}`);
  console.log(`   Status: ${item.status}`);
  console.log(`   WP Post ID: ${item.target_post_id || "N/A"}`);
  console.log(`   WP URL: ${item.target_permalink || "N/A"}`);
  console.log("");

  // Check current image URL
  const currentUrl = item.featured_image_url;
  let isExpired = false;
  
  if (currentUrl) {
    console.log(`🖼️  Current Image URL: ${currentUrl.substring(0, 80)}...`);
    
    if (currentUrl.includes('oaidalleapiprodscus.blob.core.windows.net')) {
      const match = currentUrl.match(/se=([^&]+)/);
      if (match) {
        const expirationStr = decodeURIComponent(match[1]);
        const expirationDate = new Date(expirationStr);
        const now = new Date();
        isExpired = now > expirationDate;
        
        console.log(`   Expiration: ${expirationDate.toISOString()}`);
        console.log(`   Current Time: ${now.toISOString()}`);
        console.log(`   Status: ${isExpired ? "❌ EXPIRED" : "✅ Valid"}`);
      }
    } else {
      console.log(`   Type: Non-DALL-E URL (should not expire)`);
    }
    console.log("");
  } else {
    console.log("⚠️  No image URL found!");
    console.log("");
  }

  // Regenerate the AI image (always regenerate for consistency)
  console.log("🎨 Generating fresh AI image...");
  const result = await aiImageService.generateFeaturedImage(
    item.generated_title,
    item.generated_excerpt || item.generated_title,
    "realistic"
  );

  if (!result.success || !result.imageUrl) {
    console.log(`❌ Failed to regenerate image: ${result.error}`);
    return;
  }

  console.log(`✅ New image generated!`);
  console.log(`   URL: ${result.imageUrl.substring(0, 80)}...`);
  console.log(`   Valid for: 2 hours`);
  console.log("");

  // Update pipeline item
  console.log("💾 Updating database...");
  await storage.updatePipelineItem(item.id, {
    featuredImageUrl: result.imageUrl,
    aiGeneratedImageUrl: result.imageUrl,
    updatedAt: new Date(),
  });
  console.log("   ✅ Pipeline item updated");

  // Update WP pull job if exists
  const jobResult = await db.execute(
    sql`UPDATE wp_pull_jobs
        SET featured_image_url = ${result.imageUrl},
            updated_at = NOW()
        WHERE pipeline_item_id = ${item.id}
        RETURNING id`
  );
  
  if (jobResult.rows.length > 0) {
    console.log("   ✅ WP pull job updated");
  }
  console.log("");

  // Handle republishing based on current status
  if (item.status === "published" && item.target_post_id) {
    console.log("📝 Article is already published to WordPress");
    console.log(`   WordPress Post ID: ${item.target_post_id}`);
    console.log(`   WordPress URL: ${item.target_permalink}`);
    console.log("");
    console.log("🔄 Resetting status for republishing...");
    
    await storage.updatePipelineItem(item.id, {
      status: "scheduled",
      targetPostId: null,
      targetPermalink: null,
      publishedAt: null,
      updatedAt: new Date(),
    });
    
    console.log("   ✅ Status reset to 'scheduled'");
    console.log("");
    console.log("⚠️  IMPORTANT: Delete the old WordPress post first!");
    console.log(`   WordPress Admin → Posts → Post ID ${item.target_post_id} → Trash`);
    console.log("");
    console.log("📋 Then publish the article:");
    console.log("   1. Go to Topics page in Content Santa");
    console.log("   2. Click 'Run Now' on the topic");
    console.log("   3. Monitor Pipeline page for status");
    console.log("");
  } else {
    console.log("✅ Article is ready for publishing!");
    console.log(`   Current Status: ${item.status}`);
    console.log("   The article will be published on next pipeline run with the new image.");
    console.log("");
    console.log("📋 To publish immediately:");
    console.log("   1. Go to Topics page");
    console.log("   2. Click 'Run Now' on the topic");
    console.log("");
  }

  console.log("🎉 Process complete!");
  console.log("");
  console.log("🔗 New Image URL (for manual use if needed):");
  console.log(result.imageUrl);
}

const searchPattern = process.argv[2] || "Qatar Chamber";
republishArticle(searchPattern)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
