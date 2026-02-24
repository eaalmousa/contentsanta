import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

/**
 * TEST: Verify category ID confirmation enforcement
 * 
 * Checks:
 * 1. Production target has default_category_id
 * 2. Production target has default_category_id_confirmed = true
 * 3. Inactive targets are properly deactivated
 */

async function testCategoryConfirmation() {
  console.log("\n🧪 Testing category ID confirmation enforcement...\n");

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Check production target
    const result = await db.execute(sql`
      SELECT id, name, is_active, config_json
      FROM publishing_targets
      WHERE id = '33a2681e-ddaf-40c8-836f-e44a990afad6'
    `);

    if (result.rows.length === 0) {
      console.log("❌ FAIL: Production target not found");
      testsFailed++;
    } else {
      const target = result.rows[0] as any;
      const config = target.config_json;

      console.log("TEST 1: Production target is active");
      if (target.is_active) {
        console.log("✅ PASS: Target is active\n");
        testsPassed++;
      } else {
        console.log("❌ FAIL: Target is NOT active\n");
        testsFailed++;
      }

      console.log("TEST 2: default_category_id is set");
      if (config.default_category_id) {
        console.log(`✅ PASS: default_category_id = ${config.default_category_id}\n`);
        testsPassed++;
      } else {
        console.log("❌ FAIL: default_category_id is missing\n");
        testsFailed++;
      }

      console.log("TEST 3: default_category_id_confirmed is true");
      if (config.default_category_id_confirmed === true) {
        console.log("✅ PASS: Category ID is confirmed\n");
        testsPassed++;
      } else {
        console.log("❌ FAIL: Category ID is NOT confirmed");
        console.log("   Preflight will quarantine items with policy_block\n");
        testsFailed++;
      }
    }

    // Check duplicate targets are deactivated
    const duplicates = await db.execute(sql`
      SELECT id, name, is_active
      FROM publishing_targets
      WHERE name ILIKE '%Gulf Estate%'
        AND id != '33a2681e-ddaf-40c8-836f-e44a990afad6'
    `);

    console.log("TEST 4: Duplicate targets are deactivated");
    let allInactive = true;
    for (const dup of duplicates.rows as any[]) {
      if (dup.is_active) {
        console.log(`   ❌ Target ${dup.id} is still ACTIVE`);
        allInactive = false;
      }
    }

    if (allInactive) {
      console.log(`✅ PASS: All ${duplicates.rows.length} duplicate target(s) are inactive\n`);
      testsPassed++;
    } else {
      console.log("❌ FAIL: Some duplicate targets are still active\n");
      testsFailed++;
    }

    // Summary
    console.log("=".repeat(60));
    console.log("📊 TEST SUMMARY");
    console.log("=".repeat(60));
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);

    if (testsFailed === 0) {
      console.log("\n✅ ALL TESTS PASSED - Category ID confirmation enforced");
    } else {
      console.log("\n❌ TESTS FAILED - Configuration issues detected");
    }

  } catch (error) {
    console.error("❌ Test execution error:", error);
    throw error;
  } finally {
    process.exit(testsFailed === 0 ? 0 : 1);
  }
}

testCategoryConfirmation();
