# Complete Data Flow Mapping: Source to Published Content

**Generated:** 2026-01-27  
**Scope:** RSS ingestion → story clustering → topic discovery → pipeline automation → publishing

---

## 1. Data Chain Overview

```
sources (RSS feeds)
  ↓ [RSS Fetch Job - every 30min]
source_items (ingested articles)
  ↓ [Story Clustering - on-demand/triggered]
stories (deduplicated clusters)
  ↓ [Topic Discovery Job - every 20min]
topic_stories (relevance-scored matches)
  ↓ [Fetch Job - every 10min]
pipeline_items (automation workflow)
  ↓ [Generate → Gate → Schedule → Publish]
drafts (generated content)
publish_attempts (publishing logs)
wp_pull_jobs (plugin-based publishing)
```

---

## 2. Detailed Table Flow

### 2.1 Sources → Source Items (RSS Ingestion)

**Tables:**
- `sources` - RSS feed configurations
- `fetch_runs` - Execution logs for each fetch
- `source_items` - Individual articles/news items

**Process:**
1. **Scheduler triggers** `fetchAllActiveSources()` every 30 minutes
2. **For each active source:**
   - HTTP GET with decompression (gzip/deflate/brotli)
   - Parse RSS/Atom XML
   - Extract items: title, URL, publishedAt, excerpt, rawContent
   - Generate `contentHash` (SHA256 of normalized URL + title)
   - Generate `guidNormalized` (SHA256 of GUID or fallback)
   - **Deduplication:** Check if `contentHash` exists in workspace
   - **Insert** if new, skip if duplicate
3. **Update source metadata:**
   - `lastFetchedAt`, `lastSuccessAt`, `lastError`, `itemCount`
4. **Create fetch_run record:**
   - Status: success/failed
   - Stats: insertedCount, dedupedCount, durationMs, httpStatus

**Files:**
- `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\server\services\rss-service.ts` (lines 421-637: `fetchRSSSource()`)
- `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\server\services\scheduler.ts` (lines 18-26: RSS fetch cron)

**Silent failure points:**
- ❌ Feed parsing errors NOT recorded in `fetch_runs` if XML is invalid before parsing
- ❌ Items missing GUID/link silently skipped (only counted in `missingGuidCount`)
- ❌ HTTP 403/404 errors stored in `lastError` but no alert system

---

### 2.2 Source Items → Stories (Aggregation/Deduplication)

**Tables:**
- `source_items` (status: new → processed)
- `stories` - Deduplicated story clusters
- `story_items` - Provenance links (many-to-many)
- `image_assets` - Images extracted from RSS

**Process:**
1. **Triggered:** Manual or via topic discovery (not scheduled)
2. **For each new source_item:**
   - Extract keywords from title + excerpt (stopwords removed)
   - Generate `similarityHash` (MD5 of top 10 keywords)
   - Generate `publishedDateBucket` (YYYY-MM-DD)
   - **Search existing stories:** Match by `similarityHash` + date bucket
   - **Calculate Jaccard similarity** (keyword overlap)
   - **If similarity ≥ 0.6:** Link to existing story
   - **Else:** Create new story with normalized title
3. **Update story:**
   - Increment `sourceCount`
   - Update `lastUpdatedAt`
4. **Extract images:**
   - Parse `media:thumbnail`, `media:content`, `enclosure`
   - Create `image_assets` records
   - Select primary image (prefer tier_1 sources)

**Files:**
- `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\server\services\story-clustering-service.ts` (lines 151-226: `clusterSourceItem()`)

**Silent failure points:**
- ❌ Clustering NOT automatic - requires manual trigger or happens during topic discovery
- ❌ Items with very short titles (<3 words after stopword removal) may cluster poorly
- ❌ No error tracking if story creation fails mid-process

---

### 2.3 Stories → Topic Stories (Topic Discovery/Matching)

**Tables:**
- `topics` - Automation pipeline configs
- `topic_sources` - Per-topic source enablement
- `topic_stories` - Relevance-scored story matches (many-to-many)
- `stories` - Source data

**Process:**
1. **Scheduler triggers** `runAllLiveTopics()` every 20 minutes
2. **For each live topic:**
   - Get enabled sources via `topic_sources` table
   - **If no sources enabled:** Skip with warning log
   - Fetch recent source_items (last 168 hours, max 500)
   - **Relevance filtering:**
     - Extract query keywords from `topic.query` + `topic.name`
     - Match against title (0.15 score), summary (0.08), content (0.03)
     - Domain vocabulary: high-weight terms (0.20), medium-weight (0.08)
     - Negative keywords: penalize off-topic (-0.25 in title, -0.1 elsewhere)
     - **Threshold:** score ≥ 0.15 AND ≥1 matched term AND (≥1 high-weight OR ≥2 medium-weight)
   - **Story clustering:** Convert new items to stories
   - **Clear stale topic_stories** for topic
   - **Re-score all stories** from enabled sources
   - **Apply tier-1 boost:** +0.05 if story from tier=1 or isOfficial=true source
   - **Persist topic_stories:** Only if score ≥ threshold
3. **Log execution:** TopicRunLog with stats (processed, accepted, rejected)

**Files:**
- `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\server\services\topic-run-service.ts` (lines 30-172: `runTopicDiscovery()`)
- `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\server\services\topic-relevance-service.ts` (lines 104-245: relevance scoring)

**Silent failure points:**
- ❌ Topics with no enabled sources silently skipped (only console log)
- ❌ Relevance scoring hardcoded for "real estate" domain - generic topics may underperform
- ❌ Stale `topic_stories` cleared on every run - history lost

---

### 2.4 Topic Stories → Pipeline Items (Pipeline Entry)

**Tables:**
- `pipeline_items` - Items in automation workflow (13-state machine)
- `automation_job_runs` - Execution logs for each pipeline job
- `stories`, `topic_stories` - Source data

**Process:**
1. **Scheduler triggers** `runAllLivePipelines()` every 10 minutes
2. **For each automated topic** (mode: auto or approval_required):
   - **Validate configuration:**
     - Auto mode requires `publishingTargetId` (else skip with error)
     - Check target exists and is reachable
   - **Run Fetch Job:**
     - Get stories from `topic_stories`
     - Create `pipeline_items` (status: "fetched") for new stories
     - Generate `dedupeHash` (SHA256 of normalized title)
   - **Run Match & Rank Job:**
     - Filter by `includeKeywords` / `excludeKeywords`
     - Deduplicate against already-published items
     - Rank by `relevanceScore` from `topic_stories` (fallback: 0.5)
     - Status progression: fetched → matched → deduped → ranked
   - **Run Generate Job:**
     - Top 5 ranked items (sorted by score desc)
     - Create Input + WorkflowRun (type: "seo_blog")
     - Call AI generation (`processWorkflowWithAI`)
     - Store generated content in `pipeline_items` fields
     - Create Draft (status: "approved" if auto, else "pending")
     - Status progression: ranked → generated
   - **Run Quality Gate Job:**
     - Validate: title + body present, body ≥100 chars, score ≥0.3
     - Status progression: generated → gated (or → quarantined / skipped)
   - **Run Schedule Job:**
     - Check daily cap, quiet hours
     - Calculate next publish slot (by `publishTimes` or `minSpacing`)
     - Status progression: gated → scheduled
   - **Run Publish Job:**
     - Items where `scheduledFor` ≤ now
     - **WordPress Pull mode:**
       - Create `wp_pull_jobs` record (status: "queued")
       - Status: scheduled → publishing → (queued in wp_pull_jobs)
     - **REST API mode:**
       - Test WordPress connection first
       - Publish via REST API
       - Status: scheduled → publishing → published
     - **ALWAYS create publish_attempt** (even on failure)
     - Retry logic: max 5 attempts, exponential backoff (1, 5, 20, 60, 360 min)
   - **Run Verify Job:**
     - Test connection to verify post exists
     - Status: published → verified
   - **Run Retry Job:**
     - Re-queue retrying items after backoff period
     - Move to appropriate stage based on error code

**Files:**
- `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\server\services\pipeline-jobs-service.ts` (lines 150-1284: all pipeline jobs)
- `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\server\services\scheduler.ts` (lines 50-63: pipeline automation cron)

**Status transition map:**
```
fetched → matched → deduped → ranked → generated → gated → scheduled → publishing → published → verified
            ↓         ↓         ↓         ↓         ↓        ↓           ↓           ↓
          skipped  skipped   skipped  retrying  quarantined  retrying  quarantined  retrying
```

**Gap conditions:**
- ❌ **NO error code recorded** when items stuck in "fetched" (never matched)
- ❌ **NO retry logic** for "matched" → "deduped" failures
- ❌ **Incomplete quarantine reasons:** Only set for generation/publish failures, not earlier stages
- ❌ **Silent cap skip:** Items skipped due to daily cap have `lastErrorMessage` but no `skipReason` field populated
- ❌ **Publish attempt NOT created** if target validation fails early (before API call)
- ⚠️ **Fixed in recent code:** Publish attempts now ALWAYS created (line 969-980)

---

### 2.5 Pipeline Items → Drafts (Content Generation)

**Tables:**
- `drafts` - Generated content for editorial review
- `inputs` - Source content for AI workflow
- `workflow_runs` - AI generation execution logs
- `assets` + `asset_versions` - Versioned output storage

**Process:**
1. **During Generate Job** (see 2.4 above):
   - Create Input record with story title + excerpt
   - Create WorkflowRun (workflowType: "seo_blog")
   - Call `processWorkflowWithAI()` (external AI service)
   - Extract title + body from AssetVersion
   - Store in `pipeline_items.generatedTitle/Body/Excerpt`
   - **Create Draft:**
     - Link to topic, story, pipelineItem
     - Status: "approved" (auto mode) or "pending" (approval_required)
     - Provenance: Top 5 source_items linked to story
2. **Draft NOT created if:**
   - AI generation fails (returns `success: false`)
   - AssetVersion missing title or body
   - Draft already exists for pipeline_item (checked via `getDraftByPipelineItemId`)

**Files:**
- `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\server\services\pipeline-jobs-service.ts` (lines 303-441: `runGenerateJob()`)

**Silent failure points:**
- ❌ Draft creation errors not logged to `automation_job_runs`
- ❌ No tracking if draft creation succeeds but AI result is truncated

---

### 2.6 Pipeline Items → Publish Attempts (Publishing Logs)

**Tables:**
- `publish_attempts` - Detailed logs for each publish try
- `pipeline_items` - Workflow state

**Process:**
1. **During Publish Job** (see 2.4 above):
   - Increment `publishAttempts` counter
   - Store attempt metadata:
     - `attemptNumber` (1-5)
     - `requestPayload` (title, content, excerpt)
     - `responseStatus` (HTTP code or 200 for WP Pull)
     - `responseBody` (success result or error object)
     - `result` ("success" or "fail")
     - `errorMessage` (structured: "ERROR_CODE: message")
   - **ALWAYS created** (as of recent fix, line 969-980)

**Files:**
- `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\server\services\pipeline-jobs-service.ts` (lines 768-1013: `runPublishJob()`)

**Gap conditions:**
- ⚠️ **Fixed:** Previously, attempts NOT created if connection test failed before API call
- ✅ **Now recorded:** All failures including early validation errors

---

### 2.7 Pipeline Items → WP Pull Jobs (Plugin-Based Publishing)

**Tables:**
- `wp_pull_jobs` - Job queue for WordPress plugin
- `publishing_targets` (type: "wordpress_pull") - Plugin connector config
- `wp_plugin_request_logs` - Plugin handshake/pull/report audit trail

**Process:**
1. **Job Creation** (during Publish Job):
   - If target type = "wordpress_pull"
   - Validate `siteId` exists
   - Create wp_pull_job:
     - Status: "queued"
     - Content: title, contentHtml, categories, tags, excerpt, slug
     - Metadata: storyId, pipelineItemId, topicId
2. **Plugin Pull** (WordPress plugin polls `/api/publishing/wp-pull/pull`):
   - Auth: siteId + X-ContentSanta-Secret header (bcrypt verified)
   - Lease next queued job (status: "queued" → "leased")
   - Generate `leaseToken` (16-byte random hex)
   - Set `leaseExpiresAt` (now + 5 minutes)
   - Update target: `lastPullAt`
3. **Plugin Report** (plugin posts to `/api/publishing/wp-pull/report`):
   - Auth: siteId + secret + leaseToken
   - **If success:**
     - wp_pull_job: "leased" → "published"
     - Store `resultWpPostId`, `resultWpUrl`
     - pipeline_item: → "published"
     - Update topic: `publishedToday++`
     - Target: `lastHealthStatus = "ok"`
   - **If failure:**
     - Increment `attempts`
     - If attempts ≥ 5: "leased" → "failed"
     - Else: "leased" → "queued" (re-queue)
     - Target: `lastErrorCode = "PUBLISH_FAILED"`
4. **Lease Cleanup** (every 2 minutes):
   - Release jobs where `leaseExpiresAt` < now AND status = "leased"
   - Reset to "queued" for retry

**Files:**
- `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\server\services\wp-pull-service.ts` (lines 82-221: pull/report logic)
- `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\server\services\scheduler.ts` (lines 65-75: lease cleanup cron)

**Silent failure points:**
- ❌ Plugin never polls: Job stuck in "queued" forever (no timeout/expiry for queued jobs)
- ❌ Plugin crashes after lease: Job expires and re-queues, but no notification
- ❌ Auth failures NOT recorded in `publish_attempts` table

---

## 3. Scheduler Configuration

**File:** `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\server\services\scheduler.ts`

**Registration:** Called once on server start via `routes.ts` line 4330

| Job | Interval | Function | Description |
|-----|----------|----------|-------------|
| **RSS Fetch** | Every 30 min | `fetchAllActiveSources()` | Fetch from all active RSS feeds |
| **Automations** | Every 15 min | `runAllActiveAutomations()` | Legacy automation workflow (pre-pipeline) |
| **Topic Discovery** | Every 20 min | `runAllLiveTopics()` | Match stories to topics, persist topic_stories |
| **Pipeline Automation** | Every 10 min | `runAllLivePipelines()` | Run full 7-stage pipeline for auto/semi-auto topics |
| **WP Pull Lease Cleanup** | Every 2 min | `releaseExpiredWpPullJobLeases()` | Re-queue expired plugin jobs |

**Manual triggers available via API:**
- `/api/system/trigger-rss-fetch` (POST)
- `/api/system/trigger-automations` (POST)
- `/api/system/trigger-topic-discovery` (POST)
- `/api/system/trigger-pipeline` (POST)

---

## 4. Pipeline Status Transition Map

### 4.1 Valid Status Values

**From schema.ts lines 1365-1380:**
```typescript
export const pipelineItemStatuses = [
  "fetched",      // Story fetched from sources
  "matched",      // Matched to pipeline rules
  "deduped",      // Passed deduplication check
  "ranked",       // Scored and ranked
  "generated",    // AI content generated
  "gated",        // Passed quality gate
  "scheduled",    // Scheduled for publishing
  "publishing",   // Currently publishing
  "published",    // Successfully published to target
  "verified",     // Verified post exists on target
  "retrying",     // Retrying after failure
  "quarantined",  // Failed with actionable reason
  "skipped",      // Skipped due to cap/policy
] as const;
```

### 4.2 Transition Functions

| From → To | Function | File | Lines | Trigger |
|-----------|----------|------|-------|---------|
| (none) → fetched | `runFetchJob()` | pipeline-jobs-service.ts | 150-211 | New story linked to topic |
| fetched → matched | `runMatchAndRankJob()` | pipeline-jobs-service.ts | 213-301 | Keyword match passes |
| fetched → skipped | `runMatchAndRankJob()` | pipeline-jobs-service.ts | 257-263 | Keyword match fails |
| matched → deduped | `runMatchAndRankJob()` | pipeline-jobs-service.ts | 276 | Not duplicate of published |
| matched → skipped | `runMatchAndRankJob()` | pipeline-jobs-service.ts | 268-274 | Duplicate detected |
| deduped → ranked | `runMatchAndRankJob()` | pipeline-jobs-service.ts | 283-287 | Relevance score assigned |
| ranked → generated | `runGenerateJob()` | pipeline-jobs-service.ts | 303-441 | AI generation succeeds |
| ranked → retrying | `runGenerateJob()` | pipeline-jobs-service.ts | 412-427 | AI generation fails |
| generated → gated | `runQualityGateJob()` | pipeline-jobs-service.ts | 443-509 | Passes quality checks |
| generated → quarantined | `runQualityGateJob()` | pipeline-jobs-service.ts | 465-482 | Quality check fails |
| generated → skipped | `runQualityGateJob()` | pipeline-jobs-service.ts | 485-492 | Low relevance score |
| gated → scheduled | `runScheduleJob()` | pipeline-jobs-service.ts | 628-766 | Slot available + cap OK |
| gated → skipped | `runScheduleJob()` | pipeline-jobs-service.ts | 688-692, 735-741 | Daily cap reached |
| scheduled → publishing | `runPublishJob()` | pipeline-jobs-service.ts | 768-1013 | scheduledFor ≤ now |
| publishing → published | `runPublishJob()` | pipeline-jobs-service.ts | 920-947 | WordPress publish succeeds |
| publishing → retrying | `runPublishJob()` | pipeline-jobs-service.ts | 991-998 | Publish fails, retries < 5 |
| publishing → quarantined | `runPublishJob()` | pipeline-jobs-service.ts | 983-989 | Publish fails, retries ≥ 5 |
| published → verified | `runVerifyJob()` | pipeline-jobs-service.ts | 1015-1097 | Connection test succeeds |
| published → retrying | `runVerifyJob()` | pipeline-jobs-service.ts | 1073-1081 | Verify fails, retries < 5 |
| retrying → (various) | `runRetryJob()` | pipeline-jobs-service.ts | 1099-1160 | Backoff period elapsed |

### 4.3 Status Validation

**No formal validation** - Status transitions happen via direct string assignment:
```typescript
await storage.updatePipelineItem(item.id, {
  status: "quarantined" as PipelineItemStatus,
  lastErrorCode: "INVALID_CONTENT",
  lastErrorMessage: "Missing generated title or body",
});
```

**Risks:**
- ❌ No enforcement of valid state machine transitions
- ❌ Items can be manually set to invalid states via API
- ❌ No locking to prevent concurrent state changes

---

## 5. Gap Conditions Summary

### 5.1 Silent Failure Points

| Stage | Gap | Impact | File Reference |
|-------|-----|--------|----------------|
| **RSS Fetch** | Invalid XML fails before fetch_run creation | No audit trail | rss-service.ts:453-462 |
| **RSS Fetch** | Items missing GUID/link silently skipped | Lost content | rss-service.ts:487-494 |
| **Story Clustering** | Not automatic - requires manual trigger | Items stuck in "new" status | story-clustering-service.ts:228-251 |
| **Topic Discovery** | No enabled sources = silent skip | Topics never match stories | topic-run-service.ts:38-52 |
| **Fetch Job** | No error tracking if story missing | Items stuck in "fetched" | pipeline-jobs-service.ts:244-251 |
| **Match Job** | Keyword mismatch = skip, no quarantine | Lost in noise | pipeline-jobs-service.ts:257-263 |
| **Generate Job** | Draft creation errors not logged | Orphaned generated content | pipeline-jobs-service.ts:385-404 |
| **Schedule Job** | Daily cap skip has no skipReason field | Can't distinguish skip causes | pipeline-jobs-service.ts:688-692 |
| **WP Pull** | Plugin never polls = stuck in "queued" | Jobs never timeout | wp-pull-service.ts:82-112 |

### 5.2 Missing Error Codes

**Locations where error codes NOT recorded:**

1. **Fetch Job story lookup failure** (pipeline-jobs-service.ts:244)
   - Updates `lastErrorMessage` but no `lastErrorCode`
   - Should set: `STORY_NOT_FOUND`

2. **Match Job keyword filter rejection** (pipeline-jobs-service.ts:257)
   - Stores reason in `lastErrorMessage`
   - Should use `skipReason` field + code `NO_KEYWORD_MATCH`

3. **Schedule Job daily cap rejection** (pipeline-jobs-service.ts:688)
   - Message says "DAILY_CAP" but no structured `skipReason`
   - Should set: `skipReason: "daily_cap_reached"`

4. **Schedule Job no slot available** (pipeline-jobs-service.ts:709)
   - Message says "NO_SLOT" but no structured code
   - Should set: `skipReason: "no_slot_available"`

### 5.3 Missing Retry Logic

**Stages without retry:**
- ❌ **Fetch Job:** If story fetch fails, item stuck forever
- ❌ **Match Job:** If deduplication check fails, item stays "matched"
- ❌ **Gate Job:** Quarantined items never auto-retry

**Stages with retry:**
- ✅ Generate Job (ranked → retrying → ranked)
- ✅ Publish Job (publishing → retrying → scheduled, max 5 attempts)
- ✅ Verify Job (published → retrying → published, max 5 attempts)

### 5.4 Incomplete Quarantine Logic

**Quarantine reasons defined** (schema.ts:1383-1393):
```typescript
export const quarantineReasons = [
  "language_mismatch",
  "policy_block",
  "invalid_content",
  "publish_failed",
  "verify_failed",
  "taxonomy_missing",
  "rate_limited",
  "unknown_error",
] as const;
```

**Actually used:**
- ✅ `invalid_content` - Gate job (lines 466, 476)
- ✅ `publish_failed` - Implied by lastErrorCode (not explicitly set)
- ❌ Others NEVER set in code

**Missing usage:**
- ❌ `language_mismatch` - Could detect wrong language in gate
- ❌ `policy_block` - Could check policy flags in match
- ❌ `taxonomy_missing` - Could validate categories exist
- ❌ `rate_limited` - Could detect 429 errors in publish

---

## 6. File References

### Core Services

- **RSS Service:** `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\server\services\rss-service.ts`
- **Story Clustering:** `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\server\services\story-clustering-service.ts`
- **Topic Relevance:** `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\server\services\topic-relevance-service.ts`
- **Topic Discovery:** `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\server\services\topic-run-service.ts`
- **Pipeline Jobs:** `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\server\services\pipeline-jobs-service.ts`
- **WP Pull Service:** `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\server\services\wp-pull-service.ts`
- **Scheduler:** `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\server\services\scheduler.ts`

### Schema & Storage

- **Schema Definitions:** `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\shared\schema.ts`
- **Storage Layer:** `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\server\storage.ts`

### Server Entry Point

- **Routes & Init:** `D:\360 WorkPlace\Verdent\Content Santa On Replit\Content-Santa\Content-Santa\server\routes.ts` (scheduler started at line 4330)

---

## 7. Recommended Actions

### 7.1 Critical Fixes

1. **Add error codes to all failure points:**
   - Fetch job story lookup (STORY_NOT_FOUND)
   - Match job keyword rejection (NO_KEYWORD_MATCH)
   - Schedule job rejections (DAILY_CAP, NO_SLOT)

2. **Populate structured reason fields:**
   - Use `skipReason` enum for all skips
   - Use `quarantineReason` enum for all quarantines
   - Remove free-text `lastErrorMessage` duplication

3. **Add retry logic to early stages:**
   - Fetch job: Retry story lookup (exponential backoff)
   - Match job: Retry deduplication check
   - Gate job: Auto-retry quarantined after 24h (if error code is transient)

4. **Fix WP Pull timeout:**
   - Add `queuedAt` timestamp to wp_pull_jobs
   - Expire jobs queued >24h with errorCode: "PLUGIN_TIMEOUT"
   - Send alert to workspace owner

### 7.2 Monitoring Enhancements

1. **Status audit queries:**
   ```sql
   -- Items stuck in intermediate states
   SELECT status, COUNT(*) 
   FROM pipeline_items 
   WHERE status IN ('fetched', 'matched', 'deduped', 'publishing', 'retrying')
   GROUP BY status;
   
   -- Quarantined items without reason codes
   SELECT id, last_error_code, last_error_message
   FROM pipeline_items
   WHERE status = 'quarantined' AND quarantine_reason IS NULL;
   ```

2. **Add alerts for:**
   - Items in "fetched" >6 hours
   - Items in "retrying" >24 hours
   - wp_pull_jobs in "queued" >12 hours
   - Topics with zero enabled sources

### 7.3 Data Integrity

1. **Validate state transitions:**
   - Add `validateStatusTransition(from, to)` check in storage.updatePipelineItem()
   - Reject invalid transitions (e.g., "published" → "fetched")

2. **Add status history table:**
   ```sql
   CREATE TABLE pipeline_item_status_history (
     id UUID PRIMARY KEY,
     pipeline_item_id UUID NOT NULL,
     from_status TEXT,
     to_status TEXT NOT NULL,
     changed_at TIMESTAMP DEFAULT NOW(),
     changed_by TEXT,
     reason TEXT
   );
   ```

---

**End of Mapping**
