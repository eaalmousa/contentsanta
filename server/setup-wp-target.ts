import { db } from "./db";
import { publishingTargets, topics } from "@shared/schema";
import { generateSiteId, generateSecret } from "./services/wp-pull-service";
import { eq } from "drizzle-orm";

async function setupWpTarget() {
  console.log("=== Setting up WordPress Pull Publishing Target ===\n");

  const siteId = generateSiteId();
  const { raw: secret, hash: secretHash, last4: secretLast4 } = await generateSecret();

  console.log("Generated credentials:");
  console.log(`  Site ID: ${siteId}`);
  console.log(`  Secret: ${secret}`);
  console.log(`  Secret (last 4): ${secretLast4}`);

  const [target] = await db.insert(publishingTargets).values({
    workspaceId: "demo-workspace",
    type: "wordpress_pull",
    name: "Test WordPress Site",
    isActive: true,
    lastHealthStatus: "ok",
    lastHealthMessage: "Healthy - ready for testing",
    defaultPostStatus: "draft",
    defaultPostType: "posts",
    siteId,
    secretHash,
    secretLast4,
    secretCreatedAt: new Date(),
    wpSiteUrl: "https://test-wordpress-site.local",
  }).returning();

  console.log(`\nCreated publishing target: ${target.id}`);

  const [topic] = await db.select().from(topics).where(eq(topics.automationMode, "approval_required")).limit(1);
  
  if (topic) {
    await db.update(topics)
      .set({ 
        publishingTargetId: target.id,
        automationMode: "auto"
      })
      .where(eq(topics.id, topic.id));
    console.log(`Linked target to topic: ${topic.name}`);
    console.log(`Changed topic to Full Auto mode`);
  }

  console.log("\n=== Configuration Complete ===");
  console.log("\nFor WordPress Plugin configuration:");
  console.log(`  1. Install the ContentSanta WP Plugin`);
  console.log(`  2. Enter Site ID: ${siteId}`);
  console.log(`  3. Enter Secret: ${secret}`);
  console.log(`  4. Set Pull URL: https://your-replit-url/api/wp-pull`);
  
  console.log("\n=== Credentials for testing ===");
  console.log(JSON.stringify({ siteId, secret }, null, 2));
  
  process.exit(0);
}

setupWpTarget().catch(console.error);
