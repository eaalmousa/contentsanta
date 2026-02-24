# WordPress Plugin Not Publishing - Debugging Guide

**Date**: 2026-02-16  
**Issue**: WordPress plugin not pulling jobs from server

---

## Current State

- **24 WP pull jobs** in `queued` status
- **0 jobs** pulled by WordPress
- **0 items** published
- Oldest job created: 4+ hours ago

**Problem**: WordPress plugin is not calling `/api/wp/pull`

---

## Verification Steps

### Step 1: Check Plugin is Installed & Active

1. Go to WordPress admin: https://gulfestategazette.com/wp-admin/plugins.php
2. Search for "Content Santa Connector"
3. Verify:
   - [ ] Plugin is **Active** (not just installed)
   - [ ] Version shows **0.8.1** or newer
   - [ ] No errors showing

### Step 2: Check Plugin Settings

1. Go to Settings → Content Santa Connector
2. Verify configuration:
   - **API URL**: Should be your ngrok URL (e.g., `https://xxxx.ngrok.io`)
   - **Site ID**: Should match database
   - **Secret**: Should be filled (32+ characters)
   - **Status**: Should show "Connected" or similar

### Step 3: Test Connection Manually

In WordPress plugin settings page, click:
- **"Test Connection"** button
- **"Pull Jobs Now"** button

**Expected**: Should show "Success" or job count  
**If Error**: Note the exact error message

### Step 4: Check WordPress Cron

WordPress cron might be disabled. In `wp-config.php`, check:

```php
// Should NOT have this (or should be false):
define('DISABLE_WP_CRON', true); // ❌ BAD
```

If cron is disabled, the plugin can't run automatically.

### Step 5: Check Server Logs

On Content Santa server console, look for:

```
[WP Pull] Authenticated successfully for siteId=...
GET /api/wp/pull 204
```

**If you see these**: WordPress is calling but getting empty queue (weird)  
**If you DON'T see these**: WordPress is not calling at all

---

## Manual Test from Command Line

### Test if WordPress can reach the server:

**From your computer** (not WordPress server):

```powershell
# Get your ngrok URL from environment
$url = $env:NGROK_URL  # or hardcode it

# Get Site ID and Secret from WordPress plugin settings
$siteId = "cs_site_948CC696C5B70A71"  # From plugin
$secret = "your_secret_here"  # From plugin

# Test pull endpoint
curl "$url/api/wp/pull" `
  -H "X-ContentSanta-SiteId: $siteId" `
  -H "X-ContentSanta-Secret: $secret" `
  -H "User-Agent: ContentSanta-WP/0.8.1"
```

**Expected Response**:
- HTTP 200 with job data (if jobs exist)
- HTTP 204 if no jobs
- HTTP 401 if auth failed

---

## Most Likely Causes

### 1. **Plugin Not Active** (80% likely)
- Solution: Activate plugin from WordPress admin

### 2. **Wrong API URL** (15% likely)
- Plugin still has old URL (localhost:5000 or old ngrok)
- Solution: Update API URL in plugin settings to current ngrok URL

### 3. **Wrong Secret** (5% likely)
- Plugin secret doesn't match database
- Solution: Regenerate secret OR update plugin with correct secret

---

## Quick Fix Actions

### Option A: Manual Pull (Immediate Test)

1. WordPress Admin → Settings → Content Santa Connector
2. Click **"Pull Jobs Now"** button
3. Should publish 10 articles immediately

### Option B: Wait for Cron (If Active)

- Plugin runs every 5 minutes
- Next run should publish articles
- Check in 5 minutes

### Option C: Force Server-Side Pull

**Create a test endpoint to force WordPress to pull**:

```typescript
// In server/routes.ts (temporary debug endpoint)
app.get("/api/debug/force-pull", async (req, res) => {
  const jobs = await storage.getWpPullJobsForSite("cs_site_948CC696C5B70A71", 5);
  res.json({
    jobCount: jobs.length,
    jobs: jobs.map(j => ({ id: j.id, title: j.title }))
  });
});
```

Then visit: `http://localhost:5000/api/debug/force-pull`

---

## What to Do Now

1. **Check WordPress plugin is active**
2. **Verify API URL matches ngrok**
3. **Click "Pull Jobs Now" in plugin settings**
4. **Watch server console for pull requests**
5. **Report back exact error if any**

---

## After WordPress Pulls Successfully

Once jobs are pulled and published:

- Items will change status: `queued` → `published`
- Pipeline Published tab will show articles
- Each article will have WordPress link

**Then refresh browser and Published tab will populate!** ✅
