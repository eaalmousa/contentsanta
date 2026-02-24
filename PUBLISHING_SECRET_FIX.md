# Publishing Secret Generation Fix

## 🐛 Bug Fixed

**Error**: "Failed to rotate secret - activeWorkspaceId is not defined"

**Location**: Publishing page → Target card → "Generate New Secret" button

---

## 🔍 Root Cause

The `TargetCard` component used `activeWorkspaceId` in mutation callbacks, but it was **not defined** in the component's scope.

**Broken Code**:
```typescript
function TargetCard({ target, onEdit }: { target: PublishingTarget; onEdit: () => void }) {
  // ...
  const rotateSecretMutation = useMutation({
    // ...
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/publishing-targets", { workspaceId: activeWorkspaceId }]  // ❌ undefined!
      });
    }
  });
}
```

---

## ✅ Solution Applied

### 1. Added `workspaceId` prop to TargetCard

**File**: `client/src/pages/publishing.tsx:109`

```typescript
function TargetCard({ 
  target, 
  onEdit, 
  workspaceId  // ✅ NEW!
}: { 
  target: PublishingTarget; 
  onEdit: () => void; 
  workspaceId: string;  // ✅ NEW!
}) {
```

### 2. Updated mutations to use `workspaceId` prop

**Rotate Secret Mutation** (line 245):
```typescript
queryClient.invalidateQueries({ 
  queryKey: ["/api/publishing-targets", { workspaceId }]  // ✅ Fixed!
});
```

**Health Check Mutation** (lines 265, 277):
```typescript
// onSuccess
queryClient.invalidateQueries({ 
  queryKey: ["/api/publishing-targets", { workspaceId }]  // ✅ Fixed!
});

// onError
queryClient.invalidateQueries({ 
  queryKey: ["/api/publishing-targets", { workspaceId }]  // ✅ Fixed!
});
```

### 3. Passed `workspaceId` from Publishing component

**File**: `client/src/pages/publishing.tsx:1185-1190`

```typescript
<TargetCard 
  key={target.id} 
  target={target} 
  onEdit={() => handleEdit(target)}
  workspaceId={activeWorkspaceId!}  // ✅ NEW!
/>
```

---

## 🎯 Files Modified

- ✅ `client/src/pages/publishing.tsx` (4 changes)
  - Line 109: Added `workspaceId` parameter to TargetCard
  - Line 245: Fixed rotateSecretMutation onSuccess
  - Line 265: Fixed healthCheckMutation onSuccess
  - Line 277: Fixed healthCheckMutation onError
  - Line 1189: Passed workspaceId prop to TargetCard

---

## 🧪 Testing

After the fix:

1. ✅ Navigate to Publishing page
2. ✅ Click "Generate New Secret" on any target
3. ✅ Secret should generate successfully
4. ✅ Toast notification: "Secret rotated - Copy the new secret now!"
5. ✅ Secret displayed in modal/alert

---

## 📊 Impact

- **Before**: Secret generation always failed with "activeWorkspaceId is not defined"
- **After**: Secret generation works correctly, UI updates properly

---

**Status**: ✅ **FIXED** - Ready for testing!
