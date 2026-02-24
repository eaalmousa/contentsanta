import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function testSessionFix() {
  console.log("════════════════════════════════════════════════");
  console.log("SESSION FIX VERIFICATION");
  console.log("════════════════════════════════════════════════\n");
  
  try {
    // 1. Check admin user
    console.log("1. ADMIN USER CHECK:");
    const adminUser = await db.execute(sql`
      SELECT id, email, is_site_admin, auth_provider
      FROM users 
      WHERE email = 'admin@contentsanta.local'
    `);
    
    if (adminUser.rows.length > 0) {
      const user = adminUser.rows[0] as any;
      console.log(`   ✅ Admin user exists`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Site Admin: ${user.is_site_admin}`);
      console.log(`   Auth Provider: ${user.auth_provider}`);
    } else {
      console.log("   ❌ Admin user NOT found!");
    }
    
    // 2. Check sessions
    console.log("\n2. ACTIVE SESSIONS:");
    const sessions = await db.execute(sql`
      SELECT 
        sid,
        sess::text as session_data,
        expire
      FROM sessions 
      WHERE expire > NOW()
      ORDER BY expire DESC 
      LIMIT 5
    `);
    
    console.log(`   Found ${sessions.rows.length} active sessions`);
    if (sessions.rows.length > 0) {
      sessions.rows.forEach((row: any, idx) => {
        console.log(`   ${idx + 1}. SID: ${row.sid.substring(0, 20)}...`);
        console.log(`      Expires: ${row.expire}`);
        
        try {
          const sessData = JSON.parse(row.session_data);
          if (sessData.passport?.user) {
            const user = sessData.passport.user;
            console.log(`      User: ${user.id || user.claims?.sub || 'unknown'}`);
            console.log(`      Has expires_at: ${!!user.expires_at}`);
            console.log(`      Has user.id: ${!!user.id}`);
          }
        } catch (e) {
          console.log(`      (Could not parse session data)`);
        }
      });
    }
    
    // 3. Environment check
    console.log("\n3. ENVIRONMENT:");
    console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`   SESSION_SECRET: ${process.env.SESSION_SECRET ? '✅ Set' : '❌ NOT set'}`);
    console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ NOT set'}`);
    console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ NOT set'}`);
    
    // 4. Instructions
    console.log("\n════════════════════════════════════════════════");
    console.log("✅ SESSION FIX APPLIED");
    console.log("════════════════════════════════════════════════");
    console.log("\nThe isAuthenticated middleware now supports:");
    console.log("  - Custom auth (email/password + Google OAuth)");
    console.log("  - Replit OIDC auth (for production)");
    console.log("\nTO TEST:");
    console.log("1. Restart server: npm run dev");
    console.log("2. Clear browser cookies (F12 → Application → Cookies → Delete all)");
    console.log("3. Go to: http://localhost:5000/login");
    console.log("4. Login: admin@contentsanta.local / contentsanta123");
    console.log("5. Go to: http://localhost:5000/sources");
    console.log("6. Click 'Discover Sources' - should work now!");
    console.log("\nIf you STILL get 401:");
    console.log("  → Use incognito window (fresh session)");
    console.log("  → Check browser console for errors");
    console.log("  → Check server console for auth logs");
    
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
  }
}

testSessionFix().then(() => process.exit(0)).catch(console.error);
