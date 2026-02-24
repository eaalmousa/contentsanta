import { db } from "./server/db";
import { sql } from "drizzle-orm";

const jobId = "f50ebbd2-6adb-4d1f-a2f9-9d26931a8a07";

const result = await db.execute(sql`
  SELECT 
    id, status, result_wp_post_id, result_wp_url,
    callback_image_http_code, callback_image_bytes,
    callback_wp_attachment_id, callback_set_thumbnail_ok,
    callback_error_step, callback_error_details,
    attempts, error
  FROM wp_pull_jobs
  WHERE id = ${jobId}
`);

const job = result.rows[0] as any;

if (!job) {
  console.log("❌ Job not found");
  process.exit(1);
}

console.log("\n📊 QUICK JOB CHECK:\n");
console.log(`Status: ${job.status}`);
console.log(`WP Post ID: ${job.result_wp_post_id || 'N/A'}`);
console.log(`WP URL: ${job.result_wp_url || 'N/A'}`);
console.log(`Attempts: ${job.attempts}`);
console.log(`Error: ${job.error || 'None'}`);
console.log();
console.log("📸 IMAGE EVIDENCE:");
console.log(`HTTP Code: ${job.callback_image_http_code || 'N/A'}`);
console.log(`Image Bytes: ${job.callback_image_bytes || 'N/A'}`);
console.log(`Attachment ID: ${job.callback_wp_attachment_id || 'N/A'}`);
console.log(`Thumbnail Set: ${job.callback_set_thumbnail_ok !== null ? job.callback_set_thumbnail_ok : 'N/A'}`);
console.log(`Error Step: ${job.callback_error_step || 'None'}`);
console.log(`Error Details: ${job.callback_error_details || 'None'}`);
console.log();

process.exit(0);
