import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkMissingImage() {
  console.log("🔍 Investigating Missing Image Issue:\n");
  
  // Find the US CPI article
  const items = await db.execute(
    sql`SELECT id, generated_title, status, featured_image_url, 
               featured_image_caption, featured_image_credit, target_post_id,
               created_at, updated_at
        FROM pipeline_items
        WHERE generated_title LIKE '%US consumer price index%'
        ORDER BY created_at DESC
        LIMIT 1`
  );

  if (items.rows.length === 0) {
    console.log("❌ Article not found in pipeline!");
    return;
  }

  const item = items.rows[0];
  console.log("📄 Pipeline Item:");
  console.log("  ID:", item.id);
  console.log("  Title:", item.generated_title);
  console.log("  Status:", item.status);
  console.log("  WP Post ID:", item.target_post_id);
  console.log("  Created:", item.created_at);
  console.log("  Updated:", item.updated_at);
  console.log("");
  console.log("🖼️  Image Data:");
  console.log("  Featured Image URL:", item.featured_image_url || "❌ MISSING!");
  console.log("  Image Caption:", item.featured_image_caption || "(none)");
  console.log("  Image Credits:", item.featured_image_credit || "(none)");

  // Check WP pull job
  console.log("\n📦 WP Pull Job:");
  const jobs = await db.execute(
    sql`SELECT id, payload_json, created_at
        FROM wp_pull_jobs
        WHERE pipeline_item_id = ${item.id}
        ORDER BY created_at DESC
        LIMIT 1`
  );

  if (jobs.rows.length === 0) {
    console.log("  ❌ No WP job found!");
    return;
  }

  const job = jobs.rows[0];
  const payload = job.payload_json as any;
  
  console.log("  Job ID:", job.id);
  console.log("  Created:", job.created_at);
  console.log("  Has featuredImageUrl:", !!payload.featuredImageUrl);
  console.log("  featuredImageUrl:", payload.featuredImageUrl || "❌ MISSING!");
  
  if (payload.featuredImageCaption) {
    console.log("  Image Caption:", payload.featuredImageCaption);
  }
  if (payload.featuredImageCredits) {
    console.log("  Image Credits:", payload.featuredImageCredits);
  }

  // Diagnosis
  console.log("\n🐛 DIAGNOSIS:");
  if (!item.featured_image_url) {
    console.log("  ❌ Pipeline item has NO featured_image_url");
    console.log("  📌 Issue: Content generation did NOT set an image");
    console.log("  📌 Causes:");
    console.log("     1. AI image generation failed");
    console.log("     2. Source extraction didn't find an image");
    console.log("     3. Image optimization failed");
    console.log("     4. featured-image-service not called");
  } else if (!payload.featuredImageUrl) {
    console.log("  ⚠️  Pipeline has image but WP job does NOT");
    console.log("  📌 Issue: Image not included in job payload");
    console.log("  📌 Check: wp-pull-service.ts createWpPullJob()");
  } else {
    console.log("  ⚠️  Both have image URLs - plugin may not be handling it");
    console.log("  📌 Check: WordPress plugin image download logic");
  }
}

checkMissingImage().catch(console.error);
