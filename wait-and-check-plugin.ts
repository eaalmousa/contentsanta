import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function waitAndCheck() {
  console.log("⏳ Waiting 10 seconds for plugin to pull and publish...\n");
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log("🔍 Checking Results:\n");
  console.log("=".repeat(80));

  // Check recent plugin activity
  const logs = await db.execute(
    sql`SELECT endpoint, method, http_status, reason, created_at
        FROM wp_plugin_request_logs
        WHERE target_id = '8be2881b-9b51-4ef4-9ab1-94a3b05d5398'
          AND created_at > NOW() - INTERVAL '2 minutes'
        ORDER BY created_at DESC`
  );

  console.log(`\n📡 Plugin Requests (Last 2 Minutes): ${logs.rows.length}\n`);

  if (logs.rows.length === 0) {
    console.log("❌ NO PLUGIN ACTIVITY!");
    console.log("\n⚠️  PROBLEM: Plugin is NOT polling!");
    console.log("\nPossible causes:");
    console.log("  1. Plugin not activated");
    console.log("  2. WP-Cron not running");
    console.log("  3. Plugin settings wrong");
    console.log("  4. localhost not reachable from WordPress");
  } else {
    for (const log of logs.rows) {
      const time = new Date(log.created_at).toLocaleTimeString();
      console.log(`${time} - ${log.method} ${log.endpoint} → ${log.http_status} (${log.reason})`);
    }

    const pullRequests = logs.rows.filter(l => l.endpoint === "pull");
    const reportRequests = logs.rows.filter(l => l.endpoint === "report");

    console.log(`\n✅ /api/wp/pull requests: ${pullRequests.length}`);
    console.log(`${reportRequests.length > 0 ? "✅" : "❌"} /api/wp/report callbacks: ${reportRequests.length}`);

    if (reportRequests.length > 0) {
      console.log("\n🎉 SUCCESS! Plugin is reporting back!");
    } else {
      console.log("\n⚠️  Plugin pulled jobs but didn't report back");
      console.log("   → Old plugin version still active");
    }
  }

  // Check WP jobs
  console.log("\n" + "=".repeat(80));
  console.log("\n📦 WP Pull Jobs:\n");

  const jobs = await db.execute(
    sql`SELECT id, status, created_at, result_wp_post_id, result_wp_url
        FROM wp_pull_jobs
        WHERE target_id = '8be2881b-9b51-4ef4-9ab1-94a3b05d5398'
        ORDER BY created_at DESC
        LIMIT 3`
  );

  for (const job of jobs.rows) {
    console.log(`Job ${job.id.substring(0, 8)}... - ${job.status}`);
    console.log(`  Created: ${new Date(job.created_at).toLocaleTimeString()}`);
    if (job.result_wp_post_id) {
      console.log(`  ✅ Published: Post ID ${job.result_wp_post_id}`);
      console.log(`  ✅ URL: ${job.result_wp_url}`);
    }
    console.log("");
  }

  // Check pipeline items
  console.log("=".repeat(80));
  console.log("\n📋 Pipeline Items:\n");

  const items = await db.execute(
    sql`SELECT generated_title, status, target_post_id
        FROM pipeline_items
        WHERE workspace_id = '6830ca7f-cf7b-4d6c-97bc-3615fa563be9'
        ORDER BY updated_at DESC
        LIMIT 5`
  );

  for (const item of items.rows) {
    const title = (item.generated_title || "(no title)").substring(0, 60);
    console.log(`${item.status.toUpperCase()}: ${title}...`);
    if (item.target_post_id) console.log(`  ✅ WP Post ID: ${item.target_post_id}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n📊 SUMMARY:\n");

  if (logs.rows.length > 0 && logs.rows.some(l => l.endpoint === "report")) {
    console.log("🎉 PLUGIN IS WORKING CORRECTLY!");
    console.log("   - Polling Content Santa ✅");
    console.log("   - Publishing to WordPress ✅");
    console.log("   - Reporting back results ✅");
  } else if (logs.rows.length > 0) {
    console.log("⚠️  PLUGIN PARTIALLY WORKING");
    console.log("   - Polling Content Santa ✅");
    console.log("   - Publishing to WordPress ✅");
    console.log("   - Reporting back results ❌ (old version!)");
  } else {
    console.log("❌ PLUGIN NOT WORKING");
    console.log("   - Not polling Content Santa ❌");
    console.log("   - Check WordPress plugin activation and settings");
  }
}

waitAndCheck().catch(console.error);
