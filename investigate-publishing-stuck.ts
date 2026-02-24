import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function investigatePublishingStuck() {
  console.log("🔍 Investigating Stuck Publishing State\n");
  console.log("=".repeat(80));

  const workspaceId = "6830ca7f-cf7b-4d6c-97bc-3615fa563be9";
  const targetId = "8be2881b-9b51-4ef4-9ab1-94a3b05d5398"; // Gulf Estate Gazette

  // 1. Check items stuck in "publishing" state
  console.log("\n📋 ITEMS STUCK IN 'PUBLISHING' STATE:\n");
  
  const publishingItems = await db.execute(
    sql`SELECT id, generated_title, status, scheduled_for, updated_at,
               EXTRACT(EPOCH FROM (NOW() - updated_at))/60 as minutes_stuck
        FROM pipeline_items
        WHERE workspace_id = ${workspaceId}
          AND status = 'publishing'
        ORDER BY updated_at ASC`
  );

  console.log(`  Found ${publishingItems.rows.length} items in 'publishing' state\n`);
  
  for (const item of publishingItems.rows) {
    console.log(`  📄 ${item.generated_title.substring(0, 80)}...`);
    console.log(`     Status: ${item.status}`);
    console.log(`     Updated: ${item.updated_at}`);
    console.log(`     Stuck for: ${Math.round(item.minutes_stuck)} minutes`);

    // Check if WP pull job exists for this item
    const wpJob = await db.execute(
      sql`SELECT id, status, leased_at, lease_expires_at, attempts, error, created_at, updated_at
          FROM wp_pull_jobs
          WHERE pipeline_item_id = ${item.id}
          ORDER BY created_at DESC
          LIMIT 1`
    );

    if (wpJob.rows.length > 0) {
      const job = wpJob.rows[0];
      console.log(`     WP Job Status: ${job.status}`);
      console.log(`     Job Attempts: ${job.attempts}`);
      console.log(`     Job Created: ${job.created_at}`);
      console.log(`     Job Updated: ${job.updated_at}`);
      console.log(`     Leased At: ${job.leased_at || "(not leased)"}`);
      console.log(`     Lease Expires: ${job.lease_expires_at || "(no lease)"}`);
      if (job.error) console.log(`     Error: ${job.error}`);
    } else {
      console.log(`     ❌ NO WP PULL JOB FOUND!`);
    }
    console.log("");
  }

  // 2. Check Ramadan article specifically
  console.log("=".repeat(80));
  console.log("\n📋 RAMADAN ARTICLE (Published on WP but shows Quarantined):\n");
  
  const ramadanItem = await db.execute(
    sql`SELECT id, generated_title, status, target_post_id, target_permalink, 
               published_at, verified_at, quarantine_reason, last_error_message
        FROM pipeline_items
        WHERE generated_title LIKE '%Ramadan 2026%'
        ORDER BY created_at DESC
        LIMIT 1`
  );

  if (ramadanItem.rows.length > 0) {
    const item = ramadanItem.rows[0];
    console.log(`  Title: ${item.generated_title}`);
    console.log(`  Status: ${item.status}`);
    console.log(`  Target Post ID: ${item.target_post_id || "(null)"}`);
    console.log(`  Target Permalink: ${item.target_permalink || "(null)"}`);
    console.log(`  Published At: ${item.published_at || "(null)"}`);
    console.log(`  Verified At: ${item.verified_at || "(null)"}`);
    console.log(`  Quarantine Reason: ${item.quarantine_reason || "(none)"}`);
    console.log(`  Last Error: ${item.last_error_message || "(none)"}`);

    // Check WP pull job
    const wpJob = await db.execute(
      sql`SELECT id, status, result_wp_post_id, result_wp_url, error, attempts, created_at, updated_at
          FROM wp_pull_jobs
          WHERE pipeline_item_id = ${item.id}
          ORDER BY created_at DESC
          LIMIT 1`
    );

    console.log("\n  WP Pull Job:");
    if (wpJob.rows.length > 0) {
      const job = wpJob.rows[0];
      console.log(`    Job ID: ${job.id}`);
      console.log(`    Job Status: ${job.status}`);
      console.log(`    WP Post ID: ${job.result_wp_post_id || "(null)"}`);
      console.log(`    WP URL: ${job.result_wp_url || "(null)"}`);
      console.log(`    Attempts: ${job.attempts}`);
      console.log(`    Error: ${job.error || "(none)"}`);
      console.log(`    Created: ${job.created_at}`);
      console.log(`    Updated: ${job.updated_at}`);
    } else {
      console.log(`    ❌ No WP pull job found!`);
    }

    console.log("\n  🌐 WordPress Reality:");
    console.log(`    URL: https://gulfestategazette.com/top-trending-ramadan-2026-timings-dubai-property-r/`);
    console.log(`    Status: PUBLISHED (confirmed by user)`);
    console.log(`    Published: ~30 minutes ago`);

    console.log("\n  🐛 Bug Analysis:");
    if (item.status === "quarantined" && !item.target_post_id) {
      console.log(`    ❌ CRITICAL: Article is on WordPress but status is 'quarantined'`);
      console.log(`    ❌ CRITICAL: No target_post_id stored (link broken)`);
      console.log(`    📌 Root Cause: WP plugin published but never called /api/wp/report`);
      console.log(`    📌 Plugin may be using OLD version without report callback`);
    }
  }

  // 3. Check WP plugin polling activity
  console.log("\n" + "=".repeat(80));
  console.log("\n📡 WORDPRESS PLUGIN ACTIVITY:\n");

  const pluginLogs = await db.execute(
    sql`SELECT endpoint, method, reason, http_status, created_at
        FROM plugin_request_logs
        WHERE target_id = ${targetId}
        ORDER BY created_at DESC
        LIMIT 10`
  );

  if (pluginLogs.rows.length === 0) {
    console.log("  ⚠️  NO PLUGIN ACTIVITY LOGGED!");
    console.log("  📌 This means:");
    console.log("     1. Plugin is not polling /api/wp/pull, OR");
    console.log("     2. Plugin polling but auth is failing, OR");
    console.log("     3. Plugin logs not being created");
  } else {
    console.log(`  Recent plugin requests (last 10):\n`);
    for (const log of pluginLogs.rows) {
      console.log(`    ${log.created_at} - ${log.method} ${log.endpoint}`);
      console.log(`      Status: ${log.http_status}, Reason: ${log.reason || "(success)"}`);
    }
  }

  // 4. Check all WP pull jobs status
  console.log("\n" + "=".repeat(80));
  console.log("\n📊 ALL WP PULL JOBS STATUS:\n");

  const jobStats = await db.execute(
    sql`SELECT status, COUNT(*) as count, 
               MAX(updated_at) as last_updated
        FROM wp_pull_jobs
        WHERE target_id = ${targetId}
        GROUP BY status
        ORDER BY count DESC`
  );

  for (const stat of jobStats.rows) {
    console.log(`  ${stat.status}: ${stat.count} jobs (last: ${stat.last_updated})`);
  }

  // 5. Check if any jobs completed recently
  const recentCompleted = await db.execute(
    sql`SELECT id, status, result_wp_post_id, updated_at
        FROM wp_pull_jobs
        WHERE target_id = ${targetId}
          AND status IN ('completed', 'published')
        ORDER BY updated_at DESC
        LIMIT 3`
  );

  console.log(`\n  Recently completed jobs: ${recentCompleted.rows.length}`);
  if (recentCompleted.rows.length > 0) {
    for (const job of recentCompleted.rows) {
      console.log(`    Job ${job.id}: ${job.status}, Post ID: ${job.result_wp_post_id || "(null)"}`);
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n🔧 DIAGNOSIS:\n");

  if (pluginLogs.rows.length === 0) {
    console.log("  ❌ PROBLEM: WordPress plugin is NOT calling Content Santa API");
    console.log("\n  📌 CAUSES:");
    console.log("     1. Plugin not activated on WordPress");
    console.log("     2. Plugin cron not running (check WP-Cron)");
    console.log("     3. Plugin settings incorrect (wrong URL, site ID, or secret)");
    console.log("     4. Network issue (localhost unreachable from WordPress)");
    console.log("\n  ✅ SOLUTION:");
    console.log("     1. Check WordPress → Plugins → Content Santa Connector is ACTIVE");
    console.log("     2. Check Settings → Content Santa Connector:");
    console.log("        - Base URL should be: http://localhost:5000 (or ngrok URL)");
    console.log("        - Site ID: 8be2881b-9b51-4ef4-9ab1-94a3b05d5398");
    console.log("        - Secret: (correct secret key)");
    console.log("     3. Click 'Run Now (Manual Pull)' to test immediately");
    console.log("     4. Check WordPress debug.log for errors");
  } else {
    console.log("  ℹ️  Plugin IS calling Content Santa API");
    console.log("  📌 Check if it's pulling jobs successfully");
  }

  if (publishingItems.rows.length > 0) {
    console.log("\n  ❌ PROBLEM: Items stuck in 'publishing' state");
    console.log("  📌 This means WP jobs are queued but plugin isn't pulling them");
  }

  console.log("");
}

investigatePublishingStuck().catch(console.error);
