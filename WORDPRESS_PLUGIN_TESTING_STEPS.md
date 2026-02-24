# WordPress Plugin v0.8.0 Testing Guide

## 🎯 Current Status

✅ **Migration Complete** - Callback evidence fields added to database  
✅ **Test Job Created** - Job ID: `f50ebbd2-6adb-4d1f-a2f9-9d26931a8a07`  
✅ **Server Running** - Port 5000 (http://localhost:5000)  
✅ **Target Confirmed** - Gulf Estate Gazette (Site ID: `cs_site_275192919E433615`)

---

## 📋 Step-by-Step Instructions

### **Step 1: Upload WordPress Plugin v0.8.0**

1. **Locate Plugin File:**
   - File: `content-santa-connector-v0.8.0.php`
   - Location: Project root directory

2. **Upload to WordPress:**
   ```
   WordPress Admin → Plugins → Add New → Upload Plugin
   ```
   - Choose file: `content-santa-connector-v0.8.0.php`
   - Click "Install Now"
   - Click "Activate Plugin"

3. **Verify Version:**
   - Go to: Plugins → Installed Plugins
   - Find: "Content Santa Connector"
   - Check version shows: **0.8.0**

---

### **Step 2: Configure Plugin Settings**

1. **Navigate to Settings:**
   ```
   WordPress Admin → Settings → Content Santa Connector
   ```

2. **Verify/Update Configuration:**
   - **Content Santa Base URL:** `YOUR_NGROK_URL` (e.g., https://xxxx.ngrok.io)
   - **Site ID:** `cs_site_275192919E433615`
   - **Secret Key:** (your generated secret)
   - **Poll Interval:** 3 minutes (recommended)

3. **Save Changes** if you made any updates

---

### **Step 3: Trigger Manual Pull**

1. On the Content Santa Connector settings page, scroll to:
   ```
   Manual Pull Controls
   ```

2. Click the button:
   ```
   🔄 Run Now (Manual Pull)
   ```

3. **Wait 10-15 seconds** for processing

4. **Expected WordPress Response:**
   - Success message: "Pull completed successfully"
   - Or: "1 article(s) published"

---

### **Step 4: Verify Test Article Created**

1. **Check WordPress Posts:**
   ```
   WordPress Admin → Posts → All Posts
   ```

2. **Find Test Article:**
   - Title: "Test Article - Image Pipeline Verification 2026-02-14T23:08:43.020Z"
   - Status: Published
   - **VERIFY:** Has a visible **featured image** (laptop/keyboard photo from Unsplash)

3. **View Published Post:**
   - Click "View" to see the live post
   - **VERIFY:** Featured image appears at the top

---

### **Step 5: Verify Callback Evidence (Run in PowerShell)**

After WordPress pull completes, run this command to check callback evidence:

```powershell
npx tsx --env-file=.env simple-wp-check.ts
```

**Expected Output (Success Indicators):**

```
✅ Job Status: published
✅ Callback Image HTTP Code: 200
✅ Callback Image Bytes: 156789 (or similar positive number)
✅ Callback WP Attachment ID: 123 (or any number)
✅ Callback Set Thumbnail OK: true
✅ Result WP URL: https://gulfestategazette.com/test-image-pipeline-xxxxx/
```

---

## 🔍 Troubleshooting

### Issue: "Site ID mismatch" or "Authentication failed"

**Solution:**
1. Regenerate secret in Content Santa admin
2. Copy new secret to WordPress plugin settings
3. Save settings
4. Retry manual pull

### Issue: "No jobs found" or "Queue empty"

**Solution:**
1. Run again: `npx tsx --env-file=.env create-test-job-geg.ts`
2. Retry manual pull in WordPress

### Issue: Article published but NO featured image

**Check WordPress Error Log:**
- Look for: "Content Santa: ERROR downloading image..."
- This indicates network/firewall blocking image download

**Check Callback Evidence:**
- Run: `npx tsx --env-file=.env simple-wp-check.ts`
- Look at: `callback_error_step` and `callback_error_details`

### Issue: Plugin not appearing in WordPress

**Solution:**
1. Check file was uploaded completely
2. Check WordPress PHP error log
3. Ensure WordPress is PHP 7.4+ compatible

---

## 📊 What Each Callback Field Means

| Field | Success Value | Meaning |
|-------|---------------|---------|
| `callback_image_http_code` | `200` | Image downloaded successfully from Unsplash |
| `callback_image_bytes` | `> 0` | Downloaded file size (proves download worked) |
| `callback_wp_attachment_id` | `> 0` | WordPress media library ID (image uploaded) |
| `callback_set_thumbnail_ok` | `true` | Featured image was set on the post |
| `callback_error_step` | `null` | No errors occurred |
| `callback_error_details` | `null` | No error details |

---

## ✅ Success Criteria

**The image pipeline fix is COMPLETE when ALL are true:**

1. ✅ Test article appears in WordPress posts list
2. ✅ Test article has a visible featured image (laptop photo)
3. ✅ `callback_wp_attachment_id` is populated (not null)
4. ✅ `callback_set_thumbnail_ok` is `true`
5. ✅ Live post URL shows featured image at the top

---

## 🚀 Next Steps After Verification

Once image pipeline is verified working:

1. Delete test article from WordPress
2. Delete test job from database
3. Continue with Publishing Pipeline implementation (todos #1-3)
4. Test full end-to-end flow with real topics

---

**Current Server:** http://localhost:5000  
**Test Job ID:** f50ebbd2-6adb-4d1f-a2f9-9d26931a8a07  
**Target Site:** Gulf Estate Gazette (cs_site_275192919E433615)

---

*Ready to test? Upload plugin v0.8.0 and click "Run Now (Manual Pull)"!*
