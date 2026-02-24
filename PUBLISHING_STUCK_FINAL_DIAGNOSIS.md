# WordPress Plugin NOT Pulling Jobs - Diagnostic Guide

**Date**: 2026-02-16  
**Issue**: 24 jobs queued but WordPress never pulls them  
**Status**: 🔍 **INVESTIGATING**

---

## Problem Evidence

Database shows:
- ✅ 24 WP pull jobs created (hours ago)
- ❌ ALL have `lease_token: null` (never pulled by WordPress)
- ❌ ALL have `result_wp_post_id: null` (no posts created)
- ❌ 5 pipeline items stuck in "publishing" status
- ❌ 0 published items in database

**Root Cause**: WordPress plugin is NOT calling `GET /api/wp/pull` at all!

---

## Why WordPress Cron Might Not Run

WordPress uses a pseudo-cron system that requires site visits to trigger. If your site has low traffic or caching blocks cron execution, scheduled tasks won't run.

### Common Causes:

1. **No Site Visitors** → WP cron never triggers
2. **Aggressive Caching** → Cron requests blocked by cache layer (SiteGround Optimizer, WP-Optimize, etc.)
3. **WP Cron Disabled** → `DISABLE_WP_CRON` set to `true` in `wp-config.php`
4. **Plugin Settings Wrong** → Wrong API URL, Site ID, or Secret

---

## Immediate Checks Required

### 1. Verify Plugin Settings (WordPress Admin)

**Go to**: WordPress Admin → Settings → Content Santa Connector

**Check these fields EXACTLY match**:

```
Base URL: [FROM SERVER CONFIG - see below]
Site ID:  [FROM SERVER CONFIG - see below]
Secret:   [FROM SERVER CONFIG - see below]
Interval: 3 minutes
```

**Server Configuration (from database)**:
```
[SEE OUTPUT ABOVE FROM check-wp-connector-config.ts]
```

### 2. Check if WP Cron is Running

**Method A: Check WordPress Admin**
1. Go to: WordPress Admin → Tools → Site Health → Info
2. Find "WordPress Constants" section
3. Look for `DISABLE_WP_CRON`: Should be `false` (or not present)

**Method B: Check wp-config.php**
1. Open `/home/customer/www/gulfestategazette.com/public_html/wp-config.php`
2. Search for `DISABLE_WP_CRON`
3. If found, make sure it's set to `false`: `define('DISABLE_WP_CRON', false);`
4. If not found, that's fine (default is enabled)

### 3. Manually Trigger Plugin Pull

**In WordPress Admin**:
1. Go to: Settings → Content Santa Connector
2. Click **"Run Now (Manual Pull)"** button
3. Watch for success/error message
4. Check server logs for pull request

### 4. Check for Cron Conflicts

**Common caching plugins that block cron**:
- SiteGround Optimizer (you have this installed!)
- WP-Optimize (you have this installed!)
- Speed Optimizer (you have this installed!)

**Action**: Temporarily disable these plugins, trigger manual pull, then re-enable.

---

## Solutions

### Solution A: Enable Real Cron (Recommended for SiteGround)

**SiteGround provides real server cron**. Set it up:

1. **Disable WordPress Cron** (in `wp-config.php`):
   ```php
   define('DISABLE_WP_CRON', true);
   ```

2. **Set up server cron job** (in SiteGround cPanel → Cron Jobs):
   ```
   */3 * * * * wget -q -O - https://gulfestategazette.com/wp-cron.php?doing_wp_cron >/dev/null 2>&1
   ```
   OR
   ```
   */3 * * * * curl -s https://gulfestategazette.com/wp-cron.php?doing_wp_cron >/dev/null 2>&1
   ```

   This runs every 3 minutes regardless of site traffic.

3. **Restart WordPress** (clear all caches)

### Solution B: Use Manual Pull for Now

Until cron is fixed, use the **"Run Now (Manual Pull)"** button in plugin settings every few minutes to test.

### Solution C: Check API Connectivity from WordPress

Create a test file `/wp-content/test-cs-api.php`:

```php
<?php
require_once('../../../wp-load.php');

$settings = get_option('content_santa_connector_settings');
$url = rtrim($settings['base_url'], '/') . '/api/wp/pull';
$site_id = $settings['site_id'];
$secret = $settings['secret'];

$response = wp_remote_get($url, [
  'headers' => [
    'X-WordPress-Site-ID' => $site_id,
    'X-CS-Secret' => $secret,
    'User-Agent' => 'ContentSantaConnector/0.8.2'
  ],
  'timeout' => 15
]);

echo '<pre>';
echo "Testing API connectivity:\n\n";
echo "URL: $url\n";
echo "Site ID: $site_id\n";
echo "Secret (first 8): " . substr($secret, 0, 8) . "...\n\n";

if (is_wp_error($response)) {
  echo "ERROR: " . $response->get_error_message() . "\n";
} else {
  echo "HTTP Status: " . wp_remote_retrieve_response_code($response) . "\n";
  echo "Response:\n" . wp_remote_retrieve_body($response) . "\n";
}
echo '</pre>';
?>
```

**Then visit**: `https://gulfestategazette.com/wp-content/test-cs-api.php`

**Expected**: HTTP 200 + job JSON OR "no jobs available"  
**If Error**: Firewall/network issue blocking outbound requests

---

## Debug Logs

### Enable WordPress Debug Logging

Edit `wp-config.php`:
```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
define('WP_DEBUG_DISPLAY', false);
```

Then trigger manual pull and check `/wp-content/debug.log` for errors containing "Content Santa".

---

## Next Steps

1. ✅ **Check plugin settings** match server config (see output above)
2. ✅ **Click "Run Now (Manual Pull)"** button in plugin settings
3. ✅ **Check if WP cron is enabled** (Site Health or wp-config.php)
4. ⏳ **Enable real server cron** if on SiteGround (recommended)
5. ⏳ **Test API connectivity** using test-cs-api.php file
6. ⏳ **Enable debug logging** to see actual errors

---

## Verification

After applying fixes:
1. Trigger manual pull
2. Check server console for GET requests to `/api/wp/pull`
3. Check database: `npx tsx --env-file=.env check-publishing-status.ts`
4. Look for jobs with non-null `lease_token` (means pulled successfully)

---

**Status**: Waiting for user to check plugin settings and trigger manual pull
