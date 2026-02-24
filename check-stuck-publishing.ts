import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  console.log('\n=== WP PULL JOBS STATUS ===\n');
  
  const jobs = await db.execute(sql`
    SELECT id, status, created_at, lease_token, result_wp_post_id 
    FROM wp_pull_jobs 
    ORDER BY created_at DESC 
    LIMIT 10
  `);
  
  for (const job of jobs.rows) {
    const j = job as any;
    const jobId = j.id.substring(0, 8);
    console.log(`Job ${jobId}: ${j.status}`);
    console.log(`  Created: ${new Date(j.created_at).toLocaleTimeString()}`);
    console.log(`  Leased: ${j.lease_token ? 'YES' : 'NO'}`);
    console.log(`  WP Post: ${j.result_wp_post_id || 'NULL'}`);
    console.log('');
  }
  
  console.log('\n=== PIPELINE ITEMS STATUS ===\n');
  
  const statusCounts = await db.execute(sql`
    SELECT status, COUNT(*) as count 
    FROM pipeline_items 
    GROUP BY status 
    ORDER BY count DESC
  `);
  
  for (const row of statusCounts.rows) {
    const r = row as any;
    console.log(`${r.status}: ${r.count} items`);
  }
  
  console.log('\n=== WORDPRESS CONNECTOR CONFIG ===\n');
  
  const site = await db.execute(sql`
    SELECT id, name, wp_pull_secret 
    FROM sites 
    WHERE name LIKE '%Gulf%'
  `);
  
  if (site.rows.length > 0) {
    const s = site.rows[0] as any;
    console.log(`Site: ${s.name}`);
    console.log(`ID: ${s.id}`);
    console.log(`Secret exists: ${!!s.wp_pull_secret}`);
    if (s.wp_pull_secret) {
      console.log(`Secret (first 8): ${s.wp_pull_secret.substring(0, 8)}...`);
    }
  }
  
  console.log('\n=== PUBLISHING TARGET CONFIG ===\n');
  
  const target = await db.execute(sql`
    SELECT site_id, secret_hash, is_active, default_category_id
    FROM publishing_targets
    WHERE name LIKE '%Gulf%'
  `);
  
  if (target.rows.length > 0) {
    const t = target.rows[0] as any;
    console.log(`Site ID: ${t.site_id}`);
    console.log(`Secret hash exists: ${!!t.secret_hash}`);
    console.log(`Is active: ${t.is_active}`);
    console.log(`Default category: ${t.default_category_id}`);
  }
  
  process.exit(0);
})();
