/**
 * Fix any users still using via.placeholder.com URLs
 * Sets profile_image_url to NULL for cleaner fallback
 */

import { db } from "../server/db";
import { users } from "../shared/schema";
import { sql } from "drizzle-orm";

async function fixPlaceholderAvatars() {
  console.log("🔍 Checking for users with via.placeholder.com URLs...\n");

  // Find affected users
  const affectedUsers = await db
    .select({
      id: users.id,
      email: users.email,
      profileImageUrl: users.profileImageUrl,
    })
    .from(users)
    .where(sql`${users.profileImageUrl} LIKE '%via.placeholder.com%'`);

  if (affectedUsers.length === 0) {
    console.log("✅ No users found with placeholder URLs");
    return;
  }

  console.log(`Found ${affectedUsers.length} user(s) with placeholder URLs:\n`);
  affectedUsers.forEach((user) => {
    console.log(`  - ${user.email} (${user.id})`);
    console.log(`    Current: ${user.profileImageUrl}\n`);
  });

  // Update all affected users
  const result = await db
    .update(users)
    .set({ profileImageUrl: null })
    .where(sql`${users.profileImageUrl} LIKE '%via.placeholder.com%'`);

  console.log(`✅ Updated ${affectedUsers.length} user(s)`);
  console.log(`   Set profile_image_url = NULL\n`);

  // Verify update
  console.log("🔍 Verifying update...");
  const remaining = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.profileImageUrl} LIKE '%via.placeholder.com%'`);

  if (remaining.length === 0) {
    console.log("✅ Verification passed: No placeholder URLs remaining\n");
  } else {
    console.log(`⚠️  Warning: ${remaining.length} placeholder URL(s) still exist\n`);
  }

  console.log("📋 Next steps:");
  console.log("   1. Hard refresh browser (Ctrl+Shift+R)");
  console.log("   2. Clear browser cache/cookies for localhost:5000");
  console.log("   3. Or use Incognito window");
  console.log("   4. Verify no via.placeholder.com requests in Network tab");
}

fixPlaceholderAvatars()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
