import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function investigateStatusFlip() {
  console.log("🔍 Investigating Status Flip (Published → Quarantined):\n");
  console.log("=".repeat(80));

  // Find Ramadan article
  const ramadanQuery = await db.execute(
    sql`SELECT id, generated_title, status, target_post_id, target_permalink,
               published_at, verified_at, quarantine_reason, last_error_message,
               created_at, updated_at
        FROM pipeline_items
        WHERE generated_title LIKE '%Ramadan 2026%'
        ORDER BY created_at DESC
        LIMIT 1`
  );

  if (ramadanQuery.rows.length === 0) {
    console.log("❌ Ramadan article not found!");
    return;
  }

  const item = ramadanQuery.rows[0];
  
  console.log("\n📄 RAMADAN ARTICLE CURRENT STATE:\n");
  console.log(`Title: ${item.generated_title}`);
  console.log(`Status: ${item.status}`);
  console.log(`Target Post ID: ${item.target_post_id || "(null)"}`);
  console.log(`Target Permalink: ${item.target_permalink || "(null)"}`);
  console.log(`Published At: ${item.published_at || "(null)"}`);
  console.log(`Verified At: ${item.verified_at || "(null)"}`);
  console.log(`Quarantine Reason: ${item.quarantine_reason || "(none)"}`);
  console.log(`Last Error: ${item.last_error_message || "(none)"}`);
  console.log(`Created: ${item.created_at}`);
  console.log(`Updated: ${item.updated_at}`);

  // Check item history
  console.log("\n" + "=".repeat(80));
  console.log("\n📜 ITEM HISTORY (Last 10 Events):\n");

  const history = await db.execute(
    sql`SELECT event_type, old_status, new_status, metadata_json, created_at
        FROM pipeline_item_history
        WHERE item_id = ${item.id}
        ORDER BY created_at DESC
        LIMIT 10`
  );

  if (history.rows.length === 0) {
    console.log("❌ No history found!");
  } else {
    for (const event of history.rows) {
      const time = new Date(event.created_at).toLocaleTimeString();
      console.log(`${time} - ${event.event_type}`);
      if (event.old_status || event.new_status) {
        console.log(`  Status: ${event.old_status || "?"} → ${event.new_status || "?"}`);
      }
      if (event.metadata_json) {
        const meta = event.metadata_json as any;
        if (meta.reason) console.log(`  Reason: ${meta.reason}`);
        if (meta.error) console.log(`  Error: ${meta.error}`);
        if (meta.details) console.log(`  Details: ${meta.details}`);
      }
      console.log("");
    }
  }

  // Check WP pull jobs for this item
  console.log("=".repeat(80));
  console.log("\n📦 WP PULL JOBS FOR THIS ITEM:\n");

  const jobs = await db.execute(
    sql`SELECT id, status, created_at, updated_at, result_wp_post_id, 
               result_wp_url, error, attempts
        FROM wp_pull_jobs
        WHERE pipeline_item_id = ${item.id}
        ORDER BY created_at DESC
        LIMIT 5`
  );

  console.log(`Total jobs: ${jobs.rows.length}\n`);

  for (const job of jobs.rows) {
    console.log(`Job ${job.id.substring(0, 8)}...`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Attempts: ${job.attempts}`);
    console.log(`  Created: ${job.created_at}`);
    console.log(`  Updated: ${job.updated_at}`);
    console.log(`  WP Post ID: ${job.result_wp_post_id || "(null)"}`);
    console.log(`  WP URL: ${job.result_wp_url || "(null)"}`);
    console.log(`  Error: ${job.error || "(none)"}`);
    console.log("");
  }

  // Analyze the problem
  console.log("=".repeat(80));
  console.log("\n🐛 DIAGNOSIS:\n");

  if (item.status === "quarantined" && item.target_post_id) {
    console.log("❌ PROBLEM: Article has WP Post ID but is quarantined!");
    console.log("   This shouldn't happen - published items should stay published.");
    console.log("");
    console.log("📌 LIKELY CAUSE:");
    console.log("   Verification check failed AFTER publishing");
    console.log("   Reason: " + (item.quarantine_reason || item.last_error_message || "Unknown"));
  } else if (item.status === "quarantined" && !item.target_post_id) {
    console.log("❌ PROBLEM: Article is quarantined with no WP Post ID");
    console.log("   But user says it was published successfully!");
    console.log("");
    console.log("📌 LIKELY CAUSES:");
    console.log("   1. Plugin published but didn't report back (old plugin)");
    console.log("   2. Verification ran before plugin reported");
    console.log("   3. Race condition in status updates");
  }

  if (item.quarantine_reason) {
    console.log("\n⚠️  QUARANTINE REASON: " + item.quarantine_reason);
  }

  if (item.last_error_message) {
    console.log("\n⚠️  LAST ERROR: " + item.last_error_message);
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n🔧 RECOMMENDED ACTIONS:\n");
  console.log("1. Check WordPress - is the article actually there?");
  console.log("   URL: https://gulfestategazette.com/");
  console.log("");
  console.log("2. If article exists on WP:");
  console.log("   - Plugin published but didn't report back");
  console.log("   - Need to upload NEW plugin v0.4.0");
  console.log("");
  console.log("3. If article doesn't exist on WP:");
  console.log("   - Publishing failed");
  console.log("   - Check quarantine_reason for details");
  console.log("");
  console.log("4. Check server logs for verification errors");
}

investigateStatusFlip().catch(console.error);
