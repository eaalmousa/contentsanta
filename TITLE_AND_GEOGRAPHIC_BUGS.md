# Critical Bug Fixes Required

## Issue 1: Title Suffix Not Being Sanitized Before Publishing

**Root Cause**: Publishing worker uses raw `generatedTitle` without sanitization.

**Location**: `server/services/publishing-worker-service.ts:269`

```typescript
// ❌ CURRENT CODE (WRONG):
title: row.generated_title || 'Untitled',
```

**Problem**: The `ContentSanitizer.cleanTitle()` exists and works correctly, but publishing worker bypasses it entirely by using raw database fields.

**Fix Required**:
```typescript
// ✅ CORRECT CODE:
import { contentSanitizer } from './content-sanitizer';

// In createWpPullJob call:
title: contentSanitizer.cleanTitle(row.generated_title || 'Untitled'),
```

**Verification**: "What are service charges in Dubai? Everything new property buyers need to know - Gulf News - Seo Blog" should become "What are service charges in Dubai? Everything new property buyers need to know"

---

## Issue 2: Geographic Filtering Not Working

**Symptoms**: India articles appearing in GCC-only topic

**Root Cause**: Need to verify discovery/matching service respects topic region/country filters

**Investigation Needed**:
1. Check `server/services/discovery-service.ts` or equivalent
2. Verify sources are filtered by `region='gcc'` and `country IN ('AE','SA','KW','QA','BH','OM')`
3. Check topic's `sourceMode` - if `all`, it might be including all approved sources regardless of region

**Fix Strategy**:
- Add strict geographic filtering in source selection
- Reject items if source.country doesn't match topic.region/countries
- Add quarantine reason: `geographic_mismatch`

---

## Immediate Actions

### 1. Fix Title Sanitization (Quick Win)
Add one import and one function call in publishing worker.

### 2. Add Geographic Validation
Before creating WP job, verify source country matches topic region.

### 3. Apply Both Fixes Retroactively
- Clean existing pipeline_items titles
- Quarantine items from wrong regions
- Re-generate clean titles for scheduled items

---

## Files to Modify

1. **`server/services/publishing-worker-service.ts`** - Add sanitization
2. **`server/services/discovery-service.ts`** (or matching service) - Add geographic filter
3. **Migration script** - Clean existing data

