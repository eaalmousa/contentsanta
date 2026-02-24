import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkPluginActivity() {
  const targetId = "8be2881b-9b51-4ef4-9ab1-94a3b05d5398"; // Gulf Estate Gazette

  console.log("📡 WordPress Plugin Activity:\n");

  // Check recent plugin requests
  const logs = await db.execute(
    sql`SELECT endpoint, method, http_status, reason, created_at
        FROM wp_plugin_request_logs
        WHERE target_id = ${targetId}
        ORDER BY created_at DESC
        LIMIT 20`
  );

  console.log(`Total requests logged: ${logs.rows.length}\n`);

  if (logs.rows.length === 0) {
    console.log("❌ NO PLUGIN ACTIVITY DETECTED!\n");
    console.log("This means:");
    console.log("  1. Plugin is NOT ACTIVE on WordPress, OR");
    console.log("  2. Plugin is not polling /api/wp/pull, OR");
    console.log("  3. Plugin has WRONG settings (URL, Site ID, Secret), OR");
    console.log("  4. WordPress WP-Cron is not running\n");
    console.log("✅ ACTION REQUIRED:");
    console.log("  1. Go to WordPress → Plugins → Verify 'Content Santa Connector' is ACTIVE");
    console.log("  2. Go to Settings → Content Santa Connector");
    console.log("  3. Verify settings:");
    console.log("     - Base URL: http://localhost:5000 (or ngrok/tunnel URL)");
    console.log("     - Site ID: 8be2881b-9b51-4ef4-9ab1-94a3b05d5398");
    console.log("     - Secret: (correct secret key from .env)");
    console.log("  4. Click 'Run Now (Manual Pull)' to test immediately");
    console.log("  5. Upload NEW plugin v0.4.0 (content-santa-connector-v2-optimized.php)");
  } else {
    console.log("Recent plugin requests:\n");
    for (const log of logs.rows) {
      console.log(`${log.created_at}`);
      console.log(`  ${log.method} ${log.endpoint}`);
      console.log(`  Status: ${log.http_status}`);
      if (log.reason) console.log(`  Reason: ${log.reason}`);
      console.log("");
    }
  }

  // Check if plugin has EVER pulled a job
  const pullRequests = logs.rows.filter((log) => log.endpoint === "/api/wp/pull");
  console.log(`\n/api/wp/pull requests: ${pullRequests.length}`);

  // Check if plugin has EVER reported a result
  const reportRequests = logs.rows.filter((log) => log.endpoint === "/api/wp/report");
  console.log(`/api/wp/report callbacks: ${reportRequests.length}`);

  if (pullRequests.length === 0) {
    console.log("\n❌ Plugin has NEVER pulled a job!");
    console.log("   → Plugin is not polling or settings are wrong");
  }

  if (reportRequests.length === 0) {
    console.log("\n❌ Plugin has NEVER reported results!");
    console.log("   → Plugin version is OLD (v0.1.0 or v0.3.0 without callback)");
    console.log("   → Must upload NEW plugin v0.4.0");
  }
}

checkPluginActivity().catch(console.error);
