# Quick Testing Guide - via.placeholder.com Fix

## ✅ Backend Status: ALL VERIFIED

- ✅ Database cleaned (no placeholder URLs)
- ✅ Database constraint active (blocks future placeholders)
- ✅ Source code fixed (mock user uses null)
- ✅ Runtime guards applied (5 Avatar locations)
- ✅ Server running on http://localhost:5000

---

## 🧪 Browser Testing (3 minutes)

### Step 1: Open Incognito Window
**Why:** Your browser has cached the old session with placeholder URL

**How:**
- Chrome/Edge: `Ctrl + Shift + N`
- Firefox: `Ctrl + Shift + P`
- Or manually: Menu → New Incognito/Private Window

### Step 2: Open DevTools
- Press `F12` or right-click → Inspect
- Go to **Network** tab
- Keep it open

### Step 3: Navigate
- Go to `http://localhost:5000`
- Watch the Network tab as page loads

### Step 4: Verify Network Requests ✅
**Look for these GOOD signs:**
- ✅ No requests to `via.placeholder.com`
- ✅ No `ERR_NAME_NOT_RESOLVED` errors
- ✅ Avatar images don't appear (using fallback is correct)

**Bad signs to look for:**
- ❌ GET request to `https://via.placeholder.com/150`
- ❌ Red errors in Network tab for placeholder

### Step 5: Verify Avatar Display ✅
**Expected:**
- User avatar in header shows initials (e.g., "D" for dev user)
- Gray/muted background circle
- No broken image icon

### Step 6: Test Topic Creation ✅
1. Click **Topics** in sidebar
2. Click **Create Topic** button
3. Fill in:
   - Topic name: "Test Topic"
   - Select at least one source
4. Click **Submit**

**Expected:**
- ✅ Topic created successfully
- ✅ Appears in list
- ✅ No 400 errors in Console or Network tab

### Step 7: Check Console ✅
Go to **Console** tab in DevTools

**Expected:**
- ✅ No "Rendered more hooks" errors
- ✅ No React warnings
- ✅ No image load errors

---

## ✅ Success Criteria

All of these should be true:

- [ ] No network requests to placeholder.com domains
- [ ] No DNS resolution errors
- [ ] Avatar shows initials instead of image
- [ ] Topic creation works (201 status)
- [ ] No React hook errors in console
- [ ] No broken image icons

---

## 🔍 If Issues Persist

### Issue: Still seeing placeholder requests

**Diagnosis:**
```powershell
# Check database again
npx tsx --import=dotenv/config verify-placeholder-fix.ts
```

**Should show:**
```
✅ PASSED: No placeholder URLs found
✅ Dev user profile image is NULL (correct!)
```

**If not clean:** Re-run cleanup script:
```powershell
npx tsx --import=dotenv/config scripts/fix-dev-placeholder-avatar.ts
```

---

### Issue: Avatar shows broken image

**This is expected if:**
- User has no valid profile image (shows initials instead)
- Radix UI AvatarFallback is working correctly

**Check if it's the initials fallback:**
- Look for a circle with letter(s) inside
- Should have gray/muted background
- This is the CORRECT behavior

---

### Issue: Topic creation still fails

**Check these:**

1. **Workspace context loaded?**
   - Look for debug output in dialog
   - Should show workspace ID

2. **Active site set?**
   ```powershell
   npx tsx --import=dotenv/config check-site.ts
   ```

3. **Sources available?**
   - Need at least 1 active source
   - Check in Sources page

---

## 🎯 Quick Commands

### Restart server if needed
```powershell
# Find process
netstat -ano | findstr :5000

# Kill it (replace PID)
taskkill /F /PID <PID>

# Start fresh
npm run dev
```

### Verify database
```powershell
npx tsx --import=dotenv/config verify-placeholder-fix.ts
```

### Check constraint
```powershell
npx tsx --import=dotenv/config scripts/add-placeholder-constraint.ts
```

---

## 📊 Testing Results Template

After testing, you should see:

### Network Tab ✅
```
localhost:5000/
localhost:5000/api/auth/user
localhost:5000/api/topics
[No placeholder.com requests]
```

### Console Tab ✅
```
[No errors]
```

### Visual ✅
```
- Header avatar: [D] (gray circle with initial)
- Topics page: Loaded
- Create topic: Success
```

---

## 🚀 If All Tests Pass

You're ready for production! The fix includes:

1. **Database constraint** - Permanent protection
2. **Runtime guards** - Code-level safety
3. **Clean data** - All existing records fixed
4. **Future-proof** - New mock users won't create issue

---

**Estimated Testing Time:** 3-5 minutes

**Required Action:** Clear browser cache (Incognito window easiest)

**Server URL:** http://localhost:5000

**Status:** Ready to test! 🎉
