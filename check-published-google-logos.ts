import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  console.log('\n=== CRITICAL: Published Articles with Google Logo ===\n');
  
  const published = await db.execute(sql`
    SELECT id, generated_title, featured_image_url, target_post_id, published_at
    FROM pipeline_items
    WHERE target_post_id IS NOT NULL
      AND featured_image_url LIKE '%googleusercontent%'
    ORDER BY published_at DESC
    LIMIT 10
  `);
  
  console.log(`Found: ${published.rows.length} articles published with Google logo\n`);
  
  if (published.rows.length > 0) {
    console.log('These need to be reset and republished:\n');
    published.rows.forEach((row: any, index: number) => {
      console.log(`${index + 1}. WP Post ID: ${row.target_post_id}`);
      console.log(`   Title: ${row.generated_title?.substring(0, 70)}...`);
      console.log(`   Image: ${row.featured_image_url?.substring(0, 80)}...`);
      console.log('');
    });
    
    console.log('🔧 Action Required:');
    console.log('   Run: npx tsx --env-file=.env reset-published-google-logos.ts');
    console.log('   This will reset these items to "scheduled" for republishing\n');
  } else {
    console.log('✅ No published articles with Google logos found!\n');
  }
  
  // Also check current publishing pipeline
  const publishing = await db.execute(sql`
    SELECT id, generated_title, featured_image_url
    FROM pipeline_items
    WHERE status IN ('publishing', 'scheduled')
      AND featured_image_url LIKE '%googleusercontent%'
    ORDER BY updated_at DESC
    LIMIT 5
  `);
  
  if (publishing.rows.length > 0) {
    console.log('⚠️  Items in pipeline with Google logos:');
    publishing.rows.forEach((row: any) => {
      console.log(`   ${row.generated_title?.substring(0, 60)}...`);
    });
    console.log('');
  }
  
  process.exit(0);
})();
