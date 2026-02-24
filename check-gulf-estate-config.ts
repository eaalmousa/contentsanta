import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  console.log('\n=== Gulf Estate Gazette Configuration ===');
  
  const sites = await db.execute(sql`
    SELECT id, name, url, wp_pull_secret 
    FROM sites 
    WHERE name LIKE '%Gulf%'
  `);
  
  for (const site of sites.rows) {
    const s = site as any;
    console.log('\n📍 Site Record:');
    console.log('  UUID:', s.id);
    console.log('  Name:', s.name);
    console.log('  URL:', s.url);
    console.log('  Has Secret:', !!s.wp_pull_secret);
    if (s.wp_pull_secret) {
      console.log('  Secret:', s.wp_pull_secret);
    }
  }
  
  // Check publishing_targets table
  const targets = await db.execute(sql`
    SELECT id, name, site_id, secret_hash, is_active
    FROM publishing_targets
    WHERE name LIKE '%Gulf%'
  `);
  
  if (targets.rows.length > 0) {
    console.log('\n📍 Publishing Target Record:');
    for (const target of targets.rows) {
      const t = target as any;
      console.log('\n  Target ID:', t.id);
      console.log('  Name:', t.name);
      console.log('  Site ID (for plugin):', t.site_id);
      console.log('  Has Secret Hash:', !!t.secret_hash);
      console.log('  Is Active:', t.is_active);
    }
  }

  process.exit(0);
})();
