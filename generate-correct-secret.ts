import { db } from './server/db';
import { publishingTargets } from './shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

(async () => {
  // Generate new secret in correct format (cs_sec_XXXX)
  const rawSecret = `cs_sec_${crypto.randomBytes(32).toString('base64url')}`;
  
  // Hash with bcrypt (as the server expects)
  const hash = await bcrypt.hash(rawSecret, 10);
  
  // Update publishing_targets with proper bcrypt hash
  await db.update(publishingTargets)
    .set({ 
      secretHash: hash, 
      secretLast4: rawSecret.slice(-4),
      updatedAt: new Date() 
    })
    .where(eq(publishingTargets.siteId, 'cs_site_948CC696C5B70A71'));
  
  console.log('\n✅ NEW SECRET GENERATED WITH BCRYPT HASH');
  console.log('\n📋 WORDPRESS PLUGIN SETTINGS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Site ID:', 'cs_site_948CC696C5B70A71');
  console.log('Secret: ', rawSecret);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n⚠️  COPY THE SECRET EXACTLY (starts with cs_sec_)');
  
  process.exit(0);
})();
