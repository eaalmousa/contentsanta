import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  console.log('\n=== Gulf Estate Gazette WordPress Categories (Synced) ===\n');
  
  const cats = await db.execute(sql`
    SELECT id, name, wordpress_id 
    FROM wordpress_categories 
    WHERE site_id IN (SELECT id FROM sites WHERE name LIKE '%Gulf%') 
    ORDER BY name
  `);
  
  if (cats.rows.length === 0) {
    console.log('❌ NO CATEGORIES SYNCED FROM WORDPRESS!');
    console.log('\nThis is the problem! AI has no categories to choose from.');
    console.log('\nFIX: Sync categories from WordPress using the "Sync" button in Publishing page.');
  } else {
    console.log(`Found ${cats.rows.length} synced categories:\n`);
    for (const cat of cats.rows) {
      const c = cat as any;
      console.log(`  [WP ID: ${c.wordpress_id}] ${c.name}`);
    }
  }
  
  console.log('\n=== Recent Generated Categories in Pipeline ===\n');
  
  const items = await db.execute(sql`
    SELECT generated_category, generated_title 
    FROM pipeline_items 
    WHERE generated_category IS NOT NULL 
    ORDER BY created_at DESC 
    LIMIT 5
  `);
  
  for (const item of items.rows) {
    const it = item as any;
    console.log(`Title: ${it.generated_title?.substring(0, 60)}`);
    console.log(`Category: ${it.generated_category}`);
    console.log('');
  }
  
  process.exit(0);
})();
