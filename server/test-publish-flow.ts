import { db } from "./db";
import { pipelineItems, wpPullJobs, publishingTargets } from "@shared/schema";
import { eq, inArray, and } from "drizzle-orm";
import { storage } from "./storage";

async function testPublishFlow() {
  console.log("=== Testing Single Draft Publish Flow ===\n");

  const target = await db.select().from(publishingTargets)
    .where(eq(publishingTargets.type, "wordpress_pull"))
    .limit(1);

  if (!target.length) {
    console.error("No WordPress Pull target found!");
    process.exit(1);
  }

  console.log(`Target: ${target[0].name} (${target[0].siteId})`);
  console.log(`Status: ${target[0].isActive ? "Active" : "Inactive"}`);
  console.log(`Health: ${target[0].lastHealthStatus}`);

  const gatedItems = await db.select().from(pipelineItems)
    .where(eq(pipelineItems.status, "gated"))
    .limit(1);

  if (!gatedItems.length) {
    console.log("\nNo gated items found. Checking other statuses...");
    const allItems = await db.select().from(pipelineItems).limit(5);
    console.log("Pipeline items:", allItems.map(i => ({ id: i.id.slice(0, 8), status: i.status })));
    process.exit(1);
  }

  const item = gatedItems[0];
  console.log(`\nSelected pipeline item: ${item.id}`);
  console.log(`Title: ${item.generatedTitle}`);

  console.log("\n1. Moving from GATED → SCHEDULED...");
  await db.update(pipelineItems)
    .set({ 
      status: "scheduled",
      scheduledFor: new Date(),
      targetId: target[0].id,
      updatedAt: new Date()
    })
    .where(eq(pipelineItems.id, item.id));
  console.log("   Done.");

  console.log("\n2. Moving from SCHEDULED → PUBLISHING...");
  await db.update(pipelineItems)
    .set({ 
      status: "publishing",
      updatedAt: new Date()
    })
    .where(eq(pipelineItems.id, item.id));
  console.log("   Done.");

  console.log("\n3. Creating WP Pull Job...");
  const [job] = await db.insert(wpPullJobs).values({
    targetId: target[0].id,
    siteId: target[0].siteId!,
    storyId: item.storyId,
    pipelineItemId: item.id,
    title: item.generatedTitle || "Untitled Post",
    contentHtml: item.generatedBody || "<p>Content pending</p>",
    postStatus: "draft",
    categories: item.generatedCategory ? [item.generatedCategory] : ["Uncategorized"],
    tags: item.generatedTags || [],
    excerpt: item.generatedExcerpt || "",
    slug: item.generatedTitle?.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50) || "post",
    sourceUrl: null,
    featuredImageUrl: null,
    metadataJson: {},
    status: "pending",
  }).returning();

  console.log(`   Created job: ${job.id}`);
  console.log(`   Status: ${job.status}`);

  console.log("\n=== Publish Flow Ready ===");
  console.log("\nTo test the WP Pull endpoint, run:");
  console.log(`curl -X GET "http://localhost:5000/api/wp-pull/pull?siteId=${target[0].siteId}" \\`);
  console.log(`  -H "X-ContentSanta-Secret: YOUR_SECRET_HERE"`);

  console.log("\n=== Current State ===");
  const updatedItem = await db.select().from(pipelineItems).where(eq(pipelineItems.id, item.id)).limit(1);
  const pendingJob = await db.select().from(wpPullJobs).where(eq(wpPullJobs.id, job.id)).limit(1);
  
  console.log(`Pipeline Item: ${updatedItem[0].status}`);
  console.log(`WP Pull Job: ${pendingJob[0].status}`);

  console.log("\n=== Target credentials (for testing) ===");
  console.log(`Site ID: ${target[0].siteId}`);
  console.log(`Secret last 4: ${target[0].secretLast4}`);

  process.exit(0);
}

testPublishFlow().catch(console.error);
