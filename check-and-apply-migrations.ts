import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

async function checkAndApplyMigrations() {
  console.log("🔍 Checking migration status...\n");

  // Check if topics migration columns exist
  const topicsCheck = await db.execute(sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'topics' 
    AND column_name IN ('last_run_id', 'first_run_at', 'last_error')
    ORDER BY column_name
  `);

  const migration1Applied = topicsCheck.rows.length === 3;

  console.log("Migration status:");
  console.log(
    `  ${migration1Applied ? "✅" : "⚠️"} 20260128112959_add_topic_status_state_machine.sql - ${
      migration1Applied ? "APPLIED" : "PENDING"
    }`
  );

  // Check if idempotency migration columns exist
  const idempotencyCheck = await db.execute(sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'pipeline_items' 
    AND column_name = 'story_hash'
  `);

  const migration2Applied = idempotencyCheck.rows.length > 0;
  console.log(
    `  ${migration2Applied ? "✅" : "⚠️"} 20260128120000_add_idempotency_and_reaper.sql - ${
      migration2Applied ? "APPLIED" : "PENDING"
    }`
  );

  // Apply pending migrations
  if (!migration1Applied) {
    console.log("\n📦 Applying migration 20260128112959...");
    const migrationPath = path.join(
      __dirname,
      "db",
      "migrations",
      "20260128112959_add_topic_status_state_machine.sql"
    );
    const migrationSql = fs.readFileSync(migrationPath, "utf-8");

    try {
      await db.execute(sql.raw(migrationSql));
      console.log("✅ Migration 20260128112959 applied successfully");
    } catch (error: any) {
      console.error("❌ Error applying migration:", error.message);
      // Continue to check other migrations
    }
  }

  if (!migration2Applied) {
    console.log("\n📦 Applying migration 20260128120000...");
    const migrationPath = path.join(
      __dirname,
      "db",
      "migrations",
      "20260128120000_add_idempotency_and_reaper.sql"
    );
    const migrationSql = fs.readFileSync(migrationPath, "utf-8");

    try {
      await db.execute(sql.raw(migrationSql));
      console.log("✅ Migration 20260128120000 applied successfully");
    } catch (error: any) {
      console.error("❌ Error applying migration:", error.message);
    }
  }

  if (migration1Applied && migration2Applied) {
    console.log("\n✅ All migrations are up to date");
  } else {
    console.log("\n✅ Migration check complete");
  }

  process.exit(0);
}

checkAndApplyMigrations();
