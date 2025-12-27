import { storage } from "./server/storage";
import { fetchRSSSource } from "./server/services/rss-service";

async function main() {
  const workspaces = await storage.getWorkspaces();
  const workspace = workspaces[0];
  console.log("Workspace:", workspace.id);

  // Create a SECOND source pointing to the SAME BBC feed
  console.log("\n=== Creating SECOND source for SAME feed ===");
  let secondSource;
  try {
    secondSource = await storage.createSource({
      workspaceId: workspace.id,
      name: "BBC Technology (Duplicate)",
      type: "rss",
      feedUrl: "https://feeds.bbci.co.uk/news/technology/rss.xml",
      language: "en"
    });
    console.log("Second Source ID:", secondSource.id);
  } catch (e: any) {
    console.log("Error creating source:", e.message);
    const sources = await storage.getSources(workspace.id);
    secondSource = sources.find(s => s.name === "BBC Technology (Duplicate)");
    if (!secondSource) throw e;
    console.log("Using existing second source:", secondSource.id);
  }

  // Fetch from second source - should dedupe against first source's items
  console.log("\n=== FETCH FROM SECOND SOURCE (same feed, same workspace) ===");
  const result = await fetchRSSSource(secondSource);
  console.log("Result:", JSON.stringify(result, null, 2));

  // Get fetch runs
  const fetchRuns = await storage.getFetchRuns(secondSource.id, 2);
  console.log("\n=== FETCH RUNS FOR SECOND SOURCE ===");
  for (const run of fetchRuns) {
    console.log({
      sourceId: run.sourceId,
      status: run.status,
      insertedCount: run.insertedCount,
      dedupedCount: run.dedupedCount
    });
  }

  console.log("\n=== DEDUPE POLICY CONCLUSION ===");
  console.log("Unique constraint: UNIQUE(workspace_id, content_hash)");
  console.log("This means dedupe is CROSS-SOURCE within the same workspace.");
  console.log("Same content appearing in multiple feeds = stored once.");
}

main().catch(console.error);
