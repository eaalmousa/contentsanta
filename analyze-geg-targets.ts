import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function analyzeTargets() {
  const r = await db.execute(sql`
    SELECT 
      pt.id, 
      pt.name, 
      pt.site_id, 
      pt.is_active,
      pt.created_at,
      pt.updated_at,
      COUNT(pi.id) as item_count
    FROM publishing_targets pt
    LEFT JOIN pipeline_items pi ON pt.id = pi.target_id
    WHERE pt.name ILIKE '%Gulf Estate%'
    GROUP BY pt.id, pt.name, pt.site_id, pt.is_active, pt.created_at, pt.updated_at
    ORDER BY pt.created_at DESC
  `);
  
  console.log("\n📊 Gulf Estate Gazette Targets Analysis:");
  console.table(r.rows);
  
  const newest = r.rows[0] as any;
  console.log(`\n✅ RECOMMENDATION: Keep target ${newest.id} (newest, created ${newest.created_at})`);
  console.log(`   Deactivate the other ${r.rows.length - 1} duplicate target(s)\n`);
  
  process.exit(0);
}

analyzeTargets();
