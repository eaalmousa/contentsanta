import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function investigateShellShock() {
  console.log("🔍 Investigating Shell Shock duplicates...\n");

  console.log("1️⃣ Searching pipeline_items for 'Shell Shock'...");
  const items = await db.execute(
    sql`SELECT id, title, status, workspace_id, topic_id, story_hash, created_at, published_at
        FROM pipeline_items
        WHERE title ILIKE '%Shell Shock%'
        ORDER BY created_at DESC
        LIMIT 50`
  );

  console.log(`Found ${items.rows.length} items:\n`);
  for (const item of items.rows) {
    console.log(`  ID: ${item.id}`);
    console.log(`  Title: ${item.title}`);
    console.log(`  Status: ${item.status}`);
    console.log(`  Workspace: ${item.workspace_id}`);
    console.log(`  Topic: ${item.topic_id}`);
    console.log(`  Story Hash: ${item.story_hash}`);
    console.log(`  Created: ${item.created_at}`);
    console.log(`  Published: ${item.published_at}`);
    console.log("");
  }

  console.log("\n2️⃣ Searching wp_pull_jobs for 'Shell Shock'...");
  const jobs = await db.execute(
    sql`SELECT id, job_id, site_id, status, title, created_at, reported_at, wp_post_id
        FROM wp_pull_jobs
        WHERE title ILIKE '%Shell Shock%'
        ORDER BY created_at DESC
        LIMIT 50`
  );

  console.log(`Found ${jobs.rows.length} jobs:\n`);
  for (const job of jobs.rows) {
    console.log(`  Job ID: ${job.job_id}`);
    console.log(`  Site ID: ${job.site_id}`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Title: ${job.title}`);
    console.log(`  Created: ${job.created_at}`);
    console.log(`  Reported: ${job.reported_at}`);
    console.log(`  WP Post ID: ${job.wp_post_id}`);
    console.log("");
  }

  console.log("\n3️⃣ Checking topics...");
  if (items.rows.length > 0) {
    const topicId = items.rows[0].topic_id;
    if (topicId) {
      const topicResult = await db.execute(
        sql`SELECT id, name, status, workspace_id, interval_minutes
            FROM topics
            WHERE id = ${topicId}`
      );

      if (topicResult.rows.length > 0) {
        const topic = topicResult.rows[0];
        console.log(`Topic: ${topic.name}`);
        console.log(`Status: ${topic.status}`);
        console.log(`Workspace: ${topic.workspace_id}`);
        console.log(`Interval: ${topic.interval_minutes} minutes`);
      }
    }
  }

  console.log("\n4️⃣ Checking publishing targets...");
  if (jobs.rows.length > 0) {
    const siteId = jobs.rows[0].site_id;
    if (siteId) {
      const targetResult = await db.execute(
        sql`SELECT id, platform, status, workspace_id, site_url
            FROM publishing_targets
            WHERE id = ${siteId}`
      );

      if (targetResult.rows.length > 0) {
        const target = targetResult.rows[0];
        console.log(`Target: ${target.site_url}`);
        console.log(`Platform: ${target.platform}`);
        console.log(`Status: ${target.status}`);
        console.log(`Workspace: ${target.workspace_id}`);
      }
    }
  }

  console.log("\n✅ Investigation complete");
}

investigateShellShock().catch(console.error);
