import { storage } from "./server/storage";
import { testRSSFeed } from "./server/services/rss-service";

async function main() {
  console.log("=== 4A) Non-RSS URL (HTML page) ===");
  const htmlResult = await testRSSFeed("https://www.bbc.co.uk/news/technology");
  console.log(JSON.stringify(htmlResult, null, 2));

  console.log("\n=== 4B) 403 Forbidden test ===");
  const forbidden = await testRSSFeed("https://httpstat.us/403");
  console.log(JSON.stringify(forbidden, null, 2));

  console.log("\n=== 4C) 404 Not Found test ===");
  const notFound = await testRSSFeed("https://httpstat.us/404");
  console.log(JSON.stringify(notFound, null, 2));

  console.log("\n=== 4D) 429 Rate Limit test ===");
  const rateLimited = await testRSSFeed("https://httpstat.us/429");
  console.log(JSON.stringify(rateLimited, null, 2));

  console.log("\n=== 4E) 500 Server Error test ===");
  const serverError = await testRSSFeed("https://httpstat.us/500");
  console.log(JSON.stringify(serverError, null, 2));

  console.log("\n=== 4F) DNS failure test ===");
  const dnsFailure = await testRSSFeed("https://this-domain-does-not-exist-12345.com/feed.xml");
  console.log(JSON.stringify(dnsFailure, null, 2));
}

main().catch(console.error);
