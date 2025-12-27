import { testRSSFeed } from "./server/services/rss-service";

async function main() {
  console.log("=== Testing BBC Technology RSS Feed ===");
  const result = await testRSSFeed("https://feeds.bbci.co.uk/news/technology/rss.xml");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
