import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkRecentPublishing() {
  console.log("=== RECENT PUBLISHING ACTIVITY ===\n");

  // Check recent wp_pull_jobs
  console.log("1. RECENT WP PULL JOBS:");
  const jobs = await db.execute(sql`
    SELECT 
      id,
      title,
      status,
      featured_image_url,
      result_wp_post_id,
      result_wp_url,
      created_at,
      updated_at
    FROM wp_pull_jobs
    WHERE updated_at > NOW() - INTERVAL '30 minutes'
    ORDER BY updated_at DESC
    LIMIT 10
  `);

  for (const job of jobs.rows) {
    const hasImage = job.featured_image_url && job.featured_image_url.trim() !== '';
    console.log(`\n  ${job.title?.substring(0, 60)}...`);
    console.log(`    Status: ${job.status}`);
    console.log(`    Has Image URL: ${hasImage ? "✅ YES" : "❌ NO"}`);
    if (hasImage) {
      console.log(`    Image URL: ${job.featured_image_url?.substring(0, 80)}...`);
    }
    if (job.result_wp_post_id) {
      console.log(`    WP Post ID: ${job.result_wp_post_id}`);
    }
    if (job.result_wp_url) {
      console.log(`    WP URL: ${job.result_wp_url}`);
    }
    console.log(`    Updated: ${new Date(job.updated_at).toLocaleString()}`);
  }

  console.log(`\n  Total jobs in last 30 min: ${jobs.rows.length}`);

  // Check queued jobs waiting to be pulled
  console.log("\n2. QUEUED JOBS WAITING FOR WORDPRESS:");
  const queued = await db.execute(sql`
    SELECT 
      id,
      title,
      status,
      featured_image_url,
      site_id,
      created_at
    FROM wp_pull_jobs
    WHERE status = 'queued'
      AND (lease_expires_at IS NULL OR lease_expires_at < NOW())
    ORDER BY created_at DESC
    LIMIT 5
  `);

  if (queued.rows.length === 0) {
    console.log("  No queued jobs available");
  } else {
    for (const job of queued.rows) {
      const hasImage = job.featured_image_url && job.featured_image_url.trim() !== '';
      console.log(`\n  ${job.title?.substring(0, 60)}...`);
      console.log(`    Site ID: ${job.site_id}`);
      console.log(`    Has Image: ${hasImage ? "✅ YES" : "❌ NO"}`);
      console.log(`    Created: ${new Date(job.created_at).toLocaleString()}`);
    }
  }

  console.log("\n=== END ===");
  process.exit(0);
}

checkRecentPublishing().catch(console.error);
