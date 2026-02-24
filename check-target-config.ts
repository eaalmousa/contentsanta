import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkTargetConfig() {
  console.log('🔍 Checking publishing target configuration...\n');

  const target = await db.execute(sql`
    SELECT 
      id,
      name,
      type,
      site_id,
      config_json
    FROM publishing_targets
    WHERE id = 'a51100b5-5be2-4906-877d-d3d3df4b3bca'
  `);

  if (target.rows.length === 0) {
    console.log('❌ Target not found!');
    process.exit(1);
  }

  const t = target.rows[0] as any;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Target Name:', t.name);
  console.log('Type:', t.type);
  console.log('Site ID:', t.site_id);
  console.log('\nFull Config:');
  console.log(JSON.stringify(t.config_json, null, 2));
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  console.log('\n📋 Key Settings:');
  console.log(`  Site URL: ${t.config_json?.siteUrl || 'MISSING ❌'}`);
  console.log(`  Username: ${t.config_json?.username || 'MISSING ❌'}`);
  console.log(`  App Password: ${t.config_json?.applicationPassword ? '***SET***' : 'MISSING ❌'}`);
  console.log(`  Default Category ID: ${t.config_json?.default_category_id || 'MISSING ❌'}`);
  console.log(`  Category Confirmed: ${t.config_json?.default_category_id_confirmed ? 'YES ✅' : 'NO ❌'}`);

  console.log('\n🚨 IMPORTANT:');
  console.log('WordPress plugin uses REST API credentials from this config.');
  console.log('If category ID = 1, check that category exists in WordPress!\n');

  process.exit(0);
}

checkTargetConfig().catch((err) => {
  console.error('❌ Check failed:', err);
  process.exit(1);
});
