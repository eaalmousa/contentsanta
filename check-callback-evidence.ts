import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkCallbackEvidence() {
  console.log("═══════════════════════════════════════════════");
  console.log("  WORDPRESS IMAGE PIPELINE - CALLBACK EVIDENCE");
  console.log("═══════════════════════════════════════════════\n");

  const jobId = "f50ebbd2-6adb-4d1f-a2f9-9d26931a8a07";

  const result = await db.execute(sql`
    SELECT 
      id,
      title,
      status,
      featured_image_url,
      result_wp_post_id,
      result_wp_url,
      callback_image_http_code,
      callback_image_bytes,
      callback_wp_attachment_id,
      callback_set_thumbnail_ok,
      callback_error_step,
      callback_error_details,
      attempts,
      error,
      created_at,
      updated_at
    FROM wp_pull_jobs
    WHERE id = ${jobId}
  `);

  if (result.rows.length === 0) {
    console.log("❌ Test job not found!");
    console.log(`   Job ID: ${jobId}\n`);
    console.log("SOLUTION: Run create-test-job-geg.ts again\n");
    process.exit(1);
  }

  const job = result.rows[0] as any;

  console.log("📋 JOB STATUS:\n");
  console.log(`   ID: ${job.id}`);
  console.log(`   Title: ${job.title}`);
  console.log(`   Status: ${job.status}`);
  console.log(`   Attempts: ${job.attempts}`);
  console.log(`   Created: ${new Date(job.created_at).toLocaleString()}`);
  console.log(`   Updated: ${new Date(job.updated_at).toLocaleString()}\n`);

  if (job.status === "queued") {
    console.log("⏳ Status: QUEUED (waiting for WordPress pull)\n");
    console.log("NEXT STEP:");
    console.log("1. Go to WordPress Admin → Settings → Content Santa Connector");
    console.log("2. Click 'Run Now (Manual Pull)' button");
    console.log("3. Wait 10-15 seconds");
    console.log("4. Run this script again to see results\n");
    process.exit(0);
  }

  console.log("═══════════════════════════════════════════════");
  console.log("  📸 IMAGE PIPELINE EVIDENCE");
  console.log("═══════════════════════════════════════════════\n");

  // Image Download Evidence
  console.log("1️⃣  IMAGE DOWNLOAD:");
  if (job.callback_image_http_code) {
    const httpOk = job.callback_image_http_code === 200;
    console.log(`   ${httpOk ? "✅" : "❌"} HTTP Code: ${job.callback_image_http_code} ${httpOk ? "(Success)" : "(Failed)"}`);
  } else {
    console.log(`   ⏳ HTTP Code: Not yet reported`);
  }

  if (job.callback_image_bytes) {
    const bytesKB = Math.round(job.callback_image_bytes / 1024);
    console.log(`   ✅ Downloaded: ${bytesKB} KB (${job.callback_image_bytes} bytes)`);
  } else {
    console.log(`   ⏳ Downloaded: Not yet reported`);
  }
  console.log();

  // WordPress Upload Evidence
  console.log("2️⃣  WORDPRESS UPLOAD:");
  if (job.callback_wp_attachment_id) {
    console.log(`   ✅ Attachment ID: ${job.callback_wp_attachment_id}`);
    console.log(`   ✅ Media Library: Image uploaded successfully`);
  } else {
    console.log(`   ⏳ Attachment ID: Not yet reported`);
  }
  console.log();

  // Featured Image Evidence
  console.log("3️⃣  FEATURED IMAGE:");
  if (job.callback_set_thumbnail_ok !== null && job.callback_set_thumbnail_ok !== undefined) {
    const thumbOk = job.callback_set_thumbnail_ok === true;
    console.log(`   ${thumbOk ? "✅" : "❌"} Set Thumbnail: ${thumbOk ? "Success" : "Failed"}`);
  } else {
    console.log(`   ⏳ Set Thumbnail: Not yet reported`);
  }
  console.log();

  // Error Evidence
  console.log("4️⃣  ERROR TRACKING:");
  if (job.callback_error_step || job.callback_error_details) {
    console.log(`   ❌ Error Step: ${job.callback_error_step || "Unknown"}`);
    console.log(`   ❌ Error Details: ${job.callback_error_details || "None"}`);
  } else {
    console.log(`   ✅ No errors reported`);
  }
  console.log();

  // Publishing Result
  console.log("═══════════════════════════════════════════════");
  console.log("  📝 PUBLISHING RESULT");
  console.log("═══════════════════════════════════════════════\n");

  if (job.result_wp_post_id) {
    console.log(`   ✅ WordPress Post ID: ${job.result_wp_post_id}`);
  } else {
    console.log(`   ⏳ WordPress Post ID: Not yet created`);
  }

  if (job.result_wp_url) {
    console.log(`   ✅ Post URL: ${job.result_wp_url}`);
  } else {
    console.log(`   ⏳ Post URL: Not yet available`);
  }

  if (job.error) {
    console.log(`   ❌ Job Error: ${job.error}`);
  }
  console.log();

  // Overall Assessment
  console.log("═══════════════════════════════════════════════");
  console.log("  🎯 OVERALL ASSESSMENT");
  console.log("═══════════════════════════════════════════════\n");

  const allGreen = 
    job.callback_image_http_code === 200 &&
    job.callback_image_bytes > 0 &&
    job.callback_wp_attachment_id > 0 &&
    job.callback_set_thumbnail_ok === true &&
    job.status === "published" &&
    job.result_wp_url &&
    !job.callback_error_step;

  if (allGreen) {
    console.log("   ✅✅✅ COMPLETE SUCCESS! ✅✅✅\n");
    console.log("   All image pipeline steps verified:");
    console.log("   • Image downloaded from Unsplash");
    console.log("   • Uploaded to WordPress media library");
    console.log("   • Set as featured image on post");
    console.log("   • Article published successfully\n");
    console.log(`   🌐 View live article: ${job.result_wp_url}\n`);
    console.log("   The image pipeline fix is VERIFIED and WORKING! 🎉\n");
  } else if (job.status === "leased") {
    console.log("   ⏳ IN PROGRESS: WordPress is processing the job\n");
    console.log("   Wait 10-15 seconds and run this script again.\n");
  } else if (job.status === "failed") {
    console.log("   ❌ FAILED: Job encountered an error\n");
    console.log("   Check error details above for diagnosis.\n");
  } else {
    console.log("   ⚠️  PARTIAL: Some evidence missing\n");
    console.log("   This may indicate:");
    console.log("   • WordPress is still processing");
    console.log("   • Plugin callback didn't include all fields");
    console.log("   • Network/firewall blocking image download\n");
    console.log("   Check WordPress error logs for more details.\n");
  }

  console.log("═══════════════════════════════════════════════\n");
}

checkCallbackEvidence().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
