# ContentSanta Pipeline Fixes - Implementation Summary

## Date: 2026-01-27

## Problem Statement
ContentSanta's "Full Auto by default" promise was broken due to:
1. Silent failures when topics lacked publishing targets
2. WordPress publishing errors not being logged
3. No UI visibility into configuration issues or pipeline failures

## Root Causes Fixed

### P0 Fix #1: Silent Skip Prevention ✅
**File:** `server/services/pipeline-jobs-service.ts` (lines 1151-1224)

**What Changed:**
- Replaced console-only "Skipping topic" with persisted job runs
- Added validation that publishing targets exist and are active
- Every configuration error now creates an `automation_job_run` with status="fail"

**Before:**
```typescript
if (topic.automationMode === "auto" && !topic.publishingTargetId) {
  console.log(`[Pipeline] Skipping ${topic.name} - auto mode requires publishing target`);
  continue; // ❌ Silent skip, no database record
}
```

**After:**
```typescript
if (topic.automationMode === "auto" && !topic.publishingTargetId) {
  console.error(`[Pipeline] Topic "${topic.name}" in auto mode but publishingTargetId is null`);
  
  const jobRunId = await createJobRun(topic.workspaceId, topic.id, "publish");
  const failResult: JobResult = {
    jobRunId,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 1,
    quarantined: 0,
    errors: ["AUTO_MODE_NO_TARGET: Topic in auto mode requires a publishing target to be configured"],
  };
  
  await finalizeJobRun(jobRunId, failResult, "fail");
  
  allResults.push({
    topicId: topic.id,
    topicName: topic.name,
    results: { publish: failResult },
    configError: "Auto mode requires publishing target", // ✅ Surfaced to UI
  });
  continue;
}
```

**Impact:**
- Configuration errors are now visible in `automation_job_runs` table
- UI can display meaningful error messages
- No more silent skips that confuse users

---

### P0 Fix #2: Guaranteed publish_attempts Logging ✅
**File:** `server/services/pipeline-jobs-service.ts` (lines 816-1002)

**What Changed:**
- Added `testWordPressConnection()` call BEFORE every REST API publish attempt
- Structured error codes (WP_CONNECTION_FAILED, WP_CREDENTIALS_INVALID, etc.)
- Actionable guidance messages based on error type
- `publish_attempts` table entry created for EVERY attempt, including early failures

**Before:**
```typescript
try {
  const publishResult = await publishToWordPress(target, assetVersion, { status: "publish" });
  
  if (publishResult.success && publishResult.postId) {
    // Success path...
    await storage.createPublishAttempt({ /* ... */ result: "success" });
  } else {
    throw new Error(publishResult.error || "WordPress publish failed");
  }
} catch (error: any) {
  // publish_attempts only created here, but not for early failures
  await storage.createPublishAttempt({ /* ... */ result: "fail" });
}
```

**After:**
```typescript
const attemptNumber = (item.publishAttempts || 0) + 1;
let errorCode = "PUBLISH_FAILED";
let errorMessage = "";
let responseStatus = 500;
let responseBody: any = {};

try {
  // ✅ Test connection FIRST
  console.log(`[PublishJob:${topic.id}] Testing WordPress connection for item ${item.id}`);
  const connectionTest = await testWordPressConnection(target);
  
  if (!connectionTest.success) {
    errorCode = connectionTest.errorCode || "WP_CONNECTION_FAILED";
    errorMessage = connectionTest.error || "WordPress connection test failed";
    responseBody = { 
      error: errorMessage, 
      errorCode, 
      debug: connectionTest.debug 
    };
    
    // ✅ Include actionable guidance
    if (errorCode.includes("CAPTCHA") || errorCode.includes("BLOCKED")) {
      errorMessage += " | Action: Check WordPress hosting security settings and whitelist server IP";
    } else if (errorCode === "HTML_RESPONSE" || errorCode === "API_NOT_FOUND") {
      errorMessage += " | Action: Verify Site URL is correct. If WordPress is in a subdirectory (e.g., /blog, /wp), include it in the URL";
    } else if (errorCode === "AUTH_FAILED") {
      errorMessage += " | Action: Verify username and application password are correct";
    } else if (errorCode === "MISSING_CREDENTIALS") {
      errorMessage += " | Action: Configure Site URL, Username, and Application Password in publishing target";
    }
    
    throw new Error(`${errorCode}: ${errorMessage}`);
  }
  
  // Proceed with publish...
} catch (error: any) {
  // ✅ Parse structured error codes
  const errorStr = error.message || "Unknown error";
  if (errorStr.includes(":")) {
    const parts = errorStr.split(":");
    errorCode = parts[0].trim();
    errorMessage = parts.slice(1).join(":").trim();
  } else {
    errorMessage = errorStr;
  }
  
  // ✅ ALWAYS create publish attempt, even for early failures
  await storage.createPublishAttempt({
    pipelineItemId: item.id,
    targetId: item.targetId,
    attemptNumber,
    requestPayload: { title: item.generatedTitle, content: item.generatedBody },
    responseStatus,
    responseBody: responseBody.error ? responseBody : { error: errorMessage },
    result: "fail",
  });
  
  // Retry or quarantine logic...
}
```

**Structured Error Codes:**
- `WP_CONNECTION_FAILED` - Generic connection failure
- `WP_CREDENTIALS_INVALID` / `MISSING_CREDENTIALS` - Auth issues
- `WP_API_URL_INVALID` / `HTML_RESPONSE` / `API_NOT_FOUND` - Wrong URL or subdirectory issue
- `WP_BLOCKED` / `SITEGROUND_CAPTCHA` / `CLOUDFLARE_BLOCKED` - Hosting security blocking requests
- `WP_PUBLISH_FAILED` - Publish call failed after connection succeeded
- `WP_PULL_NO_SITE_ID` - WordPress Pull target missing siteId

**Impact:**
- Users can see EXACTLY why publishing failed in `publish_attempts` table
- Error messages include actionable next steps
- No more mystery failures where "nothing happened"

---

### P1 Fix #1: Topic UI Configuration Alerts ✅
**File:** `client/src/pages/topics.tsx` (lines 1287-1313)

**What Changed:**
- Added prominent warning banners on topic cards when:
  - `automationMode === "auto"` but `publishingTargetId` is null
  - `automationMode === "auto"` but no sources are enabled
- Banners appear directly in the topic card for immediate visibility

**Implementation:**
```tsx
{/* Configuration Health Alert */}
{topic.automationMode === "auto" && !topic.publishingTargetId && (
  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-amber-900">
        Configuration Required
      </p>
      <p className="text-xs text-amber-700 mt-1">
        Auto mode requires a publishing target. Click Edit Settings to configure.
      </p>
    </div>
  </div>
)}
{topic.automationMode === "auto" && enabledSourceCount === 0 && (
  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
    <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-blue-900">
        No Sources Enabled
      </p>
      <p className="text-xs text-blue-700 mt-1">
        Enable at least one source to start auto-generating content.
      </p>
    </div>
  </div>
)}
```

**Impact:**
- Users immediately see if their topic is misconfigured
- Clear guidance on what to fix
- No more "I thought it was automated but nothing happened"

---

### P1 Fix #2: Pipeline Items Observability ✅
**File:** `client/src/pages/topics.tsx` (lines 1615-1624)
**File:** `client/src/pages/pipeline.tsx` (lines 1-3, 525-539)

**What Changed:**
1. Added "View Pipeline Items" button to AutomationStatusCard
2. Added URL query parameter support to Pipeline page (`?topic=<topicId>`)
3. Pipeline page auto-loads the topic specified in URL

**Topic Page Enhancement:**
```tsx
<Link href={`/pipeline?topic=${topic.id}`}>
  <Button 
    size="sm" 
    variant="outline"
    data-testid={`button-view-pipeline-${topic.id}`}
  >
    <Activity className="h-3 w-3 mr-1" />
    View Pipeline Items
  </Button>
</Link>
```

**Pipeline Page URL Support:**
```typescript
export default function Pipeline() {
  const { toast } = useToast();
  const searchParams = useSearch();
  const urlTopicId = new URLSearchParams(searchParams).get("topic");
  
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(urlTopicId);
  
  // Set topic from URL parameter on mount
  useEffect(() => {
    if (urlTopicId && !selectedTopicId) {
      setSelectedTopicId(urlTopicId);
    }
  }, [urlTopicId, selectedTopicId]);
  
  // Rest of component...
}
```

**Impact:**
- One-click navigation from topic to its pipeline items
- See status distribution (fetched, matched, ranked, generated, scheduled, published, quarantined)
- View quarantine reasons and publish attempts
- Debug pipeline issues in < 60 seconds

---

## Verification Checklist

### Backend Verification
1. ✅ Scheduler starts on server boot (see console: `[Scheduler] Background jobs started`)
2. ✅ `runAllLivePipelines()` creates job runs even for skipped topics
3. ✅ `publish_attempts` table receives entries for all publishing attempts
4. ✅ Error codes are structured and actionable
5. ✅ WordPress connection is tested BEFORE publishing

### Frontend Verification
1. ✅ Topic cards show configuration warnings when auto mode lacks target
2. ✅ Topic cards show warnings when no sources are enabled
3. ✅ "View Pipeline Items" button navigates to pipeline page with topic pre-selected
4. ✅ Pipeline page loads topic from URL query parameter

### Database Verification
```sql
-- Check for persisted configuration errors
SELECT * FROM automation_job_runs 
WHERE status = 'fail' 
  AND error_summary LIKE '%AUTO_MODE_NO_TARGET%'
ORDER BY started_at DESC;

-- Check publish attempts with structured error codes
SELECT pi.id, pi.status, pi.last_error_code, pi.last_error_message, 
       pa.attempt_number, pa.response_body
FROM pipeline_items pi
LEFT JOIN publish_attempts pa ON pa.pipeline_item_id = pi.id
WHERE pi.status IN ('quarantined', 'retrying', 'publishing')
ORDER BY pi.updated_at DESC;
```

---

## Final Acceptance Test

### Prerequisites
1. Set `DATABASE_URL` and `OPENAI_API_KEY` in `.env`
2. Create a WordPress publishing target and test connection
3. Ensure target credentials are valid

### Test Steps
1. **Create/select a topic** with `automationMode = "auto"`
2. **Link it to a working WordPress publishing target**
3. **Enable ≥1 source** for that topic
4. **Wait for cron (10 min)** OR manually trigger: `POST /api/topics/:id/run-pipeline`

### Expected Outcomes
✅ `pipeline_items` created (status: fetched → matched → ranked → generated → gated → scheduled)
✅ `drafts` created for generated content
✅ `publish_attempts` created when scheduled items are published
✅ WordPress post appears at target site OR (if blocked) clear error in UI with guidance

### If Publishing Fails
1. Check `publish_attempts` table for error code and message
2. Check topic card for configuration warnings
3. Click "View Pipeline Items" to see detailed status
4. Follow actionable guidance in error message (e.g., "whitelist server IP", "check subdirectory path")

---

## Error Code Reference

| Error Code | Meaning | Action Required |
|------------|---------|-----------------|
| `AUTO_MODE_NO_TARGET` | Topic in auto mode without publishing target | Configure publishing target in topic settings |
| `TARGET_NOT_FOUND` | Publishing target ID references non-existent target | Update topic to use valid publishing target |
| `WP_CONNECTION_FAILED` | Generic WordPress connection failure | Check site URL and network connectivity |
| `MISSING_CREDENTIALS` | Site URL, username, or app password missing | Configure all credentials in publishing target |
| `AUTH_FAILED` | Username or application password incorrect | Verify credentials in WordPress admin |
| `HTML_RESPONSE` | WordPress returned HTML instead of JSON | Check if WordPress is in subdirectory (e.g., /blog) |
| `API_NOT_FOUND` | WordPress REST API not found (404) | Verify Site URL and ensure REST API is enabled |
| `SITEGROUND_CAPTCHA` | SiteGround bot protection blocking requests | Whitelist server IP in SiteGround security settings |
| `CLOUDFLARE_BLOCKED` | Cloudflare blocking server-to-server requests | Whitelist IP or enable Cloudflare proxy (orange cloud) |
| `WP_PUBLISH_FAILED` | Publish call failed after connection succeeded | Check WordPress error logs for details |

---

## Rollback Plan

If issues arise, revert these commits:
1. `server/services/pipeline-jobs-service.ts` changes (lines 1151-1224, 816-1002)
2. `client/src/pages/topics.tsx` changes (lines 1287-1313, 1615-1624)
3. `client/src/pages/pipeline.tsx` changes (lines 1-3, 525-539)

---

## Next Steps (Not Implemented - Out of Scope)

The following were discussed but NOT implemented per user directive:

1. ❌ **Auto-enable sources for new topics** - User wants source activation to remain deliberate
2. ❌ **Full pipeline dashboard rewrite** - Minimal observability was the goal
3. ❌ **Automatic topic seeding** - Out of scope for this fix

---

## Summary

All P0 and P1 fixes are implemented and tested. The system now:

✅ **Never silently skips topics** - All config errors are persisted and visible
✅ **Always logs publish attempts** - Even early failures create database records
✅ **Shows clear configuration warnings** - Users see what's wrong immediately
✅ **Provides one-click observability** - View pipeline items and errors in seconds

The "Full Auto by default" promise is restored. Topics with `automationMode="auto"`, a valid `publishingTargetId`, and ≥1 enabled source will automatically progress from source fetching to WordPress publishing with full traceability.
