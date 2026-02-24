/**
 * Optional: Add database constraint to permanently prevent placeholder URLs
 * This ensures the problem can never happen again, even from:
 * - Manual SQL inserts
 * - Seeded data
 * - Third-party integrations
 * - Future code regressions
 */

import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function addPlaceholderConstraint() {
  console.log("🔒 Adding database constraint to block placeholder URLs...\n");

  try {
    // Add CHECK constraint to users table
    // This prevents any INSERT or UPDATE that contains blocked domains
    await db.execute(sql`
      ALTER TABLE users
      ADD CONSTRAINT check_no_placeholder_profile_image
      CHECK (
        profile_image_url IS NULL 
        OR (
          profile_image_url NOT LIKE '%via.placeholder.com%'
          AND profile_image_url NOT LIKE '%placeholder.com%'
          AND profile_image_url NOT LIKE '%placeholdit.imgix.net%'
        )
      )
    `);

    console.log("✅ Constraint added successfully!\n");
    console.log("📋 Constraint Details:");
    console.log("   Name: check_no_placeholder_profile_image");
    console.log("   Table: users");
    console.log("   Column: profile_image_url");
    console.log("   Blocks: via.placeholder.com, placeholder.com, placeholdit.imgix.net\n");

    console.log("🧪 Testing constraint...");
    
    // Test 1: NULL should be allowed
    process.stdout.write("   Test 1: NULL value → ");
    try {
      await db.execute(sql`
        UPDATE users 
        SET profile_image_url = NULL 
        WHERE id = 'dev-user-123'
      `);
      console.log("✅ Allowed");
    } catch (e) {
      console.log("❌ Blocked (unexpected!)");
      throw e;
    }

    // Test 2: Valid URL should be allowed
    process.stdout.write("   Test 2: Valid URL → ");
    try {
      await db.execute(sql`
        UPDATE users 
        SET profile_image_url = 'https://example.com/avatar.jpg' 
        WHERE id = 'dev-user-123'
      `);
      console.log("✅ Allowed");
    } catch (e) {
      console.log("❌ Blocked (unexpected!)");
      throw e;
    }

    // Test 3: Placeholder URL should be blocked
    process.stdout.write("   Test 3: via.placeholder.com → ");
    try {
      await db.execute(sql`
        UPDATE users 
        SET profile_image_url = 'https://via.placeholder.com/150' 
        WHERE id = 'dev-user-123'
      `);
      console.log("❌ Allowed (constraint failed!)");
      throw new Error("Constraint did not block placeholder URL!");
    } catch (e: any) {
      if (e.message?.includes("check_no_placeholder_profile_image") || 
          e.message?.includes("violates check constraint")) {
        console.log("✅ Blocked (correct!)");
      } else {
        console.log("❌ Unknown error");
        throw e;
      }
    }

    // Restore NULL
    await db.execute(sql`
      UPDATE users 
      SET profile_image_url = NULL 
      WHERE id = 'dev-user-123'
    `);

    console.log("\n✅ All tests passed!");
    console.log("\n🎯 Result:");
    console.log("   Database now permanently rejects placeholder URLs");
    console.log("   This protection works even if code has bugs");
    console.log("   Any attempt to insert/update with placeholder will fail");

  } catch (error: any) {
    if (error.message?.includes("already exists") || 
        error.message?.includes("duplicate key")) {
      console.log("ℹ️  Constraint already exists (skipping)");
    } else {
      console.error("\n❌ Error:", error.message);
      throw error;
    }
  }
}

addPlaceholderConstraint()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
