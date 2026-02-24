import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function applyAdminMigration() {
  console.log("═══════════════════════════════════════════════");
  console.log("APPLYING ADMIN SYSTEM MIGRATION");
  console.log("═══════════════════════════════════════════════\n");
  
  try {
    // 1. Add isSiteAdmin column to users table
    console.log("1. Adding isSiteAdmin column to users table...");
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_site_admin VARCHAR DEFAULT 'false'
    `);
    console.log("   ✅ isSiteAdmin column added\n");
    
    // 2. Add source approval columns
    console.log("2. Adding source approval columns...");
    await db.execute(sql`
      ALTER TABLE sources 
      ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved'
    `);
    await db.execute(sql`
      ALTER TABLE sources 
      ADD COLUMN IF NOT EXISTS approved_by VARCHAR(36)
    `);
    await db.execute(sql`
      ALTER TABLE sources 
      ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP
    `);
    await db.execute(sql`
      ALTER TABLE sources 
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT
    `);
    console.log("   ✅ Source approval columns added\n");
    
    // 3. Add index for approval status
    console.log("3. Adding approval status index...");
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_sources_approval 
      ON sources(approval_status)
    `);
    console.log("   ✅ Approval index created\n");
    
    // 4. Make admin@contentsanta.local a site admin
    console.log("4. Setting admin@contentsanta.local as site admin...");
    await db.execute(sql`
      UPDATE users 
      SET is_site_admin = 'true' 
      WHERE email = 'admin@contentsanta.local'
    `);
    console.log("   ✅ Admin user promoted to site admin\n");
    
    // 5. Set all existing sources to approved
    console.log("5. Approving all existing sources...");
    await db.execute(sql`
      UPDATE sources 
      SET approval_status = 'approved',
          approved_at = NOW()
      WHERE approval_status IS NULL OR approval_status = ''
    `);
    console.log("   ✅ Existing sources approved\n");
    
    console.log("═══════════════════════════════════════════════");
    console.log("✅ MIGRATION COMPLETE!");
    console.log("═══════════════════════════════════════════════");
    console.log("\nAdmin system features enabled:");
    console.log("  ✓ Site admin role created");
    console.log("  ✓ Source approval system activated");
    console.log("  ✓ admin@contentsanta.local is now site admin");
    console.log("\nNext:");
    console.log("  1. Refresh your browser");
    console.log("  2. Sources tab will appear for admins");
    console.log("  3. Admin can search & approve new sources");
    
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    throw error;
  }
}

applyAdminMigration().then(() => process.exit(0)).catch(console.error);
