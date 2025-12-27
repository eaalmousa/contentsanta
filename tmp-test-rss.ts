import { db } from "./server/db";
import { sources } from "./shared/schema";
import { eq } from "drizzle-orm";
import { fetchRSSSource } from "./server/services/rss-service";

async function main() {
  console.log("=== RSS FETCH TEST ===\n");
  
  const [source] = await db.select().from(sources).where(eq(sources.id, "test-source-bbc"));
  if (!source) {
    console.log("Source not found!");
    process.exit(1);
  }
  
  console.log("Source found:", source.name);
  console.log("Feed URL:", source.feedUrl);
  console.log("\nRunning first fetch...\n");
  
  const result1 = await fetchRSSSource(source);
  console.log("\n=== FIRST FETCH RESULT ===");
  console.log(JSON.stringify(result1, null, 2));
  
  console.log("\nRunning second fetch (should dedupe)...\n");
  
  const result2 = await fetchRSSSource(source);
  console.log("\n=== SECOND FETCH RESULT ===");
  console.log(JSON.stringify(result2, null, 2));
  
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
