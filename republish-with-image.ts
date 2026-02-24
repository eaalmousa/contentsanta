#!/usr/bin/env tsx
import { db } from "./server/db";
import { sql } from "drizzle-orm";
import { aiImageService } from "./server/services/ai-image-service";
import { storage } from "./server/storage";

/**
 * Republish specific article with fresh AI-generated image
 */

async function republishArticle() {
  const targetTitle = "%US consumer price index%";
  
  console.log("🔍 Finding article...\n");
  
  // Find the article
  const items = await db.execute(
    sql`SELECT id, generated_title, generated_excerpt, status, 
               featured_image_url, target_post_id, topic_id, target_id
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
  console.log(`   Status: ${item.status}`);
  console.log(`   WP Post ID: ${item.target_post_id || "N/A"}`);
  console.log("");

  // Check if DALL-E URL is expired
  const currentUrl = item.featured_image_url;
  let isExpired = false;
  
  if (currentUrl && currentUrl.includes('oaidalleapiprodscus.blob.core.windows.net')) {
    const match = currentUrl.match(/se=([^&]+)/);
    if (match) {
      const expirationStr = decodeURIComponent(match[1]);
      const expirationDate = new Date(expirationStr);
      const now = new Date();
      isExpired = now > expirationDate;
      
      console.log(`🕐 Image URL Status:`);
      console.log(`   Expiration: ${expirationDate.toISOString()}`);
      console.log(`   Current Time: ${now.toISOString()}`);
      console.log(`   Is Expired: ${isExpired ? "❌ YES" : "✅ NO"}`);
      console.log("");
    }
  }

  if (!isExpired && currentUrl) {
    console.log("✅ Image URL is still valid. No regeneration needed.");
    console.log("   If WordPress post is missing image, it may be a plugin issue.");
    return;
  }

  // Regenerate the AI image
  console.log("🔄 Regenerating AI image...");
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
  console.log("");

  // Update pipeline item
  console.log("💾 Updating pipeline item...");
  await storage.updatePipelineItem(item.id, {
    featuredImageUrl: result.imageUrl,
    aiGeneratedImageUrl: result.imageUrl,
    updatedAt: new Date(),
  });
  console.log("✅ Pipeline item updated");

  // Find and update WP pull job
  console.log("💾 Updating WP pull job...");
  const jobResult = await db.execute(
    sql`UPDATE wp_pull_jobs
        SET featured_image_url = ${result.imageUrl},
            updated_at = NOW()
        WHERE pipeline_item_id = ${item.id}
        RETURNING id`
  );
  
  if (jobResult.rows.length > 0) {
    console.log("✅ WP pull job updated");
  } else {
    console.log("⚠️  No WP pull job found (may be normal if using direct publishing)");
  }

  console.log("");
  
  // Check if we need to reset status to trigger republishing
  if (item.status === "published" && item.target_post_id) {
    console.log("📝 Article is already published to WordPress (Post ID: " + item.target_post_id + ")");
    console.log("");
    console.log("⚠️  To update the featured image on WordPress:");
    console.log("   Option 1: Delete the WP post and change status to 'scheduled' to republish");
    console.log("   Option 2: Manually set featured image in WordPress using new URL");
    console.log("");
    console.log("Would you like to reset the article status to 'scheduled' for republishing?");
    console.log("This will create a NEW post on WordPress (duplicate).");
    console.log("");
    console.log("Run: npx tsx --env-file=.env reset-article-for-republish.ts");
  } else {
    console.log("✅ Article is ready for publishing with fresh image!");
    console.log("   Status: " + item.status);
    console.log("   The next pipeline run will publish it with the new image.");
  }

  console.log("");
  console.log("🎉 Image regeneration complete!");
  console.log("");
  console.log("📋 New Image URL (copy to WordPress if needed):");
  console.log(result.imageUrl);
}

republishArticle()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
