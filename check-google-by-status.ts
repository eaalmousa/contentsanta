import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  const result = await db.execute(sql`
    SELECT status, COUNT(*) as count
    FROM pipeline_items
    WHERE featured_image_url LIKE '%googleusercontent%'
    GROUP BY status
    ORDER BY count DESC
  `);
  
  console.log('\n=== Google Logo Articles by Status ===\n');
  result.rows.forEach((row: any) => {
    console.log(`  ${row.status}: ${row.count}`);
  });
  
  console.log('\n');
  process.exit(0);
})();
