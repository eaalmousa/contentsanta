import { db } from './server/db';
import { 
  publishingTargets, 
  topics, 
  pipelineItems, 
  wpPullJobs,
  topicSources,
  topicStories,
  wpPluginRequestLogs
} from './shared/schema';

async function cleanSlate() {
  console.log("═══════════════════════════════════════════════");
  console.log("🧹 CLEANING SLATE - DELETING ALL DATA");
  console.log("═══════════════════════════════════════════════\n");
  
  try {
    // Delete plugin logs
    console.log("Deleting plugin logs...");
    await db.delete(wpPluginRequestLogs);
    console.log("  ✅ Plugin logs deleted");
    
    // Delete pipeline items
    console.log("\nDeleting pipeline items...");
    await db.delete(pipelineItems);
    console.log("  ✅ Pipeline items deleted");
    
    // Delete WP pull jobs
    console.log("\nDeleting WordPress pull jobs...");
    await db.delete(wpPullJobs);
    console.log("  ✅ WP pull jobs deleted");
    
    // Delete topic stories and sources
    console.log("\nDeleting topic stories and sources...");
    await db.delete(topicStories);
    console.log("  ✅ Topic stories deleted");
    await db.delete(topicSources);
    console.log("  ✅ Topic sources deleted");
    
    // Delete topics
    console.log("\nDeleting topics...");
    await db.delete(topics);
    console.log(`  ✅ All topics deleted`);
    
    // Delete publishing targets
    console.log("\nDeleting publishing targets...");
    await db.delete(publishingTargets);
    console.log(`  ✅ All publishing targets deleted`);
    
    console.log("\n═══════════════════════════════════════════════");
    console.log("✅ CLEAN SLATE COMPLETE!");
    console.log("═══════════════════════════════════════════════");
    console.log("\nNow you can:");
    console.log("1. Refresh your browser (F5)");
    console.log("2. Go to Publishing tab → Click 'Add Target'");
    console.log("3. Add Gulf Estate Gazette with WordPress URL");
    console.log("4. Generate a NEW secret key");
    console.log("5. Update WordPress plugin with the new secret");
    console.log("6. Go to Topics tab → Create your topics");
    console.log("\nEverything will be fresh and connected to admin@contentsanta.local");
    
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    throw error;
  }
}

cleanSlate().then(() => process.exit(0)).catch(console.error);
