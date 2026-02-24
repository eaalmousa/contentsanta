import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function findTopicTargets() {
  const result = await db.execute(sql`
    SELECT 
      t.name as topic_name,
      t.id as topic_id,
      pt.name as target_name,
      pt.id as target_id,
      pt.is_active,
      pt.type
    FROM topics t
    JOIN publishing_targets pt ON pt.topic_id = t.id
    ORDER BY t.name, pt.name
  `);

  console.log("\n📋 Topics with publishing targets:\n");
  
  for (const row of result.rows as any[]) {
    console.log(`${row.topic_name} -> ${row.target_name}`);
    console.log(`  Topic ID: ${row.topic_id}`);
    console.log(`  Target ID: ${row.target_id}`);
    console.log(`  Type: ${row.type}`);
    console.log(`  Active: ${row.is_active}`);
    console.log("");
  }

  process.exit(0);
}

findTopicTargets();
