import "dotenv/config";
import { db } from "./server/db";
import { pipelineItems } from "./shared/schema";
import { eq, sql } from "drizzle-orm";

async function testCanonicalUpdate() {
  console.log("\n🧪 Testing canonical_source_url update...\n");

  // Get one pipeline item with NULL canonical_source_url
  const [testItem] = await db
    .select()
    .from(pipelineItems)
    .where(sql`canonical_source_url IS NULL AND story_hash IS NOT NULL`)
    .limit(1);

  if (!testItem) {
    console.log("❌ No test item found");
    process.exit(1);
  }

  console.log(`Test Item ID: ${testItem.id.substring(0, 8)}...`);
  console.log(`Before: canonical_source_url = ${testItem.canonicalSourceUrl || "NULL"}`);

  // Try to update with camelCase field name
  const testUrl = "https://test-canonical-url.com/" + Date.now();
  
  const [updated] = await db
    .update(pipelineItems)
    .set({ 
      canonicalSourceUrl: testUrl,
      updatedAt: new Date()
    })
    .where(eq(pipelineItems.id, testItem.id))
    .returning();

  console.log(`After: canonical_source_url = ${updated.canonicalSourceUrl || "NULL"}`);

  if (updated.canonicalSourceUrl === testUrl) {
    console.log("✅ Update successful - Drizzle mapping works correctly");
  } else {
    console.log("❌ Update failed - canonical_source_url still NULL");
  }

  // Verify in database
  const verified = await db.execute(sql`
    SELECT canonical_source_url 
    FROM pipeline_items 
    WHERE id = ${testItem.id}
  `);

  const dbValue = (verified.rows[0] as any).canonical_source_url;
  console.log(`Database verification: ${dbValue || "NULL"}`);

  if (dbValue === testUrl) {
    console.log("✅ Database confirmed - Update persisted");
  } else {
    console.log("❌ Database mismatch - Update did not persist");
  }

  process.exit(0);
}

testCanonicalUpdate();
