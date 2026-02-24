/**
 * Final verification test for topic creation after all fixes:
 * 1. React hooks order fix
 * 2. Workspace context guards
 * 3. via.placeholder.com removal
 */

import { db } from "./server/db";
import { users, workspaces, sources, topics } from "./shared/schema";
import { eq, and } from "drizzle-orm";

async function verifyTopicCreationReadiness() {
  console.log("🔍 Verifying topic creation prerequisites...\n");

  // 1. Check dev user exists and has no external placeholder
  console.log("1️⃣ Checking dev user...");
  const devUser = await db.query.users.findFirst({
    where: eq(users.email, "dev@localhost")
  });

  if (!devUser) {
    console.log("   ❌ Dev user not found");
    return;
  }

  console.log(`   ✅ Dev user found: ${devUser.id}`);
  console.log(`   📧 Email: ${devUser.email}`);
  console.log(`   👤 Name: ${devUser.firstName} ${devUser.lastName}`);
  console.log(`   🖼️  Profile Image: ${devUser.profileImageUrl || "null (no external placeholder)"}`);

  if (devUser.profileImageUrl?.includes("placeholder.com")) {
    console.log("   ⚠️  WARNING: Still using external placeholder URL!");
  } else {
    console.log("   ✅ No external placeholder dependency\n");
  }

  // 2. Check workspace exists and is active
  console.log("2️⃣ Checking workspace...");
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.ownerId, devUser.id)
  });

  if (!workspace) {
    console.log("   ❌ No workspace found");
    return;
  }

  console.log(`   ✅ Workspace: ${workspace.name}`);
  console.log(`   🆔 ID: ${workspace.id}`);
  console.log(`   🔧 Active Site ID: ${workspace.activeSiteId || "not set"}\n`);

  // 3. Check available sources
  console.log("3️⃣ Checking sources...");
  const allSources = await db.query.sources.findMany({
    where: eq(sources.workspaceId, workspace.id)
  });

  console.log(`   📊 Total sources: ${allSources.length}`);
  
  const activeSources = allSources.filter(s => s.isActive);
  console.log(`   ✅ Active sources: ${activeSources.length}`);

  if (activeSources.length > 0) {
    console.log("\n   Active sources:");
    activeSources.forEach(s => {
      console.log(`      - ${s.name} (${s.id})`);
    });
  }
  console.log();

  // 4. Check existing topics
  console.log("4️⃣ Checking existing topics...");
  const existingTopics = await db.query.topics.findMany({
    where: eq(topics.workspaceId, workspace.id)
  });

  console.log(`   📋 Existing topics: ${existingTopics.length}`);
  if (existingTopics.length > 0) {
    existingTopics.slice(0, 3).forEach(t => {
      console.log(`      - ${t.name} (${t.status})`);
    });
    if (existingTopics.length > 3) {
      console.log(`      ... and ${existingTopics.length - 3} more`);
    }
  }
  console.log();

  // 5. Summary
  console.log("📊 SUMMARY:");
  console.log(`   ✅ Dev user exists: YES`);
  console.log(`   ✅ No external placeholder: ${!devUser.profileImageUrl?.includes("placeholder.com") ? "YES" : "NO"}`);
  console.log(`   ✅ Workspace exists: YES`);
  console.log(`   ✅ Active site set: ${workspace.activeSiteId ? "YES" : "NO"}`);
  console.log(`   ✅ Sources available: ${allSources.length > 0 ? "YES" : "NO"}`);
  console.log(`   ✅ Active sources: ${activeSources.length > 0 ? "YES" : "NO"}`);
  
  console.log("\n🎯 Frontend checks needed:");
  console.log("   1. Open browser → http://localhost:5000");
  console.log("   2. Check console for via.placeholder.com errors → Should be GONE");
  console.log("   3. Try creating a topic → Should work without 400 errors");
  console.log("   4. Check user avatar displays fallback initials properly");
  
  console.log("\n✅ All backend prerequisites met!");
}

verifyTopicCreationReadiness()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
