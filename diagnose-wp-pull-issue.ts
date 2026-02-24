import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkWhatHappened() {
  console.log("=== DIAGNOSING WHAT HAPPENED ===\n");

  try {
    // 1. Check if the test job still exists and its status
    console.log("1. CHECKING TEST JOB STATUS:");
    const jobs = await db.execute(sql`
      SELECT 
        id,
        title,
        status,
        featured_image_url,
        lease_expires_at,
        last_error,
        result_wp_post_id,
        result_wp_url,
        created_at,
        updated_at
      FROM wp_pull_jobs
      WHERE title LIKE 'TEST: Image Download Verification%'
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (jobs.rows.length === 0) {
      console.log("  ❌ No test jobs found!");
      console.log("     This means the job wasn't created or was deleted.\n");
    } else {
      for (const job of jobs.rows) {
        console.log(`\n  Job: ${job.title}`);
        console.log(`    ID: ${job.id}`);
        console.log(`    Status: ${job.status}`);
        console.log(`    Has Image URL: ${job.featured_image_url ? "✅ YES" : "❌ NO"}`);
        if (job.featured_image_url) {
          console.log(`    Image: ${job.featured_image_url.substring(0, 60)}...`);
        }
        if (job.lease_expires_at) {
          const isLeased = new Date(job.lease_expires_at) > new Date();
          console.log(`    Leased: ${isLeased ? "🔒 YES" : "No"}`);
          if (isLeased) {
            console.log(`    Lease expires: ${new Date(job.lease_expires_at).toLocaleString()}`);
          }
        }
        if (job.last_error) {
          console.log(`    Error: ${job.last_error.substring(0, 100)}...`);
        }
        if (job.result_wp_post_id) {
          console.log(`    ✅ Published! WP Post ID: ${job.result_wp_post_id}`);
          console.log(`    URL: ${job.result_wp_url}`);
        }
        console.log(`    Created: ${new Date(job.created_at).toLocaleString()}`);
        console.log(`    Updated: ${new Date(job.updated_at).toLocaleString()}`);
      }
    }

    // 2. Check all queued jobs
    console.log("\n2. ALL QUEUED JOBS WAITING:");
    const queuedJobs = await db.execute(sql`
      SELECT 
        id,
        title,
        site_id,
        status,
        featured_image_url,
        created_at
      FROM wp_pull_jobs
      WHERE status = 'queued'
        AND (lease_expires_at IS NULL OR lease_expires_at < NOW())
      ORDER BY created_at DESC
      LIMIT 10
    `);

    if (queuedJobs.rows.length === 0) {
      console.log("  ❌ No queued jobs available for WordPress to pull\n");
    } else {
      console.log(`  Found ${queuedJobs.rows.length} queued job(s):\n`);
      for (const job of queuedJobs.rows) {
        console.log(`    - ${job.title?.substring(0, 50)}...`);
        console.log(`      Site ID: ${job.site_id}`);
        console.log(`      Has Image: ${job.featured_image_url ? "✅" : "❌"}`);
      }
    }

    // 3. Check publishing target configuration
    console.log("\n3. PUBLISHING TARGET CONFIG:");
    const targets = await db.execute(sql`
      SELECT 
        id,
        name,
        type,
        site_id,
        config_json
      FROM publishing_targets
      WHERE type = 'wordpress_pull'
    `);

    if (targets.rows.length === 0) {
      console.log("  ❌ No WordPress publishing targets found!\n");
    } else {
      for (const target of targets.rows) {
        console.log(`\n  ${target.name}:`);
        console.log(`    Site ID: ${target.site_id}`);
        console.log(`    Type: ${target.type}`);
        if (target.config_json) {
          console.log(`    Config: ${JSON.stringify(target.config_json, null, 2)}`);
        }
      }
    }

    // 4. Check if WordPress has the correct secret
    console.log("\n4. SECRET VERIFICATION:");
    console.log("   WordPress plugin should be configured with:");
    console.log(`   - Base URL: Your ngrok URL or production URL`);
    console.log(`   - Site ID: ${targets.rows[0]?.site_id || "cs_site_XXXX"}`);
    console.log(`   - Secret: Check .env file for WORDPRESS_PULL_SECRET`);
    
    const envSecret = process.env.WORDPRESS_PULL_SECRET;
    if (envSecret) {
      console.log(`   - Server Secret: ${envSecret.substring(0, 15)}...${envSecret.substring(envSecret.length - 5)}`);
    } else {
      console.log(`   ❌ No WORDPRESS_PULL_SECRET in .env!`);
    }

    console.log("\n=== END DIAGNOSIS ===\n");

    // Provide recommendations
    console.log("🔍 TROUBLESHOOTING STEPS:\n");
    
    if (queuedJobs.rows.length === 0 && jobs.rows.length === 0) {
      console.log("❌ ISSUE: No jobs found");
      console.log("   ACTION: Re-run the test job creation script");
      console.log("   COMMAND: npx tsx --env-file=.env create-test-wp-job.ts\n");
    } else if (queuedJobs.rows.length > 0) {
      console.log("✅ Jobs are queued and waiting");
      console.log("   NEXT: Check if WordPress is configured correctly:");
      console.log("   1. Base URL matches your server");
      console.log("   2. Site ID matches the target site_id");
      console.log("   3. Secret matches WORDPRESS_PULL_SECRET from .env\n");
    } else if (jobs.rows.length > 0 && jobs.rows[0].status === 'leased') {
      console.log("🔒 Job is currently leased");
      console.log("   This means WordPress pulled it but hasn't reported back yet");
      console.log("   ACTION: Wait or check WordPress error log\n");
    } else if (jobs.rows.length > 0 && jobs.rows[0].status === 'completed') {
      console.log("✅ Job completed successfully!");
      console.log("   Check WordPress → Posts for the new article\n");
    } else if (jobs.rows.length > 0 && jobs.rows[0].last_error) {
      console.log("❌ Job failed with error");
      console.log("   Check the error message above\n");
    }

  } catch (error: any) {
    console.error("\n❌ ERROR:", error.message);
    console.error(error);
  }

  process.exit(0);
}

checkWhatHappened().catch(console.error);
