# Critical Issues Fixed - Duplicates, Content Filtering, Relevance

**Date**: 2026-02-16  
**Status**: 🚨 CRITICAL FIXES IN PROGRESS

---

## Issue 1: DUPLICATE PUBLISHING ❌

### Root Cause
Publishing worker creates multiple WP pull jobs for the same `pipeline_item_id`.

**Evidence**:
```
Pipeline Item: 84ccfd27... → 2 WP jobs ❌
Pipeline Item: a362957d... → 2 WP jobs ❌  
Pipeline Item: de7e4b62... → 2 WP jobs ❌
```

WordPress plugin pulls ALL jobs → Article published multiple times!

### Fix Required
**1. Add idempotency check** before creating WP job:
```typescript
// Check if job already exists for this pipeline item
const existingJob = await db.query.wpPullJobs.findFirst({
  where: and(
    eq(wpPullJobs.pipelineItemId, pipelineItemId),
    or(
      eq(wpPullJobs.status, 'queued'),
      eq(wpPullJobs.status, 'leased'),
      eq(wpPullJobs.status, 'published')
    )
  )
});

if (existingJob) {
  console.log(`Job already exists for item ${pipelineItemId}, skipping`);
  return existingJob;
}
```

**2. Add database constraint**:
```sql
CREATE UNIQUE INDEX idx_wp_pull_jobs_item_active
ON wp_pull_jobs(pipeline_item_id)
WHERE status IN ('queued', 'leased', 'published');
```

This prevents duplicate jobs at database level.

---

## Issue 2: CONTENT FILTERING (Sex/Politics) ❌

### Requirement
System must NEVER publish articles about:
- Sex / Sexual content
- Politics / Political content

### Fix Required
Add content filter in preflight service:

```typescript
async function filterRestrictedContent(title: string, body: string): Promise<{
  isRestricted: boolean;
  reason: string;
}> {
  const restrictedKeywords = [
    // Sex-related
    'sex', 'sexual', 'porn', 'adult content', 'explicit',
    // Politics-related  
    'politics', 'political', 'election', 'government policy',
    'minister', 'parliament', 'senate', 'congress', 'president',
    'prime minister', 'opposition party'
  ];

  const textLower = `${title} ${body}`.toLowerCase();
  
  for (const keyword of restrictedKeywords) {
    if (textLower.includes(keyword)) {
      return {
        isRestricted: true,
        reason: `Restricted content: contains '${keyword}'`
      };
    }
  }

  // AI-powered classification for edge cases
  const aiCheck = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{
      role: "system",
      content: "Classify if this content is about sex or politics. Reply only: YES or NO"
    }, {
      role: "user",
      content: `Title: ${title}\n\nFirst 500 chars: ${body.substring(0, 500)}`
    }],
    max_tokens: 5
  });

  if (aiCheck.choices[0]?.message?.content?.toUpperCase() === 'YES') {
    return {
      isRestricted: true,
      reason: 'Restricted content: AI detected sex/politics topic'
    };
  }

  return { isRestricted: false, reason: '' };
}
```

Apply filter in `publishing-preflight.ts` **before** any processing:
```typescript
// Step 1: Filter restricted content
const restrictedCheck = await filterRestrictedContent(
  item.generatedTitle || story.canonicalTitle,
  item.generatedBody || ''
);

if (restrictedCheck.isRestricted) {
  await storage.updatePipelineItem(pipelineItemId, {
    status: 'quarantined',
    quarantineReason: 'restricted_content',
    lastErrorMessage: restrictedCheck.reason,
  });

  return {
    success: false,
    quarantineReason: 'restricted_content',
    quarantineMessage: restrictedCheck.reason,
  };
}
```

---

## Issue 3: TOPIC RELEVANCE MATCHING ❌

### Requirement
System should find STRICTLY relevant items matching user's topic query.

### Current Problem
Matching is too broad - not strictly filtering by user's intent.

### Fix Required
**1. Add strict relevance threshold**:
```typescript
// In pipeline-jobs-service.ts or matching service
const STRICT_RELEVANCE_THRESHOLD = 0.50; // Increase from 0.20

if (score < STRICT_RELEVANCE_THRESHOLD) {
  await storage.updatePipelineItem(item.id, {
    status: 'skipped',
    skipReason: 'LOW_RELEVANCE',
    lastErrorMessage: `Score ${score.toFixed(2)} below threshold ${STRICT_RELEVANCE_THRESHOLD}`
  });
  continue;
}
```

**2. Enhance matching prompt** to be more strict:
```typescript
const matchingPrompt = `
You are a strict content matcher. Rate relevance 0-1.

Topic: "${topic.name}"
Description: "${topic.description}"
Query: "${topic.query}"

Article: "${item.title}"
Excerpt: "${item.excerpt?.substring(0, 200)}"

STRICT RULES:
- Must directly relate to topic query
- Generic news NOT relevant unless explicitly in query
- Score < 0.5 means NOT relevant

Reply with just a number 0-1.
`;
```

**3. Add query keyword enforcement**:
```typescript
// Extract key terms from topic query
const queryTerms = extractKeyTerms(topic.query);

// Check if article contains at least 2 query terms
const articleText = `${item.title} ${item.excerpt}`.toLowerCase();
const matchedTerms = queryTerms.filter(term => 
  articleText.includes(term.toLowerCase())
).length;

if (matchedTerms < 2) {
  // Skip - not enough query term matches
  skipReason = 'INSUFFICIENT_QUERY_MATCH';
}
```

---

## Implementation Plan

### Phase 1: Stop Duplicates (URGENT)
1. Add idempotency check to publishing worker
2. Add database constraint
3. Clean up existing duplicate jobs

### Phase 2: Content Filtering
1. Create content filter service
2. Integrate into preflight
3. Add quarantine reason: `restricted_content`

### Phase 3: Relevance Matching
1. Increase relevance threshold
2. Enhance matching prompt
3. Add query term enforcement

---

## Files to Modify

1. **`server/services/publishing-worker-service.ts`** - Add idempotency check
2. **`server/services/content-filter-service.ts`** (NEW) - Sex/politics filter
3. **`server/services/publishing-preflight.ts`** - Apply content filter
4. **`server/services/pipeline-jobs-service.ts`** - Strict relevance matching
5. **Migration script** - Add unique constraint, clean duplicates

---

## Next Steps

Creating fixes now...
