import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  console.log('\n=== Checking Category/Taxonomy Tables ===\n');
  
  // Check wp_categories
  const cats1 = await db.execute(sql`
    SELECT COUNT(*) as count FROM wp_categories
  `);
  console.log(`wp_categories table: ${(cats1.rows[0] as any).count} rows`);
  
  if ((cats1.rows[0] as any).count > 0) {
    const sample = await db.execute(sql`
      SELECT * FROM wp_categories LIMIT 5
    `);
    console.log('\nSample wp_categories:');
    console.log(sample.rows);
  }
  
  // Check wp_taxonomy_cache
  const cats2 = await db.execute(sql`
    SELECT COUNT(*) as count FROM wp_taxonomy_cache
  `);
  console.log(`\nwp_taxonomy_cache table: ${(cats2.rows[0] as any).count} rows`);
  
  if ((cats2.rows[0] as any).count > 0) {
    const sample = await db.execute(sql`
      SELECT * FROM wp_taxonomy_cache 
      WHERE taxonomy_type = 'category'
      LIMIT 10
    `);
    console.log('\nSample wp_taxonomy_cache (categories):');
    for (const row of sample.rows) {
      const r = row as any;
      console.log(`  [WP ID: ${r.wp_id}] ${r.name} (${r.count} posts)`);
    }
  }
  
  process.exit(0);
})();
