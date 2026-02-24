import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function debugCompletedJob() {
  console.log("🔍 Investigating completed WP job...\n");

  const targetId = "8be2881b-9b51-4ef4-9ab1-94a3b05d5398";

  // Find the completed job
  const completedJob = await db.execute(
    sql`SELECT 
          id,
          title,
          status,
          result_wp_post_id,
          result_wp_url,
          error,
          payload_json,
          pipeline_item_id,
          created_at,
          updated_at,
          attempts
        FROM wp_pull_jobs
        WHERE target_id = ${targetId}
          AND status = 'completed'
        ORDER BY updated_at DESC
        LIMIT 1`
  );

  if (completedJob.rows.length === 0) {
    console.log("❌ No completed jobs found.");
    return;
  }

  const job = completedJob.rows[0];
  const hasSuccess = !!job.result_wp_post_id;
  
  console.log("✅ Completed Job Found:");
  console.log(`  Title: ${job.title}`);
  console.log(`  Job ID: ${job.id}`);
  console.log(`  Status: ${job.status}`);
  console.log(`  Success: ${hasSuccess ? "✅ Yes" : "❌ No"}`);
  console.log(`  WP Post ID: ${job.result_wp_post_id || "(null)"}`);
  console.log(`  WP URL: ${job.result_wp_url || "(null)"}`);
  console.log(`  Error: ${job.error || "(none)"}`);
  console.log(`  Attempts: ${job.attempts}`);
  console.log(`  Completed: ${job.updated_at}`);
  console.log("");

  // Check if there's a corresponding pipeline item
  const pipelineItemId = job.pipeline_item_id;

  if (!pipelineItemId) {
    console.log("⚠️  No pipelineItemId found. Cannot link to pipeline item.");
    console.log(`  📌 Job payload: ${JSON.stringify(job.payload_json || {}, null, 2).slice(0, 200)}...`);
    return;
  }

  console.log(`🔗 Linked Pipeline Item ID: ${pipelineItemId}\n`);

  const pipelineItem = await db.execute(
    sql`SELECT 
          id,
          generated_title,
          status,
          target_post_id,
          published_at,
          updated_at
        FROM pipeline_items
        WHERE id = ${pipelineItemId}`
  );

  if (pipelineItem.rows.length === 0) {
    console.log("❌ Pipeline item not found in database.");
    return;
  }

  const item = pipelineItem.rows[0];
  console.log("📋 Pipeline Item Status:");
  console.log(`  Title: ${item.generated_title}`);
  console.log(`  Status: ${item.status}`);
  console.log(`  Target Post ID: ${item.target_post_id || "(null)"}`);
  console.log(`  Published At: ${item.published_at || "(null)"}`);
  console.log(`  Updated: ${item.updated_at}`);
  console.log("");

  // Diagnosis
  console.log("🏥 Diagnosis:");
  if (item.status === "published" && item.target_post_id) {
    console.log("  ✅ Everything working correctly!");
  } else if (hasSuccess && job.result_wp_post_id && !item.target_post_id) {
    console.log("  ❌ Job completed successfully but pipeline item not updated.");
    console.log("  📌 Possible cause: /api/wp/report endpoint failed or not implemented.");
    console.log(`  📌 Expected: pipeline_items.target_post_id = ${job.result_wp_post_id}`);
    console.log(`  📌 Expected: pipeline_items.status = 'published'`);
  } else if (!hasSuccess && job.error) {
    console.log(`  ❌ Job failed with error: ${job.error}`);
  } else {
    console.log("  ⚠️  Unknown state. Manual investigation required.");
  }
}

debugCompletedJob().catch(console.error);
