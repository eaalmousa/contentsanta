import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkAdminStatus() {
  console.log("═══════════════════════════════════════════════");
  console.log("CHECKING ADMIN USER STATUS:");
  console.log("═══════════════════════════════════════════════\n");
  
  try {
    const result = await db.execute(sql`
      SELECT 
        id, 
        email, 
        first_name, 
        last_name,
        is_site_admin,
        auth_provider,
        created_at
      FROM users 
      WHERE email = 'admin@contentsanta.local'
    `);
    
    if (result.rows.length === 0) {
      console.log("❌ Admin user not found!");
      return;
    }
    
    const admin = result.rows[0] as any;
    
    console.log("✅ Admin User Found:");
    console.log(`   Email: ${admin.email}`);
    console.log(`   Name: ${admin.first_name} ${admin.last_name}`);
    console.log(`   User ID: ${admin.id}`);
    console.log(`   Is Site Admin: ${admin.is_site_admin}`);
    console.log(`   Auth Provider: ${admin.auth_provider}`);
    console.log(`   Created: ${admin.created_at}`);
    
    if (admin.is_site_admin === 'true') {
      console.log("\n✅ User has site admin privileges");
    } else {
      console.log("\n⚠️  User is NOT a site admin!");
      console.log("   Run: npx tsx --env-file=.env apply-admin-migration.ts");
    }
    
    console.log("\n═══════════════════════════════════════════════");
    console.log("LOGIN CREDENTIALS:");
    console.log("═══════════════════════════════════════════════");
    console.log("Email: admin@contentsanta.local");
    console.log("Password: contentsanta123");
    console.log("\nTo fix session issues:");
    console.log("1. Go to: http://localhost:5000");
    console.log("2. Click your profile/logout");
    console.log("3. Go to: http://localhost:5000/login");
    console.log("4. Login with credentials above");
    console.log("5. Go back to: http://localhost:5000/sources");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

checkAdminStatus().then(() => process.exit(0)).catch(console.error);
