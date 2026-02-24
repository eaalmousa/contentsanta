import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkSourceItems() {
  const workspaceId = "6830ca7f-cf7b-4d6c-97bc-3615fa563be9";

  // Total count
  const total = await db.execute(
    sql`SELECT COUNT(*) as count FROM source_items WHERE workspace_id = ${workspaceId}`
  );
  console.log(`Total source items: ${total.rows[0].count}`);

  // By source
  const bySource = await db.execute(
    sql`SELECT s.name, COUNT(si.id) as count
        FROM sources s
        LEFT JOIN source_items si ON s.id = si.source_id AND si.workspace_id = ${workspaceId}
        WHERE s.workspace_id = ${workspaceId}
        GROUP BY s.id, s.name
        ORDER BY count DESC
        LIMIT 10`
  );

  console.log("\nTop sources:");
  for (const row of bySource.rows) {
    console.log(`  ${row.name}: ${row.count}`);
  }

  // Items created in last hour
  const recent = await db.execute(
    sql`SELECT COUNT(*) as count FROM source_items 
        WHERE workspace_id = ${workspaceId}
          AND created_at > NOW() - INTERVAL '1 hour'`
  );
  console.log(`\nCreated in last hour: ${recent.rows[0].count}`);
}

checkSourceItems().catch(console.error);
