import { db } from "./server/db";
import { wpPullJobs } from "./shared/schema";
import { eq } from "drizzle-orm";

async function inspectJob() {
  const jobId = "4685a3d1-1094-4fea-899d-83388e900554";
  
  const [job] = await db
    .select()
    .from(wpPullJobs)
    .where(eq(wpPullJobs.id, jobId))
    .limit(1);

  if (!job) {
    console.log("Job not found");
    return;
  }

  console.log("WP Pull Job Details:");
  console.log(`  ID: ${job.id}`);
  console.log(`  Target ID: ${job.targetId}`);
  console.log(`  Status: ${job.status}`);
  console.log(`  Title: ${job.title}`);
  console.log(`  Created: ${job.createdAt}`);
  console.log(`  Updated: ${job.updatedAt}`);
  console.log(`  Attempts: ${job.attempts}`);
  console.log(`  Lease Expiry: ${job.leaseExpiresAt}`);
  console.log(`  WP Post ID: ${job.resultWpPostId}`);
  console.log(`  WP URL: ${job.resultWpUrl}`);
  console.log(`\nPayload JSON:`);
  console.log(JSON.stringify(job.payloadJson, null, 2));
}

inspectJob().catch(console.error);
