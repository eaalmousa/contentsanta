#!/usr/bin/env tsx
import { db } from "./server/db";
import { sql } from "drizzle-orm";

/**
 * Clean up duplicate wp_pull_jobs
 * Remove 'queued' jobs that already have a 'published' job with same story_hash
 */

async function cleanupDuplicateJobs() {
  console.log("🧹 Cleaning up duplicate wp_pull_jobs...\n");

  // Find story_hashes with multiple jobs
  const duplicates = await db.execute(
    sql`SELECT story_hash, COUNT(*) as count
        FROM wp_pull_jobs
        WHERE story_hash IS NOT NULL
        GROUP BY story_hash
        HAVING COUNT(*) > 1`
  );

  if (duplicates.rows.length === 0) {
    console.log("✅ No duplicate jobs found!");
    return;
  }

  console.log(`Found ${duplicates.rows.length} story_hashes with duplicates\n`);

  let deletedCount = 0;

  for (const row of duplicates.rows) {
    const data = row as any;
    const storyHash = data.story_hash;
    
    console.log(`Processing story_hash: ${storyHash.substring(0, 40)}...`);
    
    // Get all jobs for this story_hash
    const jobs = await db.execute(
      sql`SELECT id, status, result_wp_post_id, created_at
          FROM wp_pull_jobs
          WHERE story_hash = ${storyHash}
          ORDER BY created_at ASC`
    );

    const jobsList = jobs.rows as any[];
    
    // Find if there's a published job
    const publishedJob = jobsList.find(j => j.status === 'published' && j.result_wp_post_id);
    
    if (!publishedJob) {
      console.log(`  ⚠️  No published job found, skipping...`);
      console.log("");
      continue;
    }
    
    console.log(`  ✅ Found published job (WP Post ID: ${publishedJob.result_wp_post_id})`);
    
    // Delete all other jobs (queued, leased, processing)
    const jobsToDelete = jobsList.filter(j => 
      j.id !== publishedJob.id && 
      ['queued', 'leased', 'processing'].includes(j.status)
    );
    
    if (jobsToDelete.length > 0) {
      console.log(`  🗑️  Deleting ${jobsToDelete.length} duplicate job(s)...`);
      
      for (const job of jobsToDelete) {
        await db.execute(
          sql`DELETE FROM wp_pull_jobs WHERE id = ${job.id}`
        );
        deletedCount++;
        console.log(`     Deleted job ${job.id} (status: ${job.status})`);
      }
    }
    
    console.log("");
  }

  console.log("\n" + "=".repeat(60));
  console.log(`✅ Cleanup complete! Deleted ${deletedCount} duplicate jobs`);
  console.log("=".repeat(60) + "\n");
}

cleanupDuplicateJobs()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
