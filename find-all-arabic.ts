import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function findAllArabic() {
  console.log("🔍 Finding ALL Arabic content across ALL statuses...\n");
  
  // Find Arabic in generated_title
  const arabicGenerated = await db.execute(sql`
    SELECT id, generated_title, status, topic_id, created_at
    FROM pipeline_items 
    WHERE generated_title ~ '[\u0600-\u06FF]'
    ORDER BY created_at DESC
    LIMIT 30
  `);
  
  console.log(`Found ${arabicGenerated.rows.length} items with Arabic in generated_title:\n`);
  arabicGenerated.rows.forEach((row: any, i) => {
    console.log(`${i + 1}. [${row.status}] ${row.generated_title?.substring(0, 80)}...`);
  });
  
  // Find Arabic in original_title (canonical_title)
  const arabicOriginal = await db.execute(sql`
    SELECT id, title, status, topic_id, created_at
    FROM pipeline_items 
    WHERE title ~ '[\u0600-\u06FF]'
    ORDER BY created_at DESC
    LIMIT 30
  `);
  
  console.log(`\n\nFound ${arabicOriginal.rows.length} items with Arabic in title:\n`);
  arabicOriginal.rows.forEach((row: any, i) => {
    console.log(`${i + 1}. [${row.status}] ${row.title?.substring(0, 80)}...`);
  });
  
  // Count by status
  const statusCounts = await db.execute(sql`
    SELECT status, COUNT(*) as count
    FROM pipeline_items 
    WHERE generated_title ~ '[\u0600-\u06FF]' OR canonical_title ~ '[\u0600-\u06FF]'
    GROUP BY status
    ORDER BY count DESC
  `);
  
  console.log(`\n\n📊 Arabic items by status:`);
  statusCounts.rows.forEach((row: any) => {
    console.log(`   ${row.status}: ${row.count}`);
  });
}

findAllArabic()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Error:", err);
    process.exit(1);
  });
