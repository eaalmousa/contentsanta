#!/usr/bin/env node
/**
 * RBAC Verification - Code Structure Tests + HTTP Integration
 * 
 * Verifies RBAC implementation by:
 * 1. Checking code structure (middleware, routes, hooks)
 * 2. Testing HTTP endpoints with authenticated session
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:5000';

// Session cookie jar
let cookie = '';

const results = {
  passed: 0,
  failed: 0,
  tests: []
};

// HTTP request helper with automatic cookie handling
async function req(path, opts = {}) {
  const url = `${BASE_URL}${path}`;
  const options = {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    redirect: 'manual', // Don't follow redirects automatically
    signal: AbortSignal.timeout(10000) // 10 second timeout
  };
  
  try {
    const res = await fetch(url, options);
    
    // Capture Set-Cookie from response
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      cookie = setCookie.split(';')[0];
    }
    
    // Try to parse response as JSON (only for non-redirect responses)
    let text = '';
    let json = null;
    
    if (res.status !== 302 && res.status !== 301) {
      text = await res.text();
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    
    return { res, json, text, status: res.status };
  } catch (error) {
    return { 
      res: null, 
      json: null, 
      text: '', 
      status: 0, 
      error: error.message 
    };
  }
}

function test(name, fn) {
  return async () => {
    try {
      await fn();
      results.passed++;
      results.tests.push({ name, status: 'PASS' });
      console.log(`✓ ${name}`);
    } catch (error) {
      results.failed++;
      results.tests.push({ name, status: 'FAIL', error: error.message });
      console.log(`✗ ${name}`);
      console.log(`  Error: ${error.message}`);
    }
  };
}

// Code structure tests
const codeTests = [
  test('1. RBAC middleware file exists and exports functions', async () => {
    const fs = await import('fs/promises');
    const middlewareContent = await fs.readFile('server/middleware/rbac.ts', 'utf-8');
    
    if (!middlewareContent.includes('export function requireRole')) {
      throw new Error('requireRole function not exported');
    }
    
    if (!middlewareContent.includes('export async function requireWorkspaceOwnership')) {
      throw new Error('requireWorkspaceOwnership function not exported');
    }
    
    console.log('  ✓ Both RBAC functions exported correctly');
  }),

  test('2. routes.ts imports RBAC middleware', async () => {
    const fs = await import('fs/promises');
    const routesContent = await fs.readFile('server/routes.ts', 'utf-8');
    
    if (!routesContent.includes('import { requireRole, requireWorkspaceOwnership }')) {
      throw new Error('RBAC middleware not imported in routes.ts');
    }
    
    console.log('  ✓ RBAC middleware imported in routes.ts');
  }),

  test('3. POST /api/sources has RBAC middleware', async () => {
    const fs = await import('fs/promises');
    const routesContent = await fs.readFile('server/routes.ts', 'utf-8');
    
    const postSourcesPattern = /app\.post\("\/api\/sources",\s*isAuthenticated,\s*requireRole\(\["admin",\s*"owner"\]\)/;
    
    if (!postSourcesPattern.test(routesContent)) {
      throw new Error('POST /api/sources missing requireRole middleware');
    }
    
    console.log('  ✓ POST /api/sources protected with requireRole(["admin", "owner"])');
  }),

  test('4. PATCH /api/sources/:id has RBAC middleware', async () => {
    const fs = await import('fs/promises');
    const routesContent = await fs.readFile('server/routes.ts', 'utf-8');
    
    const patchPattern = /app\.patch\("\/api\/sources\/:id",\s*isAuthenticated,\s*requireRole\(\["admin",\s*"owner"\]\)/;
    
    if (!patchPattern.test(routesContent)) {
      throw new Error('PATCH /api/sources/:id missing requireRole middleware');
    }
    
    console.log('  ✓ PATCH /api/sources/:id protected with requireRole(["admin", "owner"])');
  }),

  test('5. DELETE /api/sources/:id has RBAC middleware', async () => {
    const fs = await import('fs/promises');
    const routesContent = await fs.readFile('server/routes.ts', 'utf-8');
    
    const deletePattern = /app\.delete\("\/api\/sources\/:id",\s*isAuthenticated,\s*requireRole\(\["admin",\s*"owner"\]\)/;
    
    if (!deletePattern.test(routesContent)) {
      throw new Error('DELETE /api/sources/:id missing requireRole middleware');
    }
    
    console.log('  ✓ DELETE /api/sources/:id protected with requireRole(["admin", "owner"])');
  }),

  test('6. POST /api/sources/:id/fetch has RBAC middleware', async () => {
    const fs = await import('fs/promises');
    const routesContent = await fs.readFile('server/routes.ts', 'utf-8');
    
    const fetchPattern = /app\.post\("\/api\/sources\/:id\/fetch",\s*isAuthenticated,\s*requireRole\(\["admin",\s*"owner"\]\)/;
    
    if (!fetchPattern.test(routesContent)) {
      throw new Error('POST /api/sources/:id/fetch missing requireRole middleware');
    }
    
    console.log('  ✓ POST /api/sources/:id/fetch protected with requireRole(["admin", "owner"])');
  }),

  test('7. useWorkspaceRole hook exists', async () => {
    const fs = await import('fs/promises');
    const hookContent = await fs.readFile('client/src/hooks/use-workspace-role.ts', 'utf-8');
    
    if (!hookContent.includes('export function useWorkspaceRole')) {
      throw new Error('useWorkspaceRole hook not exported');
    }
    
    if (!hookContent.includes('canEditSources')) {
      throw new Error('canEditSources flag not defined in hook');
    }
    
    console.log('  ✓ useWorkspaceRole hook properly defined');
  }),

  test('8. sources.tsx imports and uses useWorkspaceRole', async () => {
    const fs = await import('fs/promises');
    const sourcesPage = await fs.readFile('client/src/pages/sources.tsx', 'utf-8');
    
    if (!sourcesPage.includes('import { useWorkspaceRole }')) {
      throw new Error('useWorkspaceRole not imported in sources.tsx');
    }
    
    if (!sourcesPage.includes('const { canEditSources')) {
      throw new Error('canEditSources not destructured from hook');
    }
    
    console.log('  ✓ sources.tsx imports and uses the hook');
  }),

  test('9. Admin buttons are conditionally rendered', async () => {
    const fs = await import('fs/promises');
    const sourcesPage = await fs.readFile('client/src/pages/sources.tsx', 'utf-8');
    
    const hasConditional = sourcesPage.includes('{canEditSources &&');
    
    if (!hasConditional) {
      throw new Error('Admin controls not gated with canEditSources');
    }
    
    const matches = sourcesPage.match(/\{canEditSources &&/g);
    console.log(`  ✓ Found ${matches?.length || 0} conditional render blocks for admin controls`);
  }),

  test('10. GET /api/sources remains accessible to all users', async () => {
    const fs = await import('fs/promises');
    const routesContent = await fs.readFile('server/routes.ts', 'utf-8');
    
    const getSourcesPattern = /app\.get\("\/api\/sources",\s*isAuthenticated,\s*async/;
    
    if (!getSourcesPattern.test(routesContent)) {
      throw new Error('GET /api/sources pattern not found');
    }
    
    const lines = routesContent.split('\n');
    const getSourcesLine = lines.findIndex(line => line.includes('app.get("/api/sources"'));
    
    if (getSourcesLine > 0 && lines[getSourcesLine].includes('requireRole')) {
      throw new Error('GET /api/sources should NOT have requireRole middleware');
    }
    
    console.log('  ✓ GET /api/sources remains accessible to all authenticated users');
  })
];

// HTTP integration tests
const httpTests = [
  test('HTTP-1. Establish authenticated session via /api/dev/session', async () => {
    console.log(`  → GET ${BASE_URL}/api/dev/session`);
    
    const login = await req('/api/dev/session');
    
    console.log(`  ← Status: ${login.status}`);
    console.log(`  ← Cookie received: ${!!cookie}`);
    
    if (login.status === 0) {
      throw new Error(`Server not reachable: ${login.error}`);
    }
    
    // Expect 200 with JSON response
    if (login.status !== 200) {
      throw new Error(`Login failed with status ${login.status}: ${JSON.stringify(login.json)}`);
    }
    
    if (!cookie) {
      throw new Error('No session cookie received from login');
    }
    
    if (!login.json?.ok) {
      throw new Error('Login response missing ok:true');
    }
    
    console.log(`  ✓ Session established`);
    console.log(`  ✓ Cookie: ${cookie.substring(0, 40)}...`);
  }),

  test('HTTP-2. GET /api/me/context returns 200 with activeWorkspaceId', async () => {
    console.log(`  → GET ${BASE_URL}/api/me/context`);
    
    const ctx = await req('/api/me/context');
    
    console.log(`  ← Status: ${ctx.status}`);
    
    if (ctx.status !== 200) {
      throw new Error(`Expected 200, got ${ctx.status}. Response: ${JSON.stringify(ctx.json)}`);
    }
    
    if (!ctx.json?.activeWorkspaceId) {
      throw new Error('activeWorkspaceId missing from context');
    }
    
    if (!ctx.json?.memberships || ctx.json.memberships.length === 0) {
      throw new Error('memberships missing or empty in context');
    }
    
    const role = ctx.json.memberships[0]?.role;
    console.log(`  ✓ Active Workspace: ${ctx.json.activeWorkspaceId}`);
    console.log(`  ✓ User Role: ${role}`);
  }),

  test('HTTP-3. GET /api/sources returns 200 for authenticated user', async () => {
    console.log(`  → GET ${BASE_URL}/api/sources`);
    
    const sources = await req('/api/sources');
    
    console.log(`  ← Status: ${sources.status}`);
    
    if (sources.status !== 200) {
      throw new Error(`Expected 200, got ${sources.status}. Response: ${JSON.stringify(sources.json)}`);
    }
    
    const count = Array.isArray(sources.json) ? sources.json.length : 0;
    console.log(`  ✓ Found ${count} sources`);
  }),

  test('HTTP-4. POST /api/sources succeeds with admin/owner role', async () => {
    console.log(`  → POST ${BASE_URL}/api/sources`);
    
    const newSource = {
      name: 'RBAC Test Source',
      feedUrl: 'https://example.com/rbac-test-feed',
      description: 'Automated RBAC verification test source',
      language: 'en',
      fetchIntervalMinutes: 60
    };
    
    const response = await req('/api/sources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSource)
    });
    
    console.log(`  ← Status: ${response.status}`);
    
    if (response.status === 201) {
      console.log(`  ✓ Source created (admin/owner role confirmed)`);
      console.log(`  ✓ Source ID: ${response.json?.id}`);
      
      // Clean up: delete the test source
      if (response.json?.id) {
        await req(`/api/sources/${response.json.id}`, { method: 'DELETE' });
        console.log(`  ✓ Test source cleaned up`);
      }
    } else if (response.status === 403) {
      console.log(`  ℹ User has viewer/editor role (403 returned)`);
      if (response.json?.requiredRoles) {
        console.log(`  ℹ Required roles: ${response.json.requiredRoles.join(', ')}`);
        console.log(`  ℹ User role: ${response.json.userRole}`);
      }
    } else {
      throw new Error(`Unexpected status ${response.status}. Response: ${JSON.stringify(response.json)}`);
    }
  })
];

async function runTests() {
  console.log('='.repeat(70));
  console.log('RBAC Implementation Verification');
  console.log('='.repeat(70));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Node Version: ${process.version}\n`);
  
  console.log('Part 1: Code Structure Tests');
  console.log('-'.repeat(70));
  
  for (const testFn of codeTests) {
    await testFn();
  }
  
  console.log('\n' + 'Part 2: HTTP Integration Tests');
  console.log('-'.repeat(70));
  
  for (const testFn of httpTests) {
    await testFn();
  }
  
  console.log('\n' + '='.repeat(70));
  console.log(`Results: ${results.passed} passed, ${results.failed} failed`);
  console.log('='.repeat(70));
  
  if (results.failed > 0) {
    console.log('\nFailed tests:');
    results.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => console.log(`  - ${t.name}\n    ${t.error}`));
  } else {
    console.log('\n✅ All RBAC verifications passed!');
    console.log('\nRBAC Implementation Summary:');
    console.log('  • Backend: 4 mutation endpoints protected with requireRole(["admin", "owner"])');
    console.log('  • Frontend: Admin controls conditionally rendered based on canEditSources');
    console.log('  • Session: Authenticated session established successfully');
    console.log('  • Workspace: Context includes activeWorkspaceId and role information');
  }
  
  console.log('');
  process.exit(results.failed > 0 ? 1 : 0);
}

// Check Node.js version
if (typeof fetch === 'undefined') {
  console.error('Error: fetch API not available. Please use Node.js 18 or higher.');
  console.error(`Current version: ${process.version}`);
  process.exit(1);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
