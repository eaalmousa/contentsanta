import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  const result = await db.execute(sql`
    SELECT id, name, wp_pull_secret, wp_site_url, connection_status 
    FROM sites 
    WHERE name = 'Gulf Estate Gazette'
  `);
  
  console.log('\n=== Gulf Estate Gazette Configuration ===');
  if (result.rows.length === 0) {
    console.log('ERROR: Site not found!');
    process.exit(1);
  }
  
  const site = result.rows[0] as any;
  console.log(`\nSite ID: ${site.id}`);
  console.log(`Name: ${site.name}`);
  console.log(`WP Site URL: ${site.wp_site_url}`);
  console.log(`Connection Status: ${site.connection_status}`);
  console.log(`\nWP Pull Secret: ${site.wp_pull_secret ? `"${site.wp_pull_secret.substring(0, 8)}...${site.wp_pull_secret.substring(site.wp_pull_secret.length - 4)}" (length: ${site.wp_pull_secret.length})` : 'NULL/EMPTY!'}`);
  
  if (!site.wp_pull_secret) {
    console.log('\n🔴 PROBLEM: wp_pull_secret is NULL! WordPress plugin cannot authenticate.');
    console.log('\nFIX: Generate a new secret using UI or run:');
    console.log(`  npx tsx --env-file=.env -e "import { db } from './server/db'; import crypto from 'crypto'; import { sql } from 'drizzle-orm'; (async () => { const secret = crypto.randomBytes(32).toString('hex'); await db.execute(sql\\`UPDATE sites SET wp_pull_secret = \\${secret} WHERE id = '${site.id}'\\`); console.log('New secret:', secret); process.exit(0); })()"`);
  } else {
    console.log('\n✅ Secret exists. Plugin should be configured with this secret.');
  }
  
  process.exit(0);
})();
