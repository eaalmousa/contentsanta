import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkJobLeases() {
  const targetId = "8be2881b-9b51-4ef4-9ab1-94a3b05d5398";

  console.log("🔍 WP Pull Job Lease Analysis:\n");

  const jobs = await db.execute(
    sql`SELECT id, status, attempts, leased_at, lease_expires_at, 
               result_wp_post_id, error, created_at, updated_at,
               EXTRACT(EPOCH FROM (NOW() - leased_at))/60 as minutes_since_lease,
               EXTRACT(EPOCH FROM (lease_expires_at - NOW()))/60 as minutes_until_expiry
        FROM wp_pull_jobs
        WHERE target_id = ${targetId}
        ORDER BY updated_at DESC
        LIMIT 5`
  );

  console.log(`Total jobs: ${jobs.rows.length}\n`);

  for (const job of jobs.rows) {
    console.log("─".repeat(80));
    console.log(`Job ID: ${job.id}`);
    console.log(`Status: ${job.status}`);
    console.log(`Attempts: ${job.attempts}`);
    console.log(`Created: ${job.created_at}`);
    console.log(`Updated: ${job.updated_at}`);
    console.log(`Leased At: ${job.leased_at || "(never)"}`);
    console.log(`Lease Expires: ${job.lease_expires_at || "(no lease)"}`);
    
    if (job.leased_at && job.minutes_since_lease) {
      console.log(`Time Since Lease: ${Math.round(Number(job.minutes_since_lease))} minutes ago`);
    }
    
    if (job.lease_expires_at && job.minutes_until_expiry) {
      const expiry = Math.round(Number(job.minutes_until_expiry));
      if (expiry < 0) {
        console.log(`Lease Status: ⚠️  EXPIRED ${Math.abs(expiry)} minutes ago`);
      } else {
        console.log(`Lease Status: ✅ Active (expires in ${expiry} minutes)`);
      }
    }
    
    console.log(`WP Post ID: ${job.result_wp_post_id || "(not reported)"}`);
    console.log(`Error: ${job.error || "(none)"}`);
    console.log("");
  }

  // Analyze the problem
  console.log("─".repeat(80));
  console.log("\n🐛 DIAGNOSIS:\n");

  const leasedJobs = jobs.rows.filter((j) => j.leased_at !== null);
  const reportedJobs = jobs.rows.filter((j) => j.result_wp_post_id !== null);

  console.log(`Jobs leased to plugin: ${leasedJobs.length}`);
  console.log(`Jobs with WP Post ID: ${reportedJobs.length}`);

  if (leasedJobs.length > 0 && reportedJobs.length === 0) {
    console.log("\n❌ PROBLEM: Plugin is pulling jobs but NOT reporting results!\n");
    console.log("This means:");
    console.log("  1. Plugin is OLD version (v0.1.0 or v0.3.0) without /api/wp/report callback");
    console.log("  2. Plugin is publishing to WordPress successfully");
    console.log("  3. But plugin doesn't tell Content Santa about the published post\n");
    console.log("✅ SOLUTION:");
    console.log("  1. Upload NEW plugin v0.4.0 (content-santa-connector-v2-optimized.php)");
    console.log("  2. Activate the new plugin on WordPress");
    console.log("  3. The new plugin will call /api/wp/report after publishing");
    console.log("  4. This will update Content Santa with the WordPress post ID\n");
  }

  if (leasedJobs.length > 0) {
    const allExpired = leasedJobs.every((j) => {
      if (!j.lease_expires_at) return false;
      return new Date(j.lease_expires_at) < new Date();
    });

    if (allExpired) {
      console.log("⚠️  All leases have EXPIRED - jobs will be re-leased on next poll\n");
    }
  }
}

checkJobLeases().catch(console.error);
