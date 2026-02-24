/**
 * Quick database connection test
 */

import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function testConnection() {
  console.log("🔍 Testing database connection...\n");

  try {
    // Test basic query
    console.log("1️⃣ Testing basic query...");
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log("   ✅ Basic query successful:", result.rows);

    // Test workspaces table
    console.log("\n2️⃣ Testing workspaces table...");
    const workspaces = await db.execute(sql`
      SELECT id, name, slug 
      FROM workspaces 
      LIMIT 1
    `);
    console.log(`   ✅ Found ${workspaces.rows?.length || 0} workspace(s)`);
    if (workspaces.rows && workspaces.rows.length > 0) {
      console.log("   Workspace:", workspaces.rows[0]);
    }

    // Test users table
    console.log("\n3️⃣ Testing users table...");
    const users = await db.execute(sql`
      SELECT id, email 
      FROM users 
      LIMIT 1
    `);
    console.log(`   ✅ Found ${users.rows?.length || 0} user(s)`);
    if (users.rows && users.rows.length > 0) {
      console.log("   User:", users.rows[0]);
    }

    // Test sites table
    console.log("\n4️⃣ Testing sites table...");
    const sites = await db.execute(sql`
      SELECT id, name, workspace_id 
      FROM sites 
      LIMIT 1
    `);
    console.log(`   ✅ Found ${sites.rows?.length || 0} site(s)`);

    console.log("\n✅ All database tests passed!");
    console.log("\n📊 Connection Details:");
    console.log(`   Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'unknown'}`);

  } catch (error: any) {
    console.error("\n❌ Database connection failed!");
    console.error("Error:", error.message);
    console.error("\nPossible causes:");
    console.error("  - Invalid DATABASE_URL in .env");
    console.error("  - Database server is down");
    console.error("  - Network/firewall blocking connection");
    console.error("  - SSL certificate issues");
    console.error("\nCurrent DATABASE_URL format:");
    const dbUrl = process.env.DATABASE_URL || '';
    const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
    console.error(`  ${maskedUrl}`);
    throw error;
  }
}

testConnection()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
