/**
 * Quick verification that placeholder URLs are gone
 */

import { db } from "./server/db";
import { users } from "./shared/schema";
import { sql } from "drizzle-orm";

async function verifyFix() {
  console.log("🔍 Verification: Checking for placeholder URLs...\n");

  // Check for any remaining placeholder URLs
  const withPlaceholder = await db
    .select({
      id: users.id,
      email: users.email,
      profileImageUrl: users.profileImageUrl,
    })
    .from(users)
    .where(sql`${users.profileImageUrl} LIKE '%placeholder%'`);

  if (withPlaceholder.length > 0) {
    console.log(`❌ FAILED: Found ${withPlaceholder.length} user(s) with placeholder URLs:\n`);
    withPlaceholder.forEach((user) => {
      console.log(`  - ${user.email}: ${user.profileImageUrl}`);
    });
    process.exit(1);
  }

  console.log("✅ PASSED: No placeholder URLs found\n");

  // Show dev user status
  const devUser = await db.query.users.findFirst({
    where: sql`${users.email} = 'dev@localhost'`,
  });

  if (devUser) {
    console.log("📋 Dev User Status:");
    console.log(`   ID: ${devUser.id}`);
    console.log(`   Email: ${devUser.email}`);
    console.log(`   Name: ${devUser.firstName || "null"} ${devUser.lastName || "null"}`);
    console.log(`   Profile Image URL: ${devUser.profileImageUrl || "null"}`);
    
    if (!devUser.profileImageUrl) {
      console.log("\n✅ Dev user profile image is NULL (correct!)");
    } else if (!devUser.profileImageUrl.includes("placeholder")) {
      console.log("\n✅ Dev user has non-placeholder image");
    } else {
      console.log("\n❌ Dev user still has placeholder image!");
    }
  }

  console.log("\n🎯 Next Steps:");
  console.log("   1. Open browser to http://localhost:5000");
  console.log("   2. Open Incognito/Private window (to avoid cached session)");
  console.log("   3. Open DevTools (F12) → Network tab");
  console.log("   4. Refresh page");
  console.log("   5. Verify:");
  console.log("      - No requests to via.placeholder.com");
  console.log("      - Avatar shows initials (e.g., 'D')");
  console.log("      - Topic creation works");
}

verifyFix()
  .then(() => {
    console.log("\n✅ Verification complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Verification failed:", error);
    process.exit(1);
  });
