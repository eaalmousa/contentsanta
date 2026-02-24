import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function simpleCheck() {
  console.log("=== SIMPLE WP PULL CHECK ===\n");

  try {
    // Check test jobs
    const jobs = await db.execute(sql`
      SELECT 
        id,
        title,
        status,
        featured_image_url,
        created_at,
        updated_at
      FROM wp_pull_jobs
      WHERE title LIKE 'TEST:%'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log(`Found ${jobs.rows.length} test job(s):\n`);
    
    if (jobs.rows.length === 0) {
      console.log("❌ No test jobs found!");
      console.log("\nPossible reasons:");
      console.log("1. Job creation failed");
      console.log("2. Wrong table/database");
      console.log("3. Job was deleted\n");
      console.log("SOLUTION: Re-create test job");
      console.log("COMMAND: npx tsx --env-file=.env create-test-wp-job.ts\n");
    } else {
      for (const job of jobs.rows) {
        console.log(`✅ Job: ${job.title}`);
        console.log(`   ID: ${job.id}`);
        console.log(`   Status: ${job.status}`);
        console.log(`   Has Image: ${job.featured_image_url ? "YES" : "NO"}`);
        console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
        console.log(`   Updated: ${new Date(job.updated_at).toLocaleString()}\n`);
      }
    }

    // Check queued jobs
    const queued = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM wp_pull_jobs
      WHERE status = 'queued'
    `);

    console.log(`Total queued jobs: ${queued.rows[0].count}\n`);

    // Check site_id match
    const targets = await db.execute(sql`
      SELECT site_id, name FROM publishing_targets WHERE type = 'wordpress_pull' LIMIT 1
    `);

    if (targets.rows.length > 0) {
      console.log(`WordPress target site_id: ${targets.rows[0].site_id}`);
      console.log(`WordPress plugin should use this same site_id\n`);
    }

  } catch (error: any) {
    console.error("ERROR:", error.message);
  }

  process.exit(0);
}

simpleCheck().catch(console.error);
