# WordPress Plugin Debug Instructions

**Current Status**: ✅ Plugin pulling jobs successfully (HTTP 200)

**Problem**: Jobs pulled but not published

---

## Step 1: Check WordPress Error Log

The plugin says: **"Check WordPress error_log for detailed debug output"**

### Find the error log:

**Option A: Via WordPress Dashboard**
1. Install "WP Log Viewer" plugin (if not already installed)
2. Go to Tools → Log Viewer
3. Look for recent errors from Content Santa Connector

**Option B: Via File System**
1. Connect via FTP/File Manager
2. Navigate to: `/wp-content/debug.log`
3. Download and check last 100 lines

**Option C: Via cPanel**
1. File Manager → `/public_html/wp-content/`
2. Look for `debug.log`
3. Right-click → View

---

## What to Look For:

Search for these error patterns:

```
[Content Santa]
Error creating post
Failed to upload image
Invalid category
Database error
```

---

## Expected Debug Output:

When a job is pulled and published, you should see:

```
[Content Santa] Processing job: <job_id>
[Content Santa] Title: <article_title>
[Content Santa] Downloading featured image from: <url>
[Content Santa] Image uploaded, attachment ID: <id>
[Content Santa] Post created successfully, ID: <post_id>
[Content Santa] Reporting success to Content Santa server
[Content Santa] Report callback: 200 OK
```

---

## Quick Test:

1. Click **"Run Now (Manual Pull)"** button in plugin settings
2. Wait 10 seconds
3. Check:
   - WordPress Posts page (should have new draft/published post)
   - Server console (should show callback: POST /api/wp/report)
   - Error log for any failures

---

## Most Likely Issues:

### 1. **Category Missing** (50% likely)
- Plugin trying to assign non-existent category
- **Fix**: Check `default_category_id` in publishing target matches actual WordPress category

### 2. **Image Download Failed** (30% likely)
- Featured image URL not accessible
- **Fix**: Check image URLs are valid

### 3. **Permission Issue** (15% likely)
- WordPress user doesn't have permission to create posts
- **Fix**: Ensure WordPress user has `edit_posts` capability

### 4. **Memory/Timeout** (5% likely)
- PHP timeout or memory limit
- **Fix**: Increase `max_execution_time` and `memory_limit`

---

## Next Steps:

1. **Check WordPress error_log** (most important!)
2. **Go to WordPress Posts page** - Any new drafts?
3. **Check server console** - Any callback POST requests?
4. Report back what you find!
