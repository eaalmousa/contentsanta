# Publishing System Hardening - Test Plan

## Overview
This document describes the comprehensive fixes applied to the WordPress publishing system to ensure clean, deduped, categorized, English-only (for configured sites) content with featured images.

## Phase 1: Schema Updates

### New Fields Added

#### publishing_targets table:
- `content_site_id` (VARCHAR 36): Links target to a content site (sites table)
- `require_featured_image` (BOOLEAN): Whether featured image is required
- `language_mode` (TEXT): Language policy ("any", "english_only", etc.)
- `allowed_languages` (TEXT[]): Array of allowed language codes

#### pipeline_items table:
- `story_hash` (TEXT): Stable hash for idempotency (canonical_url + normalized_title)
- `canonical_source_url` (TEXT): Source URL for the story
- `featured_image_url` (TEXT): URL of the featured image
- `featured_image_media_id` (TEXT): WordPress media ID after upload

### New Constraints:
- Unique constraint on `(target_id, story_hash)` - prevents duplicate publishing
- Index on `story_hash` for fast lookups
- FK constraint `content_site_id` → `sites(id)` ON DELETE RESTRICT

### New Quarantine Reasons:
- `missing_featured_image` - Added to existing reasons

## Phase 2: Content Sanitizer Service

**File:** `server/services/content-sanitizer.ts`

### Features:
1. **Title Cleanup:**
   - Removes "– Seo Blog", "– SEO Blog" suffixes
   - Removes repeated separators
   - Normalizes whitespace
   - Strips leading/trailing punctuation

2. **Body Sanitization:**
   - Extracts and removes "Meta Description:" blocks
   - Extracts and removes "Relevant Keywords:" sections
   - Converts Markdown to clean HTML
   - Downgrades H1 to H2 (WordPress best practice)
   - Removes standalone separator lines (`---`)
   - Removes empty formatting artifacts

3. **Language Detection:**
   - Computes Arabic character ratio (Unicode ranges 0x0600-0x06FF, etc.)
   - Configurable threshold (default: 3-5%)
   - Returns detailed detection results

4. **Story Hash Generation:**
   - Stable hash based on canonical URL + normalized title
   - Used for idempotency checks

## Phase 3: Featured Image Service

**File:** `server/services/featured-image-service.ts`

### Features:
1. **Image Extraction:**
   - Extracts from story_items (primary source)
   - Falls back to OpenGraph meta tags
   - Falls back to Twitter card meta tags
   - Falls back to first `<img>` tag in content

2. **WordPress Upload:**
   - Downloads image securely (validates URL, MIME type)
   - Uploads to WordPress media library via REST API
   - Sets title and alt text
   - Returns media ID for featured_media field

3. **Validation:**
   - Checks for valid image extensions (.jpg, .jpeg, .png, .gif, .webp, .svg)
   - HTTPS-only URLs
   - Safe filename generation

## Phase 4: Enhanced WordPress Publisher

**File:** `server/services/enhanced-publisher.ts`

### Publishing Flow (Step-by-Step):

#### Step 1: Check Already Published
- If `targetPostId` exists for this target, skip (already done)

#### Step 2: Generate Story Hash
- Create stable hash from canonical URL + title
- Check if another pipeline item with same hash already published to this target
- If duplicate found → mark as "skipped" with reason "duplicate"

#### Step 3: Language Detection
- Extract allowed_languages from target
- Compute Arabic ratio in title + body
- If threshold exceeded (>3%) → quarantine with reason "language_mismatch"

#### Step 4: Sanitize Content
- Clean title (remove "SEO Blog", etc.)
- Extract meta description (store separately, not in body)
- Extract keywords (store separately)
- Convert Markdown → HTML
- Remove formatting artifacts

#### Step 5: Extract/Upload Featured Image
- Call `featuredImageService.extractImageFromStory()`
- If image found:
  - Upload to WordPress media library
  - Get media ID
- If `requireFeaturedImage=true` and no image → quarantine with reason "missing_featured_image"

#### Step 6: Prepare WordPress Post Data
- Set title, content, excerpt
- Add `meta` fields:
  - `content_santa_story_hash` (for future idempotency checks)
  - `content_santa_source_url`
  - `content_santa_pipeline_item_id`
- Set `featured_media` if available
- Resolve category/tag IDs from taxonomy cache

#### Step 7: Search for Existing WP Post
- Query WordPress API for posts with matching `content_santa_story_hash` meta
- If found → UPDATE instead of CREATE

#### Step 8: Create or Update WP Post
- If existing → `POST /wp-json/wp/v2/posts/{id}` (update)
- If new → `POST /wp-json/wp/v2/posts` (create)
- Get post ID and permalink

#### Step 9: Update Pipeline Item
- Set status = "published"
- Store `targetPostId`, `targetPermalink`
- Store `storyHash`, `canonicalSourceUrl`
- Store `featuredImageUrl`, `featuredImageMediaId`
- Set `publishedAt` timestamp

### Error Handling:
- All errors → quarantine with reason "publish_failed"
- Increment `publishAttempts` counter
- Store error message and payload

## Phase 5: Integration with Pipeline

**File:** `server/services/pipeline-jobs-service.ts`

### Changes:
- Imported `enhancedPublisher`
- Replaced direct `publishToWordPress()` call with `enhancedPublisher.publishPipelineItem()`
- Added handling for `quarantineReason` in result
- Preserved wp_pull flow (unchanged)

## Phase 6: API Updates

**File:** `server/routes.ts`

### Publishing Targets API:
- `GET /api/publishing-targets?siteId=<id>` - Now supports filtering by site
- Returns only targets for specified site when query param provided

## Migration

**File:** `db/migrations/add-publishing-safeguards.ts`

### Migration Steps:
1. Add `content_site_id` to publishing_targets
2. Add `require_featured_image`, `language_mode`, `allowed_languages` to publishing_targets
3. Add `story_hash`, `canonical_source_url`, `featured_image_url`, `featured_image_media_id` to pipeline_items
4. Create indexes
5. Add unique constraint for idempotency
6. Add FK constraints
7. Backfill `story_hash` for existing items

## Test Plan

### Test 1: Idempotency (Duplicate Prevention)
**Objective:** Verify same story never creates multiple WP posts

**Steps:**
1. Create a topic with a publishing target
2. Run pipeline to publish an item (Item A)
3. Verify Item A is published successfully
4. Manually re-run publish job or duplicate the pipeline item
5. Verify:
   - Second attempt detects existing `story_hash`
   - Item is skipped with reason "duplicate"
   - No second WP post created

**Expected Result:** Only ONE post exists in WordPress. Second attempt marked as "skipped".

### Test 2: Language Detection (Arabic Content)
**Objective:** Verify Arabic content is quarantined for English-only sites

**Setup:**
- Set publishing target `language_mode` = "english_only"
- Set `allowed_languages` = ["en"]

**Steps:**
1. Create a story with >5% Arabic content in title or body
2. Run pipeline
3. Check pipeline_item status

**Expected Result:**
- Status = "quarantined"
- `quarantine_reason` = "language_mismatch"
- `last_error_message` contains "Arabic content detected: X%"
- No WP post created

### Test 3: Clean English Content
**Objective:** Verify normal English content publishes cleanly

**Steps:**
1. Create a story with:
   - English title containing "– Seo Blog"
   - Body containing "**Meta Description:** ..."
   - Body containing "**Relevant Keywords:** ..."
   - Markdown formatting (##, ###, **)
2. Publish to WordPress

**Verification:**
Check WordPress post:
- ✅ Title does NOT contain "Seo Blog"
- ✅ Body does NOT contain "Meta Description:" label
- ✅ Body does NOT contain "Relevant Keywords:" section
- ✅ Markdown converted to proper HTML (`<h2>`, `<strong>`, etc.)
- ✅ Excerpt is populated (not in body)
- ✅ Featured image is set
- ✅ Category is set correctly
- ✅ Post meta includes `content_santa_story_hash`

### Test 4: Featured Image Requirement
**Objective:** Verify posts quarantined when image required but missing

**Setup:**
- Set publishing target `require_featured_image` = true

**Steps:**
1. Create a story with no images in source_items
2. Run pipeline

**Expected Result:**
- Status = "quarantined"
- `quarantine_reason` = "missing_featured_image"
- No WP post created

### Test 5: Featured Image Success
**Objective:** Verify images extracted and uploaded

**Steps:**
1. Create a story with an image in source_item
2. Run pipeline
3. Verify:
   - Image uploaded to WP media library
   - `featured_image_media_id` populated in pipeline_item
   - WordPress post has featured image set

**Expected Result:**
- `featured_image_url` and `featured_image_media_id` populated
- WordPress post displays featured image

### Test 6: Update Instead of Duplicate
**Objective:** Verify existing posts are updated, not duplicated

**Steps:**
1. Publish Item A to WordPress (creates Post X)
2. Edit Item A's generated content
3. Re-publish Item A
4. Verify:
   - System finds existing post via `story_hash` meta
   - Post X is updated (not Post Y created)
   - `targetPostId` remains same

**Expected Result:** Only ONE post in WordPress, content updated.

### Test 7: Category Mapping
**Objective:** Verify topics map to correct WP categories

**Setup:**
- Sync WordPress categories to taxonomy cache
- Set topic `generated_category` to match a WP category

**Steps:**
1. Publish item
2. Check WordPress post categories

**Expected Result:** Post appears under correct category (e.g., "Real Estate News").

## Configuration Guide

### For Gulf Estate Gazette (English-Only + Featured Image Required)

1. **Publishing Target Configuration:**
```json
{
  "name": "Gulf Estate Gazette",
  "type": "wordpress",
  "content_site_id": "<site_id>",
  "require_featured_image": true,
  "language_mode": "english_only",
  "allowed_languages": ["en"],
  "configJson": {
    "siteUrl": "https://gulfestategazette.com",
    "username": "admin",
    "appPassword": "xxxx xxxx xxxx xxxx"
  }
}
```

2. **Topic Configuration:**
- Set `publishingTargetId` to the target above
- Enable automation mode = "auto"
- Set daily cap, quiet hours, etc.

3. **Sync Categories:**
- Run POST `/api/publishing-targets/:id/sync-categories`
- This caches WP categories for fast lookups

## Monitoring

### Key Metrics:
- **Quarantine Rate:** Items in "quarantined" status
- **Quarantine Reasons:** Distribution of language_mismatch, missing_featured_image, etc.
- **Duplicate Prevention:** Count of items skipped due to "duplicate"
- **Publish Success Rate:** published / (published + quarantined + failed)

### Logs to Watch:
```
[pub-*] Starting enhanced WordPress publish
[pub-*] Step 1: Check if already published
[pub-*] Step 2: Generate story hash for idempotency
[pub-*] Step 3: Language detection
[pub-*] Step 4: Sanitize content
[pub-*] Step 5: Extract/upload featured image
[pub-*] Step 7: Search for existing WP post by meta
[pub-*] ✅ Publish complete: <permalink>
```

### Quarantine Dashboard:
Query pipeline_items:
```sql
SELECT 
  quarantine_reason,
  COUNT(*) as count,
  last_error_message
FROM pipeline_items
WHERE status = 'quarantined'
GROUP BY quarantine_reason, last_error_message
ORDER BY count DESC;
```

## Rollback Plan

If issues arise:

1. **Disable Enhanced Publisher:**
   - Revert `server/services/pipeline-jobs-service.ts` to use old `publishToWordPress()`
   - Comment out import of `enhancedPublisher`

2. **Relax Constraints:**
   - Set `require_featured_image` = false
   - Set `allowed_languages` = [] (allow all languages)

3. **Database Rollback:**
   - New fields can be left as NULL (safe)
   - Unique constraint can be dropped:
     ```sql
     ALTER TABLE pipeline_items
     DROP CONSTRAINT IF EXISTS pipeline_item_target_hash_unique;
     ```

## Summary of Files Changed

### New Files:
- `db/migrations/add-publishing-safeguards.ts` - Migration
- `server/services/content-sanitizer.ts` - Content cleaning
- `server/services/featured-image-service.ts` - Image extraction/upload
- `server/services/enhanced-publisher.ts` - Orchestration

### Modified Files:
- `shared/schema.ts` - Schema definitions
- `server/services/pipeline-jobs-service.ts` - Integration
- `server/routes.ts` - API site filtering
- `server/storage.ts` - Schema export

### Dependencies:
- No new npm packages required
- Uses existing markdown conversion and HTML parsing
- All services use native Node.js APIs

## Production Checklist

- [ ] Run migration: `npx tsx db/migrations/add-publishing-safeguards.ts`
- [ ] Verify schema: Check `pipeline_items.story_hash` exists
- [ ] Configure targets: Set `require_featured_image`, `language_mode`, `allowed_languages`
- [ ] Sync categories: POST `/api/publishing-targets/:id/sync-categories`
- [ ] Test publish flow: Manually trigger one publish job
- [ ] Monitor logs: Watch for `[pub-*]` messages
- [ ] Check quarantine: Query `status='quarantined'` items
- [ ] Verify WordPress: Check posts for clean content, images, categories

## Conclusion

This implementation provides **production-grade safeguards** to ensure:
1. ✅ No duplicate posts (idempotency via story_hash)
2. ✅ No Arabic content on English-only sites (language detection)
3. ✅ Clean content (no "Meta Description", "Relevant Keywords", or markdown artifacts)
4. ✅ Clean titles (no "SEO Blog" suffixes)
5. ✅ Featured images always present (or quarantined)
6. ✅ Proper categorization (via synced taxonomy cache)
7. ✅ Graceful error handling (quarantine instead of silent failure)
8. ✅ Full auditability (publish_attempts, error logs, metadata)

The system is now **fail-safe**: bad content cannot sneak through to production.
