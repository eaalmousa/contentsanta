import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function listSources() {
  const result = await db.execute(sql`
    SELECT 
      s.id,
      s.name,
      s.feed_url,
      s.is_active,
      s.language
    FROM sources s
    WHERE s.is_active = 'true'
    ORDER BY s.name
    LIMIT 50
  `);

  console.log("\n📡 Active sources:\n");
  
  for (const row of result.rows as any[]) {
    const lang = row.language || "unknown";
    console.log(`${row.name}`);
    console.log(`  ID: ${row.id}`);
    console.log(`  URL: ${row.feed_url}`);
    console.log(`  Language: ${lang}`);
    console.log("");
  }

  process.exit(0);
}

listSources();
