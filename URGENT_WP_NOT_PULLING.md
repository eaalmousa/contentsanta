# URGENT: WordPress Plugin NOT Pulling Jobs

**Date**: 2026-02-16  
**Time**: 11:42 PM  
**Status**: 🔴 **CRITICAL - WORDPRESS NOT PULLING**

---

## Evidence

### Database Shows:
- ✅ **10 WP jobs created** (9:33 PM - 11:15 PM)
- ❌ **ALL in `queued` status** (never leased)
- ❌ **NO lease_token** (WordPress never pulled them)
- ❌ **NO result_wp_post_id** (no posts created)

### Pipeline Items:
- **2 items** stuck in `publishing`
- **6 items** in `retrying`
- **172 items** waiting in `ranked`
- **Reaper** continuously resetting stuck items

---

## Root Cause

**WordPress plugin is NOT calling** `GET /api/wp/pull`!

Possible reasons:
1. **WordPress cron not running** (no site traffic)
2. **Plugin settings wrong** (URL/Site ID/Secret)
3. **ngrok URL changed** (plugin has old URL)
4. **Plugin disabled/crashed**

---

## IMMEDIATE ACTION REQUIRED

### Step 1: Verify ngrok URL

**Check current ngrok URL**:
```powershell
# If ngrok is running, get the URL
curl http://localhost:4040/api/tunnels 2>$null | ConvertFrom-Json | Select-Object -ExpandProperty tunnels | Select-Object public_url
```

**Or start ngrok**:
```powershell
ngrok http 5000
```

### Step 2: Check WordPress Plugin Settings

**Go to**: WordPress Admin → Settings → Content Santa Connector

**MUST MATCH EXACTLY**:
```
Content Santa Base URL:  https://[YOUR-NGROK-URL]
Site ID:                 cs_site_948CC696C5B70A71
Secret Key:              cs_sec_bBH5KhmyT_Tmgpy5EwTrGWzE0WQzpRFpZHmWKnogOtg
Poll Interval (minutes): 3
```

### Step 3: Trigger Manual Pull

**In WordPress Admin**:
1. Go to: Settings → Content Santa Connector
2. Click: **"Run Now (Manual Pull)"** button
3. **Watch for**:
   - Success message OR error message
   - New post appearing in WordPress

### Step 4: Check Debug Logs

**Open**: `/wp-content/debug.log` (via FTP/cPanel)

**Look for**:
```
[Content Santa] DEBUG: Pull URL=https://...
[Content Santa] DEBUG: Response code=200
[Content Santa] [<job-id>] JOB RECEIVED
```

**If you see errors**:
- **401 Unauthorized** → Secret mismatch
- **Connection timeout** → ngrok URL wrong
- **No logs at all** → WordPress cron not running

---

## Quick Fix: Manual Test Pull

**Run this to simulate WordPress pulling a job**:

```powershell
$headers = @{
    "X-ContentSanta-Secret" = "cs_sec_bBH5KhmyT_Tmgpy5EwTrGWzE0WQzpRFpZHmWKnogOtg"
    "User-Agent" = "ContentSantaConnector/0.8.3"
}

$response = Invoke-RestMethod -Uri "https://[YOUR-NGROK-URL]/api/wp/pull" -Method GET -Headers $headers

Write-Host "Response:"
Write-Host ($response | ConvertTo-Json -Depth 5)
```

**Expected**: Should return a job JSON with article content

**If 401**: Secret is wrong  
**If 404**: URL is wrong  
**If timeout**: ngrok not running or wrong URL

---

## Why Items Are "Stuck in Publishing"

### Current Flow (BROKEN):

```
Publishing Worker (every 3 min):
  → Creates WP pull job
  → Status: queued
  
WordPress Plugin (should run every 3 min):
  ❌ NOT PULLING JOBS
  ❌ Cron not running or settings wrong
  
Reaper (every 5 min):
  → Finds jobs >10 minutes old
  → Resets pipeline_items to "retrying"
  → Items loop forever!
```

### Expected Flow (WORKING):

```
Publishing Worker:
  → Creates WP pull job (status: queued)
  
WordPress Plugin:
  ✅ Pulls job (adds lease_token)
  ✅ Creates post
  ✅ Sends callback
  
Server:
  ✅ Marks job complete
  ✅ Marks pipeline_item published
```

---

## CHECKLIST

Before next steps, verify:

- [ ] ngrok is running and URL is active
- [ ] WordPress plugin settings have correct ngrok URL
- [ ] WordPress plugin settings have correct Site ID (cs_site_948CC696C5B70A71)
- [ ] WordPress plugin settings have correct Secret (cs_sec_bBH5Khm...)
- [ ] WordPress debug logging is enabled
- [ ] Manual pull button works (or shows error)

**Once verified, test manual pull and share results!**

---

**Status**: BLOCKED - waiting for WordPress plugin configuration verification
