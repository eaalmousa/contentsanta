import { db } from "./server/db";
import { pipelineItems, wpPullJobs, topics, publishingTargets } from "./shared/schema";
import { eq, ilike, desc, sql } from "drizzle-orm";

async function investigateShellShock() {
  console.log("🔍 Investigating Shell Shock duplicates...\n");

  console.log("1️⃣ Searching pipeline_items for 'Shell Shock'...");
  const items = await db
    .select()
    .from(pipelineItems)
    .where(sql`LOWER(${pipelineItems.title}) LIKE LOWER('%Shell Shock%')`)
    .limit(50);

  console.log(`Found ${items.length} items:\n`);
  for (const item of items) {
    console.log(`  ID: ${item.id}`);
    console.log(`  Title: ${item.title}`);
    console.log(`  Status: ${item.status}`);
    console.log(`  Workspace: ${item.workspaceId}`);
    console.log(`  Topic: ${item.topicId}`);
    console.log(`  Story Hash: ${item.storyHash}`);
    console.log(`  Created: ${item.createdAt}`);
    console.log(`  Published: ${item.publishedAt}`);
    console.log("");
  }

  console.log("\n2️⃣ Searching wp_pull_jobs for 'Shell Shock'...");
  const jobs = await db
    .select()
    .from(wpPullJobs)
    .where(sql`LOWER(${wpPullJobs.title}) LIKE LOWER('%Shell Shock%')`)
    .limit(50);

  console.log(`Found ${jobs.length} jobs:\n`);
  for (const job of jobs) {
    console.log(`  Job ID: ${job.jobId}`);
    console.log(`  Site ID: ${job.siteId}`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Title: ${job.title}`);
    console.log(`  Created: ${job.createdAt}`);
    console.log(`  Reported: ${job.reportedAt}`);
    console.log(`  WP Post ID: ${job.wpPostId}`);
    console.log("");
  }

  console.log("\n3️⃣ Checking if topic is still active...");
  if (items.length > 0) {
    const topicId = items[0].topicId;
    if (topicId) {
      const topic = await db
        .select({
          id: topics.id,
          name: topics.name,
          status: topics.status,
          workspaceId: topics.workspaceId,
          intervalMinutes: topics.intervalMinutes,
        })
        .from(topics)
        .where(eq(topics.id, topicId))
        .limit(1);

      if (topic.length > 0) {
        console.log(`Topic: ${topic[0].name}`);
        console.log(`Status: ${topic[0].status}`);
        console.log(`Workspace: ${topic[0].workspaceId}`);
        console.log(`Interval: ${topic[0].intervalMinutes} minutes`);
      }
    }
  }

  console.log("\n4️⃣ Checking publishing targets...");
  if (jobs.length > 0) {
    const siteId = jobs[0].siteId;
    if (siteId) {
      const target = await db
        .select({
          id: publishingTargets.id,
          platform: publishingTargets.platform,
          status: publishingTargets.status,
          workspaceId: publishingTargets.workspaceId,
          siteUrl: publishingTargets.siteUrl,
        })
        .from(publishingTargets)
        .where(eq(publishingTargets.id, siteId))
        .limit(1);

      if (target.length > 0) {
        console.log(`Target: ${target[0].siteUrl}`);
        console.log(`Platform: ${target[0].platform}`);
        console.log(`Status: ${target[0].status}`);
        console.log(`Workspace: ${target[0].workspaceId}`);
      }
    }
  }

  console.log("\n✅ Investigation complete");
}

investigateShellShock().catch(console.error);
