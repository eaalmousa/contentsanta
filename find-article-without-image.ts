import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function findArticle() {
  console.log("🔍 Searching for article: Economy news insights and market trends worldwide\n");

  // Search in pipeline_items
  const items = await db.execute(
    sql`SELECT id, generated_title, status, featured_image_url, published_at, last_error_message, quarantine_reason
        FROM pipeline_items
        WHERE LOWER(generated_title) LIKE '%economy%news%insights%'
           OR LOWER(generated_title) LIKE '%market%trends%worldwide%'
        ORDER BY created_at DESC
        LIMIT 5`
  );

  console.log(`Found ${items.rows.length} matching items:\n`);
  for (const item of items.rows) {
    console.log(`  ID: ${item.id}`);
    console.log(`  Title: ${item.generated_title}`);
    console.log(`  Status: ${item.status}`);
    console.log(`  Featured Image: ${item.featured_image_url || "(none)"}`);
    console.log(`  Published: ${item.published_at || "(not published)"}`);
    console.log(`  Error: ${item.last_error_message || "(none)"}`);
    console.log(`  Quarantine: ${item.quarantine_reason || "(none)"}`);
    console.log("");
  }

  // Search in wp_pull_jobs
  const jobs = await db.execute(
    sql`SELECT id, title, status, created_at, updated_at, result_wp_url, attempts
        FROM wp_pull_jobs
        WHERE LOWER(title) LIKE '%economy%news%insights%'
           OR LOWER(title) LIKE '%market%trends%worldwide%'
        ORDER BY created_at DESC
        LIMIT 5`
  );

  console.log(`\nFound ${jobs.rows.length} matching WP jobs:\n`);
  for (const job of jobs.rows) {
    console.log(`  Job ID: ${job.id}`);
    console.log(`  Title: ${job.title}`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Created: ${job.created_at}`);
    console.log(`  Updated: ${job.updated_at}`);
    console.log(`  WP URL: ${job.result_wp_url || "(none)"}`);
    console.log(`  Attempts: ${job.attempts}`);
    console.log("");
  }
}

findArticle().catch(console.error);
