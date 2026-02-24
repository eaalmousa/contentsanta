import { db } from "./server/db.js";
import { sql } from "drizzle-orm";

async function checkTopics() {
  console.log("\n=== Topic Details ===\n");

  try {
    const topicsResult = await db.execute(sql`
      SELECT 
        id,
        name,
        query,
        is_live,
        automation_mode,
        workspace_id,
        (SELECT count(*) FROM topic_stories WHERE topic_id = topics.id) as story_count
      FROM topics
      WHERE name ILIKE '%real%'
      ORDER BY created_at DESC
    `);

    if (topicsResult.rows.length === 0) {
      console.log("No topics found matching 'real'\n");
    } else {
      topicsResult.rows.forEach(row => {
        console.log(`Topic: ${row.name}`);
        console.log(`  ID: ${row.id}`);
        console.log(`  Query: "${row.query}"`);
        console.log(`  Live: ${row.is_live}`);
        console.log(`  Mode: ${row.automation_mode}`);
        console.log(`  Stories linked: ${row.story_count}`);
        console.log("");
      });
    }

    // Check topic_stories relevance scores
    const topicStoriesResult = await db.execute(sql`
      SELECT 
        ts.topic_id,
        t.name as topic_name,
        ts.relevance_score,
        ts.matched_terms,
        s.canonical_title
      FROM topic_stories ts
      JOIN topics t ON t.id = ts.topic_id
      JOIN stories s ON s.id = ts.story_id
      WHERE t.name ILIKE '%real%'
      ORDER BY ts.relevance_score DESC
      LIMIT 10
    `);

    console.log("=== Top Matched Stories ===\n");
    if (topicStoriesResult.rows.length === 0) {
      console.log("No topic_stories found\n");
    } else {
      topicStoriesResult.rows.forEach(row => {
        console.log(`Topic: ${row.topic_name}`);
        console.log(`  Score: ${row.relevance_score}`);
        console.log(`  Terms: ${row.matched_terms?.join(", ") || "none"}`);
        console.log(`  Title: ${row.canonical_title}`);
        console.log("");
      });
    }

  } catch (error) {
    console.error("Error:", error.message);
  }

  process.exit(0);
}

checkTopics();
