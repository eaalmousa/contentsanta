import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  console.log('\n=== Recently Published Articles with Google Logo ===\n');
  
  const items = await db.execute(sql`
    SELECT id, generated_title, featured_image_url, published_at, updated_at
    FROM pipeline_items 
    WHERE status = 'published'
      AND featured_image_url LIKE '%googleusercontent%'
    ORDER BY published_at DESC 
    LIMIT 5
  `);
  
  if (items.rows.length === 0) {
    console.log('✅ No articles with Google logo found!');
  } else {
    console.log(`❌ Found ${items.rows.length} articles with Google logo:\n`);
    for (const item of items.rows) {
      const i = item as any;
      console.log(`Title: ${i.generated_title?.substring(0, 70)}`);
      console.log(`Published: ${new Date(i.published_at).toLocaleString()}`);
      console.log(`Image: ${i.featured_image_url?.substring(0, 80)}...`);
      console.log('');
    }
  }
  
  console.log('\n=== Check if Image Resolution is Working ===\n');
  
  // Check server logs for image resolution
  const recentItems = await db.execute(sql`
    SELECT generated_title, featured_image_url, created_at
    FROM pipeline_items
    WHERE created_at > NOW() - INTERVAL '1 hour'
      AND featured_image_url IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 3
  `);
  
  console.log('Recent items (last hour):\n');
  for (const item of recentItems.rows) {
    const i = item as any;
    const isGoogle = i.featured_image_url?.includes('googleusercontent');
    console.log(`${isGoogle ? '❌' : '✅'} ${i.generated_title?.substring(0, 60)}`);
    console.log(`   ${i.featured_image_url?.substring(0, 80)}`);
    console.log('');
  }
  
  process.exit(0);
})();
