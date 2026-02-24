/**
 * Check and fix missing payload_json column in wp_pull_jobs table
 */

import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function fixPayloadJsonColumn() {
  console.log("🔍 Checking wp_pull_jobs table schema...\n");

  try {
    // Check if payload_json column exists
    const columnCheck = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'wp_pull_jobs' 
      AND column_name = 'payload_json'
    `);

    if (columnCheck.rows && columnCheck.rows.length > 0) {
      console.log("✅ payload_json column already exists");
      console.log(`   Type: ${(columnCheck.rows[0] as any).data_type}`);
      return;
    }

    console.log("❌ payload_json column missing");
    console.log("➕ Adding payload_json column...\n");

    // Add the missing column
    await db.execute(sql`
      ALTER TABLE wp_pull_jobs 
      ADD COLUMN IF NOT EXISTS payload_json jsonb
    `);

    console.log("✅ payload_json column added successfully\n");

    // Verify it was added
    const verifyCheck = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'wp_pull_jobs' 
      AND column_name = 'payload_json'
    `);

    if (verifyCheck.rows && verifyCheck.rows.length > 0) {
      console.log("✅ Verification passed");
      console.log(`   Column: payload_json`);
      console.log(`   Type: ${(verifyCheck.rows[0] as any).data_type}`);
    } else {
      console.log("⚠️  Verification failed - column may not have been added");
    }

  } catch (error) {
    console.error("\n❌ Error:", error);
    throw error;
  }
}

fixPayloadJsonColumn()
  .then(() => {
    console.log("\n✅ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Failed:", error);
    process.exit(1);
  });
