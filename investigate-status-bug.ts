import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function investigateStatusBug() {
  console.log("🔍 Investigating Status Synchronization Bug\n");
  console.log("=".repeat(80));

  const workspaceId = "6830ca7f-cf7b-4d6c-97bc-3615fa563be9";

  // 1. Find "Ramadan 2026" item (shows quarantined but was published)
  console.log("\n📋 ITEM 1: Ramadan 2026 (shows quarantined, actually published?)\n");
  
  const ramadanItem = await db.execute(
    sql`SELECT id, generated_title, status, target_post_id, published_at, verified_at, 
               last_error_code, last_error_message, quarantine_reason
        FROM pipeline_items
        WHERE generated_title LIKE '%Ramadan 2026%'
        ORDER BY created_at DESC
        LIMIT 1`
  );

  if (ramadanItem.rows.length > 0) {
    const item = ramadanItem.rows[0];
    console.log(`  Title: ${item.generated_title}`);
    console.log(`  Status: ${item.status}`);
    console.log(`  Published At: ${item.published_at || "(null)"}`);
    console.log(`  Target Post ID: ${item.target_post_id || "(null)"}`);
    console.log(`  Verified At: ${item.verified_at || "(null)"}`);
    console.log(`  Last Error: ${item.last_error_code || "(none)"}`);
    console.log(`  Error Message: ${item.last_error_message || "(none)"}`);
    console.log(`  Quarantine Reason: ${item.quarantine_reason || "(none)"}`);

    // Check WP pull job for this item
    const wpJob = await db.execute(
      sql`SELECT id, status, result_wp_post_id, result_wp_url, error, created_at, updated_at
          FROM wp_pull_jobs
          WHERE pipeline_item_id = ${item.id}
          ORDER BY created_at DESC
          LIMIT 1`
    );

    if (wpJob.rows.length > 0) {
      const job = wpJob.rows[0];
      console.log(`\n  WP Pull Job:`);
      console.log(`    Job Status: ${job.status}`);
      console.log(`    WP Post ID: ${job.result_wp_post_id || "(null)"}`);
      console.log(`    WP URL: ${job.result_wp_url || "(null)"}`);
      console.log(`    Error: ${job.error || "(none)"}`);
      console.log(`    Updated: ${job.updated_at}`);
    } else {
      console.log(`\n  ⚠️  No WP Pull Job found`);
    }

    console.log("\n  🔍 Diagnosis:");
    if (item.published_at && !item.target_post_id) {
      console.log("    ❌ BUG: Has published_at but no target_post_id");
      console.log("    📌 Cause: WP job completed but didn't report back post ID");
    }
    if (item.status === "quarantined" && item.published_at) {
      console.log("    ❌ BUG: Status is 'quarantined' but has published_at timestamp");
      console.log("    📌 Cause: Status not updated to 'published' after successful publish");
    }
  } else {
    console.log("  ⚠️  Item not found");
  }

  // 2. Find "US consumer price index" item (shows published but wasn't)
  console.log("\n" + "=".repeat(80));
  console.log("\n📋 ITEM 2: US consumer price index (shows published, actually not?)\n");
  
  const cpiItem = await db.execute(
    sql`SELECT id, generated_title, status, target_post_id, published_at, verified_at,
               last_error_code, last_error_message, scheduled_for
        FROM pipeline_items
        WHERE generated_title LIKE '%consumer price index%'
        ORDER BY created_at DESC
        LIMIT 1`
  );

  if (cpiItem.rows.length > 0) {
    const item = cpiItem.rows[0];
    console.log(`  Title: ${item.generated_title}`);
    console.log(`  Status: ${item.status}`);
    console.log(`  Published At: ${item.published_at || "(null)"}`);
    console.log(`  Scheduled For: ${item.scheduled_for || "(null)"}`);
    console.log(`  Target Post ID: ${item.target_post_id || "(null)"}`);
    console.log(`  Verified At: ${item.verified_at || "(null)"}`);

    // Check WP pull job
    const wpJob = await db.execute(
      sql`SELECT id, status, result_wp_post_id, result_wp_url, error
          FROM wp_pull_jobs
          WHERE pipeline_item_id = ${item.id}
          ORDER BY created_at DESC
          LIMIT 1`
    );

    if (wpJob.rows.length > 0) {
      const job = wpJob.rows[0];
      console.log(`\n  WP Pull Job:`);
      console.log(`    Job Status: ${job.status}`);
      console.log(`    WP Post ID: ${job.result_wp_post_id || "(null)"}`);
      console.log(`    WP URL: ${job.result_wp_url || "(null)"}`);
      console.log(`    Error: ${job.error || "(none)"}`);
    } else {
      console.log(`\n  ⚠️  No WP Pull Job created yet`);
    }

    console.log("\n  🔍 Diagnosis:");
    if (item.status === "published" && !item.target_post_id) {
      console.log("    ❌ BUG: Status is 'published' but no target_post_id");
      console.log("    📌 Cause: Status incorrectly set to published");
    }
    if (item.status === "published" && !item.published_at) {
      console.log("    ❌ BUG: Status is 'published' but no published_at timestamp");
      console.log("    📌 Cause: Status field out of sync");
    }
  } else {
    console.log("  ⚠️  Item not found");
  }

  // 3. Check how many items have this sync issue
  console.log("\n" + "=".repeat(80));
  console.log("\n📊 SYSTEM-WIDE STATUS SYNC ISSUES:\n");

  const syncIssues = await db.execute(
    sql`SELECT 
          COUNT(CASE WHEN status = 'quarantined' AND published_at IS NOT NULL THEN 1 END) as quarantined_but_published,
          COUNT(CASE WHEN status = 'published' AND target_post_id IS NULL THEN 1 END) as published_but_no_post_id,
          COUNT(CASE WHEN status = 'published' AND published_at IS NULL THEN 1 END) as published_but_no_timestamp,
          COUNT(CASE WHEN published_at IS NOT NULL AND target_post_id IS NULL THEN 1 END) as has_timestamp_no_post_id
        FROM pipeline_items
        WHERE workspace_id = ${workspaceId}`
  );

  const issues = syncIssues.rows[0];
  console.log(`  Quarantined but has published_at: ${issues.quarantined_but_published}`);
  console.log(`  Published but no target_post_id: ${issues.published_but_no_post_id}`);
  console.log(`  Published but no published_at: ${issues.published_but_no_timestamp}`);
  console.log(`  Has published_at but no post_id: ${issues.has_timestamp_no_post_id}`);

  console.log("\n" + "=".repeat(80));
  console.log("\n🔧 ROOT CAUSE ANALYSIS:\n");
  console.log("  The publishing flow has a broken callback/reporting mechanism:");
  console.log("  1. WP plugin publishes article successfully");
  console.log("  2. Plugin sets published_at timestamp");
  console.log("  3. Plugin FAILS to report back post ID to Content Santa");
  console.log("  4. Content Santa never updates status from 'quarantined' to 'published'");
  console.log("  5. Item stuck in 'quarantined' state despite being published\n");

  console.log("📌 FIX REQUIRED:");
  console.log("  1. Check /api/wp/report endpoint (receives plugin callback)");
  console.log("  2. Verify plugin is calling report endpoint correctly");
  console.log("  3. Fix status update logic when report is received");
  console.log("  4. Add data cleanup script to fix existing broken items\n");
}

investigateStatusBug().catch(console.error);
