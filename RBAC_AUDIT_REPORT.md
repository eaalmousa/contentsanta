# RBAC Implementation Audit Report - Sources and System-Wide Permissions

**Generated:** 2026-01-27  
**Scope:** Sources API, Topics API, Publishing Targets, and System-Wide RBAC

---

## Executive Summary

### Critical Findings
1. **No RBAC enforcement on Sources API** - All authenticated users have full CRUD access
2. **Hardcoded workspace ID ("demo-workspace")** in most Source endpoints
3. **No role-based authorization middleware** implemented
4. **Frontend has no role checks** for Add/Edit/Delete operations
5. **Topic-sources permissions are open** to all authenticated workspace members

### Security Impact
- **HIGH**: Any authenticated user can create, modify, or delete sources
- **HIGH**: No separation between admin and regular user capabilities
- **MEDIUM**: Hardcoded workspace IDs bypass multi-tenant isolation in some endpoints

---

## 1. Role Schema and Storage

### ✅ **IMPLEMENTED**: Role Definitions

**File:** `shared/schema.ts:10-11`
```typescript
export const roleTypes = ["owner", "admin", "editor", "reviewer", "viewer"] as const;
export type RoleType = typeof roleTypes[number];
```

**Storage Location:**
- `workspace_users` table has a `role` column (type: `RoleType`)
- Users are assigned roles per workspace via `workspace_users` join table

**Schema:**
```typescript
export const workspaceUsers = pgTable("workspace_users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  role: text("role").notNull().$type<RoleType>().default("viewer"),
  createdAt: timestamp("created_at").defaultNow(),
});
```

**Verification Methods:** `server/storage.ts`
- `getWorkspaceUser(workspaceId, userId)` - Returns role for a specific user in workspace
- `getUserWorkspaceMemberships(userId)` - Returns all workspaces with roles for a user

---

## 2. Sources API Endpoints

### ❌ **MISSING**: All Sources endpoints lack role-based authorization

| Endpoint | Method | Auth | Role Check | Current Behavior | Required Role |
|----------|--------|------|------------|------------------|---------------|
| `/api/sources` | GET | ✅ | ❌ | Hardcoded "demo-workspace", returns all sources | Any authenticated |
| `/api/sources/:id` | GET | ✅ | ❌ | No workspace validation | Any authenticated |
| `/api/sources` | POST | ✅ | ❌ | Hardcoded "demo-workspace", anyone can create | **Should be: admin** |
| `/api/sources/:id` | PATCH | ✅ | ❌ | Anyone can edit any source | **Should be: admin** |
| `/api/sources/:id` | DELETE | ✅ | ❌ | Anyone can delete any source | **Should be: admin** |
| `/api/sources/:id/fetch` | POST | ✅ | ❌ | Anyone can trigger fetch | **Should be: admin** |
| `/api/sources/test-feed` | POST | ✅ | ❌ | Anyone can test feeds | **Should be: admin** |
| `/api/sources/seed-official` | POST | ✅ | ❌ | Anyone can seed sources | **Should be: admin** |
| `/api/sources/adopt-from-workspace` | POST | ✅ | Partial | Checks workspace membership but not role | **Should be: admin** |

### 🔍 **Code Analysis: GET /api/sources**

**File:** `server/routes.ts:2065-2072`
```typescript
app.get("/api/sources", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const sources = await storage.getSources("demo-workspace"); // ❌ Hardcoded workspace
    res.json(sources);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sources" });
  }
});
```

**Issues:**
1. Hardcoded `"demo-workspace"` - should resolve from user session
2. No workspace membership check
3. No role validation

**Recommended Fix:**
```typescript
app.get("/api/sources", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const workspace = await resolveWorkspace(userId);
    if (!workspace) {
      return res.status(404).json({ error: "No workspace found" });
    }
    const sources = await storage.getSources(workspace.id);
    res.json(sources);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sources" });
  }
});
```

### 🔍 **Code Analysis: POST /api/sources**

**File:** `server/routes.ts:2084-2095`
```typescript
app.post("/api/sources", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const data = insertSourceSchema.parse({
      ...req.body,
      workspaceId: "demo-workspace", // ❌ Hardcoded workspace
    });
    const source = await storage.createSource(data);
    res.status(201).json(source);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Invalid source data" });
  }
});
```

**Issues:**
1. ❌ Hardcoded workspace ID
2. ❌ No role check - any authenticated user can create sources
3. ❌ Should require `admin` or `owner` role

**Recommended Fix:**
```typescript
app.post("/api/sources", isAuthenticated, requireRole(["admin", "owner"]), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const workspace = await resolveWorkspace(userId);
    if (!workspace) {
      return res.status(404).json({ error: "No workspace found" });
    }
    
    const data = insertSourceSchema.parse({
      ...req.body,
      workspaceId: workspace.id,
    });
    const source = await storage.createSource(data);
    res.status(201).json(source);
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Invalid source data" });
  }
});
```

### 🔍 **Code Analysis: PATCH/DELETE /api/sources/:id**

**File:** `server/routes.ts:2097-2114`
```typescript
app.patch("/api/sources/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const source = await storage.updateSource(req.params.id, req.body);
    if (!source) return res.status(404).json({ error: "Source not found" });
    res.json(source);
  } catch (error) {
    res.status(500).json({ error: "Failed to update source" });
  }
});

app.delete("/api/sources/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    await storage.deleteSource(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Failed to delete source" });
  }
});
```

**Issues:**
1. ❌ No workspace ownership validation
2. ❌ No role check - any authenticated user can modify/delete any source
3. ❌ Should validate source belongs to user's workspace
4. ❌ Should require `admin` or `owner` role

**Recommended Fix:**
```typescript
app.patch("/api/sources/:id", isAuthenticated, requireRole(["admin", "owner"]), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const workspace = await resolveWorkspace(userId);
    if (!workspace) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // Validate source belongs to user's workspace
    const existingSource = await storage.getSource(req.params.id);
    if (!existingSource || existingSource.workspaceId !== workspace.id) {
      return res.status(404).json({ error: "Source not found" });
    }
    
    const source = await storage.updateSource(req.params.id, req.body);
    res.json(source);
  } catch (error) {
    res.status(500).json({ error: "Failed to update source" });
  }
});
```

---

## 3. Topic-Sources API Endpoints

### ⚠️ **PARTIAL**: Topic-sources have authentication but no granular role checks

| Endpoint | Method | Auth | Role Check | Current Behavior | Should Be |
|----------|--------|------|------------|------------------|-----------|
| `/api/topics/:topicId/sources` | GET | ✅ | ❌ | Any workspace member can view | ✅ OK (all members) |
| `/api/topics/:topicId/sources` | POST | ✅ | ❌ | Any workspace member can add | **Should be: editor/admin** |
| `/api/topics/:topicId/sources/:sourceId` | PATCH | ✅ | ❌ | Any workspace member can toggle | **Should be: editor/admin** |

### 🔍 **Code Analysis: Topic Sources Management**

**File:** `server/routes.ts:3054-3129`

**Helper Function:**
```typescript
const validateTopicAccess = async (topicId: string, res: Response): Promise<boolean> => {
  const topic = await storage.getTopic(topicId);
  if (!topic) {
    res.status(404).json({ error: "Topic not found" });
    return false;
  }
  return true;
};
```

**Issues:**
1. ✅ Validates topic exists
2. ❌ Does NOT validate user is a member of topic's workspace
3. ❌ Does NOT check user's role in workspace
4. ❌ Any authenticated user can access any topic's sources

**GET /api/topics/:topicId/sources:**
```typescript
app.get("/api/topics/:topicId/sources", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { topicId } = req.params;
    if (!await validateTopicAccess(topicId, res)) return;
    
    const topicSources = await storage.getTopicSources(topicId);
    const sourcesWithDetails = await Promise.all(
      topicSources.map(async (ts) => {
        const source = await storage.getSource(ts.sourceId);
        return { ...ts, source };
      })
    );
    res.json(sourcesWithDetails);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch topic sources" });
  }
});
```

**Recommended Fix:**
```typescript
const validateTopicAccessWithRole = async (
  topicId: string, 
  userId: string, 
  requiredRoles: RoleType[]
): Promise<{ ok: boolean; topic?: Topic; error?: string }> => {
  const topic = await storage.getTopic(topicId);
  if (!topic) {
    return { ok: false, error: "Topic not found" };
  }
  
  const membership = await storage.getWorkspaceUser(topic.workspaceId, userId);
  if (!membership) {
    return { ok: false, error: "Access denied - not a workspace member" };
  }
  
  if (requiredRoles.length > 0 && !requiredRoles.includes(membership.role)) {
    return { ok: false, error: `Requires role: ${requiredRoles.join(" or ")}` };
  }
  
  return { ok: true, topic };
};

app.post("/api/topics/:topicId/sources", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.claims?.sub;
    const validation = await validateTopicAccessWithRole(req.params.topicId, userId, ["owner", "admin", "editor"]);
    if (!validation.ok) {
      return res.status(403).json({ error: validation.error });
    }
    
    // ... rest of handler
  }
});
```

---

## 4. Frontend Sources UI

### ❌ **MISSING**: No role-based UI controls

**File:** `client/src/pages/sources.tsx`

**Add Source Button (Lines 171-177):**
```typescript
<DialogTrigger asChild>
  <Button data-testid="button-add-source">
    <Plus className="mr-2 h-4 w-4" />
    Add Source
  </Button>
</DialogTrigger>
```

**Issues:**
1. ❌ Button always visible to all authenticated users
2. ❌ No role check before rendering
3. ❌ Should only show for admin/owner

**Recommended Fix:**
```typescript
import { useWorkspaceRole } from "@/hooks/use-workspace-role";

export default function SourcesPage() {
  const { role, isAdmin } = useWorkspaceRole();
  
  // ... existing code
  
  return (
    <div className="flex items-center gap-2">
      {isAdmin && (
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-source">
              <Plus className="mr-2 h-4 w-4" />
              Add Source
            </Button>
          </DialogTrigger>
          {/* ... dialog content */}
        </Dialog>
      )}
    </div>
  );
}
```

**Edit/Delete Actions (Lines 292-376):**
```typescript
{sources.map((source) => (
  <Card key={source.id} data-testid={`card-source-${source.id}`}>
    {/* ... card content */}
    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(source.id)}>
      <Trash2 className="h-4 w-4" />
    </Button>
    <Switch
      checked={source.isActive === "true"}
      onCheckedChange={(checked) => toggleMutation.mutate({ id: source.id, isActive: checked })}
    />
  </Card>
))}
```

**Issues:**
1. ❌ All controls visible to all users
2. ❌ No role checks on mutations
3. ❌ Should be disabled for non-admin users

---

## 5. Frontend Topics UI

### ⚠️ **PARTIAL**: Topics page has some workspace validation but no role checks

**File:** `client/src/pages/topics.tsx:256-280`

**Topic Sources Toggle (Lines 492-499):**
```typescript
<Switch
  checked={ts.isEnabled}
  onCheckedChange={(checked) => 
    toggleSourceMutation.mutate({ sourceId: ts.sourceId, isEnabled: checked })
  }
  disabled={toggleSourceMutation.isPending}
  data-testid={`switch-source-${ts.sourceId}`}
/>
```

**Issues:**
1. ✅ Authenticated users only
2. ✅ Workspace context loaded
3. ❌ No role validation - all members can toggle sources
4. ❌ Should require editor/admin role

**Recommended Fix:**
```typescript
const { role, canEdit } = useWorkspaceRole();

<Switch
  checked={ts.isEnabled}
  onCheckedChange={(checked) => 
    canEdit && toggleSourceMutation.mutate({ sourceId: ts.sourceId, isEnabled: checked })
  }
  disabled={toggleSourceMutation.isPending || !canEdit}
  data-testid={`switch-source-${ts.sourceId}`}
/>
{!canEdit && (
  <Badge variant="secondary" className="text-xs">View Only</Badge>
)}
```

---

## 6. Missing RBAC Infrastructure

### ❌ **CRITICAL**: No role-based authorization middleware

**Required Middleware (not found in codebase):**

```typescript
// server/middleware/rbac.ts
export function requireRole(allowedRoles: RoleType[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const workspace = await resolveWorkspace(userId);
      if (!workspace) {
        return res.status(403).json({ error: "No workspace found" });
      }
      
      const membership = await storage.getWorkspaceUser(workspace.id, userId);
      if (!membership) {
        return res.status(403).json({ error: "Not a workspace member" });
      }
      
      if (!allowedRoles.includes(membership.role)) {
        return res.status(403).json({ 
          error: "Insufficient permissions",
          required: allowedRoles,
          current: membership.role 
        });
      }
      
      // Attach workspace and role to request for downstream use
      (req as any).workspace = workspace;
      (req as any).role = membership.role;
      
      next();
    } catch (error) {
      console.error("[RBAC] Role check failed:", error);
      res.status(500).json({ error: "Authorization check failed" });
    }
  };
}
```

### ❌ **MISSING**: Frontend role context hook

**Required Hook:**

```typescript
// client/src/hooks/use-workspace-role.ts
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function useWorkspaceRole() {
  const { data } = useQuery({
    queryKey: ["/api/me/context"],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  const role = data?.membership?.role as RoleType | undefined;
  
  return {
    role,
    isOwner: role === "owner",
    isAdmin: role === "admin" || role === "owner",
    canEdit: ["owner", "admin", "editor"].includes(role || ""),
    canReview: ["owner", "admin", "editor", "reviewer"].includes(role || ""),
    isViewer: role === "viewer",
  };
}
```

---

## 7. Recommended RBAC Implementation Plan

### Phase 1: Backend Infrastructure (Priority: CRITICAL)

1. **Create RBAC middleware** (`server/middleware/rbac.ts`)
   - `requireRole(roles: RoleType[])`
   - `requireWorkspaceMembership()`
   - `requireResourceOwnership(resourceType, resourceId)`

2. **Fix Sources API**
   - Add `requireRole(["admin", "owner"])` to POST, PATCH, DELETE
   - Replace hardcoded "demo-workspace" with `resolveWorkspace(userId)`
   - Add workspace validation to all endpoints

3. **Fix Topic-Sources API**
   - Add role checks to POST/PATCH operations
   - Validate user is workspace member before any operation
   - Allow GET for all members, restrict POST/PATCH to editors+

### Phase 2: Frontend Role Controls (Priority: HIGH)

1. **Create `useWorkspaceRole` hook**
   - Fetch user role from `/api/me/context`
   - Provide helper booleans: `isAdmin`, `canEdit`, `canReview`, `isViewer`

2. **Update Sources UI**
   - Hide "Add Source" button for non-admins
   - Disable edit/delete actions for non-admins
   - Show role-based badges or tooltips

3. **Update Topics UI**
   - Restrict source toggle to editors+
   - Add visual indicators for read-only users
   - Disable schedule/taxonomy editing for non-editors

### Phase 3: Resource-Level Permissions (Priority: MEDIUM)

1. **Publishing Targets**
   - Already has `createdByUserId` field
   - Add role check: only creator or admins can edit/delete
   - Implement shared target concept (workspace-wide vs personal)

2. **Topics**
   - Consider topic-level ownership (optional)
   - Default: editors can manage all topics in workspace
   - Advanced: add `createdBy` + ownership model

### Phase 4: Audit Logging (Priority: LOW)

1. Add audit trail for:
   - Source creation/deletion
   - Topic activation/deactivation
   - Publishing target changes
   - User role changes

---

## 8. Specific Code Changes Required

### File: `server/routes.ts`

**Lines to modify:**

1. **Line 2065** - GET `/api/sources`
   ```typescript
   - const sources = await storage.getSources("demo-workspace");
   + const userId = (req.user as any)?.claims?.sub;
   + const workspace = await resolveWorkspace(userId);
   + if (!workspace) return res.status(404).json({ error: "No workspace found" });
   + const sources = await storage.getSources(workspace.id);
   ```

2. **Line 2084** - POST `/api/sources`
   ```typescript
   - app.post("/api/sources", isAuthenticated, async (req: Request, res: Response) => {
   + app.post("/api/sources", isAuthenticated, requireRole(["admin", "owner"]), async (req: Request, res: Response) => {
   ```

3. **Line 2097** - PATCH `/api/sources/:id`
   ```typescript
   - app.patch("/api/sources/:id", isAuthenticated, async (req: Request, res: Response) => {
   + app.patch("/api/sources/:id", isAuthenticated, requireRole(["admin", "owner"]), async (req: Request, res: Response) => {
     // Add workspace ownership validation before updating
   ```

4. **Line 2107** - DELETE `/api/sources/:id`
   ```typescript
   - app.delete("/api/sources/:id", isAuthenticated, async (req: Request, res: Response) => {
   + app.delete("/api/sources/:id", isAuthenticated, requireRole(["admin", "owner"]), async (req: Request, res: Response) => {
     // Add workspace ownership validation before deleting
   ```

5. **Line 3078** - POST `/api/topics/:topicId/sources`
   ```typescript
   - app.post("/api/topics/:topicId/sources", isAuthenticated, async (req: Request, res: Response) => {
   + app.post("/api/topics/:topicId/sources", isAuthenticated, requireRole(["admin", "owner", "editor"]), async (req: Request, res: Response) => {
   ```

6. **Line 3112** - PATCH `/api/topics/:topicId/sources/:sourceId`
   ```typescript
   - app.patch("/api/topics/:topicId/sources/:sourceId", isAuthenticated, async (req: Request, res: Response) => {
   + app.patch("/api/topics/:topicId/sources/:sourceId", isAuthenticated, requireRole(["admin", "owner", "editor"]), async (req: Request, res: Response) => {
   ```

### File: `client/src/pages/sources.tsx`

**Lines to modify:**

1. **Line 171** - Add Source Button
   ```typescript
   + const { isAdmin } = useWorkspaceRole();
   
   - <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
   + {isAdmin && (
   +   <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
         <DialogTrigger asChild>
   ```

2. **Lines 292-376** - Source Cards
   ```typescript
   + const { isAdmin } = useWorkspaceRole();
   
   {sources.map((source) => (
     <Card key={source.id}>
       {/* ... */}
   -   <Button onClick={() => deleteMutation.mutate(source.id)}>
   +   <Button 
   +     onClick={() => deleteMutation.mutate(source.id)}
   +     disabled={!isAdmin}
   +   >
         <Trash2 />
       </Button>
   ```

---

## 9. Testing Recommendations

### Unit Tests

1. Test role middleware:
   - ✅ Allows admin/owner to POST sources
   - ✅ Blocks viewer from POST sources
   - ✅ Returns 403 with clear error message

2. Test workspace isolation:
   - ✅ User A cannot modify User B's sources
   - ✅ Sources query returns only user's workspace sources

### Integration Tests

1. **Sources RBAC:**
   - Create source as admin → ✅ success
   - Create source as viewer → ❌ 403
   - Edit source owned by different workspace → ❌ 404
   - Delete source as non-admin → ❌ 403

2. **Topic-Sources RBAC:**
   - Toggle source as editor → ✅ success
   - Toggle source as viewer → ❌ 403
   - Add source to topic not in user's workspace → ❌ 403

3. **Frontend Role Checks:**
   - Viewer sees no "Add Source" button
   - Viewer sees disabled edit controls
   - Admin sees all controls enabled

---

## 10. Security Checklist

### Critical

- [ ] Replace all hardcoded "demo-workspace" with `resolveWorkspace(userId)`
- [ ] Add `requireRole()` middleware to Sources POST/PATCH/DELETE
- [ ] Validate resource ownership in all update/delete operations
- [ ] Add workspace membership check to topic-sources operations

### High Priority

- [ ] Create `useWorkspaceRole()` hook in frontend
- [ ] Hide admin-only UI controls from non-admins
- [ ] Add workspace validation to all GET endpoints
- [ ] Implement resource-level permission checks

### Medium Priority

- [ ] Add audit logging for sensitive operations
- [ ] Implement role-based UI indicators (badges, tooltips)
- [ ] Add error messages explaining required permissions
- [ ] Create admin dashboard for user role management

### Low Priority

- [ ] Add role-based analytics/reporting
- [ ] Implement workspace invitation system with role presets
- [ ] Add role change notifications
- [ ] Create permission documentation for end users

---

## 11. Summary

### Current State
- ✅ **Schema**: Roles defined and stored in `workspace_users` table
- ✅ **Authentication**: All endpoints require authentication
- ❌ **Authorization**: No role-based access control implemented
- ❌ **Frontend**: No role-based UI controls
- ❌ **Workspace Isolation**: Hardcoded workspace IDs bypass tenant isolation

### Required Work
1. **Backend:** ~8-12 hours
   - Create RBAC middleware
   - Update Sources API (5 endpoints)
   - Update Topic-Sources API (3 endpoints)
   - Fix hardcoded workspace IDs (10+ locations)

2. **Frontend:** ~4-6 hours
   - Create `useWorkspaceRole` hook
   - Update Sources page
   - Update Topics page
   - Add role indicators

3. **Testing:** ~4-6 hours
   - Unit tests for RBAC middleware
   - Integration tests for Sources/Topics APIs
   - E2E tests for role-based UI controls

**Total Estimate:** 16-24 hours of development work

---

## Appendix A: Role Permissions Matrix

| Role | View Sources | Add Source | Edit Source | Delete Source | Toggle Topic Sources | Edit Topic |
|------|--------------|------------|-------------|---------------|----------------------|------------|
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Editor** | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Reviewer** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Viewer** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Appendix B: API Endpoint Summary

### Sources API
| Endpoint | Auth | Role | Workspace Validation | Notes |
|----------|------|------|----------------------|-------|
| `GET /api/sources` | ✅ | ❌ None | ❌ Hardcoded | **FIX REQUIRED** |
| `GET /api/sources/:id` | ✅ | ❌ None | ❌ Missing | **FIX REQUIRED** |
| `POST /api/sources` | ✅ | ❌ None | ❌ Hardcoded | **FIX REQUIRED** - Should require admin |
| `PATCH /api/sources/:id` | ✅ | ❌ None | ❌ Missing | **FIX REQUIRED** - Should require admin |
| `DELETE /api/sources/:id` | ✅ | ❌ None | ❌ Missing | **FIX REQUIRED** - Should require admin |
| `POST /api/sources/:id/fetch` | ✅ | ❌ None | ❌ Missing | **FIX REQUIRED** - Should require admin |
| `POST /api/sources/test-feed` | ✅ | ❌ None | N/A | **FIX REQUIRED** - Should require admin |

### Topic-Sources API
| Endpoint | Auth | Role | Workspace Validation | Notes |
|----------|------|------|----------------------|-------|
| `GET /api/topics/:topicId/sources` | ✅ | ❌ None | ⚠️ Partial | Validates topic exists, not workspace membership |
| `POST /api/topics/:topicId/sources` | ✅ | ❌ None | ⚠️ Partial | **FIX REQUIRED** - Should require editor+ |
| `PATCH /api/topics/:topicId/sources/:sourceId` | ✅ | ❌ None | ⚠️ Partial | **FIX REQUIRED** - Should require editor+ |

---

**End of Report**
