import { calculateTopicRelevance } from "./server/services/topic-relevance-service.js";

// Test with your exact query
const topic = {
  name: "Real Estate",
  query: "Real Estate News, Property News" // Your exact query
};

// Test against a known real estate story
const testStory = {
  title: "Deputy Prime Minister receives Committee for the Settlement of Stalled Real Estate Development Projects",
  excerpt: "Real estate development and property sector updates",
  rawContent: null
};

console.log("\n=== Testing Query Relevance ===\n");
console.log(`Topic: ${topic.name}`);
console.log(`Query: "${topic.query}"`);
console.log(`\nTest Story: ${testStory.title}\n`);

const result = calculateTopicRelevance(testStory, topic);

console.log("Relevance Result:");
console.log(`  Score: ${result.score}`);
console.log(`  Matched Terms: ${result.matchedTerms.join(", ")}`);
console.log(`  Is Relevant: ${result.isRelevant}`);
console.log(`  Reason: ${result.reason}`);
console.log(`  Negative Matches: ${result.negativeMatches.join(", ") || "none"}`);

// Test with normalized query
console.log("\n=== Testing with Normalized Query ===\n");
const normalizedQuery = "real estate property"; // After our normalization
const topic2 = {
  name: "Real Estate",
  query: normalizedQuery
};

const result2 = calculateTopicRelevance(testStory, topic2);

console.log(`Query: "${topic2.query}"`);
console.log("Relevance Result:");
console.log(`  Score: ${result2.score}`);
console.log(`  Matched Terms: ${result2.matchedTerms.join(", ")}`);
console.log(`  Is Relevant: ${result2.isRelevant}`);
console.log(`  Reason: ${result2.reason}`);
