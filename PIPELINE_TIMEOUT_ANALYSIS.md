# Pipeline Timeout - Root Cause Analysis

## Problem
"Run Now" button times out after 60+ seconds with 0 articles generated.

## Root Causes Found

### 1. ✅ FIXED: Query Normalization
- **Issue**: Query `"Real Estate News, Property News"` contained quotes and commas
- **Fix**: Added `normalizeTopicQuery()` function to strip quotes, replace commas with spaces
- **Status**: Working - logs show "Normalized query: real estate news property news"

### 2. ✅ FIXED: RSS Fetching All Sources
- **Issue**: Pipeline fetched all 53 sources synchronously (2-5 minutes)
- **Fix**: Only fetch sources not fetched in last 10 minutes, limit to 10 sources max
- **Status**: Working - logs show "All sources recently fetched, skipping RSS fetch"

### 3. ✅ FIXED: Story Clustering Blocking
- **Issue**: `processNewItemsForClustering()` processed thousands of items, taking 2+ minutes
- **Fix**: Made clustering fire-and-forget (non-blocking)
- **Status**: Working - clustering no longer blocks

### 4. ❌ CURRENT BOTTLENECK: Story Scoring Loop
- **Issue**: Topic discovery loops through ALL 500 stories from enabled sources
- **Location**: `server/services/topic-run-service.ts` lines 115-145
- **Why Slow**: For each of 500 stories, it:
  1. Scores relevance against topic query
  2. Gets all linked source_items for the story
  3. Checks each source_item to see if it's from a tier-1 source
  4. Calculates adjusted score
  5. Inserts into topic_stories table
- **Time**: ~0.2-0.5 seconds per story × 500 = 100-250 seconds!

## Logs Confirming Issue

```
[TopicRun:1474ff51] Found 500 stories from enabled sources
<< HANGS HERE FOR 2+ MINUTES >>
```

The pipeline gets stuck processing 500 stories one by one.

## Recommended Fix

**Option A: Limit Stories Processed** (Quickest)
```typescript
// Only process recent stories (last 24 hours)
const recentThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
const recentStories = sourceStories.filter(s => 
  s.createdAt && new Date(s.createdAt) > recentThreshold
);
console.log(`[TopicRun] Processing ${recentStories.length}/${sourceStories.length} recent stories`);

for (const story of recentStories.slice(0, 100)) { // Max 100 stories
  // ... scoring logic
}
```

**Option B: Optimize Tier-1 Source Lookup** (Better Performance)
```typescript
// Pre-build a map of story_id → has_tier1_source
const storyTierMap = new Map<string, boolean>();

// Get all story_items in ONE query instead of N queries
const allStoryItems = await storage.getStoryItemsBatch(sourceStories.map(s => s.id));

// Build lookup
for (const item of allStoryItems) {
  const sourceInfo = sourceLookup.get(item.sourceId);
  if (sourceInfo && (sourceInfo.tier === 1 || sourceInfo.isOfficial === "true")) {
    storyTierMap.set(item.storyId, true);
  }
}

// Now scoring is fast - just lookup in the map
for (const story of sourceStories) {
  const hasTier1Source = storyTierMap.get(story.id) || false;
  // ... fast scoring
}
```

**Option C: Make Topic Discovery Async** (Best UX)
```typescript
// In pipeline-jobs-service.ts
// Don't await topic discovery - let it run in background
runTopicDiscovery(topic)
  .then(() => console.log(`[Pipeline] Topic discovery completed for ${topic.id}`))
  .catch(error => console.error(`[Pipeline] Topic discovery failed:`, error));

// Continue with pipeline jobs immediately
results.fetch = await runFetchJob(topic); // Uses existing topic_stories
```

## Immediate Workaround

Since all the code fixes are in place but the story scoring is still too slow:

1. **Use the cron jobs** instead of "Run Now"
   - Wait 20 minutes for topic discovery cron
   - Wait 10 minutes for pipeline automation cron

2. **Or manually trigger pipeline after topic discovery completes**
   - Check database: `SELECT COUNT(*) FROM topic_stories WHERE topic_id = '05f340fc...'`
   - Once > 0, click "Run Now" (will skip discovery, just run pipeline jobs)

3. **Or test with the OTHER Real Estate topic**
   - Topic `ca754b52-...` already has 3 stories linked
   - Click "Run Now" on that one - should work immediately

## Files Modified (All Good)
✅ `server/services/topic-run-service.ts` - Query normalization
✅ `server/services/pipeline-jobs-service.ts` - RSS fetch optimization, non-blocking clustering
✅ `shared/schema.ts` - Unique constraint on topic names
✅ `client/src/pages/pipeline.tsx` - Better empty state UI

## Next Step
Implement Option A (limit to 100 recent stories) to make "Run Now" complete in <10 seconds.
