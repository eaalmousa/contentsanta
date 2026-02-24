# Publishing Pipeline - Testing & Verification Guide

## Prerequisites
✅ Backend implementation complete (publishing_items table, API endpoints, worker)
✅ Frontend implementation complete (Publishing tab, handoff button, status display)
✅ Server running with publishing worker active

## Test Scenario 1: Basic Handoff Flow

### Setup
1. Navigate to `/pipeline` in the browser
2. Select a topic from the dropdown
3. Ensure topic has at least one item in "Items" tab with status `generated`, `gated`, or `scheduled`

### Steps
1. Click on "Items" tab
2. Find an eligible item (look for the TrendingUp icon button)
3. Click "Hand Off to Publishing" button
4. **Expected:** Toast notification: "Handed off to publishing"
5. Click "Publishing" tab
6. **Expected:** Item now appears in Publishing tab with status `draft_ready`
7. Click back to "Items" tab
8. **Expected:** Item no longer appears in Items list

### Verification
- [ ] Item moved from Items → Publishing tab
- [ ] Status badge shows "Draft Ready" (blue)
- [ ] Handed-off time shows "a few seconds ago"
- [ ] No errors in browser console
- [ ] No errors in server logs

---

## Test Scenario 2: Idempotent Handoff

### Steps
1. In "Items" tab, find an eligible item
2. Click "Hand Off to Publishing" button **3 times rapidly**
3. Check server logs for any errors
4. Navigate to "Publishing" tab
5. **Expected:** Only ONE item appears (no duplicates)

### Verification
- [ ] Only one publishing_items record created
- [ ] No database constraint violations in server logs
- [ ] Second/third handoff returns existing record (check server response)

---

## Test Scenario 3: Publishing Worker Automation

### Setup
- Ensure `.env` has `PUBLISHING_WORKER_INTERVAL_MINUTES=3` (or less for faster testing)
- Restart server to pick up changes

### Steps
1. Hand off an item to publishing (status: `draft_ready`)
2. Wait for publishing worker to run (max 3 minutes)
3. Check server logs for: `[Scheduler] Running publishing worker job...`
4. Check Publishing tab - status should change to `pushing` → `published` or `publish_failed`

### Verification
- [ ] Worker runs automatically every 3 minutes
- [ ] Status changes from `draft_ready` → `pushing` → `published`
- [ ] If published: `publishedUrl` field populated
- [ ] If failed: `lastError` displays reason
- [ ] Published item shows external link icon with working URL

---

## Test Scenario 4: Manual Push Now

### Steps
1. Hand off an item (status: `draft_ready`)
2. In "Publishing" tab, find the item
3. Click "Push Now" button
4. **Expected:** Button shows spinner, toast: "Publishing triggered"
5. Wait 2-3 seconds, refresh if needed
6. **Expected:** Status changes to `pushing` → `published` or `publish_failed`

### Verification
- [ ] Push Now button triggers immediate publishing
- [ ] Status updates in real-time (or after query invalidation)
- [ ] Published URL appears if successful
- [ ] Error message displays if failed

---

## Test Scenario 5: Scheduled Publishing

### Setup
1. In Publishing tab, ensure an item is `draft_ready`
2. (Backend feature: PATCH /api/publishing-items/:id with scheduledAt timestamp)

### Steps
1. Set `scheduledAt` to 2 minutes in the future
2. Status changes to `scheduled`
3. Wait until scheduled time
4. Publishing worker picks up item and publishes

### Verification
- [ ] Scheduled time displays: "in 2 minutes"
- [ ] Once due: "Due now"
- [ ] Worker respects schedule (doesn't publish early)
- [ ] After scheduled time: status → `pushing` → `published`

---

## Test Scenario 6: Retry Failed Publishing

### Setup
1. Simulate a failed publish (e.g., invalid WP credentials)
2. Item status: `publish_failed`

### Steps
1. In Publishing tab, find failed item
2. Check "Last Error" message displayed
3. Click "Push Now" button to retry
4. **Expected:** Attempt counter increments
5. If credentials fixed: status → `published`
6. If still failing: stays `publish_failed` with updated error

### Verification
- [ ] Failed items show error message inline
- [ ] Attempt counter visible and incrementing
- [ ] Retry button works (max 3 attempts per backend logic)
- [ ] After 3 attempts: item quarantined or marked as permanently failed

---

## Test Scenario 7: Publishing Tab Filters (Future Enhancement)

**Note:** Not yet implemented; included for completeness.

### Proposed Steps
1. Add status filter dropdown in Publishing tab
2. Filter by: All / Draft Ready / Scheduled / Pushing / Published / Failed
3. Count badges show item counts per status

---

## Database Verification Queries

### Check handoff idempotency
```sql
SELECT pipeline_item_id, COUNT(*) as count 
FROM publishing_items 
GROUP BY pipeline_item_id 
HAVING COUNT(*) > 1;
```
**Expected:** 0 rows (no duplicates)

### Check publishing statuses distribution
```sql
SELECT status, COUNT(*) as count 
FROM publishing_items 
GROUP BY status;
```
**Expected:** Counts match UI display

### Check failed items with errors
```sql
SELECT id, status, attempt_count, last_error 
FROM publishing_items 
WHERE status = 'publish_failed' 
LIMIT 10;
```
**Expected:** Error messages present, attempt_count ≤ 3

---

## Browser Console Checks

### No Errors Expected
- React query cache updates correctly
- No 404s for `/api/publishing-items` endpoints
- No 500 errors on handoff

### Network Tab Verification
1. **POST** `/api/publishing-items/:pipelineItemId/handoff` → 200 OK
2. **GET** `/api/publishing-items?topicId=X` → 200 OK (returns array)
3. **POST** `/api/publishing-items/:id/push` → 200 OK

---

## Acceptance Criteria Checklist

### Handoff Mechanism
- [ ] Handoff button visible only for eligible statuses
- [ ] Handoff is idempotent (no duplicate records)
- [ ] Item disappears from Items tab after handoff
- [ ] Item appears in Publishing tab immediately

### Publishing Tab UI
- [ ] Tab renders between "Items" and "Job History"
- [ ] Shows all publishing items for selected topic
- [ ] Status badges correctly styled
- [ ] Scheduled time displays with countdown
- [ ] Published URL opens in new tab
- [ ] Error messages visible for failed items

### Operational Actions
- [ ] "Push Now" button triggers immediate publishing
- [ ] Retry works for failed items
- [ ] Attempt counter visible and accurate

### Worker Automation
- [ ] Publishing worker runs on schedule
- [ ] Worker updates item statuses correctly
- [ ] Worker respects scheduled times
- [ ] Worker handles failures gracefully

### Data Integrity
- [ ] Unique constraint on pipeline_item_id enforced
- [ ] No orphaned publishing_items (all have valid pipeline_item_id)
- [ ] Timestamps (handedOffAt, scheduledAt, updatedAt) accurate

---

## Known Limitations / Future Work

1. **No batch handoff yet** - Only single-item handoff supported
2. **No status filters in Publishing tab** - All items shown together
3. **No edit scheduled time UI** - Must use API directly
4. **No verify button in UI** - Verification happens automatically
5. **No publishing history log** - Only current status visible

---

## Troubleshooting

### Item not appearing in Publishing tab
- Check browser console for errors
- Verify backend endpoint: `GET /api/publishing-items?topicId=X`
- Check database: `SELECT * FROM publishing_items WHERE pipeline_item_id = '...'`

### Handoff fails with 400 Bad Request
- Item may not be eligible (check status)
- Check server logs for validation errors
- Verify topic_id exists for pipeline item

### Publishing worker not running
- Check server logs for scheduler startup message
- Verify `.env` has `PUBLISHING_WORKER_INTERVAL_MINUTES` set
- Check cron schedule in `server/services/scheduler.ts`

### Push Now button does nothing
- Check network tab for request status
- Verify endpoint returns 200 OK
- Check for mutation errors in React Query devtools

---

**Date:** 2026-02-15  
**Status:** ✅ Ready for full end-to-end testing
