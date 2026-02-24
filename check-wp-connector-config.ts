import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  console.log('\n=== WORDPRESS CONNECTORS ===');
  const targets = await db.execute(sql`
    SELECT id, name, url, wp_site_url, wp_pull_secret 
    FROM sites 
    WHERE connection_status IS NOT NULL
  `);
  
  for (const row of targets.rows) {
    console.log(`\nConnector: ${(row as any).name}`);
    console.log(`  URL: ${(row as any).url || (row as any).wp_site_url}`);
    console.log(`  WP Pull Secret (first 8 chars): ${((row as any).wp_pull_secret || '').substring(0, 8)}...`);
  }

  process.exit(0);
})();
