# RBAC Manual Testing Guide

## Test Environment
- Server: http://localhost:5000
- Dev User: Automatically authenticated as "owner" role
- Browser: Chrome/Edge with DevTools open

## Test Scenarios

### ✅ Test 1: Backend RBAC - Admin Operations (200/201 responses)
**Purpose:** Verify admin/owner can perform all mutations

**Steps:**
1. Open browser to http://localhost:5000
2. Open DevTools → Network tab
3. Navigate to Sources page
4. Click "Add Source" button
5. Fill in:
   - Feed URL: `https://example.com/test-feed`
   - Name: `Test RBAC Source`
   - Click "Test" button (should succeed or show validation error)
6. Click "Add Source" to save

**Expected Results:**
- ✅ POST /api/sources returns **201 Created**
- ✅ Response includes source ID
- ✅ Source appears in sources list
- ✅ No 403 errors in console

**DevTools Check:**
```
POST http://localhost:5000/api/sources
Status: 201 Created
Response: { "id": "...", "name": "Test RBAC Source", ... }
```

---

### ✅ Test 2: Frontend Role Gating - UI Controls Visible
**Purpose:** Verify admin controls are visible for owner role

**Steps:**
1. Navigate to Sources page (http://localhost:5000/sources)
2. Inspect page elements

**Expected Results:**
- ✅ "Add Source" button is visible
- ✅ "Add GCC Official Sources" button is visible
- ✅ Each source card shows:
  - ✅ "Fetch Now" button
  - ✅ Delete button (trash icon)
  - ✅ External link button (always visible)
- ✅ Empty state shows "Add Your First Source" button

**Visual Checklist:**
```
Header: [Add GCC Official Sources] [Add Source] ← Both visible
Cards:  [Fetch Now] [🔗] [🗑️] ← All three buttons visible
```

---

### ✅ Test 3: Backend RBAC - Workspace Isolation
**Purpose:** Verify cross-workspace access is blocked

**Steps:**
1. Open DevTools → Console
2. Get current workspace ID:
```javascript
fetch('/api/me/context')
  .then(r => r.json())
  .then(d => console.log('Workspace ID:', d.activeWorkspaceId))
```
3. Note the workspace ID (should be a UUID)
4. Try to access sources:
```javascript
fetch('/api/sources')
  .then(r => r.json())
  .then(d => console.log('Sources:', d))
```

**Expected Results:**
- ✅ All sources have matching `workspaceId` field
- ✅ No sources from other workspaces appear
- ✅ /api/me/context returns `activeWorkspaceId`

---

### ✅ Test 4: Backend RBAC - Mutation Endpoints Protected
**Purpose:** Verify all 4 mutation endpoints have RBAC middleware

**Automated Verification:**
Run: `node verify-rbac.js`

**Expected Results:**
```
✓ 3. POST /api/sources has RBAC middleware
✓ 4. PATCH /api/sources/:id has RBAC middleware
✓ 5. DELETE /api/sources/:id has RBAC middleware
✓ 6. POST /api/sources/:id/fetch has RBAC middleware
```

---

### ✅ Test 5: Frontend Role Hook - Loading States
**Purpose:** Verify role loading doesn't break UI

**Steps:**
1. Open DevTools → Network tab
2. Set throttling to "Slow 3G"
3. Hard refresh page (Ctrl+Shift+R)
4. Watch Sources page load

**Expected Results:**
- ✅ Loading skeleton appears first
- ✅ No flash of admin buttons before role loads
- ✅ Buttons appear after role is determined
- ✅ No console errors about undefined role

---

## Test Results Summary

| Test # | Test Name | Status | Notes |
|--------|-----------|--------|-------|
| 1 | Backend RBAC - Admin Operations | ⬜ | POST /api/sources returns 201 |
| 2 | Frontend Role Gating - UI Visible | ⬜ | All admin buttons visible |
| 3 | Backend RBAC - Workspace Isolation | ⬜ | Sources scoped to workspace |
| 4 | Backend RBAC - Protected Endpoints | ✅ | Automated test passed |
| 5 | Frontend Role Hook - Loading States | ⬜ | No UI flicker |

---

## How to Test with Viewer Role (Advanced)

To test 403 responses for non-admin users, you would need to:

1. Create a second user account in the database
2. Set their role to "viewer" in `workspace_users` table
3. Log in as that user (requires Replit OAuth or database manipulation)

**Database Command (Example):**
```sql
-- Insert test viewer user
INSERT INTO users (id, email, name) 
VALUES ('test-viewer-id', 'viewer@test.com', 'Test Viewer');

-- Add to workspace with viewer role
INSERT INTO workspace_users (workspace_id, user_id, role)
VALUES ('<your-workspace-id>', 'test-viewer-id', 'viewer');
```

Then test:
```javascript
// Should return 403
fetch('/api/sources', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Test',
    feedUrl: 'https://example.com/feed'
  })
}).then(r => r.json()).then(console.log)

// Expected response:
// {
//   "error": "Forbidden",
//   "message": "Insufficient permissions for this action",
//   "requiredRoles": ["admin", "owner"],
//   "userRole": "viewer"
// }
```

---

## Troubleshooting

### Issue: All requests return 401
**Cause:** Session not established or expired
**Fix:** 
1. Clear browser cookies
2. Refresh page
3. Check server logs for auth errors

### Issue: Admin buttons not showing
**Cause:** Role hook not loading or returning wrong role
**Fix:**
1. Check console for errors
2. Verify `/api/me/context` returns memberships array
3. Verify first membership has role="owner"

### Issue: 403 on source creation even as owner
**Cause:** Middleware not finding user role
**Fix:**
1. Check server logs for RBAC errors
2. Verify workspace membership exists in database
3. Check `resolveWorkspace()` is returning correct workspace

---

## Success Criteria

All tests marked ✅ indicates RBAC is correctly implemented:

- ✅ Backend enforces admin/owner requirement for mutations
- ✅ Frontend hides admin controls from non-admins
- ✅ Workspace isolation prevents cross-workspace access
- ✅ GET endpoints remain accessible to all authenticated users
- ✅ Error responses include helpful debugging info (role, required roles)

---

## Next Steps After Manual Testing

1. ✅ Mark all tests as passed in table above
2. Create test user accounts with different roles
3. Add integration tests for RBAC scenarios
4. Consider adding role-based redirects (e.g., viewer → read-only dashboard)
