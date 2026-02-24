import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  console.log('\n=== Pipeline Items Schema ===\n');
  
  const cols = await db.execute(sql`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'pipeline_items' 
    ORDER BY ordinal_position
  `);
  
  console.log('Columns:', cols.rows.map((r: any) => r.column_name).join(', '));
  
  console.log('\n=== Status Check ===\n');
  
  const status = await db.execute(sql`
    SELECT status, COUNT(*) as count
    FROM pipeline_items
    GROUP BY status
  `);
  
  console.log('Pipeline Status:');
  status.rows.forEach((row: any) => {
    console.log(`  ${row.status}: ${row.count}`);
  });
  
  const googleImages = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM pipeline_items
    WHERE featured_image_url LIKE '%googleusercontent%'
  `);
  
  console.log(`\nGoogle Logo Images: ${(googleImages.rows[0] as any).count}`);
  
  process.exit(0);
})();
