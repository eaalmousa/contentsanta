# WordPress Cron Not Running - Solutions

**Date**: 2026-02-16  
**Issue**: Manual pull works, but automatic pulls don't happen  
**Root Cause**: WordPress pseudo-cron not triggering  
**Status**: 🔴 **NEEDS FIX**

---

## Evidence

✅ **Manual pull works** (button click triggers pull successfully)  
❌ **Automatic pulls don't work** (cron not triggering every 3 minutes)  
✅ **Server is reachable** (ngrok URL works)  
✅ **Credentials correct** (authentication succeeds)

**Conclusion**: WordPress cron system is not running scheduled tasks!

---

## Why WordPress Cron Fails

### WordPress "Cron" is Not Real Cron

WordPress uses a **pseudo-cron** system that relies on:
1. **Site visitors** - Someone must visit your site to trigger cron
2. **No caching** - Cached pages bypass PHP, so cron doesn't run
3. **No blocking** - Security plugins/firewalls can block cron

### Common Blockers on Your Site

Based on your WordPress setup (from system info):
1. ✅ **SiteGround Optimizer** - Aggressive caching can block cron
2. ✅ **WP-Optimize** - Caching plugin that may skip cron execution
3. ✅ **Speed Optimizer** - Another caching layer
4. ✅ **Low traffic** - If no visitors, cron never triggers

---

## Solution: Enable Real Server Cron

### Option A: SiteGround Cron Job (Recommended)

SiteGround provides **real server cron** in cPanel. Set it up:

#### Step 1: Disable WordPress Cron

**Edit**: `/wp-config.php` (via FTP or File Manager)

**Add BEFORE** `/* That's all, stop editing! */`:
```php
define('DISABLE_WP_CRON', true);
```

**Save the file**

#### Step 2: Create SiteGround Cron Job

1. **Login to**: SiteGround cPanel
2. **Go to**: Advanced → Cron Jobs
3. **Add New Cron Job**:

**Type**: `Command`

**Command**:
```bash
wget -q -O - https://gulfestategazette.com/wp-cron.php?doing_wp_cron >/dev/null 2>&1
```

OR if wget doesn't work:
```bash
curl -s https://gulfestategazette.com/wp-cron.php?doing_wp_cron >/dev/null 2>&1
```

**Schedule**: Every **3 minutes**  
- Minute: `*/3`
- Hour: `*`
- Day: `*`
- Month: `*`
- Weekday: `*`

4. **Click**: Add Cron Job

#### Step 3: Verify

Wait 3 minutes, then check:
- WordPress Admin → Settings → Content Santa Connector → "Last Pull" timestamp should update
- Check `/wp-content/debug.log` for new pull attempts
- Check database: jobs should start getting leased

---

## Solution: Alternative Methods

### Option B: WP-Cron Control Plugin

If you can't access cPanel:

1. **Install**: WP-Cron Control plugin (or similar)
2. **Configure**: External cron trigger URL
3. **Use**: Your own cron service (e.g., cron-job.org) to ping the URL every 3 minutes

### Option C: Temporary Workaround

**For testing NOW** (not permanent):

1. Keep a browser tab open to your WordPress admin
2. Refresh it every few minutes
3. This triggers WordPress cron

**OR**

Run this PowerShell loop to trigger cron every 3 minutes:
```powershell
while ($true) {
    Invoke-WebRequest -Uri "https://gulfestategazette.com/wp-cron.php?doing_wp_cron" -UseBasicParsing | Out-Null
    Write-Host "$(Get-Date -Format 'HH:mm:ss') - WP Cron triggered"
    Start-Sleep -Seconds 180
}
```

Press Ctrl+C to stop.

---

## Verification Commands

### Check if Jobs Are Being Pulled

**Run every few minutes to see progress**:

```powershell
npx tsx --env-file=.env -e "
import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  const jobs = await db.execute(sql\`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'queued') as queued,
      COUNT(*) FILTER (WHERE status = 'leased') as leased,
      COUNT(*) FILTER (WHERE status = 'completed') as completed
    FROM wp_pull_jobs
  \`);
  
  const j = jobs.rows[0] as any;
  console.log('WP Pull Jobs:');
  console.log(\`  Queued: \${j.queued}\`);
  console.log(\`  Leased: \${j.leased}\`);
  console.log(\`  Completed: \${j.completed}\`);
  
  process.exit(0);
})();
"
```

**Expected after cron fix**:
- Queued count decreases
- Leased/Completed count increases

### Check Pipeline Items

```powershell
npx tsx --env-file=.env -e "
import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  const items = await db.execute(sql\`
    SELECT status, COUNT(*) as count 
    FROM pipeline_items 
    WHERE status IN ('publishing', 'retrying', 'published')
    GROUP BY status
  \`);
  
  console.log('Pipeline Items:');
  for (const row of items.rows) {
    const r = row as any;
    console.log(\`  \${r.status}: \${r.count}\`);
  }
  
  process.exit(0);
})();
"
```

**Expected after cron fix**:
- `publishing` and `retrying` decrease
- `published` increases

---

## Quick Test: Force Pull Now

**To test without waiting**, click "Run Now (Manual Pull)" in WordPress plugin settings.

Then check:
1. New post appears in WordPress? ✅
2. Debug log shows success? ✅
3. Database job moves from `queued` → `completed`? ✅

---

## Summary

### Current Situation
- ✅ Server running (port 5000)
- ✅ ngrok working (https://inert-nonblamefully-dillon.ngrok-free.dev)
- ✅ WordPress plugin configured correctly
- ✅ Manual pull works
- ❌ **Automatic cron not running**

### Fix Required
Enable real server cron (Option A recommended) because:
- ❌ WordPress pseudo-cron unreliable
- ❌ Multiple caching plugins interfere
- ❌ Low traffic means no cron triggers
- ✅ SiteGround provides real cron in cPanel

### After Fix
- ✅ Jobs pulled automatically every 3 minutes
- ✅ Items move: publishing → published
- ✅ WordPress posts created automatically
- ✅ No more "stuck in publishing" errors

---

**Next Step**: 
1. Add real cron job in SiteGround cPanel (Option A)
2. OR run PowerShell loop temporarily (Option C)
3. Verify jobs start flowing in 3 minutes

Let me know which option you choose and I'll help verify it works!
