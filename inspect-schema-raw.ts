import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function introspectSchema() {
  console.log("=== DATABASE SCHEMA INTROSPECTION ===\n");

  // Get wp_pull_jobs columns
  console.log("1. wp_pull_jobs TABLE:");
  const wpPullCols = await db.execute(sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'wp_pull_jobs'
    ORDER BY ordinal_position
  `);
  
  for (const col of wpPullCols.rows) {
    console.log(`   ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
  }

  // Get pipeline_items columns
  console.log("\n2. pipeline_items TABLE:");
  const pipelineCols = await db.execute(sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'pipeline_items'
    ORDER BY ordinal_position
  `);
  
  for (const col of pipelineCols.rows) {
    console.log(`   ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
  }

  // Get publishing_targets columns
  console.log("\n3. publishing_targets TABLE:");
  const targetCols = await db.execute(sql`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'publishing_targets'
    ORDER BY ordinal_position
  `);
  
  for (const col of targetCols.rows) {
    console.log(`   ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
  }

  // Get actual targets with site_id
  console.log("\n4. ACTUAL PUBLISHING TARGETS:");
  const targets = await db.execute(sql`
    SELECT 
      id,
      name,
      type,
      site_id,
      config_json->'default_category_id' as default_cat
    FROM publishing_targets
    WHERE type = 'wordpress_pull'
  `);
  
  for (const target of targets.rows) {
    console.log(`\n   ${target.name}:`);
    console.log(`     ID: ${target.id}`);
    console.log(`     Site ID: ${target.site_id}`);
    console.log(`     Type: ${target.type}`);
    console.log(`     Default Category: ${target.default_cat}`);
  }

  console.log("\n=== END ===");
  process.exit(0);
}

introspectSchema().catch(console.error);
