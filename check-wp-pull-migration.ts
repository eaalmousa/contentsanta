import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkWpPullJobsMigration() {
  console.log("🔍 Checking wp_pull_jobs migration status...\n");

  const columns = await db.execute(sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'wp_pull_jobs' 
    AND column_name IN ('payload_json', 'story_hash')
    ORDER BY column_name
  `);

  console.log("Columns found:");
  for (const row of columns.rows as any[]) {
    console.log(`  ✅ ${row.column_name}`);
  }

  if (columns.rows.length === 2) {
    console.log("\n✅ Migration add-wp-pull-jobs-payload already applied");
  } else {
    console.log("\n⚠️  Missing columns - need to apply migration");
    console.log("   Run: .\scripts\run-tsx.ps1 db\migrations\add-wp-pull-jobs-payload.ts");
  }

  process.exit(0);
}

checkWpPullJobsMigration();
