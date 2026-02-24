import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function listTopics() {
  const result = await db.execute(sql`
    SELECT 
      t.id,
      t.name,
      t.status,
      t.workspace_id,
      COUNT(DISTINCT ts.source_id) as source_count,
      COUNT(DISTINCT pi.id) as pipeline_item_count
    FROM topics t
    LEFT JOIN topic_sources ts ON ts.topic_id = t.id AND ts.is_enabled = 'true'
    LEFT JOIN pipeline_items pi ON pi.topic_id = t.id
    GROUP BY t.id, t.name, t.status, t.workspace_id
    ORDER BY t.name
    LIMIT 20
  `);

  console.log("\n📋 Topics:\n");
  
  for (const row of result.rows as any[]) {
    console.log(`${row.name}`);
    console.log(`  ID: ${row.id}`);
    console.log(`  Status: ${row.status || "unknown"}`);
    console.log(`  Sources: ${row.source_count}`);
    console.log(`  Pipeline Items: ${row.pipeline_item_count}`);
    console.log("");
  }

  process.exit(0);
}

listTopics();
