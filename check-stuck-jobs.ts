
import * as dotenv from "dotenv";
dotenv.config();

import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkJobStatuses() {
  console.log("📊 Checking wp_pull_jobs statuses...");

  const statuses = await db.execute(sql`
    SELECT status, COUNT(*) as count
    FROM wp_pull_jobs
    GROUP BY status
    ORDER BY count DESC
  `);

  console.log(`Job Statuses:\n`);
  statuses.rows.forEach((row: any) => {
    console.log(`   ${row.status}: ${row.count}`);
  });

  // Check for jobs leased for a long time
  const stuckLeased = await db.execute(sql`
    SELECT id, created_at, leased_at, status
    FROM wp_pull_jobs
    WHERE status = 'leased'
      AND leased_at < NOW() - INTERVAL '10 minutes'
  `);

  console.log(`\nFound ${stuckLeased.rows.length} stuck 'leased' jobs (potential duplicates).`);
  
  stuckLeased.rows.forEach((row: any) => {
    console.log(`   - [${row.status}] ${row.created_at} (Leased: ${row.leased_at})`);
  });

  process.exit(0);
}

checkJobStatuses().catch(console.error);
