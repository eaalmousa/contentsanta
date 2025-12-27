import { storage } from "./server/storage";
import { fetchRSSSource } from "./server/services/rss-service";

async function main() {
  // Get or create a test workspace
  let workspaces = await storage.getWorkspaces();
  let workspace = workspaces[0];
  if (!workspace) {
    console.log("Creating test workspace...");
    workspace = await storage.createWorkspace({
      name: "Test Workspace",
      slug: "test-workspace",
      ownerId: "test-user"
    });
  }
  console.log("Using workspace:", workspace.id);

  // Check for existing BBC source or create one
  const sources = await storage.getSources(workspace.id);
  let bbcSource = sources.find(s => s.feedUrl.includes("feeds.bbci.co.uk/news/technology"));
  
  if (!bbcSource) {
    console.log("Creating BBC Technology source...");
    bbcSource = await storage.createSource({
      workspaceId: workspace.id,
      name: "BBC Technology",
      type: "rss",
      feedUrl: "https://feeds.bbci.co.uk/news/technology/rss.xml",
      language: "en"
    });
  }
  console.log("Source ID:", bbcSource.id);

  // Run fetch #1
  console.log("\n=== FETCH RUN #1 ===");
  const result1 = await fetchRSSSource(bbcSource);
  console.log("Result 1:", JSON.stringify(result1, null, 2));

  // Run fetch #2 (should dedupe)
  console.log("\n=== FETCH RUN #2 ===");
  const result2 = await fetchRSSSource(bbcSource);
  console.log("Result 2:", JSON.stringify(result2, null, 2));

  // Get fetch runs from DB
  console.log("\n=== FETCH RUNS FROM DATABASE ===");
  const fetchRuns = await storage.getFetchRuns(bbcSource.id, 5);
  for (const run of fetchRuns) {
    console.log({
      id: run.id,
      status: run.status,
      httpStatus: run.httpStatus,
      contentType: run.contentType,
      contentEncoding: run.contentEncoding,
      bytesCompressed: run.bytesCompressed,
      bytesDecompressed: run.bytesDecompressed,
      parsedItemsCount: run.parsedItemsCount,
      insertedCount: run.insertedCount,
      dedupedCount: run.dedupedCount,
      missingGuidCount: run.missingGuidCount,
      missingLinkCount: run.missingLinkCount,
      durationMs: run.durationMs,
      createdAt: run.createdAt
    });
  }
}

main().catch(console.error);
