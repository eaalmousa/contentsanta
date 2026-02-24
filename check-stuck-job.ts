import { db } from './server/db';
import { wpPullJobs } from './shared/schema';
import { eq } from 'drizzle-orm';

async function checkJob() {
  const jobId = 'f50ebbd2-6adb-4d1f-a2f9-9d26931a8a07';
  
  const [job] = await db.select().from(wpPullJobs).where(eq(wpPullJobs.id, jobId));
  
  if (!job) {
    console.log(`❌ Job ${jobId} not found`);
    return;
  }
  
  console.log("═══════════════════════════════════════════════");
  console.log("JOB STATUS:");
  console.log("═══════════════════════════════════════════════");
  console.log(`Job ID: ${job.id}`);
  console.log(`Status: ${job.status}`);
  console.log(`Title: ${job.title}`);
  console.log(`Target ID: ${job.targetId}`);
  console.log(`Site ID: ${job.siteId}`);
  console.log(`Lease Token: ${job.leaseToken || 'N/A'}`);
  console.log(`Lease Expires: ${job.leaseExpiresAt || 'N/A'}`);
  console.log(`WP Post ID: ${job.resultWpPostId || 'N/A'}`);
  console.log(`WP URL: ${job.resultWpUrl || 'N/A'}`);
  console.log(`Attempts: ${job.attempts}`);
  console.log(`Created: ${job.createdAt}`);
  console.log(`Updated: ${job.updatedAt}`);
  console.log("═══════════════════════════════════════════════");
}

checkJob().then(() => process.exit(0)).catch(console.error);
