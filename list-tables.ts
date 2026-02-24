import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  const result = await db.execute(sql`
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename
  `);
  
  console.log("All tables in public schema:");
  result.rows.forEach((r: any) => {
    console.log(`  - ${r.tablename}`);
  });
})().then(() => process.exit(0));
