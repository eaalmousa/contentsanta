#!/usr/bin/env tsx
import { db } from "./server/db";
import { sql } from "drizzle-orm";
import { aiImageService } from "./server/services/ai-image-service";

/**
 * Fix articles with expired DALL-E image URLs
 * DALL-E URLs expire after 2 hours. This script:
 * 1. Finds pipeline items with expired DALL-E URLs
 * 2. Regenerates the AI images
 * 3. Updates the URLs in both pipeline_items and wp_pull_jobs
 */

interface PipelineItemWithExpiredImage {
  id: string;
  generated_title: string;
  generated_excerpt: string;
  featured_image_url: string;
  featured_image_caption: string;
  featured_image_credit: string;
  status: string;
}

async function checkUrlExpired(url: string): Promise<boolean> {
  try {
    // Check if it's a DALL-E URL with expiration timestamp
    if (!url.includes('oaidalleapiprodscus.blob.core.windows.net')) {
      return false; // Not a DALL-E URL
    }

    // Extract expiration time from URL (se= parameter)
    const match = url.match(/se=([^&]+)/);
    if (!match) return false;

    const expirationStr = decodeURIComponent(match[1]);
    const expirationDate = new Date(expirationStr);
    const now = new Date();

    return now > expirationDate;
  } catch (error) {
    console.error("Error checking URL expiration:", error);
    return false;
  }
}

async function fixExpiredImages() {
  console.log("🔍 Scanning for pipeline items with expired DALL-E image URLs...\n");

  // Find items with DALL-E URLs (AI-generated images)
  const items = await db.execute<PipelineItemWithExpiredImage>(
    sql`SELECT id, generated_title, generated_excerpt, 
               featured_image_url, featured_image_caption, featured_image_credit, status
        FROM pipeline_items
        WHERE featured_image_url LIKE '%oaidalleapiprodscus.blob.core.windows.net%'
          AND status IN ('scheduled', 'publishing', 'quarantined', 'retrying')
          AND featured_image_url IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 50`
  );

  if (items.rows.length === 0) {
    console.log("✅ No items found with DALL-E image URLs");
    return;
  }

  console.log(`Found ${items.rows.length} items with DALL-E URLs\n`);

  let expiredCount = 0;
  let regeneratedCount = 0;

  for (const item of items.rows) {
    const isExpired = await checkUrlExpired(item.featured_image_url);

    if (!isExpired) {
      console.log(`✅ ${item.generated_title.substring(0, 60)}`);
      console.log(`   URL still valid (not expired)`);
      console.log("");
      continue;
    }

    expiredCount++;
    console.log(`❌ EXPIRED: ${item.generated_title.substring(0, 60)}`);
    console.log(`   Status: ${item.status}`);
    console.log(`   Old URL: ${item.featured_image_url.substring(0, 80)}...`);

    // Regenerate the AI image
    console.log(`   🔄 Regenerating AI image...`);
    const result = await aiImageService.generateFeaturedImage(
      item.generated_title,
      item.generated_excerpt || item.generated_title,
      "realistic"
    );

    if (!result.success || !result.imageUrl) {
      console.log(`   ❌ Failed to regenerate: ${result.error}`);
      console.log("");
      continue;
    }

    console.log(`   ✅ New image generated: ${result.imageUrl.substring(0, 80)}...`);

    // Update pipeline_items
    await db.execute(
      sql`UPDATE pipeline_items
          SET featured_image_url = ${result.imageUrl},
              updated_at = NOW()
          WHERE id = ${item.id}`
    );

    // Update wp_pull_jobs if exists
    await db.execute(
      sql`UPDATE wp_pull_jobs
          SET featured_image_url = ${result.imageUrl},
              updated_at = NOW()
          WHERE pipeline_item_id = ${item.id}
            AND status = 'pending'`
    );

    regeneratedCount++;
    console.log(`   ✅ Updated pipeline item and WP pull job`);
    console.log("");
  }

  console.log("\n📊 Summary:");
  console.log(`   Total items scanned: ${items.rows.length}`);
  console.log(`   Expired URLs found: ${expiredCount}`);
  console.log(`   Images regenerated: ${regeneratedCount}`);
  console.log("");
  console.log("✅ Fix complete!");
}

fixExpiredImages()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
