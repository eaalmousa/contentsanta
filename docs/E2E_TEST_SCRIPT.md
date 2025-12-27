# End-to-End Test Script: RSS to WordPress with Featured Images

This document provides a step-by-step verification script for testing the complete flow:
RSS fetch → Image assets created → Smart Editor shows image → Publish → WordPress featured image.

## Prerequisites

1. At least one RSS source configured in Sources page
2. A WordPress publishing target configured with valid credentials
3. Access to the Admin Dashboard (Diagnostics tab)

## Test Steps

### Step 1: Fetch RSS Sources

1. Navigate to **Sources** page (`/sources`)
2. Click the **Fetch All** button (or individual source fetch button)
3. Wait for fetch to complete
4. Verify new source items appear in the list

**Expected Result:** Source items are fetched and stored. Check logs for:
```
[RSS:xxx] insertedCount: N
```

### Step 2: Verify Image Assets Created

1. Navigate to **Admin Dashboard** (`/admin`)
2. Click the **Diagnostics** tab
3. Select a story from the Stories Overview list
4. In the Story Details panel, verify:
   - **Summary** shows total sources and images
   - **Primary** indicator shows "Yes" if images exist
   - **Image Assets** section shows extracted images with:
     - `isPrimary: true` for exactly one image
     - `originType: source` for RSS-extracted images
     - `sourceTier` matches the source's tier (tier_1, tier_2, tier_3)

**Expected Result:** Each story with images has:
- At least one image asset in `image_assets` table
- Exactly one image marked as `isPrimary: true`
- Source tier correctly propagated from source configuration

### Step 3: Verify Smart Editor Shows Image

1. Navigate to **Inbox** page (`/inbox`)
2. Click on a story that has images (shown in diagnostics)
3. In the Smart Editor, verify:
   - Featured image appears in the preview section
   - Image is loaded from `originalUrl` field
   - Source attribution shows correct domain name (not "Unknown Source")

**Expected Result:** 
- Image displays correctly in Smart Editor
- No "Unknown Source" text appears
- Sources show proper names (either from source.name or derived from URL domain)

### Step 4: Publish to WordPress

1. In Smart Editor, generate content using the AI workflow
2. Click **Publish** button
3. Select WordPress target from dropdown
4. Click **Publish Now**

**Expected Result:**
- Post is created on WordPress
- Success toast shows post URL

### Step 5: Verify WordPress Featured Image

1. Open the WordPress admin dashboard
2. Navigate to Posts → All Posts
3. Find the newly published post
4. Click to edit the post
5. In the right sidebar, check **Featured Image** section

**Expected Result:**
- Featured image is set on the post
- Image matches the primary image from image_assets

### Fallback Scenario: Image Upload Failure

If the featured image upload fails (network issue, SSRF block, MIME mismatch):

1. Post is still published successfully
2. Console logs show warning:
   ```
   [WordPress] Featured image upload failed: [error reason]
   ```
3. Publish result includes:
   - `success: true` (post was published)
   - `featuredImageFailed: true`
   - `featuredImageError: "[reason]"`
   - `warnings: ["Featured image upload failed: [reason]"]`

The post will be published without a featured image, but the failure is logged for debugging.

## Admin Diagnostics API Reference

### List Stories with Image Info
```
GET /api/admin/diagnostics/stories
```

Response:
```json
[
  {
    "id": "story-uuid",
    "canonicalTitle": "Story Title",
    "sourceCount": 3,
    "dateBucket": "2025-12-27",
    "imageCount": 2,
    "hasPrimaryImage": true,
    "primaryImageUrl": "https://example.com/image.jpg",
    "createdAt": "2025-12-27T12:00:00Z"
  }
]
```

### Get Story Diagnostic Details
```
GET /api/admin/diagnostics/story/:storyId
```

Response:
```json
{
  "story": {
    "id": "story-uuid",
    "canonicalTitle": "Story Title",
    "sourceCount": 3,
    "dateBucket": "2025-12-27",
    "createdAt": "2025-12-27T12:00:00Z"
  },
  "linkedSourceItems": [
    {
      "id": "source-item-uuid",
      "title": "Article Title",
      "url": "https://example.com/article",
      "publishedAt": "2025-12-27T10:00:00Z",
      "sourceName": "example.com",
      "sourceId": "source-uuid",
      "mediaTier": "tier_1",
      "hasImages": true,
      "imageCount": 1
    }
  ],
  "imageAssets": [
    {
      "id": "image-asset-uuid",
      "originType": "source",
      "originalUrl": "https://example.com/image.jpg",
      "isPrimary": true,
      "sourceTier": "tier_1",
      "sourceItemId": "source-item-uuid",
      "createdAt": "2025-12-27T12:00:00Z"
    }
  ],
  "primaryImageId": "image-asset-uuid",
  "primaryImageUrl": "https://example.com/image.jpg",
  "summary": {
    "totalSources": 3,
    "totalImages": 2,
    "hasPrimaryImage": true
  }
}
```

## Troubleshooting

### Images not appearing in stories

1. Check if RSS feed includes `media:thumbnail`, `media:content`, or `enclosure` tags
2. Verify images are extracted by checking source item's `metadataJson.images` array
3. Ensure story clustering is running (triggered on source fetch)
4. Check Admin Diagnostics to see if image_assets were created

### Primary image not selected

1. Go to Admin Diagnostics → select the story
2. Check if any image has `isPrimary: true`
3. If no primary, the `selectPrimaryImage` function may not have run
4. Re-cluster by triggering a new source fetch

### Unknown Source still appearing

1. Check if the source has a name configured
2. If source.name is empty, system derives from URL domain
3. Ensure URL is valid and parseable

### WordPress featured image not appearing

1. Check console logs for upload errors
2. Verify image URL is HTTPS (HTTP is blocked)
3. Ensure image URL is not from a private IP range
4. Verify MIME type is image/jpeg, image/png, image/gif, or image/webp
