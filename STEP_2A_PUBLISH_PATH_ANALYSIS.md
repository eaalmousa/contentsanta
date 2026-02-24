# Step 2A: WordPress Publishing Path Analysis

**Status:** ✅ COMPLETE  
**Date:** 2026-01-28

---

## Summary

Gulf Estate Gazette uses the **WordPress Pull plugin path** exclusively. No refactoring needed for automation-service.ts bypass because it's not used by this target.

---

## Three Publishing Paths Identified

### Path 1: Pipeline Jobs Service → Enhanced Publisher (DIRECT PUSH)
**File:** `server/services/pipeline-jobs-service.ts`  
**Line:** 874  
**Code:**
```typescript
const publishResult = await enhancedPublisher.publishPipelineItem(item.id, target.id);
```

**How it works:**
- Triggered by scheduled pipeline jobs
- Calls `enhanced-publisher.ts` directly
- Applies all safeguards (sanitization, language check, featured images, idempotency)
- Used for `type: "wordpress"` targets with direct API credentials

**Used by Gulf Estate Gazette?** ❌ NO

---

### Path 2: Automation Service → Old WordPress Service (DIRECT PUSH BYPASS)
**File:** `server/services/automation-service.ts`  
**Line:** 132  
**Code:**
```typescript
if (target && latestVersion && target.type === "wordpress") {
  const publishResult = await publishToWordPress(target, latestVersion, {
    status: "publish",
  });
}
```

**How it works:**
- Triggered by automation runs (RSS/source polling)
- Bypasses enhanced publisher
- Calls old `wordpress-service.ts` directly
- **DOES NOT apply safeguards** (no sanitization, no language check, no featured images, no idempotency)

**Used by Gulf Estate Gazette?** ❌ NO  
**Reason:** No automations linked to Gulf Estate Gazette target (verified in database query)

---

### Path 3: WordPress Pull Plugin (PLUGIN POLLING)
**File:** `server/services/wp-pull-service.ts`  
**How it works:**
1. Pipeline job creates `pipeline_item` with status "scheduled"
2. Pipeline job creates `wp_pull_job` with content + metadata
3. WordPress plugin polls `/api/wp-pull/pull?siteId=XXX` (every 60 seconds)
4. Plugin receives job payload, publishes to WordPress locally
5. Plugin reports success back to `/api/wp-pull/report`
6. Server updates `pipeline_item.status = "published"` + `target_post_id` + `target_permalink`

**Used by Gulf Estate Gazette?** ✅ YES

**Evidence from database:**

**Target Configuration:**
```
┌─────────────────────────────────┬───────────────────────┬──────────────────┬────────────────────────────┐
│ id                              │ name                  │ type             │ site_id                    │
├─────────────────────────────────┼───────────────────────┼──────────────────┼────────────────────────────┤
│ 33a2681e-ddaf-40c8-836f-e44a9...│ Gulf Estate Gazette   │ wordpress_pull   │ cs_site_35F5824765499423   │
└─────────────────────────────────┴───────────────────────┴──────────────────┴────────────────────────────┘
```

**Recent Pipeline Items (10 items):**
- Status: `scheduled` (waiting for plugin to pull)
- All have `story_hash` (idempotency enabled ✅)
- None have `featured_image_url` (enforcement not yet in place ❌)
- Many titles contain Arabic text (language enforcement not in place ❌)

**Recent WP Pull Jobs (4 jobs):**
- Status: `queued` or `leased` (plugin is actively polling)
- No `result_wp_post_id` yet (jobs not yet published by plugin)
- Titles contain Arabic text and duplicates

---

## Critical Finding: Plugin Path DOES NOT Flow Through Enhanced Publisher

**Problem:**  
The WordPress Pull plugin path (`wp-pull-service.ts`) creates jobs directly from `pipeline_items` without ever calling `enhanced-publisher.ts`. This means:

❌ **Safeguards are NOT applied:**
- No content sanitization (markdown artifacts, SEO junk remain)
- No language detection/blocking (Arabic text gets published)
- No featured image requirement enforcement
- No category mapping
- Idempotency exists at DB level (story_hash unique constraint), but NOT at application level

**Where safeguards SHOULD be applied:**
- **Option A:** In `pipeline-jobs-service.ts` BEFORE creating `wp_pull_job`
- **Option B:** In `wp-pull-service.ts` when creating job payload
- **Option C:** Move job creation logic into `enhanced-publisher.ts`

**Current flow (BROKEN):**
```
pipeline-jobs-service.ts:publishPipelineItem()
  ├─ Check if target.type === "wordpress"
  │    ├─ YES → Call enhancedPublisher.publishPipelineItem() ✅
  │    └─ NO  → Continue...
  │
  ├─ Check if target.type === "wordpress_pull"
  │    └─ YES → Create wp_pull_job directly ❌ (NO SAFEGUARDS)
  │
  └─ Job created with raw content from pipeline_item
```

---

## Recommendation for Step 2B

**Refactor pipeline-jobs-service.ts to apply safeguards BEFORE creating wp_pull_job:**

```typescript
// BEFORE creating wp_pull_job, apply safeguards:
const { sanitized, quarantine } = await enhancedPublisher.validateAndPrepareContent(
  item,
  target
);

if (quarantine) {
  await storage.updatePipelineItem(item.id, {
    status: "quarantined",
    quarantineReason: quarantine.reason
  });
  return { success: false, reason: quarantine.reason };
}

// Create wp_pull_job with sanitized content
await storage.createWpPullJob({
  ...
  contentHtml: sanitized.content,
  title: sanitized.title,
  featuredImageUrl: sanitized.featuredImageUrl,
  categories: sanitized.categories,
  ...
});
```

---

## Next Action (Step 2B)

**Task:** Refactor `pipeline-jobs-service.ts` to enforce safeguards for `wordpress_pull` targets

**Files to modify:**
1. `server/services/enhanced-publisher.ts` - Extract validation logic into reusable function
2. `server/services/pipeline-jobs-service.ts` - Apply validation before creating wp_pull_job

**Deliverable:** All publishing paths (direct push AND plugin poll) flow through same safeguards
