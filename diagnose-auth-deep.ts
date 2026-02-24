import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function diagnoseAuthIssues() {
  console.log("═══════════════════════════════════════════════");
  console.log("DEEP AUTH & SESSION DIAGNOSTICS");
  console.log("═══════════════════════════════════════════════\n");
  
  try {
    // 1. Check if SESSION_SECRET is set
    console.log("1. SESSION SECRET:");
    if (process.env.SESSION_SECRET) {
      console.log(`   ✅ SESSION_SECRET is set (length: ${process.env.SESSION_SECRET.length})`);
    } else {
      console.log("   ❌ SESSION_SECRET is NOT set!");
      console.log("   FIX: Add SESSION_SECRET to .env file");
    }
    
    // 2. Check if sessions table exists
    console.log("\n2. SESSIONS TABLE:");
    try {
      const sessionsCheck = await db.execute(sql`
        SELECT COUNT(*) as count FROM sessions
      `);
      const sessionCount = (sessionsCheck.rows[0] as any).count;
      console.log(`   ✅ Sessions table exists`);
      console.log(`   Found ${sessionCount} active sessions`);
      
      // Show recent sessions
      const recentSessions = await db.execute(sql`
        SELECT 
          sid, 
          sess::text as session_data,
          expire
        FROM sessions 
        ORDER BY expire DESC 
        LIMIT 5
      `);
      
      if (recentSessions.rows.length > 0) {
        console.log("\n   Recent sessions:");
        recentSessions.rows.forEach((row: any, idx) => {
          const isExpired = new Date(row.expire) < new Date();
          console.log(`   ${idx + 1}. SID: ${row.sid.substring(0, 20)}...`);
          console.log(`      Expires: ${row.expire} ${isExpired ? '(EXPIRED)' : '(active)'}`);
        });
      }
    } catch (error) {
      console.log("   ❌ Sessions table does NOT exist!");
      console.log("   FIX: Run migration to create sessions table");
    }
    
    // 3. Check admin user
    console.log("\n3. ADMIN USER:");
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
    
    // 4. Check environment variables
    console.log("\n4. ENVIRONMENT:");
    console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'Set ✅' : 'NOT set ❌'}`);
    console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'Set ✅' : 'NOT set ❌'}`);
    
    // 5. Recommendations
    console.log("\n═══════════════════════════════════════════════");
    console.log("RECOMMENDATIONS:");
    console.log("═══════════════════════════════════════════════");
    
    if (!process.env.SESSION_SECRET) {
      console.log("\n⚠️  CRITICAL: SESSION_SECRET missing!");
      console.log("   Add to .env: SESSION_SECRET=your-random-secret-here");
      console.log("   Generate: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"");
    }
    
    console.log("\n✅ TO FIX SESSION ISSUES:");
    console.log("1. Clear all browser cookies:");
    console.log("   - Press F12 → Application → Cookies → Delete all");
    console.log("2. Or use incognito/private window");
    console.log("3. Go to: http://localhost:5000/login");
    console.log("4. Login: admin@contentsanta.local / contentsanta123");
    console.log("5. Check browser DevTools Console for errors");
    
  } catch (error: any) {
    console.error("\n❌ Diagnostic error:", error.message);
  }
}

diagnoseAuthIssues().then(() => process.exit(0)).catch(console.error);
