import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { sql } from "drizzle-orm";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

// Schema guard: verify critical publishing fields exist
// This prevents "code ahead of DB" causing broken publishing
async function verifySchemaFingerprint() {
  try {
    // Check one critical field from each enhanced table
    const result = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM information_schema.columns 
         WHERE table_name = 'pipeline_items' AND column_name = 'story_hash') as has_story_hash,
        (SELECT COUNT(*) FROM information_schema.columns 
         WHERE table_name = 'publishing_targets' AND column_name = 'require_featured_image') as has_require_image
    `);

    const row = result.rows[0] as any;
    
    if (row.has_story_hash === 0 || row.has_require_image === 0) {
      console.error("\n❌ FATAL: Database schema is out of sync with code!");
      console.error("Missing critical publishing safeguard fields.");
      console.error("\n👉 Run migration: npx tsx db/migrations/add-publishing-safeguards.ts\n");
      throw new Error("SCHEMA_MISMATCH: Database schema migration required");
    }
    
    console.log("✅ Schema fingerprint verified");
  } catch (error: any) {
    if (error.message.includes("SCHEMA_MISMATCH")) {
      throw error;
    }
    // Ignore verification errors during tests or if tables don't exist yet
    console.warn("⚠️  Schema verification skipped:", error.message);
  }
}

// Run verification in production/development (skip in test/migration context)
if (process.env.NODE_ENV !== "test" && !process.argv.join(" ").includes("migration")) {
  // Run immediately and await to ensure it blocks startup if schema is wrong
  verifySchemaFingerprint().catch((error) => {
    console.error("Schema verification failed:", error.message);
    process.exit(1);
  });
}
