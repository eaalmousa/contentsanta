import { db } from './server/db';
import { publishingTargets } from './shared/schema';
import { eq } from 'drizzle-orm';

async function checkSecret() {
  const siteId = 'cs_site_275192919E433615';
  
  const [target] = await db.select().from(publishingTargets)
    .where(eq(publishingTargets.siteId, siteId));
  
  if (!target) {
    console.log(`❌ Target not found for siteId=${siteId}`);
    return;
  }
  
  console.log("═══════════════════════════════════════════════");
  console.log("SECRET VERIFICATION:");
  console.log("═══════════════════════════════════════════════");
  console.log(`Target: ${target.name}`);
  console.log(`Site ID: ${target.siteId}`);
  console.log(`Has Secret (plaintext): ${target.secret ? 'Yes' : 'No'}`);
  console.log(`Has Secret Hash: ${target.secretHash ? 'Yes' : 'No'}`);
  
  if (target.secret) {
    console.log(`\nPlaintext Secret (for WordPress): ${target.secret}`);
    console.log(`  (Copy this EXACT value to WordPress plugin settings)`);
  } else {
    console.log('\n⚠️  No plaintext secret stored!');
    console.log('   You need to generate a new secret from the Publishing page');
  }
  
  console.log("\n═══════════════════════════════════════════════");
  console.log("WHAT TO DO:");
  console.log("═══════════════════════════════════════════════");
  console.log("1. Go to WordPress Admin → Settings → Content Santa Connector");
  console.log("2. Find the 'Secret Key' field");
  console.log("3. Paste the secret shown above (EXACT match, no spaces)");
  console.log("4. Click 'Save Changes'");
  console.log("5. Try manual pull again");
  console.log("\nIf secret is missing above:");
  console.log("1. Go to Content Santa → Publishing tab");
  console.log("2. Edit 'Gulf Estate Gazette'");
  console.log("3. Click 'Generate New Secret'");
  console.log("4. Copy the displayed secret");
  console.log("5. Paste it into WordPress plugin");
}

checkSecret().then(() => process.exit(0)).catch(console.error);
