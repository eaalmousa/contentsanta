import { db } from "./server/db";
import { wpPullJobs } from "./shared/schema";
import { eq } from "drizzle-orm";

async function fixOldJob() {
  console.log("🔧 Fixing old job with missing image metadata...\n");

  const jobId = "4685a3d1-1094-4fea-899d-83388e900554";
  
  // Get current job
  const [job] = await db
    .select()
    .from(wpPullJobs)
    .where(eq(wpPullJobs.id, jobId))
    .limit(1);

  if (!job) {
    console.log("Job not found");
    return;
  }

  const payload = job.payloadJson as any;
  
  console.log("Current payload:");
  console.log(`  Featured Image: ${payload.featuredImageUrl}`);
  console.log(`  Credit: ${payload.featuredImageCredit || "(missing)"}`);
  console.log(`  Caption: ${payload.featuredImageCaption || "(missing)"}`);

  // Update payload with proper metadata
  const updatedPayload = {
    ...payload,
    featuredImageCredit: "Arab News", // Based on the article source
    featuredImageCaption: payload.title,
  };

  // Reset job to queued status with updated payload
  await db
    .update(wpPullJobs)
    .set({
      payloadJson: updatedPayload,
      status: "queued",
      attempts: 0,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(wpPullJobs.id, jobId));

  console.log("\n✅ Job updated with image metadata:");
  console.log(`  Featured Image: ${updatedPayload.featuredImageUrl}`);
  console.log(`  Credit: ${updatedPayload.featuredImageCredit}`);
  console.log(`  Caption: ${updatedPayload.featuredImageCaption}`);
  console.log(`\n⚠️ Plugin will download and upload image on next poll (within 2 minutes)`);
  console.log(`⚠️ Make sure you've uploaded the V0.3.0 plugin to WordPress!`);
}

fixOldJob().catch(console.error);
