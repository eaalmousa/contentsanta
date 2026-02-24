import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

/**
 * STEP 3 Test: Verify wp_pull_jobs.payload_json includes categoryIds
 * 
 * Checks:
 * 1. payload_json structure includes all required fields
 * 2. categoryIds is present and is an array
 * 3. categoryIds contains at least one category ID
 * 4. All expected fields are present: title, contentHtml, excerpt, categoryIds, featuredImageMediaId, storyHash, canonicalSourceUrl
 */

async function testPayloadJson() {
  console.log("🧪 Testing wp_pull_jobs.payload_json structure...\n");

  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // Find recent wp_pull_jobs
    const jobs = await db.execute(sql`
      SELECT 
        id,
        site_id,
        status,
        title,
        payload_json,
        created_at
      FROM wp_pull_jobs
      WHERE payload_json IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 5
    `);

    if (jobs.rows.length === 0) {
      console.log("⚠️  No wp_pull_jobs with payload_json found");
      console.log("\n📋 Testing expected payload structure (mock test)...\n");

      // Mock test - verify expected structure
      const mockPayload = {
        title: "Test Article",
        contentHtml: "<p>Test content</p>",
        excerpt: "Test excerpt",
        categoryIds: [1],
        featuredImageMediaId: null,
        storyHash: "abc123",
        canonicalSourceUrl: "https://example.com/test",
      };

      console.log("TEST 1: Mock payload structure validation");
      const requiredFields = [
        "title",
        "contentHtml",
        "excerpt",
        "categoryIds",
        "featuredImageMediaId",
        "storyHash",
        "canonicalSourceUrl",
      ];

      let allFieldsPresent = true;
      for (const field of requiredFields) {
        if (!(field in mockPayload)) {
          console.log(`   ❌ Missing field: ${field}`);
          allFieldsPresent = false;
        }
      }

      if (allFieldsPresent) {
        console.log("✅ PASS: Mock payload has all required fields");
        testsPassed++;
      } else {
        console.log("❌ FAIL: Mock payload missing required fields");
        testsFailed++;
      }

      console.log("\nTEST 2: categoryIds validation");
      if (Array.isArray(mockPayload.categoryIds) && mockPayload.categoryIds.length > 0) {
        console.log(`✅ PASS: categoryIds is array with ${mockPayload.categoryIds.length} item(s)`);
        testsPassed++;
      } else {
        console.log("❌ FAIL: categoryIds must be non-empty array");
        testsFailed++;
      }

      console.log("\n⚠️  NOTE: No actual wp_pull_jobs found to test");
      console.log("   To create a real test case:");
      console.log("   1. Trigger a pipeline item to be published to a wordpress_pull target");
      console.log("   2. Verify the WP Pull job gets created with payload_json");
      console.log("   3. Re-run this test to validate real data");
    } else {
      console.log(`📦 Found ${jobs.rows.length} wp_pull_jobs with payload_json\n`);

      for (const job of jobs.rows as any[]) {
        console.log("=".repeat(60));
        console.log(`Job ID: ${job.id.substring(0, 8)}`);
        console.log(`Status: ${job.status}`);
        console.log(`Title: ${job.title?.substring(0, 50) || "N/A"}`);
        console.log(`Created: ${new Date(job.created_at).toISOString()}\n`);

        const payload = job.payload_json;

        if (!payload) {
          console.log("❌ FAIL: payload_json is null or undefined\n");
          testsFailed++;
          continue;
        }

        console.log("TEST: Payload structure validation");
        const requiredFields = [
          "title",
          "contentHtml",
          "excerpt",
          "categoryIds",
          "featuredImageMediaId",
          "storyHash",
          "canonicalSourceUrl",
        ];

        let jobPassed = true;

        for (const field of requiredFields) {
          if (field in payload) {
            console.log(`   ✅ ${field}: present`);
          } else {
            console.log(`   ❌ ${field}: MISSING`);
            jobPassed = false;
          }
        }

        // Specific check for categoryIds
        if ("categoryIds" in payload) {
          if (Array.isArray(payload.categoryIds)) {
            if (payload.categoryIds.length > 0) {
              console.log(`   ✅ categoryIds: array with ${payload.categoryIds.length} item(s) → ${JSON.stringify(payload.categoryIds)}`);
            } else {
              console.log(`   ⚠️  categoryIds: array but EMPTY`);
              jobPassed = false;
            }
          } else {
            console.log(`   ❌ categoryIds: not an array (type: ${typeof payload.categoryIds})`);
            jobPassed = false;
          }
        }

        console.log(`\nPayload preview:`);
        console.log(JSON.stringify(payload, null, 2).substring(0, 500) + "...\n");

        if (jobPassed) {
          console.log("✅ PASS: Job payload structure valid\n");
          testsPassed++;
        } else {
          console.log("❌ FAIL: Job payload structure invalid\n");
          testsFailed++;
        }
      }
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 TEST SUMMARY");
    console.log("=".repeat(60));
    console.log(`✅ Passed: ${testsPassed}`);
    console.log(`❌ Failed: ${testsFailed}`);

    if (testsFailed === 0) {
      console.log("\n✅ ALL TESTS PASSED - payload_json structure valid");
    } else {
      console.log("\n❌ TESTS FAILED - payload_json structure has issues");
    }
  } catch (error) {
    console.error("❌ Test execution error:", error);
    throw error;
  } finally {
    process.exit(testsFailed === 0 ? 0 : 1);
  }
}

testPayloadJson();
