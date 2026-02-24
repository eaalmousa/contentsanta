# Critical Fixes Applied - Sources Visibility

**Date:** 2026-01-27  
**Priority:** P0 - CRITICAL  
**Issue:** Sources invisible due to hardcoded workspace ID

---

## Problem Summary

All Sources API endpoints were hardcoded to query `"demo-workspace"`, causing:
- Users unable to see sources (even though they exist in their workspace)
- Multi-tenant isolation broken
- Auto-seeded sources invisible to new workspaces

---

## Fixes Applied

### File: `server/routes.ts`

**Pattern Applied:** Use `resolveWorkspace(userId)` to get user's active workspace (same as Publishing Targets)

#### 1. GET /api/sources (line 2065-2074)
**Before:**
```typescript
const sources = await storage.getSources("demo-workspace");
```

**After:**
```typescript
const userId = (req.user as any)?.claims?.sub;
const workspace = await resolveWorkspace(userId);
const sources = await storage.getSources(workspace.id);
```

---

#### 2. POST /api/sources (line 2086-2099)
**Before:**
```typescript
const data = insertSourceSchema.parse({
  ...req.body,
  workspaceId: "demo-workspace",
});
```

**After:**
```typescript
const userId = (req.user as any)?.claims?.sub;
const workspace = await resolveWorkspace(userId);
const data = insertSourceSchema.parse({
  ...req.body,
  workspaceId: workspace.id,
});
```

---

#### 3. GET /api/source-items (line 2146-2157)
**Before:**
```typescript
const items = await storage.getSourceItems("demo-workspace", status, sourceId);
```

**After:**
```typescript
const userId = (req.user as any)?.claims?.sub;
const workspace = await resolveWorkspace(userId);
const items = await storage.getSourceItems(workspace.id, status, sourceId);
```

---

#### 4. POST /api/source-items/:id/generate (line 2179-2229)
**Before:**
```typescript
const input = await storage.createInput({
  workspaceId: "demo-workspace",
  ...
});
const workflowRun = await storage.createWorkflowRun({
  workspaceId: "demo-workspace",
  ...
});
const asset = await storage.createAsset({
  workspaceId: "demo-workspace",
  ...
});
processWorkflowWithAI(..., "demo-workspace", null)
```

**After:**
```typescript
const userId = (req.user as any)?.claims?.sub;
const workspace = await resolveWorkspace(userId);
const input = await storage.createInput({
  workspaceId: workspace.id,
  ...
});
const workflowRun = await storage.createWorkflowRun({
  workspaceId: workspace.id,
  ...
});
const asset = await storage.createAsset({
  workspaceId: workspace.id,
  ...
});
processWorkflowWithAI(..., workspace.id, null)
```

---

#### 5. GET /api/automations (line 2233-2242)
**Before:**
```typescript
const automations = await storage.getAutomations("demo-workspace");
```

**After:**
```typescript
const userId = (req.user as any)?.claims?.sub;
const workspace = await resolveWorkspace(userId);
const automations = await storage.getAutomations(workspace.id);
```

---

#### 6. POST /api/automations (line 2254-2267)
**Before:**
```typescript
const data = insertAutomationSchema.parse({
  ...req.body,
  workspaceId: "demo-workspace",
});
```

**After:**
```typescript
const userId = (req.user as any)?.claims?.sub;
const workspace = await resolveWorkspace(userId);
const data = insertAutomationSchema.parse({
  ...req.body,
  workspaceId: workspace.id,
});
```

---

## Testing Instructions

### Before Fix:
1. Navigate to `/sources`
2. See "No sources found" even though sources exist
3. Browser console shows workspace context loaded but sources empty

### After Fix:
1. Restart server
2. Clear browser cookies/cache
3. Sign in at `http://localhost:5000/api/login`
4. Navigate to `/sources`
5. **Expected:** See all seeded sources (Al Jazeera, Gulf Business, Arab Times, etc.)
6. **Expected:** Console logs show workspace ID matching between context and sources query

### Verification Checklist:
- ✅ Sources visible on `/sources` page
- ✅ Source count in workspace context matches actual sources shown
- ✅ Can create topics and enable sources
- ✅ Sources dropdown in topic creation shows sources
- ✅ Pipeline automation can access sources

---

## Impact

**Before:** 
- 0 sources visible
- Pipeline automation blocked (no sources to ingest from)
- Core product promise broken

**After:**
- All workspace sources visible
- Multi-tenant isolation working
- Pipeline automation unblocked
- Auto-seeding works correctly for new users

---

## Next Steps (P0 Remaining)

**RBAC Enforcement** - Add role-based authorization to prevent non-admins from creating/editing/deleting sources:

1. Create `server/middleware/rbac.ts`:
```typescript
export function requireRole(allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.user as any)?.claims?.sub;
    const workspace = await resolveWorkspace(userId);
    const membership = await storage.getUserWorkspaceMembership(userId, workspace.id);
    
    if (!membership || !allowedRoles.includes(membership.role)) {
      return res.status(403).json({ 
        error: "Forbidden",
        message: "Insufficient permissions",
        requiredRoles: allowedRoles,
        userRole: membership?.role || "none"
      });
    }
    
    next();
  };
}
```

2. Apply to Sources endpoints:
```typescript
// admin/owner only
app.post("/api/sources", isAuthenticated, requireRole(["admin", "owner"]), ...);
app.patch("/api/sources/:id", isAuthenticated, requireRole(["admin", "owner"]), ...);
app.delete("/api/sources/:id", isAuthenticated, requireRole(["admin", "owner"]), ...);

// all authenticated users
app.get("/api/sources", isAuthenticated, ...); // no role check
```

3. Add frontend hook `client/src/hooks/use-workspace-role.ts`:
```typescript
export function useWorkspaceRole() {
  const { data: context } = useQuery(["/api/me/context"]);
  const role = context?.memberships?.[0]?.role || "viewer";
  
  return {
    role,
    isAdmin: role === "admin" || role === "owner",
    isEditor: role === "editor",
    canEditSources: role === "admin" || role === "owner",
    canEditTopics: ["admin", "owner", "editor"].includes(role),
  };
}
```

4. Update `client/src/pages/sources.tsx`:
```typescript
const { canEditSources } = useWorkspaceRole();

// Hide Add Source button for non-admins
{canEditSources && (
  <Button onClick={...}>Add Source</Button>
)}

// Hide Edit/Delete actions
{canEditSources && <Button onClick={...}>Edit</Button>}
{canEditSources && <Button onClick={...}>Delete</Button>}
```

**Estimated Effort:** 2 hours
